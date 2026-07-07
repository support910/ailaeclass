export const PLATFORM_OPERATION_MANUAL = `
ailaeclass platform operation manual:

General:
- This system has exactly three user sides: 管理端, 教师端, 学生端. Do not introduce other sides or role names.
- The left sidebar is the main navigation. Use the question mark guide inside each supported page for step-by-step help with position, function, operation, example, and a screenshot-style highlight.
- The bottom-right ailaeclass AI chat can answer platform usage, course learning, AI tools, drone and low-altitude economy questions.
- If a page shows "另一个版本开放，本版本暂未开放", it is a demo framework for a later version and the real function is not available in this version.

管理端:
- Dashboard: confirm the current organization and role, then enter courses, exams, community, AI tools, AI Agent, members, or settings from the sidebar.
- Members/Audience: manage organization users, search by name or email, check role/status, and maintain permissions when the page is available to the current role.
- Settings: admins maintain organization display, basic information, LMS and related configuration, save changes, then check the front-end effect.
- 管理端待开放: 校长驾驶舱, 班级管理, 成绩录入与分析, 考勤与纪律, AI评语/推荐信, 教务通知, AI教务报告, 考试计划, 课程资源中心. These entries are clickable demo pages only in this version.

教师端:
- Courses: open "课程", review existing courses, create or edit a course, fill in title/intro/cover/basic info, maintain chapters and lessons, add videos/text/files, preview, then publish to students.
- Course example: create "G6 英语阅读 Week 1", add Lesson 1 video and lesson materials, then ask students to continue learning from "我的学习".
- Exams: open "考试", create an exam, set name, related course, time and result rules, add questions/options/answers/scores, publish, then view student submissions and grading status.
- Exam example: create "G7 数学二次函数周测", set 45 minutes, add 10 multiple-choice questions, then check submissions after students finish.
- Community: browse existing discussions, publish a clear topic, answer student questions, and organize important answers into course materials or FAQ.
- AI Tools: choose a tool, enter grade/subject/topic/output requirements, generate teaching drafts, then manually check before publishing.
- AI Agent: describe the task goal, provide course background, continue asking for revisions, and organize the final output.
- 教师端待开放: 班级管理, 成绩录入与分析, 考勤与纪律, AI评语/推荐信, 教务通知, 考试计划, 课程资源中心. These entries are clickable demo pages only in this version.

学生端:
- Home: confirm profile and current organization, view recommended learning entry and progress.
- My Learning: open "我的学习", choose an joined course, enter course details, follow chapters and lessons, complete learning, and check progress.
- My Learning example: open "数学强化课", start from Chapter 1 Lesson 1, then continue to the next lesson.
- Exercises: choose a practice, answer questions, submit, then review score, answers and feedback.
- Community: search existing questions first, publish a clear new question with course context, then check teacher or classmate replies.
- AI Tools: choose a learning tool, enter a specific question with subject/grade/topic, read the explanation, and continue asking follow-up questions.
- AI Agent: state the learning goal or the problem you are stuck on, ask for step-by-step explanation, then turn the result into notes.
- Explore: browse available courses, open details, join or start learning if authorized.
- Student settings: update avatar/name/profile information, save, then refresh or return home to check the display.
- 学生端待开放: 智能错题本, AI今日推荐练习, 学习数据摘要, 成长雷达, 强弱科目提示, 学习通知, 证书成长档案, 低空学习路径. These entries are clickable demo pages only in this version.

Troubleshooting:
- If login says "Invalid login credentials", confirm the email and password. Current restored test accounts include admin@gmail.com / 123456 and 2939875118@qq.com / 123456.
- If courses are missing, check whether the account is in the correct organization and course groups.
- If exams fail to load, check the account role and organization membership. 教师端 accounts should be able to access courses and exams.
- If AI chat says it is not configured, ask an administrator to configure the DeepSeek API key.
`;
