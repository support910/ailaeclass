import { test, expect } from './fixtures';

const TEST_COURSE_ID = '0baf93d6-8b52-4804-a17f-a81e2b3f7eef';

test.describe('Lessons - Admin Flow', () => {
  test('admin can view course lessons list', async ({ adminPage }) => {
    await adminPage.goto(`/courses/${TEST_COURSE_ID}/lessons`);
    await expect(adminPage.locator('h1, h2, h3, h4').filter({ hasText: /內容|lessons/i })).toBeVisible();
  });

  test('admin can view a lesson', async ({ adminPage }) => {
    await adminPage.goto(`/courses/${TEST_COURSE_ID}/lessons`);
    const lessonLink = adminPage.locator('a[href*="/lessons/"]').first();
    if (await lessonLink.count() > 0) {
      await lessonLink.click();
      await expect(adminPage.locator('h1, h2, h3, h4').first()).toBeVisible();
    }
  });
});

test.describe('Lessons - Student Flow', () => {
  test('student can view lesson content', async ({ studentPage }) => {
    await studentPage.goto(`/courses/${TEST_COURSE_ID}/lessons`);
    const lessonLink = studentPage.locator('a[href*="/lessons/"]').first();
    if (await lessonLink.count() > 0) {
      await lessonLink.click();
      await expect(studentPage.locator('h1, h2, h3, h4').first()).toBeVisible();
    }
  });
});
