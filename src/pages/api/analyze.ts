// API Endpoint: POST /api/analyze
// 3-Step AI Pipeline:
//   Step 1: Gemini Vision analysis → items JSON
//   Step 2: Gemini generates clean desk photo
//   Step 3: Gemini adds labels to the clean photo
// Uses Gemini 3.1 Flash Image Preview for image generation

export const prerender = false;

import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';

// Initialize Gemini with the Nana Banana API key
const genAI = new GoogleGenerativeAI(
  import.meta.env.GEMINI_NANA_BANANA_API_KEY
  || import.meta.env.Gemini_NANA_Banana_API_KEY
  || ''
);

// Configuration
const MAX_IMAGE_SIZE = 1024; // Max dimension for preprocessing
const TIMEOUT_MS = 45000;     // 45 seconds — leaves 15s buffer before 60s Vercel limit
const STEP1_TIMEOUT_MS = 12000; // 12s max for analysis
const STEP2_TIMEOUT_MS = 18000; // 18s max for clean desk generation
const STEP3_TIMEOUT_MS = 12000; // 12s max for labeling

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function getClientIP(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
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

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt + RATE_WINDOW_MS) rateLimitMap.delete(ip);
  }
}, 60_000);

// Types
interface TidyItem {
  id: string;
  name: string;
  currentPosition: string;
  targetPosition: string;
  action: 'relocate' | 'remove' | 'reorganize';
}

interface AnalyzeResult {
  success: boolean;
  plan?: string;
  items?: TidyItem[];
  tidyVisionUrl?: string;   // Step 2: clean desk photo
  labelsImageUrl?: string; // Step 3: labeled clean desk
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
// Step 1: Analyze desk items (Vision, text-only, fast)
// ---------------------------------------------------------------------------

async function step1Analyze(
  base64Image: string,
  mimeType: string,
  timeoutMs: number
): Promise<{ items: TidyItem[]; summary: string }> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-image-preview',
  });

  const prompt = `You are "Nana Banana 2", a friendly desk organization expert.

TASK: Analyze this messy desk image and create a detailed inventory.

ANALYZE:
1. Identify every distinct item on the desk (books, cups, papers, laptop, phone, cables, notebooks, pen holders, plants, chargers, etc.)
2. Note where each item currently sits (e.g., "center of desk", "left corner", "under papers")
3. Decide where each item should go for a clean, organized desk

RESPOND with ONLY valid JSON (no markdown, no explanation):
{
  "items": [
    {
      "id": "item-1",
      "name": "item name (short, clear)",
      "currentPosition": "brief description of current location",
      "targetPosition": "brief description of where it should go",
      "action": "relocate"
    }
  ],
  "summary": "2-3 sentence summary of the overall tidy strategy"
}

Action values: "relocate" (move to new spot), "remove" (put away/throw away), "reorganize" (rearrange on desk).
Keep it to 5-8 items maximum for clarity.`;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Step1 timeout')), timeoutMs)
  );

  const callPromise = model.generateContent([
    { inlineData: { mimeType, data: base64Image } },
    prompt,
  ]);

  const result = await Promise.race([callPromise, timeoutPromise]);
  const text = result.response.text().trim();

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Step1: No JSON in response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const items: TidyItem[] = (parsed.items || []).map((item: any, index: number) => ({
    id: item.id || `item-${index + 1}`,
    name: item.name || 'Unknown item',
    currentPosition: item.currentPosition || 'on desk',
    targetPosition: item.targetPosition || 'tidy spot',
    action: ['relocate', 'remove', 'reorganize'].includes(item.action)
      ? item.action
      : 'relocate',
  }));

  return { items, summary: parsed.summary || '' };
}

// ---------------------------------------------------------------------------
// Step 2: Generate clean desk photo (image generation, medium time)
// ---------------------------------------------------------------------------

