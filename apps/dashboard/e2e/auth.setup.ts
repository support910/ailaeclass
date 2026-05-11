import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const authDir = path.join(__dirname, '..', 'playwright', '.auth');
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('admin@test.com');
  await page.locator('input[type="password"]').fill('123456');
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/.*home|.*courses|.*dashboard|.*lms|.*org/);
  await page.context().storageState({ path: path.join(authDir, 'admin.json') });
});

setup('authenticate as student', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('student@test.com');
  await page.locator('input[type="password"]').fill('123456');
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/.*home|.*courses|.*dashboard|.*lms/);
  await page.context().storageState({ path: path.join(authDir, 'student.json') });
});
