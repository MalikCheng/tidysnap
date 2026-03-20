# TidySnap QA Test Strategy

**Document Version:** 1.0
**Last Updated:** 2026-03-20
**QA Engineer:** Claude (QA Sprint)
**Project:** tidysnap.homes

---

## 1. Executive Summary

This document defines the QA testing strategy for TidySnap, covering the /try page upload flow, AI analysis pipeline, Stripe payments, and mobile compatibility.

**Scope:**
- Frontend: /try page, /dashboard page
- Backend: /api/analyze, /api/checkout, /api/webhook, /api/subscription, /api/auth

**Out of Scope:**
- Blog pages (static content, minimal risk)
- CI/CD pipeline testing (future work)

---

## 2. Risk Matrix

| Component | Risk Level | Priority | Reason |
|-----------|-----------|----------|--------|
| /api/analyze (AI pipeline) | 🔴 CRITICAL | P0 | Core feature, 3rd party dependency |
| Upload flow UX | 🔴 CRITICAL | P0 | User entry point |
| Stripe Checkout | 🟠 HIGH | P1 | Revenue impact |
| Mobile responsiveness | 🟠 HIGH | P1 | ~40% mobile traffic |
| Auth flow | 🟡 MEDIUM | P1 | Gate for analysis |
| Dashboard | 🟡 MEDIUM | P2 | Secondary feature |

---

## 3. Test Standards

### P0 - Must Pass (Blocker)
- **Definition:** Core functionality broken, revenue impact, data loss
- **SLA:** Must fix within 24 hours
- **Examples:**
  - Upload flow fails silently
  - AI analysis returns empty/garbage response
  - Stripe payment fails for valid cards
  - Mobile: Upload button unclickable

### P1 - Should Pass (High Priority)
- **Definition:** Major feature broken, workarounds exist
- **SLA:** Fix within 1 week
- **Examples:**
  - Auth modal shows wrong text
  - Loading state never completes (timeout > 60s)
  - Mobile: Images overflow viewport

### P2 - Nice to Pass (Medium Priority)
- **Definition:** Minor UX issues, cosmetic bugs
- **SLA:** Fix within 2 weeks
- **Examples:**
  - Share button tooltip incorrect
  - Font renders slightly off on Firefox
  - Download button icon misaligned

---

## 4. Test Cases by Priority

### P0 - Critical Path Tests

#### P0.1: Upload Flow
```
Test: Upload a messy desk image successfully
Steps:
  1. Navigate to /try
  2. Login with test account (test@tidysnap.test / test123)
  3. Drag desktop-messy-1.jpg to dropzone
  4. Wait for analysis to complete
  5. Verify result shows annotated image
Expected: Annotated image with arrows displayed within 60s
```

```
Test: Upload rejected for invalid file type
Steps:
  1. Navigate to /try
  2. Login
  3. Attempt to upload document.pdf
Expected: Error message "Only JPG, PNG, WEBP allowed"
```

```
Test: Upload rejected for oversized file
Steps:
  1. Navigate to /try
  2. Login
  3. Attempt to upload 15MB.jpg
Expected: Error message "Max file size is 10MB"
```

#### P0.2: AI Analysis Pipeline
```
Test: AI returns valid analysis
Steps:
  1. Upload standard messy desk image
  2. Verify response contains: plan, items[], imageUrl
Expected: Response schema matches AnalyzeResult interface
```

```
Test: AI timeout handling
Steps:
  1. Upload complex image
  2. Monitor response time
Expected: Either completes in <55s OR returns degradedMode response
```

```
Test: Free user limit enforced
Steps:
  1. Login as free user (already used 1 analysis)
  2. Attempt to upload
Expected: Upgrade modal shown
```

#### P0.3: Stripe Checkout
```
Test: Checkout creates valid session
Steps:
  1. Navigate to /dashboard
  2. Click "Get Lifetime Access"
  3. Enter test@tidysnap.test
  4. Click "Continue to Payment"
Expected: Redirected to Stripe Checkout with valid session
```

```
Test: Stripe test card succeeds
Steps:
  1. Complete checkout to Stripe
  2. Enter 4242 4242 4242 4242
  3. Enter any future expiry, any CVC
  4. Submit payment
Expected: Redirected to /dashboard?success=true
```

```
Test: Stripe canceled payment
Steps:
  1. Complete checkout to Stripe
  2. Click "Cancel"
Expected: Redirected to /dashboard?canceled=true
```

---

### P1 - High Priority Tests

#### P1.1: Authentication Flow
```
Test: Register new user
Steps:
  1. Navigate to /try
  2. Click "Sign Up"
  3. Enter unique email + password
  4. Submit
Expected: Account created, logged in, analysis allowed
```

```
Test: Login existing user
Steps:
  1. Navigate to /try
  2. Click "Login"
  3. Enter test@tidysnap.test / test123
  4. Submit
Expected: Logged in successfully
```

