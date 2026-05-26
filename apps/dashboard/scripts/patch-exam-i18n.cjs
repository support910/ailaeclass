const fs = require('fs');
const path = require('path');

const translationsDir = path.join(__dirname, '../src/lib/utils/translations');
const enFile = path.join(translationsDir, 'en.json');

// Locales that need components.exam patched
const targetLocales = ['da', 'de', 'es', 'fr', 'hi', 'pl', 'pt', 'ru', 'vi'];

// Read en.json
const enData = JSON.parse(fs.readFileSync(enFile, 'utf8'));
const examBlock = enData.components.exam;

if (!examBlock) {
  console.error('Missing components.exam in en.json');
  process.exit(1);
}

let hasError = false;

for (const locale of targetLocales) {
  const filePath = path.join(translationsDir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Patch components.exam
  if (!data.components) {
    data.components = {};
  }
  if (!data.components.exam) {
    data.components.exam = examBlock;
    console.log(`[${locale}] Added components.exam`);
  } else {
    console.log(`[${locale}] components.exam already exists, skipping`);
  }

  // Patch course.navItems.nav_exams
  if (!data.course) data.course = {};
  if (!data.course.navItems) data.course.navItems = {};
  if (!data.course.navItems.nav_exams) {
    data.course.navItems.nav_exams = 'Exams';
    console.log(`[${locale}] Added course.navItems.nav_exams`);
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// Also ensure en/zh/zh-TW have nav_exams
const ensureNavExams = ['en', 'zh', 'zh-TW'];
for (const locale of ensureNavExams) {
  const filePath = path.join(translationsDir, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!data.course) data.course = {};
  if (!data.course.navItems) data.course.navItems = {};
  if (!data.course.navItems.nav_exams) {
    const label = locale === 'zh' ? '考试' : locale === 'zh-TW' ? '考試' : 'Exams';
    data.course.navItems.nav_exams = label;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`[${locale}] Added course.navItems.nav_exams = "${label}"`);
  } else {
    console.log(`[${locale}] course.navItems.nav_exams already exists`);
  }
}

console.log('Patch complete.');
