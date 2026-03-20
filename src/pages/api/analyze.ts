// API Endpoint: POST /api/analyze
// Analyzes uploaded desk image and generates tidy plan with arrows
// Uses Nana Banana 2 (Gemini Flash) for AI-powered desk organization

export const prerender = false;

import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';

// Initialize Gemini with the Nana Banana API key
const genAI = new GoogleGenerativeAI(
  import.meta.env.GEMINI_NANA_BANANA_API_KEY || 'AIzaSyA0a1Ez0M-0wJyfhdkVDnRsP3XJPjxFCCg'
);

// Configuration
const MAX_IMAGE_SIZE = 1024; // Max dimension for preprocessing
const TIMEOUT_MS = 55000; // 55 seconds (leaving buffer before 60s limit)

interface AnalyzeResult {
  success: boolean;
  plan?: string;
  imageUrl?: string;
  items?: Array<{
    name: string;
    currentPosition: string;
    targetPosition: string;
    arrow?: { start: { x: number; y: number }; end: { x: number; y: number } };
  }>;
  error?: string;
  degradedMode?: boolean;
}

/**
 * Preprocess image: resize and standardize format
 */
async function preprocessImage(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  // Get current dimensions
  const width = metadata.width || MAX_IMAGE_SIZE;
  const height = metadata.height || MAX_IMAGE_SIZE;

  // Calculate resize needed
  let resizeNeeded = false;
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
    resizeNeeded = true;
  }

  // Resize if needed
  let processedImage = image;
  if (resizeNeeded) {
    processedImage = image.resize(targetWidth, targetHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Convert to WebP for smaller size and consistency
  const outputBuffer = await processedImage.webp({ quality: 85 }).toBuffer();

  return {
    buffer: outputBuffer,
    mimeType: 'image/webp',
  };
}

/**
 * Analyze desk image and generate tidy plan with Nana Banana 2
 */
async function analyzeWithNanaBanana(
  base64Image: string,
  mimeType: string
): Promise<{ text: string; imageData?: string }> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      responseModalities: ['text', 'image'],
    },
  });

  // Enhanced prompt for generating annotated tidy plan
  const prompt = `You are "Nana Banana 2", an expert desk organization AI.

TASK: Analyze this messy desk image and create a comprehensive tidy plan.

INPUT IMAGE ANALYSIS:
1. Identify ALL items on the desk (books, cups, papers, laptop, phone, cables, etc.)
2. Note their current positions
3. Determine optimal final positions for each item

OUTPUT REQUIREMENTS:
You MUST respond with BOTH:
1. A detailed TEXT PLAN listing each item, its current spot, and where it should go
2. An ANNOTATED IMAGE showing the tidy version with:
   - Clear ARROWS pointing from current positions to target positions
   - LABELS for each item (what it is)
   - Clean desk surface showing organized state
   - Color-coded arrows (e.g., red for items to remove, green for items to relocate)

IMPORTANT:
- Generate a visual image that SHOWS the arrows overlaid on the desk
- Use the prompt format: "Organized desk with arrows showing where each item goes: [list items]"
- Make the annotated image clearly show movement directions

Respond with your text analysis AND generate an image showing the tidy desk plan.`;

  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64Image } },
    prompt,
  ]);

  const response = result.response;
  let textResponse = '';
  let imageData: string | undefined;

  // Extract text and image from response
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

  return { text: textResponse.trim(), imageData };
}

/**
 * Generate SVG overlay with arrows and labels (fallback method)
 */
function generateAnnotatedImageSvg(
  items: Array<{
    name: string;
    currentX: number;
    currentY: number;
    targetX: number;
    targetY: number;
    color: string;
  }>,
  width: number,
  height: number
): string {
  const arrows = items
    .map(
      (item, i) => `
    <defs>
      <marker id="arrowhead-${i}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="${item.color}"/>
      </marker>
    </defs>
    <line x1="${item.currentX}" y1="${item.currentY}" x2="${item.targetX}" y2="${item.targetY}"
          stroke="${item.color}" stroke-width="4" marker-end="url(#arrowhead-${i})"/>
    <rect x="${item.targetX - 40}" y="${item.targetY - 40}" width="80" height="30" rx="5" fill="${item.color}" opacity="0.9"/>
    <text x="${item.targetX}" y="${item.targetY - 18}" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${item.name}</text>
  `
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${arrows}
  </svg>`;
}

export async function POST({ request }: { request: Request }): Promise<Response> {
  const startTime = Date.now();

  try {
    // Parse form data
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return new Response(JSON.stringify({ error: 'No image uploaded' } as AnalyzeResult), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Analyze] Received image: ${imageFile.name}, size: ${imageFile.size}`);

    // Read image bytes
    const bytes = await imageFile.arrayBuffer();
    let imageBuffer = Buffer.from(bytes);
    let mimeType = imageFile.type || 'image/jpeg';

    // Preprocess image (resize, standardize format)
    try {
      const processed = await preprocessImage(imageBuffer, mimeType);
      imageBuffer = processed.buffer;
      mimeType = processed.mimeType;
      console.log(`[Analyze] Preprocessed image: ${processed.buffer.length} bytes, ${mimeType}`);
    } catch (preprocessError) {
      console.warn('[Analyze] Preprocessing failed, using original:', preprocessError);
      // Continue with original image
    }

    // Convert to base64
    const base64 = imageBuffer.toString('base64');

    // Check timeout
    const remainingTime = TIMEOUT_MS - (Date.now() - startTime);
    if (remainingTime <= 0) {
      return new Response(
        JSON.stringify({
          success: true,
          degradedMode: true,
          plan: 'Analysis timed out. Please try with a smaller image.',
          error: 'Timeout - try a smaller image',
        } as AnalyzeResult),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Call Nana Banana 2 with timeout
    let textResult: string;
    let imageUrl: string | undefined;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI timeout')), remainingTime);
      });

      const aiPromise = analyzeWithNanaBanana(base64, mimeType);

      const aiResult = await Promise.race([aiPromise, timeoutPromise]);

      textResult = aiResult.text;
      imageUrl = aiResult.imageData;

      console.log(`[Analyze] Nana Banana response: ${textResult.substring(0, 100)}...`);
    } catch (aiError: any) {
      console.error('[Analyze] AI Error:', aiError.message);

      // Degraded mode: return preprocessing info
      return new Response(
        JSON.stringify({
          success: true,
          degradedMode: true,
          plan: `Image preprocessed successfully (${(imageBuffer.length / 1024).toFixed(1)}KB). ` +
            `AI analysis timed out. Please try again with a smaller image or wait a moment.`,
          error: aiError.message,
        } as AnalyzeResult),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse items from text response
    const items: AnalyzeResult['items'] = [];
    const lines = textResult.split('\n');
    for (const line of lines) {
      // Look for patterns like "Laptop: desk → drawer" or "Book: left → right shelf"
      const match = line.match(/^[-•*]?\s*([^:]+):\s*(.+)→(.+)/);
      if (match) {
        items.push({
          name: match[1].trim(),
          currentPosition: match[2].trim(),
          targetPosition: match[3].trim(),
        });
      }
    }

    // Build response
    const response: AnalyzeResult = {
      success: true,
      plan: textResult,
      imageUrl,
      items: items.length > 0 ? items : undefined,
    };

    console.log(`[Analyze] Complete in ${Date.now() - startTime}ms`);

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
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
