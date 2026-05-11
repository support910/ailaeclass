import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure clean state (no storage state)
    await page.context().clearCookies();
  });

  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('form button[type="submit"]')).toBeVisible();
  });

  test('login form validates empty fields', async ({ page }) => {
    await page.goto('/login');
    await page.locator('form button[type="submit"]').click();
    // Form should still show inputs after failed validation
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('signup page has all required fields', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').nth(1)).toBeVisible();
  });

  test('can navigate to forgot password page', async ({ page }) => {
    await page.goto('/login');
    await page.locator('a[href="/forgot"]').click();
    await expect(page).toHaveURL(/.*forgot/);
    await expect(page.locator('text=/forgot|忘記|password/i').first()).toBeVisible();
  });

  test('forgot password page has email input', async ({ page }) => {
    await page.goto('/forgot');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('admin can login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@test.com');
    await page.locator('input[type="password"]').fill('123456');
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/.*home|.*courses|.*dashboard|.*lms|.*org/);
    // Should be redirected away from login
    await expect(page).not.toHaveURL(/.*login/);
  });

  test('student can login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('student@test.com');
    await page.locator('input[type="password"]').fill('123456');
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/.*home|.*courses|.*dashboard|.*lms/);
    await expect(page).not.toHaveURL(/.*login/);
  });

  test('login fails with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('wrong@example.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.locator('form button[type="submit"]').click();
    await expect(page.locator('text=/invalid|錯誤|error/i').first()).toBeVisible();
  });
});
