import { test, expect } from '@playwright/test';

test.describe('Public Navigation & Layout', () => {
  test('login page loads without errors', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
    await expect(page.locator('form')).toBeVisible();
  });

  test('signup page loads correctly', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('forgot password page loads', async ({ page }) => {
    await page.goto('/forgot');
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('responsive layout on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');
    await expect(page.locator('form')).toBeVisible();
  });
});

test.describe('Protected Routes Redirect', () => {
  test('redirects unauthenticated users from LMS pages', async ({ page }) => {
    await page.goto('/lms/mylearning');
    await expect(page).toHaveURL(/.*login|.*signup/);
  });

  test('redirects unauthenticated users from org pages', async ({ page }) => {
    await page.goto('/org/5g-numultimedia/courses');
    await expect(page).toHaveURL(/.*login|.*signup/);
  });
});
