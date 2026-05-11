import { test, expect } from './fixtures';

test.describe('Community - Admin', () => {
  test('admin can view org community', async ({ adminPage }) => {
    await adminPage.goto('/org/5g-numultimedia/community');
    await expect(adminPage.locator('h1').filter({ hasText: /社區|community/i })).toBeVisible();
  });

  test('admin can open ask community page', async ({ adminPage }) => {
    await adminPage.goto('/org/5g-numultimedia/community/ask');
    await expect(adminPage.locator('h1, h2, h3, h4').filter({ hasText: /提問|ask/i })).toBeVisible();
  });
});

test.describe('Community - Student', () => {
  test('student can view LMS community', async ({ studentPage }) => {
    await studentPage.goto('/lms/community');
    await expect(studentPage.locator('h1, h2, h3, h4').filter({ hasText: /社區|community/i })).toBeVisible();
  });

  test('student can open ask question page', async ({ studentPage }) => {
    await studentPage.goto('/lms/community/ask');
    await expect(studentPage.locator('h1, h2, h3, h4').filter({ hasText: /提問|ask/i })).toBeVisible();
  });
});
