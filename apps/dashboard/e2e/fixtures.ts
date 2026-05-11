import { test as base, expect, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const test = base.extend<{
  adminPage: Page;
  studentPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(__dirname, '..', 'playwright', '.auth', 'admin.json')
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  studentPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(__dirname, '..', 'playwright', '.auth', 'student.json')
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  }
});

export { expect };
