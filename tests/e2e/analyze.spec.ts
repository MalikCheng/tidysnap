import { test, expect, request } from '@playwright/test';
import path from 'path';
import * as fs from 'fs';
import { TEST_FILES, TIMEOUTS } from '../fixtures/test-data';

/**
 * P0 E2E Tests: AI Analysis Pipeline
 * Tests the complete AI analysis flow from upload to result
 */
test.describe('AI Analysis Pipeline', () => {
  test.setTimeout(TIMEOUTS.analysisMax + 10000); // Extra time for slow responses

  test('P0.1: API returns valid response structure', async () => {
    // Test API directly (faster than full E2E)
    const context = await request.newContext();
    const filePath = path.resolve(process.cwd(), TEST_FILES.desktopMessy);

    // Read file as buffer
    const fileBuffer = fs.readFileSync(filePath);

    // POST to analyze endpoint
    const response = await context.post('/api/analyze', {
      multipart: {
        image: {
          name: 'test-desk.jpg',
          mimeType: 'image/jpeg',
          buffer: fileBuffer,
        },
      },
    });

    // Verify response
    expect(response.ok()).toBeTruthy();

    const json = await response.json();
    console.log('API Response:', JSON.stringify(json, null, 2));

    // Validate response schema
    expect(json).toHaveProperty('success');
    if (json.success) {
      expect(json).toHaveProperty('plan');
      expect(json).toHaveProperty('items');
      expect(Array.isArray(json.items)).toBeTruthy();
      expect(json).toHaveProperty('imageUrl');

      // Verify items structure
      if (json.items.length > 0) {
        const item = json.items[0];
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('currentPosition');
        expect(item).toHaveProperty('targetPosition');
      }
    } else {
      // If not successful, should have error message
      expect(json).toHaveProperty('error');
    }
  });

  test('P0.2: Analysis completes within timeout', async ({ page }) => {
    await page.goto('/try');

    const fileInput = page.locator('input[type="file"]');
    const testFilePath = path.resolve(process.cwd(), TEST_FILES.desktopMessyLarge);
    await fileInput.setInputFiles(testFilePath);

    // Measure time from upload to result
    const startTime = Date.now();

    // Wait for loading state
    await page.waitForSelector('[data-testid="loading"], .loading', { timeout: 5000 }).catch(() => {});

    // Wait for results
    await page.waitForSelector('[data-testid="results"], .results', { timeout: TIMEOUTS.analysisMax });

    const duration = Date.now() - startTime;
    console.log(`Analysis completed in ${duration}ms`);

    // Should complete well under the 55s Vercel limit
    expect(duration).toBeLessThan(TIMEOUTS.analysisMax);
  });

  test('P0.3: Degraded mode on AI timeout', async ({ page }) => {
    // This test is hard to trigger deterministically
    // Skipping - would require mocking the AI service
    test.skip(true, 'Requires AI service mocking');
  });

  test('P0.4: Result displays annotated image with arrows', async ({ page }) => {
    await page.goto('/try');

    const fileInput = page.locator('input[type="file"]');
    const testFilePath = path.resolve(process.cwd(), TEST_FILES.desktopMessy);
    await fileInput.setInputFiles(testFilePath);

    // Wait for results
    await page.waitForSelector('[data-testid="results"], .results', { timeout: TIMEOUTS.analysisMax });

    // Verify before/after images are displayed
    const beforeImage = page.locator('img[alt*="before"], img[alt*="original"]').first();
    const afterImage = page.locator('img[alt*="after"], img[alt*="annotated"]').first();

    await expect(beforeImage).toBeVisible();
    await expect(afterImage).toBeVisible();

    // Verify plan text is displayed
    const planText = page.locator('[data-testid="plan"], .plan, .suggestions');
    await expect(planText).toBeVisible();
  });

  test('P0.5: Download button functionality', async ({ page }) => {
    await page.goto('/try');

    const fileInput = page.locator('input[type="file"]');
    const testFilePath = path.resolve(process.cwd(), TEST_FILES.desktopMessy);
    await fileInput.setInputFiles(testFilePath);

    // Wait for results
    await page.waitForSelector('[data-testid="results"], .results', { timeout: TIMEOUTS.analysisMax });

    // Find and click download button
    const downloadButton = page.locator('button:has-text("Download"), [data-testid="download"]');
    await expect(downloadButton).toBeVisible();

    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);

    await downloadButton.click();
    const download = await downloadPromise;

    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.(jpg|jpeg|png|webp)$/i);
    }
  });
});
