const fs = require('fs');
const path = require('path');

const translationsDir = path.join(__dirname, '../src/lib/utils/translations');
const locales = ['en', 'zh', 'zh-TW', 'hi', 'fr', 'pl', 'pt', 'de', 'vi', 'ru', 'es', 'da'];

const newKeys = {
  retry: 'Retry',
  edit_action: 'Edit',
  preview_action: 'Preview',
  org_not_ready: 'Organization not ready'
};

let hasError = false;

for (const locale of locales) {
  const filePath = path.join(translationsDir, `${locale}.json`);
  let data;

  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`[${locale}] JSON INVALID: ${e.message}`);
    hasError = true;
    continue;
  }

  if (!data.components) data.components = {};
  if (!data.components.exam) {
    console.error(`[${locale}] MISSING components.exam`);
    hasError = true;
    continue;
  }

  for (const [key, enValue] of Object.entries(newKeys)) {
    if (!data.components.exam[key]) {
      // For non-English locales, use English fallback
      data.components.exam[key] = enValue;
      console.log(`[${locale}] Added components.exam.${key}`);
    } else {
      console.log(`[${locale}] components.exam.${key} already exists`);
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`[${locale}] Updated`);
}

if (hasError) {
  process.exit(1);
} else {
  console.log('\nAll locales patched successfully.');
  process.exit(0);
}
