# TidySnap E2E Test Suite

Automated end-to-end tests using Playwright.

## Quick Start

```bash
# Install dependencies
npm install

# Install browsers
npx playwright install chromium

# Run all tests
npm test

# Run with UI
npm run test:ui
```

## Test Structure

- `e2e/upload.spec.ts` - Upload flow tests
- `e2e/analyze.spec.ts` - AI analysis pipeline tests
- `e2e/checkout.spec.ts` - Stripe payment tests
- `e2e/mobile.spec.ts` - Mobile responsiveness tests
- `e2e/auth.spec.ts` - Authentication tests

## Fixtures

Test images are in `fixtures/`. To regenerate:

```bash
node tests/scripts/generate-fixtures.js
```

## Reports

Test reports are generated in `reports/` after running tests.

```bash
npm run test:report  # View HTML report
```

## CI/CD

Tests run automatically on push to `main` branch via GitHub Actions (when configured).
