// API Endpoint: POST /api/analyze
// Analyzes uploaded desk image and generates tidy plan with arrows
// Uses Gemini 3.1 Flash Image Preview for image-to-image generation

export const prerender = false;

import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';

// Initialize Gemini with the Nana Banana API key
// Key in .env.local: GEMINI_NANA_BANANA_API_KEY or Gemini_NANA_Banana_API_KEY
const genAI = new GoogleGenerativeAI(
  import.meta.env.GEMINI_NANA_BANANA_API_KEY
  || import.meta.env.Gemini_NANA_Banana_API_KEY
  || ''
);

// Configuration
const MAX_IMAGE_SIZE = 1024; // Max dimension for preprocessing
const TIMEOUT_MS = 45000;     // 45 seconds — leaves 15s buffer before 60s Vercel limit

// Rate limiting: in-memory sliding window per IP (serverless-safe for MVP)
// For production with Vercel KV: each cold-start resets, so this is best-effort protection
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;         // requests per window
const RATE_WINDOW_MS = 60_000; // 1 minute window

function getClientIP(request: Request): string {
  // Vercel provides real IP in these headers
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') || // Cloudflare
    'unknown'
  );
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT - entry.count };
}

// Periodic cleanup of expired rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt + RATE_WINDOW_MS) rateLimitMap.delete(ip);
  }
}, 60_000);

// Response types
interface TidyItem {
  name: string;
  currentPosition: string;
  targetPosition: string;
  action: 'relocate' | 'remove' | 'reorganize';
}

interface AnalyzeResult {
  success: boolean;
  plan?: string;
  imageUrl?: string;
  items?: TidyItem[];
  degradedMode?: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Image preprocessing
// ---------------------------------------------------------------------------

async function preprocessImage(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  const width = metadata.width || MAX_IMAGE_SIZE;
  const height = metadata.height || MAX_IMAGE_SIZE;

  let targetWidth = width;
  let targetHeight = height;

  if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
    if (width > height) {
      targetWidth = MAX_IMAGE_SIZE;
      targetHeight = Math.round((height / width) * MAX_IMAGE_SIZE);
    } else {
      targetHeight = MAX_IMAGE_SIZE;
      targetWidth = Math.round((width / height) * MAX_IMAGE_SIZE);
    }
  }

  const processedImage = image.resize(targetWidth, targetHeight, {
    fit: 'inside',
    withoutEnlargement: true,
  });

  const outputBuffer = await processedImage.webp({ quality: 85 }).toBuffer();
  return { buffer: outputBuffer, mimeType: 'image/webp' };
}

// ---------------------------------------------------------------------------
// Nana Banana 2 — AI Analysis & Image Generation
// ---------------------------------------------------------------------------

