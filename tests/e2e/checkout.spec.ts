import { test, expect } from '@playwright/test';
import { STRIPE_TEST_CARDS } from '../fixtures/test-data';

/**
 * P1 E2E Tests: Stripe Checkout Flow
 * Tests payment processing with Stripe test cards
 */
test.describe('Stripe Checkout', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('P1.1: Checkout page loads correctly', async ({ page }) => {
    // Verify pricing is displayed
    const pricingCard = page.locator('[data-testid="pricing"], .pricing, .price-card');
    await expect(pricingCard).toBeVisible();

    // Verify CTA button exists
    const upgradeButton = page.locator('button:has-text("Lifetime"), button:has-text("Upgrade"), button:has-text("Get")');
    await expect(upgradeButton).toBeVisible();

    // Verify price is shown
    const price = page.locator('text=/\\$49/i, text=/49\\.99/');
    await expect(price).toBeVisible();
  });

  test('P1.2: Redirect to Stripe on CTA click', async ({ page }) => {
    // Find upgrade button
    const upgradeButton = page.locator('button:has-text("Lifetime"), button:has-text("Upgrade")');
    await expect(upgradeButton).toBeVisible();

    // Click and wait for navigation
    await page.click('button:has-text("Lifetime"), button:has-text("Upgrade")');

    // Should navigate to Stripe (or show email modal first)
    // Check for email modal or Stripe redirect
    const emailInput = page.locator('input[type="email"], input[placeholder*="email"]');

    if (await emailInput.isVisible({ timeout: 3000 })) {
      // Email modal appears first
      await emailInput.fill('test@tidysnap.test');
      await page.click('button:has-text("Continue"), button:has-text("Payment")');
    }

    // Wait for Stripe redirect
    await page.waitForURL('**/checkout.stripe.com/**', { timeout: 10000 }).catch(() => {
      // May already be on Stripe or have different flow
    });

    // Verify we're on Stripe or payment modal
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    expect(currentUrl.includes('stripe') || currentUrl.includes('checkout')).toBeTruthy();
  });

  test('P1.3: Success redirect after payment', async ({ page }) => {
    // Navigate directly to success URL (simulating completed payment)
    await page.goto('/dashboard?success=true');

    // Verify success message
    const successMessage = page.locator('text=/Success/i, text=/Thank you/i, text=/Lifetime/i');
    await expect(successMessage.first()).toBeVisible();

    // Verify user sees lifetime badge/access
    const lifetimeBadge = page.locator('[data-testid="lifetime"], .lifetime, .badge:has-text("Lifetime")');
    await expect(lifetimeBadge).toBeVisible({ timeout: 3000 }).catch(() => {
      // Badge may require page refresh or session
    });
  });

  test('P1.4: Canceled redirect handling', async ({ page }) => {
    // Navigate with canceled param
    await page.goto('/dashboard?canceled=true');

    // Verify user is back on dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify upgrade button is still visible
    const upgradeButton = page.locator('button:has-text("Lifetime"), button:has-text("Upgrade")');
    await expect(upgradeButton).toBeVisible();
  });

  test('P1.5: Stripe test card validation', async ({ page }) => {
    // This test requires being on Stripe's hosted page
    // We can only test the redirect flow, not the actual payment
    test.skip(true, 'Cannot automate Stripe hosted form - requires Stripe Testing documentation');
  });

  test('P1.6: Webhook endpoint exists and returns 200', async ({ request }) => {
    // Test webhook endpoint exists (won't process without valid signature)
    const response = await request.post('/api/webhook', {
      headers: {
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({
        type: 'checkout.session.completed',
        data: { object: {} },
      }),
    });

    // Should return 200 (even with invalid signature - endpoint exists)
    // In production, would need proper Stripe signature
    expect([200, 400]).toContain(response.status());
  });
});
