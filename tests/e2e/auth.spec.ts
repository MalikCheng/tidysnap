import { test, expect, request } from '@playwright/test';
import { TEST_USERS } from '../fixtures/test-data';

/**
 * P1 E2E Tests: Authentication Flow
 * Tests login, registration, and session management
 */
test.describe('Authentication', () => {
  test.setTimeout(30000);

  test('P1.1: Auth modal opens on /try page', async ({ page }) => {
    await page.goto('/try');
    await page.waitForLoadState('networkidle');

    // Click login/signup button
    const authButton = page.locator('button:has-text("Login"), button:has-text("Sign"), a:has-text("Login")').first();
    await authButton.click();

    // Verify modal appears
    const modal = page.locator('[data-testid="auth-modal"], .modal, .auth-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
  });

  test('P1.2: Login with valid credentials', async ({ page }) => {
    await page.goto('/try');
    await page.waitForLoadState('networkidle');

    // Open auth modal
    const authButton = page.locator('button:has-text("Login"), button:has-text("Sign")').first();
    await authButton.click();

    // Wait for modal
    await page.waitForSelector('[data-testid="auth-modal"], .modal', { timeout: 3000 });

    // Switch to login tab if needed
    const loginTab = page.locator('button:has-text("Login"), [role="tab"]:has-text("Login")').first();
    await loginTab.click().catch(() => {}); // May already be on login

    // Fill form
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    const passwordInput = page.locator('input[type="password"]');

    await emailInput.fill(TEST_USERS.free.email);
    await passwordInput.fill(TEST_USERS.free.password);

    // Submit
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');

    // Wait for modal to close
    await page.waitForSelector('[data-testid="auth-modal"], .modal', { state: 'hidden', timeout: 5000 }).catch(() => {});

    // Verify logged in state
    const userBadge = page.locator('[data-testid="user-badge"], .user-badge, .user-info');
    await expect(userBadge).toBeVisible({ timeout: 3000 });
  });

  test('P1.3: Login with invalid credentials', async ({ page }) => {
    await page.goto('/try');

    // Open auth modal
    await page.click('button:has-text("Login"), button:has-text("Sign")'.first());
    await page.waitForSelector('[data-testid="auth-modal"], .modal', { timeout: 3000 });

    // Fill with invalid credentials
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    const passwordInput = page.locator('input[type="password"]');

    await emailInput.fill('invalid@test.com');
    await passwordInput.fill('wrongpassword');

    // Submit
    await page.click('button[type="submit"], button:has-text("Login")');

    // Verify error message
    const errorMessage = page.locator('text=/Invalid|Credentials|incorrect/i');
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
  });

  test('P1.4: Registration flow', async ({ page }) => {
    await page.goto('/try');

    // Open auth modal
    await page.click('button:has-text("Sign"), a:has-text("Sign Up")'.first());
    await page.waitForSelector('[data-testid="auth-modal"], .modal', { timeout: 3000 });

    // Switch to signup tab
    const signupTab = page.locator('button:has-text("Sign Up"), [role="tab"]:has-text("Sign Up")').first();
    await signupTab.click();

    // Fill registration form
    const timestamp = Date.now();
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    const passwordInput = page.locator('input[type="password"]');

    await emailInput.fill(`qa-test-${timestamp}@tidysnap.test`);
    await passwordInput.fill('TestPass123!');

    // Submit
    await page.click('button[type="submit"], button:has-text("Sign Up"), button:has-text("Create")');

    // Wait for success or redirect
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  });

  test('P1.5: API returns correct subscription status', async () => {
    const context = await request.newContext();

    // First register a test user
    const registerResponse = await context.post('/api/auth', {
      form: {
        action: 'register',
        email: `api-test-${Date.now()}@tidysnap.test`,
        password: 'test123',
      },
    });

    expect(registerResponse.ok()).toBeTruthy();

    // Then check subscription status
    const subscriptionResponse = await context.get('/api/subscription');
    const subscription = await subscriptionResponse.json();

    expect(subscription).toHaveProperty('loggedIn');
    expect(subscription).toHaveProperty('user');

    if (subscription.loggedIn) {
      expect(subscription.user).toHaveProperty('email');
      expect(subscription.user).toHaveProperty('subscription');
    }
  });

  test('P1.6: Google OAuth button exists', async ({ page }) => {
    await page.goto('/try');

    // Open auth modal
    await page.click('button:has-text("Login"), button:has-text("Sign")'.first());
    await page.waitForSelector('[data-testid="auth-modal"], .modal', { timeout: 3000 });

    // Verify Google OAuth button exists
    const googleButton = page.locator('button:has-text("Google"), [aria-label*="Google" i]');
    await expect(googleButton).toBeVisible({ timeout: 3000 });
  });

  test('P1.7: Logout functionality', async ({ page }) => {
    // Login first
    await page.goto('/try');
    await page.click('button:has-text("Login"), button:has-text("Sign")'.first());
    await page.waitForSelector('[data-testid="auth-modal"], .modal', { timeout: 3000 });

    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]');
    const passwordInput = page.locator('input[type="password"]');
    await emailInput.fill(TEST_USERS.free.email);
    await passwordInput.fill(TEST_USERS.free.password);
    await page.click('button[type="submit"], button:has-text("Login")');
    await page.waitForTimeout(1000);

    // Look for logout button
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout")');
    if (await logoutButton.isVisible({ timeout: 2000 })) {
      await logoutButton.click();
      await page.waitForTimeout(500);

      // Verify logged out state
      const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign")').first();
      await expect(loginButton).toBeVisible();
    }
  });
});
