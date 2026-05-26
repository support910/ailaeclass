const fs = require('fs');
const path = require('path');

const translationsDir = path.join(__dirname, '../src/lib/utils/translations');
const locales = ['en', 'zh', 'zh-TW', 'hi', 'fr', 'pl', 'pt', 'de', 'vi', 'ru', 'es', 'da'];

let hasError = false;

for (const locale of locales) {
  const filePath = path.join(translationsDir, `${locale}.json`);
  let data;

  // 1. Validate JSON
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`[${locale}] JSON valid`);
  } catch (e) {
    console.error(`[${locale}] JSON INVALID: ${e.message}`);
    hasError = true;
    continue;
  }

  // 2. Check components.exam exists
  if (!data.components || !data.components.exam) {
    console.error(`[${locale}] MISSING: components.exam`);
    hasError = true;
  } else {
    console.log(`[${locale}] components.exam OK`);
  }

  // 3. Check course.navItems.nav_exams exists
  if (!data.course || !data.course.navItems || !data.course.navItems.nav_exams) {
    console.error(`[${locale}] MISSING: course.navItems.nav_exams`);
    hasError = true;
  } else {
    console.log(`[${locale}] course.navItems.nav_exams OK`);
  }

  // 4. Check new exam action keys
  const requiredExamKeys = [
    'retry',
    'edit_action',
    'preview_action',
    'org_not_ready',
    'delete_draft',
    'delete_draft_confirm',
    'delete_draft_only'
  ];
  for (const key of requiredExamKeys) {
    if (!data.components || !data.components.exam || !data.components.exam[key]) {
      console.error(`[${locale}] MISSING: components.exam.${key}`);
      hasError = true;
    } else {
      console.log(`[${locale}] components.exam.${key} OK`);
    }
  }
}

if (hasError) {
  console.error('\nValidation FAILED. Fix missing keys above.');
  process.exit(1);
} else {
  console.log('\nAll translations valid and complete.');
  process.exit(0);
}
