const fs = require('fs');
const path = require('path');

const translationsDir = path.resolve(__dirname, '../src/lib/utils/translations');

const additions = {
  en: {
    login: {
      choose_role: 'I want to register as...',
      role_student: 'Student',
      role_student_desc: 'Join courses, take exams, and learn',
      role_teacher: 'Teacher',
      role_teacher_desc: 'Create courses, manage classes, and teach students',
      back_to_role: 'Back'
    },
    teacher_pending: {
      title: 'Approval Pending',
      heading: 'Account Awaiting Approval',
      message: 'Your teacher registration has been submitted. An administrator will review and approve your account shortly.',
      registered_email: 'Registered email:',
      back_home: 'Back to Home'
    }
  },
  zh: {
    login: {
      choose_role: '我想注册为...',
      role_student: '学生',
      role_student_desc: '加入课程、参加考试、学习成长',
      role_teacher: '教师',
      role_teacher_desc: '创建课程、管理班级、教授学生',
      back_to_role: '返回'
    },
    teacher_pending: {
      title: '等待审核',
      heading: '账号等待审核',
      message: '您的教师注册已提交。管理员将尽快审核并批准您的账号。',
      registered_email: '注册邮箱：',
      back_home: '返回首页'
    }
  },
  'zh-TW': {
    login: {
      choose_role: '我想註冊為...',
      role_student: '學生',
      role_student_desc: '加入課程、參加考試、學習成長',
      role_teacher: '教師',
      role_teacher_desc: '創建課程、管理班級、教授學生',
      back_to_role: '返回'
    },
    teacher_pending: {
      title: '等待審核',
      heading: '帳號等待審核',
      message: '您的教師註冊已提交。管理員將盡快審核並批准您的帳號。',
      registered_email: '註冊郵箱：',
      back_home: '返回首頁'
    }
  }
};

// Fallback for other locales (use English)
const fallback = additions.en;

const files = [
  'da.json', 'de.json', 'en.json', 'es.json', 'fr.json',
  'hi.json', 'pl.json', 'pt.json', 'ru.json', 'vi.json',
  'zh.json', 'zh-TW.json'
];

for (const file of files) {
  const filePath = path.join(translationsDir, file);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);

  const locale = file.replace('.json', '');
  const add = additions[locale] || fallback;

  // Merge login keys
  if (!data.login) data.login = {};
  Object.assign(data.login, add.login);

  // Merge teacher_pending keys
  if (!data.teacher_pending) data.teacher_pending = {};
  Object.assign(data.teacher_pending, add.teacher_pending);

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`Updated ${file}`);
}

console.log('Done');
