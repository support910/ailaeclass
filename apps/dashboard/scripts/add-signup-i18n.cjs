const fs = require('fs');
const path = require('path');

const translationsDir = path.resolve(__dirname, '../src/lib/utils/translations');

const additions = {
  en: {
    signup: {
      choose_role: 'I want to register as...',
      student: 'Student',
      student_desc: 'Join courses, take exams, and learn',
      teacher: 'Teacher',
      teacher_desc: 'Create courses, manage classes, and teach students',
      back_to_role: 'Back',
      role_required: 'Please select a role to continue.',
      teacher_pending_title: 'Account Awaiting Approval',
      teacher_pending_desc: 'Your teacher registration has been submitted. An administrator will review and approve your account shortly.',
      teacher_pending_action: 'Back to Home'
    },
    'course.navItem.people.teams': {
      admin_only_invite: 'Only administrators can invite team members.'
    }
  },
  zh: {
    signup: {
      choose_role: '我想注册为...',
      student: '学生',
      student_desc: '加入课程、参加考试、学习成长',
      teacher: '教师',
      teacher_desc: '创建课程、管理班级、教授学生',
      back_to_role: '返回',
      role_required: '请选择身份以继续。',
      teacher_pending_title: '账号等待审核',
      teacher_pending_desc: '您的教师注册已提交。管理员将尽快审核并批准您的账号。',
      teacher_pending_action: '返回首页'
    },
    'course.navItem.people.teams': {
      admin_only_invite: '只有管理员可以邀请团队成员。'
    }
  },
  'zh-TW': {
    signup: {
      choose_role: '我想註冊為...',
      student: '學生',
      student_desc: '加入課程、參加考試、學習成長',
      teacher: '教師',
      teacher_desc: '創建課程、管理班級、教授學生',
      back_to_role: '返回',
      role_required: '請選擇身份以繼續。',
      teacher_pending_title: '帳號等待審核',
      teacher_pending_desc: '您的教師註冊已提交。管理員將盡快審核並批准您的帳號。',
      teacher_pending_action: '返回首頁'
    },
    'course.navItem.people.teams': {
      admin_only_invite: '只有管理員可以邀請團隊成員。'
    }
  }
};

const fallback = additions.en;

const files = [
  'da.json', 'de.json', 'en.json', 'es.json', 'fr.json',
  'hi.json', 'pl.json', 'pt.json', 'ru.json', 'vi.json',
  'zh.json', 'zh-TW.json'
];

function setDeep(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key]) current[key] = {};
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

for (const file of files) {
  const filePath = path.join(translationsDir, file);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);

  const locale = file.replace('.json', '');
  const add = additions[locale] || fallback;

  // Merge signup keys
  if (!data.signup) data.signup = {};
  Object.assign(data.signup, add.signup);

  // Merge course.navItem.people.teams keys
  if (!data.course) data.course = {};
  if (!data.course.navItem) data.course.navItem = {};
  if (!data.course.navItem.people) data.course.navItem.people = {};
  if (!data.course.navItem.people.teams) data.course.navItem.people.teams = {};
  Object.assign(data.course.navItem.people.teams, add['course.navItem.people.teams']);

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`Updated ${file}`);
}

console.log('Done');
