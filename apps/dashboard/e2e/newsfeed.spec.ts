import { test, expect } from './fixtures';

const TEST_COURSE_ID = '0baf93d6-8b52-4804-a17f-a81e2b3f7eef';

test.describe('News Feed - Admin', () => {
  test('admin can view course with news feed tab', async ({ adminPage }) => {
    await adminPage.goto(`/courses/${TEST_COURSE_ID}`);
    // Verify the news feed tab is visible in the course sidebar
    await expect(adminPage.locator('button, [role="tab"]').filter({ hasText: '動態' })).toBeVisible();
    await expect(adminPage.locator('h1, h2, h3, h4').first()).toBeVisible();
  });
});

test.describe('News Feed - Student', () => {
  test('student can view LMS community feed', async ({ studentPage }) => {
    await studentPage.goto('/lms/community');
    await expect(studentPage.locator('h1, h2, h3, h4').filter({ hasText: /社區|community/i })).toBeVisible();
  });
});
