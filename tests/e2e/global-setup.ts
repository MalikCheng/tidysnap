import * as fs from 'fs';
import * as path from 'path';

/**
 * Global setup for Playwright tests
 * - Verify test fixtures exist
 * - Ensure dev server is reachable
 * - Prepare test environment
 */
export default async function globalSetup() {
  // Verify BASE_URL is accessible
  const baseUrl = process.env.BASE_URL || 'http://localhost:4321';

  console.log('🔧 Running global setup...');

  // Check fixtures directory
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');
  if (!fs.existsSync(fixturesDir)) {
    console.warn(`⚠️ Fixtures directory not found: ${fixturesDir}`);
    console.warn('   Some tests may fail without fixture images.');
  } else {
    console.log(`✅ Fixtures directory exists: ${fixturesDir}`);
  }

  // Check if dev server is running (unless in CI)
  if (!process.env.CI) {
    try {
      const response = await fetch(baseUrl, { method: 'HEAD' });
      if (response.ok) {
        console.log(`✅ Dev server reachable: ${baseUrl}`);
      } else {
        console.warn(`⚠️ Dev server returned ${response.status}`);
      }
    } catch (error) {
      console.warn(`⚠️ Dev server not reachable: ${baseUrl}`);
      console.warn('   Tests will fail if server is not running.');
    }
  }

  // Create reports directory
  const reportsDir = path.join(process.cwd(), 'tests/reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.mkdirSync(path.join(reportsDir, 'html'), { recursive: true });
  }

  console.log('✅ Global setup complete');
}
