# TidySnap Architecture

## Overview

TidySnap is an Astro 5.0 server-rendered web app deployed on Vercel. It provides an AI-powered desk organization service: users upload a photo of a messy desk, and the AI generates an annotated image with arrows and labels showing where each item should go.

**Live URL**: https://tidysnap.homes/
**Slogan**: Snap Once. Tidy Forever.

---

## System Architecture

```
┌─────────────┐     ┌──────────────────────────────────────────────────┐
│   Browser   │────▶│  Vercel Edge / Serverless Functions             │
│  (Mobile)   │     │                                                  │
└─────────────┘     │  ┌────────────┐   ┌─────────────────────────┐  │
                    │  │ /try.astro │   │  /api/*  (Serverless)   │  │
                    │  │  (SSR Page)│   │                         │  │
                    │  └────────────┘   │  analyze.ts             │  │
                    │                   │  checkout.ts             │  │
                    │                   │  webhook.ts              │  │
                    │                   │  auth.ts                 │  │
                    │                   │  subscription.ts         │  │
                    │                   └───────────┬─────────────┘  │
                    │                               │                │
                    │            ┌──────────────────┼───────────┐    │
                    │            │                  │           │    │
                    │            ▼                  ▼           ▼    │
                    │    ┌──────────────┐  ┌────────────┐  ┌────────┐│
                    │    │   Gemini API │  │  Stripe    │  │Vercel  ││
                    │    │  (Nana Banana│  │  Payments  │  │   KV   ││
                    │    │     2)      │  │            │  │(Users) ││
                    │    └──────────────┘  └────────────┘  └────────┘│
                    └──────────────────────────────────────────────────┘
```

---

## API Routes

### POST `/api/analyze`

**Purpose**: Core AI analysis endpoint — receives a desk photo and returns an annotated tidy plan.

**Request**:
- `Content-Type: multipart/form-data`
- Body: `image` (File, required) — JPG/PNG/WEBP, max 10MB

**Response** (200 OK):
```typescript
interface AnalyzeResponse {
  success: boolean;
  plan?: string;                    // AI-generated text plan
  imageUrl?: string;                // Base64 data URL of annotated image
  items?: Array<{                    // Structured item list (if parseable)
    name: string;
    currentPosition: string;
    targetPosition: string;
    action?: 'relocate' | 'remove' | 'reorganize';
  }>;
  degradedMode?: boolean;           // true if image gen failed or timed out
  error?: string;                   // Error message (only on failure)
}
```

**Response** (400/401/402/500):
```typescript
{ error: string }
```

**Flow**:
1. Parse `multipart/form-data`, validate image file
2. Image preprocessing with `sharp`:
   - Resize to max 1024px on longest edge
   - Convert to WebP (quality: 85%)
3. Base64 encode the processed image
4. Call Gemini `gemini-3.1-flash-image-preview` with analysis prompt
5. Extract text plan + generated image from response
6. Return JSON response

**Error Codes**:
| Code | Condition |
|------|-----------|
| 400 | No image / invalid type / too large |
| 401 | User not authenticated (if auth gate is enforced) |
| 500 | Server error |

---

### POST `/api/checkout`

**Purpose**: Create a Stripe Checkout session for lifetime subscription purchase.

**Request**:
- `Content-Type: application/x-www-form-urlencoded`
- Body: `email` (string, required)

**Response** (200 OK):
```typescript
{ success: true, url: string }   // Stripe Checkout URL
```

**Response** (400/500):
```typescript
{ error: string }
```

**Flow**:
1. Validate email
2. Create Stripe Checkout session (`mode: 'payment'`, one-time lifetime)
3. Return the Stripe-hosted checkout URL

---

### POST `/api/webhook`

**Purpose**: Handle Stripe webhook events.

**Request**:
- `Content-Type: text/plain`
- Header: `stripe-signature` (required)

**Handled Events**:
| Event | Action |
|-------|--------|
| `checkout.session.completed` | Upgrade user to lifetime subscription in KV store |
| `customer.subscription.deleted` | Set user subscription to 'canceled' |
| `invoice.payment_failed` | Log failure, no action (no recurring billing) |

**Response**:
```typescript
{ received: true }
```

---

### POST `/api/auth`

**Purpose**: User registration, login, and session management.

**Actions** (via `action` form field or JSON body):
| Action | Description |
|--------|-------------|
| `register` | Create new user account |
| `login` | Authenticate existing user |
| `google_login` | Google OAuth login |

**Response**:
```typescript
{ success: true, user: { email, subscription, analysisCount } }
```

**Storage**: Vercel KV (see Data Storage section)

---