async function analyzeWithNanaBanana(
  base64Image: string,
  mimeType: string,
  timeoutMs: number
): Promise<{ text: string; imageData?: string }> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-image-preview',
  });

  // Phase 1: Analyze the desk and plan (fast, text-only)
  const analysisPrompt = `You are "Nana Banana 2", a friendly desk organization expert.

TASK: Analyze this messy desk image and create a tidy plan.

ANALYZE:
1. List every item on the desk (books, cups, papers, laptop, phone, cables, notebooks, etc.)
2. Note where each item currently sits
3. Determine where each item should go for a clean, organized desk

RESPOND with this EXACT JSON format (no extra text, valid JSON only):
{
  "items": [
    {
      "name": "item name",
      "currentPosition": "where it is now",
      "targetPosition": "where it should go",
      "action": "relocate"
    }
  ],
  "summary": "2-3 sentence summary of the overall tidy strategy"
}

Action values: "relocate" (move to new spot), "remove" (put away/throw away), "reorganize" (rearrange on desk)`;

  // Phase 2: Generate annotated image (with arrows and labels)
  // Detailed visual spec for high-contrast, readable overlays on ANY desk background
  const imagePrompt = `You are "Nana Banana 2", a desk organization expert.

Look at this messy desk photo and create an annotated image showing EXACTLY how to tidy it.

VISUAL OVERLAY SPECIFICATION (MUST FOLLOW EXACTLY):

ARROW COLORS:
- 🟢 GREEN #10B981 = items to relocate/reorganize (keep on desk but move)
- 🔴 RED #EF4444 = items to remove/put away (discard or store elsewhere)
- Add a small legend in the top-left corner: "🟢 Move | 🔴 Remove"

ARROW STYLE (CRITICAL for visibility - SIMPLE and CLEAN):
- Stroke width: 12px (thicker for clarity)
- ALL arrows MUST have a 4-5px WHITE outer stroke (#FFFFFF) — non-negotiable
- Add drop shadow: 3px offset-y, 4px blur, #000000 at 40% opacity
- Arrow heads: filled triangles, 4x the stroke width
- SIMPLE curved paths, no complex curves
- lineCap and lineJoin: round
- Maximum 5 arrows total — ONLY show the 5 MOST IMPORTANT items (prevent visual clutter)

LABEL PILLS (SIMPLE):
- Background: #FFFFFF (pure white)
- Border-radius: 6px
- Text color: #1C1917 (dark)
- Font: bold sans-serif, 12px
- Shadow: 0 2px 6px rgba(0,0,0,0.2)
- Position: near the item, ABOVE or BELOW arrows
- VERY SHORT text: "→Trash", "→Shelf", "→Drawer" (max 2 words)

DESTINATION MARKERS (CLEAN):
- Place bright ORANGE #F97316 circles at arrow endpoints
- 16px diameter with 2px white border
- Simple shadow only

LAYOUT RULES:
- Keep the original desk photo clearly visible underneath
- Do NOT cover items with arrows
- Maintain photo realism — overlays should look native to the image
- Arrows must NOT overlap each other

Return the annotated image showing the tidy plan with clearly visible colored arrows, white-outlined for contrast on any desk surface.`;

  // Use generateContent with both text instructions
  // Note: gemini-3.1-flash-image-preview supports image generation via generateContent
  // with inline image parts in the response
  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64Image } },
    analysisPrompt,
  ]);

  const response = result.response;
  let textResponse = '';
  let imageData: string | undefined;

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        textResponse += part.text + '\n';
      }
      if (part.inlineData) {
        imageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  }

  // If no image came back, try a second call specifically for image generation
  if (!imageData) {
    try {
      const imageModel = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-image-preview',
      });

      // Second call: generate annotated image using the original as reference
      const imageResult = await imageModel.generateContent([
        { inlineData: { mimeType, data: base64Image } },
        imagePrompt,
      ]);

      if (imageResult.response.candidates?.[0]?.content?.parts) {
        for (const part of imageResult.response.candidates[0].content.parts) {
          if (part.inlineData) {
            imageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            break;
          }
        }
      }
    } catch (imgError) {
      console.warn('[Analyze] Image generation call failed:', imgError);
      // Continue without image — text-only fallback is acceptable
    }
  }

  return { text: textResponse.trim(), imageData };
}

// ---------------------------------------------------------------------------
// Parse structured items from AI response
// ---------------------------------------------------------------------------

