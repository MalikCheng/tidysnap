/**
 * Global teardown for Playwright tests
 * - Cleanup test artifacts
 * - Close any open browser contexts
 */
export default async function globalTeardown() {
  console.log('🧹 Running global teardown...');
  // Any cleanup logic here
  console.log('✅ Global teardown complete');
}