async function step2GenerateCleanDesk(
  base64Image: string,
  mimeType: string,
  items: TidyItem[],
  timeoutMs: number
): Promise<string | undefined> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-image-preview',
  });

  // Build item list for the prompt
  const itemList = items
    .slice(0, 6)
    .map(item => `- ${item.name}: ${item.currentPosition} → ${item.targetPosition} (${item.action})`)
    .join('\n');

  const prompt = `You are "Nana Banana 2", a desk organization expert.

TASK: Generate a clean, organized version of this desk photo.

DESK SETUP:
The messy desk contains these items (analyze the photo to find them):
${itemList}

GENERATION RULES (MUST FOLLOW):
- SAME desk surface/background as the input photo (same desk, same lighting, same angle)
- SAME items visible, but ARRANGED neatly and tidily
- Keep the same desk surface texture and color
- Items should be placed in organized spots (shelf, drawer area, corner, etc.)
- Remove any visible clutter — the desk should look genuinely clean
- Maintain photo-realistic quality — should look like a real photo, not AI-generated art
- No arrows, no labels, no text overlays — pure clean desk image

The output should be a photo of THE SAME desk, now organized and tidy, with all original items neatly arranged.

Return the clean desk photo.`;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Step2 timeout')), timeoutMs)
  );

  const callPromise = model.generateContent([
    { inlineData: { mimeType, data: base64Image } },
    prompt,
  ]);

  const result = await Promise.race([callPromise, timeoutPromise]);

  // Extract image from response
  const parts = result.response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Step 3: Add labels to the clean desk (image-to-image, medium time)
// ---------------------------------------------------------------------------