### GET `/api/subscription`

**Purpose**: Check authenticated user's subscription status.

**Response**:
```typescript
{
  loggedIn: boolean;
  user?: {
    email: string;
    subscription: 'free' | 'lifetime';
    analysisCount: number;
  }
}
```

---

## Data Storage

### Vercel KV (Users & Sessions)

Using `@vercel/kv` for persistence. KV survives serverless cold starts unlike in-memory Maps.

**Key Schema**:
```
user:{email}     → JSON: { id, email, createdAt, subscription, analysisCount, provider }
session:{id}     → JSON: { userId, createdAt }
```

**User Schema**:
```typescript
interface User {
  id: string;                     // UUID v4
  email: string;                  // Primary key
  createdAt: number;             // Unix timestamp
  subscription: 'free' | 'lifetime' | 'canceled';
  analysisCount: number;          // Increments on each analysis
  provider: 'google' | 'email';
}
```

---

## AI Pipeline (Nana Banana 2)

### Model

**`gemini-3.1-flash-image-preview`**

This is a multimodal image generation model that can:
1. Analyze an input image (vision capability)
2. Generate a new image based on instructions (image-to-image)

This allows a single model call to both analyze the messy desk AND generate the annotated tidy plan image.

### Image Preprocessing

Before sending to Gemini:
1. Resize: max 1024px on longest edge (using `sharp`)
2. Convert to WebP at 85% quality
3. Base64 encode

This ensures fast API calls, reduced cost, and consistent format.

### Prompt Strategy

The Nana Banana 2 prompt follows a structured approach:

```
You are Nana Banana 2, a friendly desk organization expert.

TASK: Analyze this messy desk image and create a comprehensive tidy plan.

INPUT IMAGE ANALYSIS:
1. Identify ALL items on the desk (books, cups, papers, laptop, phone, cables, etc.)
2. Note their current positions
3. Determine optimal final positions for each item

OUTPUT REQUIREMENTS:
1. A detailed TEXT PLAN listing each item, its current spot, and where it should go
2. An ANNOTATED IMAGE showing the tidy version with:
   - Clear ARROWS pointing from current positions to target positions
   - LABELS for each item (what it is)
   - Color-coded arrows (red=remove, green=relocate, blue=reorganize)

Respond with your text analysis AND generate an image showing the tidy desk plan.
```

### Structured JSON Output

The API parses structured items from the text response using regex. For more reliable parsing, the prompt should eventually enforce JSON output:

```json
{
  "items": [
    {
      "name": "Coffee mug",
      "currentPosition": "center of desk",
      "targetPosition": "top-right corner",
      "action": "relocate"
    }
  ],
  "summary": "5-step plan to organize your desk"
}
```

**TODO**: Migrate from regex parsing to structured JSON output parsing for reliability.

---

## Anti-Timeout Degradation Strategy

### Problem

Vercel serverless functions have a **60-second timeout** (Hobby) / **300-second timeout** (Pro). The AI image generation can take 10-45 seconds. We need a graceful degradation chain.

### 3-Tier Fallback Chain

| Tier | Name | Condition | Response |
|------|------|-----------|----------|
| 1 | Full Mode | < 45s elapsed, no errors | Text plan + AI-generated annotated image |
| 2 | Text-Only | 45-55s elapsed OR image gen failed | Structured text plan only |
| 3 | Graceful | > 55s OR critical error | Friendly error + retry UI |

### Implementation

```typescript
const TIMEOUT_MS = 45000;  // 45s — leaves 15s buffer before 60s limit

// Call with timeout
const remainingTime = TIMEOUT_MS - (Date.now() - startTime);
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('AI timeout')), remainingTime);
});

const aiResult = await Promise.race([analyzeWithNanaBanana(...), timeoutPromise]);
```

### Frontend Handling

The frontend checks `degradedMode` in the response:
- `false` / undefined: Show both image and text plan
- `true`: Show text plan with "Image generation timed out" note + "Try Again" button

---

## Error Handling

| HTTP Code | Error Type | Response |
|-----------|-----------|----------|
| 400 | Bad Request | `{ error: "No image uploaded" }` |
| 400 | Invalid File | `{ error: "Please upload JPG/PNG/WEBP" }` |
| 400 | File Too Large | `{ error: "File must be under 10MB" }` |
| 401 | Unauthorized | `{ error: "Please sign in" }` |
| 402 | Upgrade Required | `{ error: "Free limit reached" }` |
| 200 | Degraded Mode | `{ degradedMode: true, plan: "..." }` |
| 500 | Server Error | `{ error: "Something went wrong" }` |

---

## Authentication Flow

