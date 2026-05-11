import { test, expect } from './fixtures';

test.describe('Profile Settings', () => {
  test('user can view profile settings', async ({ adminPage }) => {
    await adminPage.goto('/org/5g-numultimedia/settings');
    await expect(adminPage.locator('h1').filter({ hasText: /設置|settings/i })).toBeVisible();
    await expect(adminPage.locator('[role="tab"]').filter({ hasText: /個人資料|profile/i })).toBeVisible();
  });

  test('user can view org settings tabs', async ({ adminPage }) => {
    await adminPage.goto('/org/5g-numultimedia/settings');
    await expect(adminPage.locator('[role="tab"]').filter({ hasText: /個人資料|profile/i })).toBeVisible();
    await expect(adminPage.locator('[role="tab"]').filter({ hasText: /組織|organization/i })).toBeVisible();
  });
});

test.describe('Organization Settings', () => {
  test('admin can access team settings', async ({ adminPage }) => {
    await adminPage.goto('/org/5g-numultimedia/settings/teams');
    await expect(adminPage.locator('h1, h2, h3, h4').filter({ hasText: /team|團隊/i })).toBeVisible();
  });

  test('admin can access domain settings', async ({ adminPage }) => {
    await adminPage.goto('/org/5g-numultimedia/settings/domains');
    await expect(adminPage.locator('h1, h2, h3, h4').filter({ hasText: /domain|域名/i })).toBeVisible();
  });

  test('admin can access customize LMS settings', async ({ adminPage }) => {
    await adminPage.goto('/org/5g-numultimedia/settings/customize-lms');
    await expect(adminPage.locator('h1, h2, h3, h4').filter({ hasText: /customize|自定義|學習管理|著陸頁|theme/i })).toBeVisible();
  });
});

test.describe('LMS Settings - Student', () => {
  test('student can view LMS settings', async ({ studentPage }) => {
    await studentPage.goto('/lms/settings');
    await expect(studentPage.locator('h1, h2, h3, h4').filter({ hasText: /settings|設置/i })).toBeVisible();
  });
});
