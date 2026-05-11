import { test, expect } from './fixtures';

const TEST_COURSE_ID = '0baf93d6-8b52-4804-a17f-a81e2b3f7eef';

test.describe('Attendance', () => {
  test('admin can view attendance page', async ({ adminPage }) => {
    await adminPage.goto(`/courses/${TEST_COURSE_ID}/attendance`);
    await expect(adminPage.locator('h1, h2, h3, h4').filter({ hasText: /attendance|考勤/i })).toBeVisible();
  });
});