async function step3AddLabels(
  cleanImageBase64: string,
  mimeType: string,
  items: TidyItem[],
  timeoutMs: number
): Promise<string | undefined> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-image-preview',
  });

  // Build label list
  const labelList = items
    .slice(0, 6)
    .map(item => `- ${item.name}: ${item.targetPosition}`)
    .join('\n');

  const prompt = `You are "Nana Banana 2", a desk organization expert.

TASK: Take this clean desk photo and add CLEAN, SIMPLE labels showing where each item belongs.

LABELS TO ADD:
${labelList}

VISUAL SPEC (MUST FOLLOW EXACTLY):
- NO arrows — use clean numbered circles or minimal badge labels instead
- Number each labeled item (1, 2, 3...) matching the list above
- Small LEGEND in the top-right corner listing the numbers and item names
- LEGEND STYLE: semi-transparent dark background (#1C1917 at 80%), white text, small font, rounded corners (4px)
- NUMBER BADGES: small circles (24px) positioned near each item, with white background, dark text, subtle shadow
- Keep the clean desk photo clearly visible — do NOT cover items with labels
- Labels should be subtle and professional, not cartoonish
- Maximum 6 labels — only the most important items
- Colors: white background badges with #1C1917 text

IMPORTANT: This is a CLEAN labeled image. The desk is already tidy. Add the labels/numbers only.

Return the labeled clean desk photo.`;

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Step3 timeout')), timeoutMs)
  );

  const callPromise = model.generateContent([
    { inlineData: { mimeType, data: cleanImageBase64 } },
    prompt,
  ]);

  const result = await Promise.race([callPromise, timeoutPromise]);

  const parts = result.response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST({ request }: { request: Request }): Promise<Response> {
  const startTime = Date.now();
  const clientIP = getClientIP(request);

  // Rate limiting
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
    // --- Parse and validate input ---
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return new Response(JSON.stringify({ error: 'No image uploaded' } as AnalyzeResult), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const mimeType = (imageFile.type || 'image/jpeg').startsWith('image/')
      ? imageFile.type
      : 'image/jpeg';

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

    // --- Preprocess image ---
    const bytes = await imageFile.arrayBuffer();
    let imageBuffer = Buffer.from(bytes);

    try {
      const processed = await preprocessImage(imageBuffer, mimeType);
      imageBuffer = processed.buffer;
      console.log(`[Analyze] Preprocessed: ${(processed.buffer.length / 1024).toFixed(1)}KB`);
    } catch (preprocessError) {
      console.warn('[Analyze] Preprocessing failed, using original:', preprocessError);
    }

    const base64 = imageBuffer.toString('base64');
    const elapsed = () => Date.now() - startTime;

    // --- Time budget calculation ---
    // Total budget: TIMEOUT_MS (45s). Each step has its own budget.
    // Remaining time after preprocessing:
    const remainingTime = TIMEOUT_MS - elapsed();

    if (remainingTime <= 5000) {
      return new Response(
        JSON.stringify({
          success: true,
          degradedMode: true,
          plan: 'Processing timed out. Please try with a smaller image.',
          error: 'Timeout',
        } as AnalyzeResult),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- Step 1: Analyze desk items ---
    let items: TidyItem[] = [];
    let summary = '';

    try {
      const step1Time = Math.min(STEP1_TIMEOUT_MS, remainingTime - 1000);
      const step1Result = await step1Analyze(base64, mimeType, step1Time);
      items = step1Result.items;
      summary = step1Result.summary;
      console.log(`[Analyze] Step1 done in ${elapsed()}ms, found ${items.length} items`);
    } catch (step1Error: any) {
      console.error('[Analyze] Step1 failed:', step1Error.message);
      return new Response(
        JSON.stringify({
          success: true,
          degradedMode: true,
          plan: `Image preprocessed. AI analysis failed (${step1Error.message}). Please try again.`,
          error: step1Error.message,
        } as AnalyzeResult),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // --- Step 2: Generate clean desk photo ---
    let tidyVisionUrl: string | undefined;

    try {
      const step2Time = Math.min(STEP2_TIMEOUT_MS, remainingTime - elapsed() - 5000);
      if (step2Time > 3000) {
        tidyVisionUrl = await step2GenerateCleanDesk(base64, mimeType, items, step2Time);
        console.log(`[Analyze] Step2 done in ${elapsed()}ms, clean image: ${!!tidyVisionUrl}`);
      } else {
        console.log('[Analyze] Skipping Step2 — insufficient time remaining');
      }
    } catch (step2Error: any) {
      console.warn('[Analyze] Step2 failed:', step2Error.message);
      // Step 2 failure is non-fatal — we still have items + summary
    }

    // --- Step 3: Add labels to clean desk ---
    let labelsImageUrl: string | undefined;

    try {
      // If Step 2 succeeded, use the clean image as input for Step 3
      const inputBase64 = tidyVisionUrl
        ? tidyVisionUrl.replace(/^data:[^;]+;base64,/, '')
        : base64;
      const inputMime = tidyVisionUrl
        ? (tidyVisionUrl.match(/^data:([^;]+)/)?.[1] || mimeType)
        : mimeType;

      const step3Time = Math.min(STEP3_TIMEOUT_MS, remainingTime - elapsed() - 2000);
      if (step3Time > 3000 && tidyVisionUrl) {
        labelsImageUrl = await step3AddLabels(inputBase64, inputMime, items, step3Time);
        console.log(`[Analyze] Step3 done in ${elapsed()}ms, labels: ${!!labelsImageUrl}`);
      } else {
        console.log('[Analyze] Skipping Step3 — insufficient time or no clean image');
      }
    } catch (step3Error: any) {
      console.warn('[Analyze] Step3 failed:', step3Error.message);
      // Step 3 failure is non-fatal — tidyVisionUrl is still available
    }

    // --- Determine degraded mode ---
    const degradedMode = !labelsImageUrl && !tidyVisionUrl;

    // --- Build response ---
    const response: AnalyzeResult = {
      success: true,
      plan: summary || undefined,
      items: items.length > 0 ? items : undefined,
      tidyVisionUrl,         // Step 2 output
      labelsImageUrl,        // Step 3 output (labeled clean desk)
      degradedMode,
    };

    console.log(`[Analyze] Complete in ${elapsed()}ms (degraded: ${degradedMode}, items: ${items.length})`);

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