function parseItems(textResponse: string): TidyItem[] {
  const items: TidyItem[] = [];

  // Try JSON parsing first (preferred)
  const jsonMatch = textResponse.match(/\{[\s\S]*"items"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.items)) {
        for (const item of parsed.items) {
          if (item.name && item.currentPosition && item.targetPosition) {
            items.push({
              name: item.name,
              currentPosition: item.currentPosition,
              targetPosition: item.targetPosition,
              action: item.action || 'relocate',
            });
          }
        }
      }
    } catch {
      // JSON parse failed, fall back to regex
    }
  }

  // Fallback: regex parsing for non-JSON text responses
  if (items.length === 0) {
    const lines = textResponse.split('\n');
    for (const line of lines) {
      const match = line.match(/^[-•*]?\s*([^:]+):\s*(.+)[\s\-–→]+\s*(.+)/);
      if (match) {
        const name = match[1].trim();
        const current = match[2].trim();
        const target = match[3].trim();
        const action: TidyItem['action'] = current.includes('remove') || current.includes('throw')
          ? 'remove'
          : 'reorganize';

        items.push({
          name,
          currentPosition: current,
          targetPosition: target,
          action,
        });
      }
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST({ request }: { request: Request }): Promise<Response> {
  const startTime = Date.now();
  const clientIP = getClientIP(request);

  // Rate limiting check
  const rateCheck = checkRateLimit(clientIP);
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too many requests. Please wait a moment before trying again.',
        retryAfter: rateCheck.retryAfter,
      } as AnalyzeResult),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateCheck.retryAfter || 60),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return new Response(JSON.stringify({ error: 'No image uploaded' } as AnalyzeResult), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const mimeType = imageFile.type || 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
      return new Response(JSON.stringify({ error: 'Please upload an image file (JPG, PNG, or WEBP)' } as AnalyzeResult), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (imageFile.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File must be under 10MB' } as AnalyzeResult), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Analyze] Received: ${imageFile.name}, ${(imageFile.size / 1024).toFixed(1)}KB`);

    // Read and preprocess image
    const bytes = await imageFile.arrayBuffer();
    let imageBuffer = Buffer.from(bytes);

    try {
      const processed = await preprocessImage(imageBuffer, mimeType);
      imageBuffer = processed.buffer;
      console.log(`[Analyze] Preprocessed: ${(processed.buffer.length / 1024).toFixed(1)}KB, ${processed.mimeType}`);
    } catch (preprocessError) {
      console.warn('[Analyze] Preprocessing failed, using original:', preprocessError);
    }

    const base64 = imageBuffer.toString('base64');
    const remainingTime = TIMEOUT_MS - (Date.now() - startTime);

    // Check timeout before even starting AI call
    if (remainingTime <= 0) {
      return new Response(
        JSON.stringify({
          success: true,
          degradedMode: true,
          plan: 'Processing timed out. Please try with a smaller image or wait a moment.',
          error: 'Timeout — try a smaller image',
        } as AnalyzeResult),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Tier 1: Full AI analysis + image generation with timeout
    let textResult = '';
    let imageUrl: string | undefined;
    let degradedMode = false;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI timeout')), Math.min(remainingTime, TIMEOUT_MS));
      });

      const aiPromise = analyzeWithNanaBanana(base64, mimeType, remainingTime);
      const aiResult = await Promise.race([aiPromise, timeoutPromise]);

      textResult = aiResult.text;
      imageUrl = aiResult.imageData;

      console.log(`[Analyze] AI response: ${textResult.substring(0, 100)}... (image: ${!!imageUrl})`);

    } catch (aiError: any) {
      console.error('[Analyze] AI error:', aiError.message);
      degradedMode = true;

      // Tier 2: If we got a partial text response, use it
      if (textResult) {
        // Partial success — we have text, no image
        degradedMode = true;
      } else {
        // Tier 3: Complete failure — no text, no image
        const sizeKb = (imageBuffer.length / 1024).toFixed(1);
        return new Response(
          JSON.stringify({
            success: true,
            degradedMode: true,
            plan: `Image preprocessed successfully (${sizeKb}KB). ` +
              `AI analysis timed out. Please try again with a smaller image or wait a moment.`,
            error: aiError.message,
          } as AnalyzeResult),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Parse structured items
    const items = parseItems(textResult);

    const response: AnalyzeResult = {
      success: true,
      plan: textResult,
      imageUrl,
      items: items.length > 0 ? items : undefined,
      degradedMode,
    };

    console.log(`[Analyze] Complete in ${Date.now() - startTime}ms (degraded: ${degradedMode})`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[Analyze] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Analysis failed',
      } as AnalyzeResult),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
