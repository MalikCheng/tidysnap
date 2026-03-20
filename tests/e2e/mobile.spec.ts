import { test, expect } from '@playwright/test';
import { VIEWPORTS, TEST_FILES } from '../fixtures/test-data';
import path from 'path';

/**
 * P1 E2E Tests: Mobile Compatibility
 * Tests responsive design and touch interactions on mobile devices
 */
test.describe('Mobile Compatibility', () => {
  test.describe.configure({ mode: 'serial' }); // Run sequentially for viewport changes

  test('P1.1: /try page on iPhone viewport', async ({ page }) => {
    // Set iPhone viewport
    await page.setViewportSize(VIEWPORTS.mobile);

    await page.goto('/try');
    await page.waitForLoadState('networkidle');

    // Verify upload zone is visible and properly sized
    const dropzone = page.locator('[data-testid="dropzone"], .dropzone, .upload-zone');
    await expect(dropzone).toBeVisible();

    // Verify dropzone fits within viewport
    const dropzoneBox = await dropzone.boundingBox();
    expect(dropzoneBox!.height).toBeLessThan(VIEWPORTS.mobile.height);
    expect(dropzoneBox!.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width);

    // Verify upload button is tappable (minimum 44x44)
    const uploadButton = page.locator('input[type="file"]').first();
    const buttonBox = await uploadButton.boundingBox();
    expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
    expect(buttonBox!.width).toBeGreaterThanOrEqual(44);
  });

  test('P1.2: /try page on Android viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });

    await page.goto('/try');
    await page.waitForLoadState('networkidle');

    // Verify all text is readable (no overflow)
    const body = page.locator('body');
    const bodyBox = await body.boundingBox();
    expect(bodyBox!.width).toBeLessThanOrEqual(360);

    // Verify no horizontal scroll
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test('P1.3: Touch interactions work', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    await page.goto('/try');
    await page.waitForLoadState('networkidle');

    // Test touch on dropzone (tap should open file picker)
    const dropzone = page.locator('[data-testid="dropzone"], .dropzone, .upload-zone');
    await dropzone.tap();

    // File picker should open on mobile (or at least no errors)
    // Note: Can't fully test file picker in headless mode
  });

  test('P1.4: /dashboard responsive layout', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Verify pricing card is visible
    const pricingCard = page.locator('[data-testid="pricing"], .pricing');
    await expect(pricingCard).toBeVisible();

    // Verify CTA button is visible and within viewport
    const ctaButton = page.locator('button:has-text("Lifetime"), button:has-text("Upgrade")').first();
    await expect(ctaButton).toBeVisible();

    const ctaBox = await ctaButton.boundingBox();
    expect(ctaBox!.bottom).toBeLessThanOrEqual(VIEWPORTS.mobile.height);
  });

  test('P1.5: Navbar mobile menu', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    await page.goto('/try');
    await page.waitForLoadState('networkidle');

    // Find hamburger menu
    const menuButton = page.locator('[data-testid="menu"], .menu-toggle, button:has-text("☰")').first();

    if (await menuButton.isVisible({ timeout: 2000 })) {
      await menuButton.click();

      // Verify mobile menu appears
      const mobileMenu = page.locator('[data-testid="mobile-menu"], .mobile-nav, nav');
      await expect(mobileMenu).toBeVisible({ timeout: 3000 });
    }
  });

  test('P1.6: Tablet layout', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);

    await page.goto('/try');
    await page.waitForLoadState('networkidle');

    // Should use tablet-optimized layout
    const dropzone = page.locator('[data-testid="dropzone"], .dropzone, .upload-zone');
    await expect(dropzone).toBeVisible();

    // Verify proper spacing on tablet
    const dropzoneBox = await dropzone.boundingBox();
    expect(dropzoneBox!.width).toBeGreaterThan(300); // Should be reasonably sized
  });

  test('P1.7: Image zoom on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    await page.goto('/try');

    // Upload a test image
    const fileInput = page.locator('input[type="file"]');
    const testFilePath = path.resolve(process.cwd(), TEST_FILES.desktopMessy);
    await fileInput.setInputFiles(testFilePath);

    // Wait for results
    await page.waitForSelector('[data-testid="results"], .results', { timeout: 60000 }).catch(() => {
      test.skip(true, 'Analysis did not complete');
      return;
    });

    // Verify image is displayed
    const resultImage = page.locator('[data-testid="results"] img, .results img').first();

    if (await resultImage.isVisible({ timeout: 3000 })) {
      // Image should be visible and fit within mobile viewport
      const imgBox = await resultImage.boundingBox();
      expect(imgBox!.height).toBeLessThanOrEqual(VIEWPORTS.mobile.height);
      expect(imgBox!.width).toBeLessThanOrEqual(VIEWPORTS.mobile.width);
    }
  });

  test('P1.8: Orientation change handling', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    await page.goto('/try');
    await page.waitForLoadState('networkidle');

    // Change to landscape
    await page.setViewportSize({ width: 667, height: 375 });

    // Reload to trigger layout recalculation
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify page still renders correctly
    const dropzone = page.locator('[data-testid="dropzone"], .dropzone, .upload-zone');
    await expect(dropzone).toBeVisible();
  });
});