```
Test: Google OAuth flow
Steps:
  1. Click "Continue with Google"
  2. Complete Google OAuth
Expected: Redirected back as logged-in user
```

#### P1.2: Mobile Responsiveness
```
Test: /try page on iPhone SE viewport
Viewport: 375x667
Steps:
  1. Open /try in mobile viewport
  2. Verify upload zone is visible
  3. Verify upload button is tappable
Expected: All interactive elements accessible
```

```
Test: /try page on Android viewport
Viewport: 360x800
Steps:
  1. Open /try in mobile viewport
  2. Upload image via file picker
Expected: Analysis completes correctly
```

```
Test: Dashboard mobile layout
Viewport: 375x667
Steps:
  1. Open /dashboard in mobile viewport
  2. Verify pricing card fits screen
Expected: No horizontal overflow, CTA visible
```

#### P1.3: Error Handling
```
Test: Network error during upload
Steps:
  1. Start upload
  2. Simulate network failure
Expected: Error message with retry button
```

```
Test: Invalid API response handling
Steps:
  1. Mock /api/analyze to return 500
Expected: "Something went wrong" message, retry option
```

---

### P2 - Medium Priority Tests

#### P2.1: UI Polish
```
Test: Loading animation displays
Steps:
  1. Upload image
  2. Immediately check for loading state
Expected: Pulsing ring animation visible
```

```
Test: Share button copies link
Steps:
  1. Complete analysis
  2. Click Share
Expected: Link copied to clipboard (or native share sheet on mobile)
```

```
Test: Download button works
Steps:
  1. Complete analysis
  2. Click Download
Expected: Annotated image downloads as .jpg
```

#### P2.2: Edge Cases
```
Test: Empty desk upload
Steps:
  1. Upload image of clean desk
Expected: Graceful response ("Desk looks organized!")
```

```
Test: Very small image
Steps:
  1. Upload 100x100 pixel image
Expected: Handled gracefully (sharp resizes it)
```

```
Test: Rapid multiple uploads
Steps:
  1. Upload image
  2. Immediately upload another
Expected: Only one analysis runs at a time
```

---

## 5. Test Data Requirements

### Required Fixtures
| File | Size | Type | Purpose |
|------|------|------|---------|
| desktop-messy-1.jpg | ~2MB | JPG | Standard messy desk |
| desktop-messy-2.jpg | ~3MB | JPG | Complex desk with many items |
| desktop-clean.jpg | ~1MB | JPG | Control image (clean desk) |
| mobile-messy.jpg | ~1.5MB | JPG | Mobile-shot desk |
| oversize.jpg | ~12MB | JPG | Size limit test |
| wrong-type.pdf | ~100KB | PDF | File type test |

### Test Accounts
| Email | Password | Type | Analysis Used |
|-------|----------|------|---------------|
| test@tidysnap.test | test123 | Free | 0/1 |
| test2@tidysnap.test | test123 | Free | 1/1 (limit reached) |
| lifetime@tidysnap.test | test123 | Lifetime | Unlimited |

---

## 6. Environment Setup

### Local Development
```bash
# Start dev server
npm run dev  # http://localhost:4321

# Install Playwright browsers
npx playwright install chromium

# Run tests
npx playwright test
```

### Test API Keys (use .env.test)
```
GEMINI_NANA_BANANA_API_KEY=<test-key>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=<test-price-id>
```

---

## 7. Known Issues / Technical Debt

| Issue | Severity | Workaround |
|-------|----------|------------|
| In-memory user store (Map) | P1 | Tests create fresh user per session |
| No webhook database integration | P1 | Manual verification for payment tests |
| AI timeout (55s) may affect CI | P1 | Use fast model in tests, mock in unit tests |
| No rate limiting implemented | P2 | Tests should include delays |

---

## 8. Automation Coverage

| Test Suite | Automated | Manual | Notes |
|------------|-----------|--------|-------|
| Upload Flow | ✅ | ✅ | E2E: tests/e2e/upload.spec.ts |
| AI Analysis | ✅ | ✅ | E2E: tests/e2e/analyze.spec.ts |
| Stripe Checkout | ✅ | ⚠️ | E2E: tests/e2e/checkout.spec.ts (requires Stripe test mode) |
| Mobile Tests | ✅ | ✅ | E2E: tests/e2e/mobile.spec.ts |
| Auth Flow | ✅ | ✅ | E2E: tests/e2e/auth.spec.ts |

---

## 9. Reporting

- **Test Run Frequency:** Per PR, nightly on main
- **Report Location:** `tests/reports/`
- **CI Integration:** GitHub Actions (future)
- **Bug Tracker:** GitHub Issues with `bug` label

---

*Document Status: DRAFT - Requires review from team lead*
