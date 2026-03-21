# TidySnap Technical Documentation

> Consolidated technical solutions, architecture decisions, and implementation details.
> Maintained by: @tech-lead | Last updated: 2026-03-22

---

## Table of Contents

1. [Gemini AI Pipeline](#1-gemini-ai-pipeline)
2. [Anti-Timeout Degradation Strategy](#2-anti-timeout-degradation-strategy)
3. [Image Processing Pipeline](#3-image-processing-pipeline)
4. [User Authentication & Persistence](#4-user-authentication--persistence)
5. [Stripe Integration](#5-stripe-integration)
6. [CSS Architecture (TailwindCDN Elimination)](#6-css-architecture-tailwindcdn-elimination)
7. [Rate Limiting](#7-rate-limiting)
8. [API Contracts](#8-api-contracts)
9. [Environment Variables](#9-environment-variables)
10. [Build & Deployment](#10-build--deployment)

---

## 1. Gemini AI Pipeline

### Model Selection

**Model**: `gemini-3.1-flash-image-preview`

**Why this model**:
- Image-to-image generation in a single API call (not separate vision + image gen models)
- Multipart input: accepts an image + text prompt simultaneously
- Returns both text analysis + generated image in one response
- Faster and cheaper than chaining two model calls

**Previous issue**: The codebase used `gemini-2.5-flash-preview-05-20`, which is a text+vision model — it can **describe** images but cannot **generate** new images with arrows. This is why the MVP lacked the annotated image output.

### API Integration

**File**: `src/pages/api/analyze.ts`

**Key implementation details**:

```typescript
const genAI = new GoogleGenerativeAI(
  import.meta.env.GEMINI_NANA_BANANA_API_KEY
  || import.meta.env.Gemini_NANA_Banana_API_KEY
  || ''
);

const model = genAI.getGenerativeModel({
  model: 'gemini-3.1-flash-image-preview',
});
```

**Two-call fallback**: If the first `generateContent` call doesn't return an image (the model may not generate inline image data on first attempt), a second call specifically for image generation is attempted. If that also fails, the system continues with text-only output — this is the graceful Tier 2 degradation.

### Prompt Engineering Strategy

**Persona**: "Nana Banana 2, a friendly desk organization expert"

**Phase 1 — Text Analysis** (JSON output):
```
Analyze this messy desk image and create a tidy plan.
Respond with EXACT JSON format:
{
  "items": [{ "name", "currentPosition", "targetPosition", "action" }],
  "summary": "..."
}
```

**Phase 2 — Image Generation** (visual spec):
```
OVERLAY ON THE ORIGINAL IMAGE:
- 🟢 GREEN #10B981 = relocate/reorganize
- 🔴 RED #EF4444 = remove/put away
- ALL arrows: 10px stroke, 3-4px WHITE outer stroke (non-negotiable)
- Drop shadow: 2px offset-y, 3px blur, #1E293B at 50% opacity
- Arrow heads: filled triangles, 3x stroke width
- Curved paths preferred, max 10 arrows
- LABEL PILLS: white background, #0F172A text, 8px radius, shadow
- DESTINATION MARKERS: ORANGE #F97316 circles, 20px diameter
- LEGEND: top-left corner "🟢 Move | 🔴 Remove"
- Keep original desk photo fully visible underneath
```

### Response Parsing

The API parses structured items from the text response:

1. **Primary**: JSON parsing — extract `items` array from the JSON block in the response
2. **Fallback**: Regex parsing — extract lines matching `item: current → target` pattern

```typescript
interface TidyItem {
  name: string;
  currentPosition: string;
  targetPosition: string;
  action: 'relocate' | 'remove' | 'reorganize';
}
```

---

## 2. Anti-Timeout Degradation Strategy

### Problem

Vercel serverless functions have a **60-second hard timeout** (Hobby plan). AI image generation can take 10-45 seconds. Without a degradation strategy, slow requests crash with opaque errors.

### 3-Tier Fallback Chain

| Tier | Name | Trigger | Response |
|------|------|---------|----------|
| 1 | Full Mode | < 45s, no errors | `plan` + `imageUrl` + `items` |
| 2 | Text-Only | 45-55s elapsed OR image gen failed | `plan` + `items` + `degradedMode: true` |
| 3 | Graceful | > 55s OR critical error | Friendly error + size info + `degradedMode: true` |

### Implementation

**Timeout buffer**: 45 seconds (not 55s or 60s) — leaves 15s for Vercel to wrap up and respond.

```typescript
const TIMEOUT_MS = 45000;
const remainingTime = TIMEOUT_MS - (Date.now() - startTime);

if (remainingTime <= 0) {
  return { degradedMode: true, plan: 'Processing timed out...' };
}

// Race AI call against timeout
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('AI timeout')), Math.min(remainingTime, TIMEOUT_MS))
);

try {
  const aiResult = await Promise.race([analyzeWithNanaBanana(...), timeoutPromise]);
} catch (aiError) {
  if (textResult) {
    // Tier 2: we got text, no image
    return { success: true, plan: textResult, degradedMode: true };
  } else {
    // Tier 3: complete failure
    return { degradedMode: true, plan: 'Try again with a smaller image...' };
  }
}
```

### Frontend Handling

The frontend reads `degradedMode` from the response:
- `false` / undefined: Show image + text plan
- `true`: Show text plan with amber "⚡ Partial Result" badge + "Try Again" button

---

## 3. Image Processing Pipeline

**Library**: `sharp` (devDependency)

**Purpose**: Reduce image size before sending to Gemini API — faster uploads, lower cost, consistent format.

**Pipeline**:
1. Read uploaded file as Buffer
2. Detect dimensions with `sharp.metadata()`
3. Resize to max 1024px on longest edge (`fit: 'inside'`, `withoutEnlargement: true`)
4. Convert to WebP at 85% quality
5. Base64 encode for Gemini API

```typescript
async function preprocessImage(buffer: Buffer, mimeType: string) {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  // Calculate proportional resize
  const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(metadata.width, metadata.height));
  const targetWidth = Math.round((metadata.width || MAX_IMAGE_SIZE) * scale);
  const targetHeight = Math.round((metadata.height || MAX_IMAGE_SIZE) * scale);

  const processed = await image
    .resize(targetWidth, targetHeight, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();

  return { buffer: processed, mimeType: 'image/webp' };
}
```

**Failure handling**: If preprocessing fails, the original image buffer is used — the API continues rather than failing.

---

## 4. User Authentication & Persistence

### Architecture: Vercel KV (Primary) + In-Memory (Fallback)

**Library**: `@vercel/kv` (Upstash Redis)

**Rationale**: Vercel serverless functions reset on cold start. In-memory `Map()` storage loses all data on every cold start. Vercel KV persists across cold starts.

### KV Schema

```
user:{email}     → JSON: { id, email, createdAt, subscription, analysisCount, provider }
session:{id}     → JSON: { userId, createdAt }
```

### User Schema

```typescript
interface User {
  id: string;                     // UUID v4
  email: string;                  // Primary key
  createdAt: number;             // Unix timestamp
  subscription: 'free' | 'lifetime' | 'canceled';
  analysisCount: number;          // Increments on each analysis
  provider: 'google' | 'email' | 'stripe_checkout';
}
```

### CRUD Operations

All operations in `src/lib/auth.shared.ts` (shared between API routes):

| Function | Purpose |
|----------|---------|
| `findUserByEmail(email)` | KV + in-memory fallback |
| `createOrUpdateUser(email, provider)` | Create or update user |
| `upgradeToLifetime(email)` | Set subscription to 'lifetime' |
| `incrementAnalysisCount(email)` | Increment counter after each analysis |
| `createSession(email)` | Create session, return sessionId |
| `getUserFromSession(sessionId)` | Look up user by session |

### Session Management

- Session ID stored in `sessionId` cookie
- Cookie: `sessionId=<uuid>; HttpOnly; SameSite=Lax`
- Sessions validated on every API request

### Free Tier Logic

- **Free**: 1 analysis per user (tracked in `analysisCount`)
- **Lifetime**: unlimited (checked in `/api/analyze` before processing)

---

## 5. Stripe Integration

### Lifetime Subscription Flow

```
User clicks "Upgrade" → POST /api/checkout { email }
  → Creates Stripe Checkout session (mode: 'payment', one-time $49.99)
  → Redirects to Stripe hosted checkout
  → On payment: redirected to /dashboard?success=true
  → Stripe sends webhook → POST /api/webhook
  → Webhook calls upgradeToLifetime(email)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/pages/api/checkout.ts` | Create Stripe Checkout session |
| `src/pages/api/webhook.ts` | Handle `checkout.session.completed` event |
| `src/pages/api/subscription.ts` | Return user's subscription status |

### Webhook Events Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | `upgradeToLifetime(email)` → KV |
| `customer.subscription.deleted` | Set `subscription: 'canceled'` |
| `invoice.payment_failed` | Log only (no recurring billing) |

### Security

- Webhook signature verified with `STRIPE_WEBHOOK_SECRET`
- Raw request body used for signature verification
- Email extracted from `session.metadata` or `session.customer_details.email`

---

## 6. CSS Architecture (TailwindCDN Elimination)

### Problem

The original codebase referenced `<script src="https://cdn.tailwindcss.com"></script>` in three places. This is a production risk — CDN outage or policy changes break the entire site.

### Solution: Self-Contained CSS Pipeline

**Three-part approach**:

1. **`src/pages/dashboard.astro`**: Replaced CDN with `import '../styles/global.css'` (Astro's Vite/Tailwind integration) + inline utility classes for dashboard-specific styling.

2. **`src/pages/index.astro`**: Astro wrapper that reads `public/index.html` as a static file. Removed CDN script reference from wrapper.

3. **`public/index.html`** (marketing homepage): Replaced CDN with:
   - External CSS file: `css/tailwind-utilities.css` (22KB, complete)
   - Inline `<style>` block: partial utilities as supplement

### CSS Generation Pipeline

**Generator script**: `public/css/build-utilities.js`

```bash
# Build step (runs automatically as part of npm run build)
node public/css/build-utilities.js && astro build
```

**How it works**:
1. Reads `public/index.html`
2. Extracts all Tailwind class names from `class="..."` attributes (248 unique classes)
3. Maps each class to its standard CSS property using a built-in map
4. Outputs `public/css/tailwind-utilities.css` with:
   - All base utility classes
   - Responsive breakpoints (`sm:`, `md:`, `lg:`, `xl:`)
   - Tailwind `@keyframes` animations
   - Custom classes (`.hero-bg`, `.snap-card`, `.btn-primary`, etc.)

**CSS size**: 22KB (vs 80KB+ full Tailwind CDN) — 73% smaller

### CSS Load Order

```html
<!-- External CSS loads first (complete class coverage) -->
<link rel="stylesheet" href="css/tailwind-utilities.css">
<!-- Inline styles supplement (some overlap, cascade resolves) -->
<style>/* partial classes */</style>
```

---

## 7. Rate Limiting

### Implementation

**File**: `src/pages/api/analyze.ts`

**Strategy**: In-memory sliding window per IP address.

```typescript
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;         // requests per window
const RATE_WINDOW_MS = 60_000;  // 1 minute window
```

**Limit**: 10 requests per IP per minute.

**Response on limit exceeded**:
- HTTP 429
- Headers: `Retry-After: <seconds>`, `X-RateLimit-Remaining: 0`

**Limitation**: In-memory Map resets on Vercel cold start. For production with heavy traffic, migrate to Vercel KV-based rate limiting.

---

## 8. API Contracts

### POST `/api/analyze`

**Request**: `multipart/form-data` with `image` File field

**Response** (200 OK):
```typescript
{
  success: true;
  plan: string;           // AI-generated text plan
  imageUrl?: string;       // Base64 data URL of annotated image
  items?: TidyItem[];     // Structured items if parseable
  degradedMode?: boolean; // true if image gen failed/timed out
}
```

**Response** (errors):
| Code | Condition | Body |
|------|-----------|------|
| 400 | No image | `{ error: "No image uploaded" }` |
| 400 | Invalid type | `{ error: "Please upload an image file (JPG, PNG, or WEBP)" }` |
| 400 | Too large | `{ error: "File must be under 10MB" }` |
| 429 | Rate limited | `{ error: "Too many requests", retryAfter: number }` |
| 200 | Degraded | `{ success: true, degradedMode: true, plan: "..." }` |

### POST `/api/checkout`

**Request**: `application/x-www-form-urlencoded` with `email` field

**Response** (200):
```typescript
{ success: true, url: string }  // Stripe Checkout URL
```

### POST `/api/webhook`

**Request**: `Content-Type: text/plain` with `stripe-signature` header

**Response**: `{ received: true }`

### POST `/api/auth`

**Actions**: `register`, `login`, `google_login`

**Response**:
```typescript
{ success: true, user: { email, subscription, analysisCount } }
```

### GET `/api/subscription`

**Response**:
```typescript
{
  loggedIn: boolean;
  user?: { email: string; subscription: 'free'|'lifetime'|'canceled'; analysisCount: number };
}
```

---

## 9. Environment Variables

### Required for Production

| Variable | Purpose | Source |
|----------|---------|--------|
| `GEMINI_NANA_BANANA_API_KEY` | Gemini API key | Google AI Studio |
| `STRIPE_SECRET_KEY` | Stripe secret key | Stripe Dashboard |
| `STRIPE_PRICE_ID` | Price ID for lifetime subscription | Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | Stripe Dashboard |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Google Cloud Console |
| `KV_REST_API_URL` | Vercel KV REST API URL | Vercel Storage → KV |
| `KV_REST_API_TOKEN` | Vercel KV REST API token | Vercel Storage → KV |

### Setting up Vercel KV

1. Vercel Dashboard → Storage → Create Database → KV (Upstash Redis)
2. Copy `KV_REST_API_URL` and `KV_REST_API_TOKEN`
3. Add both in: Settings → Environment Variables (Production + Preview + Development)
4. Free tier: 10,000 writes/day — sufficient for MVP

### Local Development

For local dev without KV, the auth system falls back to in-memory storage. Users/sessions are lost on server restart but the app functions normally.

---

## 10. Build & Deployment

### Build Command

```bash
npm run build
# Internally runs:
#   node public/css/build-utilities.js && astro build
```

The `build-utilities.js` script must run **before** `astro build` to generate the CSS file that `public/index.html` references.

### Deployment

- **Platform**: Vercel
- **Trigger**: Push to `main` branch
- **Adapter**: `@astrojs/vercel` (serverless SSR mode)
- **Build output**: `dist/`

### Pre-Deployment Checklist

- [ ] `npm run build` passes
- [ ] All environment variables configured in Vercel Dashboard
- [ ] Vercel KV provisioned and credentials added
- [ ] Stripe webhook URL configured: `https://tidysnap.homes/api/webhook`
- [ ] Google OAuth redirect URI configured
- [ ] Domain DNS verified

---

## Appendix: File Reference

| File | Purpose |
|------|---------|
| `src/pages/api/analyze.ts` | Core AI analysis endpoint |
| `src/pages/api/checkout.ts` | Stripe Checkout session creation |
| `src/pages/api/webhook.ts` | Stripe webhook handler |
| `src/pages/api/auth.ts` | User authentication |
| `src/pages/api/subscription.ts` | Subscription status |
| `src/lib/auth.shared.ts` | Shared auth CRUD functions |
| `public/css/build-utilities.js` | CSS generation script |
| `public/css/tailwind-utilities.css` | Generated CSS (do not edit manually) |
| `public/index.html` | Marketing homepage HTML |
| `ARCHITECTURE.md` | High-level system architecture |
