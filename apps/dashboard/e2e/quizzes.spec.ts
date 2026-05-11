import { test, expect } from './fixtures';

test.describe('Quizzes - Management', () => {
  test('admin can navigate to quiz page', async ({ adminPage }) => {
    await adminPage.goto('/org/5g-numultimedia/quiz');
    await expect(adminPage.locator('h1').filter({ hasText: /測驗|quizzes|interactive/i })).toBeVisible();
  });

  test('quiz page shows create quiz button', async ({ adminPage }) => {
    await adminPage.goto('/org/5g-numultimedia/quiz');
    await expect(adminPage.locator('button').filter({ hasText: /創建測驗|create quiz/i })).toBeVisible();
  });

  test('admin can open create quiz modal', async ({ adminPage }) => {
    await adminPage.goto('/org/5g-numultimedia/quiz');
    await adminPage.locator('button').filter({ hasText: /創建測驗|create quiz/i }).click();
    await expect(adminPage.getByRole('textbox', { name: /測驗標題|quiz title/i })).toBeVisible();
  });

  test('admin can create a new quiz', async ({ adminPage }) => {
    await adminPage.goto('/org/5g-numultimedia/quiz');
    await adminPage.locator('button').filter({ hasText: /創建測驗|create quiz/i }).click();
    await adminPage.getByRole('textbox', { name: /測驗標題|quiz title/i }).fill('Test Quiz ' + Date.now());
    await adminPage.locator('button').filter({ hasText: /繼續|continue|next/i }).click();
  });
});

test.describe('Quizzes - Student Taking', () => {
  test('student can view available quizzes', async ({ studentPage }) => {
    await studentPage.goto('/org/5g-numultimedia/quiz');
    await expect(studentPage.locator('h1').filter({ hasText: /測驗|quizzes/i })).toBeVisible();
  });
});
