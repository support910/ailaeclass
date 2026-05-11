import { test, expect } from './fixtures';

const TEST_COURSE_ID = '0baf93d6-8b52-4804-a17f-a81e2b3f7eef';

test.describe('Courses - Admin Flow', () => {
  test('admin can view courses list', async ({ adminPage }) => {
    await adminPage.goto('/org/5g-numultimedia/courses');
    await expect(adminPage.locator('h1').filter({ hasText: /課程|courses/i })).toBeVisible();
  });

  test('admin can navigate to course detail', async ({ adminPage }) => {
    await adminPage.goto(`/courses/${TEST_COURSE_ID}`);
    // Page redirects to /lessons?next=true
    await expect(adminPage).toHaveURL(/.*lessons/);
    await expect(adminPage.locator('h1, h2, h3, h4').first()).toBeVisible();
  });

  test('course detail page has navigation tabs', async ({ adminPage }) => {
    await adminPage.goto(`/courses/${TEST_COURSE_ID}/lessons?next=true`);
    await expect(adminPage.locator('button, [role="tab"]').filter({ hasText: /內容|Lessons/i })).toBeVisible();
  });

  test('admin can view course lessons', async ({ adminPage }) => {
    await adminPage.goto(`/courses/${TEST_COURSE_ID}/lessons`);
    await expect(adminPage.locator('h1, h2, h3, h4').filter({ hasText: /內容|lessons/i })).toBeVisible();
  });

  test('admin can view course people', async ({ adminPage }) => {
    await adminPage.goto(`/courses/${TEST_COURSE_ID}/people`);
    await expect(adminPage.locator('h1, h2, h3, h4').filter({ hasText: /人員|people/i })).toBeVisible();
  });

  test('admin can view course settings', async ({ adminPage }) => {
    await adminPage.goto(`/courses/${TEST_COURSE_ID}/settings`);
    await expect(adminPage.locator('h1, h2, h3, h4').filter({ hasText: /設置|settings/i })).toBeVisible();
  });

  test('admin can view course analytics', async ({ adminPage }) => {
    await adminPage.goto(`/courses/${TEST_COURSE_ID}/analytics`);
    await expect(adminPage.locator('h1, h2, h3, h4').filter({ hasText: /分析|analytics/i })).toBeVisible();
  });

  test('admin can view attendance page', async ({ adminPage }) => {
    await adminPage.goto(`/courses/${TEST_COURSE_ID}/attendance`);
    await expect(adminPage.locator('h1, h2, h3, h4').filter({ hasText: /attendance|考勤/i })).toBeVisible();
  });

  test('admin can view certificates page', async ({ adminPage }) => {
    await adminPage.goto(`/courses/${TEST_COURSE_ID}/certificates`);
    await expect(adminPage.locator('h1, h2, h3, h4').filter({ hasText: /certificates|證書/i })).toBeVisible();
  });
});

test.describe('Courses - Student Flow', () => {
  test('student can access LMS explore page', async ({ studentPage }) => {
    await studentPage.goto('/lms/explore');
    await expect(studentPage.locator('h1').filter({ hasText: /探索|explore/i })).toBeVisible();
  });

  test('student can access my learning page', async ({ studentPage }) => {
    await studentPage.goto('/lms/mylearning');
    await expect(studentPage.locator('h1').filter({ hasText: /學習|learning/i })).toBeVisible();
  });

  test('student can view exercise list', async ({ studentPage }) => {
    await studentPage.goto('/lms/exercises');
    await expect(studentPage.locator('h1').filter({ hasText: /練習|exercises/i })).toBeVisible();
  });
});
