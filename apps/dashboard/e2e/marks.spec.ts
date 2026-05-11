import { test, expect } from './fixtures';

const TEST_COURSE_ID = '0baf93d6-8b52-4804-a17f-a81e2b3f7eef';

test.describe('Marks / Grades', () => {
  test('marks page redirects to lessons', async ({ adminPage }) => {
    await adminPage.goto(`/courses/${TEST_COURSE_ID}/marks`);
    // Marks page redirects to lessons page in this app
    await expect(adminPage).toHaveURL(/.*lessons/);
  });
});

test.describe('Certificates', () => {
  test('admin can view certificates page', async ({ adminPage }) => {
    await adminPage.goto(`/courses/${TEST_COURSE_ID}/certificates`);
    await expect(adminPage.locator('h1, h2, h3, h4').filter({ hasText: /certificates|證書/i })).toBeVisible();
  });
});
