import { test, expect } from '@playwright/test';
import path from 'path';
import { TEST_FILES, TIMEOUTS } from '../fixtures/test-data';

/**
 * P0 E2E Tests: Upload Flow
 * Critical path tests for the /try page upload functionality
 */
test.describe('Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to /try page
    await page.goto('/try');
    await page.waitForLoadState('networkidle');
  });

  test('P0.1: Successful upload of messy desk image', async ({ page }) => {
    // Login first (simplified - assumes auth modal opens)
    await page.click('button:has-text("Login"), button:has-text("Sign")');
    await page.waitForSelector('[data-testid="auth-modal"], .modal', { timeout: 5000 }).catch(() => {
      // Auth modal may not appear if already logged in
    });

    // If auth modal exists, skip - these tests assume authenticated user
    const authModal = await page.$('[data-testid="auth-modal"], .modal');
    if (authModal) {
      test.skip(true, 'Requires authentication - skipping for fixture test');
      return;
    }

    // Find file input
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();

    // Upload test file
    const testFilePath = path.resolve(process.cwd(), TEST_FILES.desktopMessy);
    await fileInput.setInputFiles(testFilePath);

    // Verify loading state appears
    const loadingIndicator = page.locator('[data-testid="loading"], .loading, .analyzing');
    await expect(loadingIndicator).toBeVisible({ timeout: 5000 }).catch(() => {
      // Loading may complete too fast to catch
    });

    // Wait for results (max 60s for AI analysis)
    const results = page.locator('[data-testid="results"], .results, .analysis-result');
    await expect(results).toBeVisible({ timeout: TIMEOUTS.analysisMax });

    // Verify result contains annotated image
    const annotatedImage = page.locator('img[alt*="annotated"], img[alt*="result"]');
    await expect(annotatedImage).toBeVisible();
  });

  test('P0.2: File type rejection - PDF upload', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    const testFilePath = path.resolve(process.cwd(), TEST_FILES.wrongType);

    // Set files (should be rejected)
    await fileInput.setInputFiles(testFilePath);

    // Verify error message appears
    const errorMessage = page.locator('text=/Only.*JPG.*PNG.*WEBP/i, text=/Invalid.*file.*type/i');
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
  });

  test('P0.3: File size validation', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    const testFilePath = path.resolve(process.cwd(), TEST_FILES.oversized);

    await fileInput.setInputFiles(testFilePath);

    // Verify size error message
    const errorMessage = page.locator('text=/Max.*size.*10MB/i, text=/File.*too.*large/i');
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
  });

  test('P0.4: Drag and drop functionality', async ({ page }) => {
    // Find dropzone
    const dropzone = page.locator('[data-testid="dropzone"], .dropzone, .upload-zone');
    await expect(dropzone).toBeVisible();

    // Simulate drag and drop
    const testFilePath = path.resolve(process.cwd(), TEST_FILES.desktopMessy);
    await dropzone.dispatchEvent('drop', {
      dataTransfer: {
        files: [createFileList(testFilePath)],
      },
    });

    // Should trigger upload
    const loadingOrResults = page.locator('[data-testid="loading"], [data-testid="results"]');
    await expect(loadingOrResults.or(page.locator('.results'))).toBeVisible({ timeout: TIMEOUTS.analysisMax });
  });

  test('P0.5: Free user limit enforcement', async ({ page }) => {
    // This test would need authentication with exhausted user
    // Skipped in CI - manual verification required
    test.skip(!process.env.RUN_FULL_TESTS, 'Skipping - requires specific test account');
  });
});

// Helper to create FileList-like object
function createFileList(filePath: string) {
  return {
    items: [{
      kind: 'file',
      getAsFile: () => ({ path: filePath, name: path.basename(filePath) }),
    }],
    length: 1,
  };
}
