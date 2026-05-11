import { test, expect } from './fixtures';

const TEST_COURSE_ID = '0baf93d6-8b52-4804-a17f-a81e2b3f7eef';

test.describe('People Management - Admin', () => {
  test('admin can view course people list', async ({ adminPage }) => {
    await adminPage.goto(`/courses/${TEST_COURSE_ID}/people`);
    await expect(adminPage.locator('h1, h2, h3, h4').filter({ hasText: /人員|people/i })).toBeVisible();
  });

  test('admin can view org audience', async ({ adminPage }) => {
    await adminPage.goto('/org/5g-numultimedia/audience');
    await expect(adminPage.locator('h1').filter({ hasText: /受眾|audience/i })).toBeVisible();
  });
});