```
┌──────────┐    POST /api/auth     ┌─────────────┐    Create session    ┌──────────┐
│  Client  │─────────────────────▶│  auth.ts    │─────────────────────▶│ Vercel   │
│          │    (email/google)     │             │                      │    KV    │
│          │◀─────────────────────│             │◀─────────────────────│          │
└──────────┘    Set-Cookie:        └─────────────┘   session:{id}        └──────────┘
               session=xxx

Every subsequent request includes Cookie: session=xxx
/api/subscription reads the session, looks up user in KV
/api/analyze checks user subscription tier before processing
```

### Free Tier

- **1 free analysis** per user (before account creation)
- After 1 free analysis: Upgrade modal (Stripe lifetime offer at $49)
- After payment: `subscription: 'lifetime'`, unlimited analyses

---

## Stripe Integration

### Lifetime Subscription

- **Price**: $49 (one-time, no recurring)
- **Type**: `mode: 'payment'` (not subscription)
- **Product**: Lifetime access — no ads, unlimited analyses
- **Early Bird**: 50% off from original $99

### Checkout Flow

```
1. User clicks "Upgrade Now" on /try or /dashboard
2. POST /api/checkout { email } → returns Stripe checkout URL
3. User redirected to Stripe hosted checkout
4. On success: redirected to /dashboard?success=true
5. Stripe sends webhook → /api/webhook receives checkout.session.completed
6. Webhook updates user subscription in KV
```

### Webhook Events

| Event | Handler Action |
|-------|---------------|
| `checkout.session.completed` | `kv.set(user:{email}, { subscription: 'lifetime' })` |
| `customer.subscription.deleted` | `kv.set(user:{email}, { subscription: 'canceled' })` |
| `invoice.payment_failed` | Log only (no recurring billing) |

---

## Frontend Pages

| Page | Route | Purpose |
|------|-------|---------|
| Marketing Homepage | `/` | Static HTML landing page (public/index.html) |
| AI Analyzer | `/try` | Core MVP page — upload, analyze, download |
| Dashboard | `/dashboard` | User subscription status, upgrade CTA |
| Blog Listing | `/blog` | Content marketing |
| Blog Post | `/blog/[slug]` | Individual blog articles |
| RSS Feed | `/rss.xml` | RSS subscription |

---

## Environment Variables

> ⚠️ **Required for production deployment.** KV variables must be configured in Vercel Dashboard → Settings → Environment Variables before going live.

| Variable | Purpose | Required |
|----------|---------|----------|
| `GEMINI_NANA_BANANA_API_KEY` | Gemini API key for AI analysis | ✅ |
| `STRIPE_SECRET_KEY` | Stripe secret key | ✅ |
| `STRIPE_PRICE_ID` | Stripe Price ID for lifetime subscription | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | ✅ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | ✅ |
| `KV_REST_API_URL` | Vercel KV (Upstash Redis) REST API URL | ✅ Production |
| `KV_REST_API_TOKEN` | Vercel KV REST API token | ✅ Production |

### Setting up Vercel KV

1. Go to **Vercel Dashboard** → **Storage** → **Create Database** → **KV (Upstash Redis)**
2. Copy the `KV_REST_API_URL` and `KV_REST_API_TOKEN` from the created KV database
3. Add both as environment variables in **Settings → Environment Variables** (Production + Preview + Development)
4. KV is free up to 10,000 writes/day — sufficient for MVP

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Framework | Astro 5.0 (SSR mode) |
| Adapter | @astrojs/vercel |
| Styling | Tailwind CSS v4 (via @tailwindcss/vite) |
| AI | Gemini `gemini-3.1-flash-image-preview` via @google/generative-ai |
| Payments | Stripe SDK (serverless webhook) |
| Auth | Custom session + Vercel KV |
| Image Processing | sharp (devDependency) |
| Deployment | Vercel (connected to main branch) |

---

## Known Issues & TODOs

- [x] **P0**: Migrate from `gemini-2.5-flash-preview-05-20` to `gemini-3.1-flash-image-preview`
- [x] **P0**: Replace in-memory auth Map with Vercel KV persistence
- [x] **P0**: Connect webhook to update user subscription in KV
- [x] **P0**: Add rate limiting to /api/analyze (10 req/min per IP)
- [x] **P1**: Fix subscription API to return real user data (now reads from KV)
- [ ] **P1**: Connect frontend to real subscription data on dashboard page
- [ ] **P2**: Migrate AI item parsing from regex to structured JSON output
- [ ] **P3**: Add pinch-to-zoom on mobile for plan image
- [ ] **P3**: Stage-based loading progress indicator
