import { test, expect } from './fixtures';

const TEST_COURSE_ID = '0baf93d6-8b52-4804-a17f-a81e2b3f7eef';
const TEST_LESSON_ID = 'e5aa40c1-9e2d-411b-84d8-e8bf5e5d6d4f';

test.describe('Homework / Exercises - Teacher Flow', () => {
  test('teacher can view course submissions page', async ({ adminPage }) => {
    await adminPage.goto(`/courses/${TEST_COURSE_ID}/submissions`);
    await expect(adminPage.locator('body')).toBeVisible();
  });

  test('teacher can view lesson exercises', async ({ adminPage }) => {
    await adminPage.goto(`/courses/${TEST_COURSE_ID}/lessons/${TEST_LESSON_ID}/exercises`);
    await expect(adminPage.locator('h1, h2, h3, h4').first()).toBeVisible();
  });
});

test.describe('Homework / Exercises - Student Flow', () => {
  test('student can view exercise list in LMS', async ({ studentPage }) => {
    await studentPage.goto('/lms/exercises');
    await expect(studentPage.locator('h1').filter({ hasText: /練習|exercises/i })).toBeVisible();
  });

  test('student can view exercises by status', async ({ studentPage }) => {
    await studentPage.goto('/lms/exercises');
    // Student LMS is in English — check status labels exist
    await expect(studentPage.getByText('Not Submitted', { exact: true })).toBeVisible();
    await expect(studentPage.getByText('Submitted', { exact: true })).toBeVisible();
    await expect(studentPage.getByText('Grading In Progress', { exact: true })).toBeVisible();
    await expect(studentPage.getByText('Graded', { exact: true })).toBeVisible();
  });

  test('student can open a lesson', async ({ studentPage }) => {
    await studentPage.goto(`/courses/${TEST_COURSE_ID}/lessons/${TEST_LESSON_ID}`);
    await expect(studentPage.locator('h1, h2, h3, h4').first()).toBeVisible();
  });

  test('student can view lesson exercises', async ({ studentPage }) => {
    await studentPage.goto(`/courses/${TEST_COURSE_ID}/lessons/${TEST_LESSON_ID}/exercises`);
    await expect(studentPage.locator('h1, h2, h3, h4').first()).toBeVisible();
  });
});
