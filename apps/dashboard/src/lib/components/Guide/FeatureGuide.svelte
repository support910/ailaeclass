<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import HelpIcon from 'carbon-icons-svelte/lib/Help.svelte';
  import { locale } from '$lib/utils/functions/translations';
  import OpenCC from 'opencc-js';

  export let scope: 'org' | 'lms' = 'org';

  type Placement = 'auto' | 'center';

  interface GuideStep {
    id: string;
    title: string;
    body: string;
    selector?: string;
    textTargets?: string[];
    placement?: Placement;
    clickTargetToContinue?: boolean;
    actionHint?: string;
    example?: string;
  }

  interface Guide {
    id: string;
    label: string;
    steps: GuideStep[];
  }

  interface HighlightRect {
    top: number;
    left: number;
    width: number;
    height: number;
  }

  let open = false;
  let activeGuideId = '';
  let currentIndex = 0;
  let targetElement: HTMLElement | null = null;
  let highlightRect: HighlightRect | null = null;
  let panelStyle = '';

  const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' });

  const englishText: Record<string, string> = {
    管理端首页: 'Admin Home',
    课程: 'Courses',
    考试: 'Exams',
    社区: 'Community',
    'AI 工具': 'AI Tools',
    'AI Agent': 'AI Agent',
    成员: 'Members',
    设置: 'Settings',
    学生首页: 'Student Home',
    我的学习: 'My Learning',
    练习: 'Exercises',
    学生社区: 'Student Community',
    '学生 AI 工具': 'Student AI Tools',
    '学生 AI Agent': 'Student AI Agent',
    探索课程: 'Explore Courses',
    '这是管理端首页': 'This is the admin home',
    '这里用来快速判断机构的整体状态：课程数量、学生数量、热门课程和最近注册都会集中显示。': 'Use this page to quickly understand the organization status, including course count, student count, popular courses, and recent enrollments.',
    '例子：新机构先看课程数量，如果为 0，就从左侧进入课程创建第一门课。': 'Example: if a new organization has 0 courses, go to Courses from the left menu and create the first course.',
    '左侧是主要功能入口': 'The left menu is the main navigation',
    '课程、考试、社区、AI 工具、成员和设置都从这里进入；待开放模块也会统一放在左侧下方。': 'Courses, exams, community, AI tools, members, and settings are all opened here. Upcoming modules are grouped lower in the same menu.',
    '中间是运营概览': 'The center area shows the overview',
    '这些卡片帮助管理员快速确认课程、学生和收入等关键状态，再决定下一步操作。': 'These cards help admins check key course, student, and revenue signals before deciding the next action.',
    '这是课程系统': 'This is the course system',
    '课程模块用于创建课程、维护章节课时、上传资料，并发布给学生学习。': 'The course module is used to create courses, manage chapters and lessons, upload materials, and publish learning content to students.',
    '从这里创建课程': 'Create courses here',
    '点击创建课程后，可以填写课程名称、介绍和课程内容。课程创建后再进入课程详情维护章节和课时。': 'After clicking Create Course, fill in the name, description, and course content. Then open the course detail page to manage chapters and lessons.',
    '如果要新建课程，可以点击高亮按钮。': 'Click the highlighted button when you want to create a new course.',
    '这里用来搜索和整理课程': 'Search and organize courses here',
    '可以按关键词搜索课程，也可以按创建时间、发布状态、课时数量来切换排序。': 'Search by keyword, or sort courses by creation date, publish status, or number of lessons.',
    '这里是课程列表': 'This is the course list',
    '已有课程会显示在这里。进入课程后可以编辑章节、课时、成员、作业和课程设置。': 'Existing courses appear here. Open a course to edit chapters, lessons, members, assignments, and settings.',
    '例子：创建“G7 数学 Week 1”，然后添加 Lesson 1 视频和练习。': 'Example: create “G7 Math Week 1”, then add the Lesson 1 video and exercises.',
    '这是考试系统': 'This is the exam system',
    '考试系统用于发布测评并收集学生提交。传统考试适合正式测验，学生完整作答后统一提交；速解训练适合课堂练习，每题做完后立即看正误和解析。': 'The exam system publishes assessments and collects student submissions. Traditional exams are for formal tests submitted at the end; quick practice shows correctness and explanations after each question.',
    '例子：周测用传统考试；课堂即时巩固用速解训练。': 'Example: use Traditional Exam for a weekly test, and Quick Practice for in-class review.',
    '这里区分传统考试和速解训练': 'Traditional exams and quick practice are separated here',
    '列表会按考试模式分组，老师可以快速判断某个测评是正式考试，还是复习训练。': 'The list is grouped by exam mode so teachers can quickly tell whether an assessment is a formal exam or review practice.',
    '点击这里创建考试': 'Click here to create an exam',
    '现在请点击高亮的“创建考试”。点击后会打开创建考试弹框，接下来会继续介绍每个字段。': 'Click the highlighted Create Exam button. A creation dialog will open, and the guide will explain each field next.',
    '点击高亮按钮继续，也可以直接点“下一步”。': 'Click the highlighted button to continue, or use Next.',
    '先填写考试标题': 'Fill in the exam title first',
    '标题会展示给学生和老师，建议写清楚年级、科目、范围和用途。': 'The title is shown to students and teachers. Include the grade, subject, scope, and purpose.',
    '例子：G7 数学二次函数周测。': 'Example: G7 Math Quadratic Functions Weekly Test.',
    '选择考试模式': 'Choose the exam mode',
    '传统考试用于正式测验和评分；速解训练用于课堂即时训练，学生答完一题就能看到反馈。': 'Traditional exams are for formal testing and grading. Quick practice is for instant classroom practice where students see feedback after each question.',
    '选择关联课程和课时': 'Choose the related course and lesson',
    '考试必须挂在某门课程和某个课时下，这样学生能在对应学习路径里看到它。': 'Each exam must belong to a course and lesson so students can find it in the correct learning path.',
    '设置考试规则': 'Set exam rules',
    '这里控制考试时长、允许尝试次数和通过分数。正式考试建议限制次数；练习可以放宽次数。': 'Set duration, allowed attempts, and passing score here. Formal exams should limit attempts; practice can be more flexible.',
    '设置成绩显示方式': 'Set result visibility',
    '成绩显示决定学生什么时候看到结果：批改后显示、立即显示，或由老师手动控制。': 'Result visibility controls when students see results: after grading, immediately, or manually controlled by the teacher.',
    '设置开放时间': 'Set availability time',
    '开始时间和结束时间用于限制学生可作答的时间窗口。课堂练习可以不填，正式考试建议填写。': 'Start and end times define when students can answer. You can leave them blank for class practice, but formal exams should usually set them.',
    '继续进入题目编辑': 'Continue to question editing',
    '字段填好后点击继续，系统会创建考试草稿。之后进入编辑页添加题目、答案、解析和分值，再发布给学生。': 'After filling the fields, click Continue to create an exam draft. Then add questions, answers, explanations, and points before publishing.',
    '这是社区功能': 'This is the community feature',
    '社区用于发布讨论、沉淀答疑和整理常见问题，适合老师与学生围绕课程内容交流。': 'Community is used for discussions, Q&A, and frequently asked questions around course content.',
    '这里查看已有讨论': 'View existing discussions here',
    '先浏览是否已有类似问题，再决定回复已有主题或创建新主题。': 'Check whether a similar question already exists before replying or creating a new topic.',
    '使用建议': 'Suggested use',
    '高频问题可以整理成课程 FAQ，再放回课程资料里，减少重复答疑。': 'Frequent questions can be turned into a course FAQ and added back into course materials.',
    '例子：把“二次函数顶点式怎么理解”整理成一条固定答疑。': 'Example: turn “How should I understand vertex form?” into a pinned Q&A.',
    '这是 AI 工具区': 'This is the AI tools area',
    '这里适合生成教学材料草稿、课堂练习、知识点解释和备课辅助内容。': 'Use this area to draft teaching materials, class exercises, concept explanations, and lesson preparation content.',
    '先选择工具': 'Choose a tool first',
    '不同工具对应不同任务。选择工具后，输入年级、科目、主题和输出要求。': 'Different tools support different tasks. After choosing one, enter grade, subject, topic, and output requirements.',
    '生成后要人工检查': 'Review AI output manually',
    'AI 输出适合作为草稿，老师需要检查准确性、难度和是否符合本班学生情况。': 'AI output is a draft. Teachers should check accuracy, difficulty, and fit for the class.',
    '例子：生成一份复习提纲后，再要求改成 10 分钟课堂版。': 'Example: generate a review outline, then ask for a 10-minute classroom version.',
    '这是 AI Agent': 'This is AI Agent',
    'Agent 适合连续对话，可以帮老师备课、改写通知、整理材料和设计练习。': 'Agent supports multi-turn conversations and can help with lesson prep, announcements, materials, and exercises.',
    '在输入框里说明目标': 'Describe the goal in the input box',
    '越具体越好：说明年级、科目、主题、学生水平和想要的输出格式。': 'Be specific: include grade, subject, topic, student level, and desired output format.',
    '用追问把结果调到可用': 'Refine the result through follow-up prompts',
    '可以继续要求“更简单”“改成表格”“补充例题”“适合 20 分钟课堂”。': 'You can ask for changes such as “make it simpler”, “turn it into a table”, “add examples”, or “fit a 20-minute class”.',
    '这是成员/受众管理': 'This is member and audience management',
    '这里用来查看机构里的学生、老师和相关用户，并确认他们的角色和状态。': 'Use this page to view students, teachers, and related users, and confirm their roles and status.',
    '通过搜索找到用户': 'Find users through search',
    '可以按姓名、邮箱或角色快速定位用户，确认是否已经加入机构或课程。': 'Search by name, email, or role to confirm whether a user has joined the organization or a course.',
    '重点看角色和状态': 'Focus on role and status',
    '角色决定用户能看到管理端、教师端或学生端的哪些功能。': 'A user’s role determines which admin, teacher, or student features they can access.',
    '例子：搜索学生邮箱，确认他是否已经能看到课程。': 'Example: search a student email to confirm whether they can see the course.',
    '这是设置': 'This is Settings',
    '设置用于维护机构信息、站点展示、LMS 配置和其他系统选项。': 'Settings maintain organization information, site display, LMS configuration, and other system options.',
    '先选配置分类': 'Choose a settings category first',
    '不同设置项会分区展示，先找到你要修改的范围，再填写表单。': 'Settings are grouped by category. Find the area you want to change before filling the form.',
    '修改后记得保存并检查': 'Save and check after editing',
    '保存后建议切到前台或学生端刷新确认展示效果。': 'After saving, switch to the public site or student side and refresh to confirm the result.',
    '例子：修改机构展示名称后，回到首页确认是否生效。': 'Example: after changing the organization display name, return to the homepage to confirm it changed.',
    '这是学生首页': 'This is the student home',
    '学生首页用于查看学习入口、最近课程和个人学习状态。': 'Student Home shows learning entry points, recent courses, and personal learning status.',
    '从这里继续学习': 'Continue learning here',
    '看到课程后，可以直接进入课程继续完成课时。': 'When a course appears, open it to continue lessons.',
    '这是我的学习': 'This is My Learning',
    '这里展示已经加入的课程，是学生每天继续学习的主要入口。': 'This page shows joined courses and is the main daily entry point for students.',
    '课程卡片': 'Course cards',
    '每张卡片代表一门课程，显示课程类型、课时数量和当前进度。': 'Each card represents a course and shows course type, lesson count, and current progress.',
    '点击继续课程': 'Click Continue Course',
    '进入课程后按照章节和课时学习，完成后进度会更新。': 'Open a course and study by chapter and lesson. Progress updates after completion.',
    '例子：打开“我的梦”，从 Lesson 1 继续学习。': 'Example: open “我的梦” and continue from Lesson 1.',
    '这是练习功能': 'This is Exercises',
    '练习用于巩固课程知识点，学生提交后可以查看结果和反馈。': 'Exercises reinforce course concepts. Students can view results and feedback after submission.',
    '先选择练习': 'Choose an exercise first',
    '从列表里选择要完成的练习，再进入作答页面。': 'Choose an exercise from the list, then enter the answering page.',
    '提交后看反馈': 'Review feedback after submission',
    '完成后重点看错题、解析和需要复习的知识点。': 'After finishing, focus on mistakes, explanations, and concepts to review.',
    '这是学生社区': 'This is Student Community',
    '学生可以在这里查看问题、发布提问，并阅读老师或同学的回复。': 'Students can view questions, ask new ones, and read replies from teachers or classmates.',
    '先搜索再提问': 'Search before asking',
    '如果没有类似问题，再发布自己的问题，并补充课程、题目和卡住的位置。': 'If no similar question exists, post your question with the course, problem, and where you are stuck.',
    '这是学生 AI 工具': 'This is Student AI Tools',
    '学生可以用 AI 工具解释知识点、生成练习思路和整理复习材料。': 'Students can use AI tools to explain concepts, generate practice ideas, and organize review materials.',
    '问题越具体越好': 'The more specific the question, the better',
    '说明科目、年级、知识点和不懂的地方，得到的解释会更有用。': 'Include subject, grade, concept, and what you do not understand to get a more useful explanation.',
    '例子：用简单的话解释二次函数顶点式，并给 3 道练习。': 'Example: explain vertex form simply and give 3 practice questions.',
    '这是学生 AI Agent': 'This is Student AI Agent',
    'Agent 像学习伙伴，适合连续追问和拆解复杂问题。': 'Agent works like a study partner for follow-up questions and breaking down complex problems.',
    '说出学习目标': 'State your learning goal',
    '可以告诉它要复习什么、哪里不懂、希望用什么方式解释。': 'Tell it what to review, what is confusing, and how you want it explained.',
    '这是探索课程': 'This is Explore Courses',
    '探索页用于发现可加入或可学习的课程资源。': 'Explore helps students find courses they can join or study.',
    '先查看课程详情': 'View course details first',
    '进入课程详情后看介绍、章节和学习目标，再决定是否加入。': 'Open course details to review the introduction, chapters, and learning goals before joining.',
    跳过: 'Skip',
    上一步: 'Back',
    下一步: 'Next',
    完成: 'Done',
    打开当前页面引导: 'Open guide',
    '我已点击 / 下一步': 'Clicked / Next',
    例子: 'Example'
  };

  const orgGuides: Record<string, Guide> = {
    dashboard: {
      id: 'org-dashboard',
      label: '管理端首页',
      steps: [
        {
          id: 'intro',
          title: '这是管理端首页',
          body: '这里用来快速判断机构的整体状态：课程数量、学生数量、热门课程和最近注册都会集中显示。',
          textTargets: ['控制檯', 'Dashboard'],
          example: '例子：新机构先看课程数量，如果为 0，就从左侧进入课程创建第一门课。'
        },
        {
          id: 'nav',
          title: '左侧是主要功能入口',
          body: '课程、考试、社区、AI 工具、成员和设置都从这里进入；待开放模块也会统一放在左侧下方。',
          textTargets: ['課程', '课程', '考試', '考试']
        },
        {
          id: 'stats',
          title: '中间是运营概览',
          body: '这些卡片帮助管理员快速确认课程、学生和收入等关键状态，再决定下一步操作。',
          textTargets: ['課程數量', '课程数量', '學生總數', '学生总数']
        }
      ]
    },
    courses: {
      id: 'org-courses',
      label: '课程',
      steps: [
        {
          id: 'intro',
          title: '这是课程系统',
          body: '课程模块用于创建课程、维护章节课时、上传资料，并发布给学生学习。',
          selector: '[data-guide-target="courses-title"]',
          textTargets: ['課程', '课程', 'Courses']
        },
        {
          id: 'create',
          title: '从这里创建课程',
          body: '点击创建课程后，可以填写课程名称、介绍和课程内容。课程创建后再进入课程详情维护章节和课时。',
          selector: '[data-guide-target="courses-create"]',
          textTargets: ['創建課程', '创建课程', 'Create Course'],
          actionHint: '如果要新建课程，可以点击高亮按钮。'
        },
        {
          id: 'filter',
          title: '这里用来搜索和整理课程',
          body: '可以按关键词搜索课程，也可以按创建时间、发布状态、课时数量来切换排序。',
          selector: '[data-guide-target="courses-filter"]',
          textTargets: ['Search', '搜索']
        },
        {
          id: 'list',
          title: '这里是课程列表',
          body: '已有课程会显示在这里。进入课程后可以编辑章节、课时、成员、作业和课程设置。',
          selector: '[data-guide-target="courses-list"]',
          example: '例子：创建“G7 数学 Week 1”，然后添加 Lesson 1 视频和练习。'
        }
      ]
    },
    exams: {
      id: 'org-exams',
      label: '考试',
      steps: [
        {
          id: 'intro',
          title: '这是考试系统',
          body: '考试系统用于发布测评并收集学生提交。传统考试适合正式测验，学生完整作答后统一提交；速解训练适合课堂练习，每题做完后立即看正误和解析。',
          selector: '[data-guide-target="exam-page-title"]',
          textTargets: ['考試', '考试', 'Exam'],
          example: '例子：周测用传统考试；课堂即时巩固用速解训练。'
        },
        {
          id: 'modes',
          title: '这里区分传统考试和速解训练',
          body: '列表会按考试模式分组，老师可以快速判断某个测评是正式考试，还是复习训练。',
          selector: '[data-guide-target="exam-mode-sections"]',
          textTargets: ['傳統考試', '传统考试', '速解訓練', '速解训练']
        },
        {
          id: 'create',
          title: '点击这里创建考试',
          body: '现在请点击高亮的“创建考试”。点击后会打开创建考试弹框，接下来会继续介绍每个字段。',
          selector: '[data-guide-target="exam-create"]',
          textTargets: ['創建考試', '创建考试', 'Create Exam'],
          clickTargetToContinue: true,
          actionHint: '点击高亮按钮继续，也可以直接点“下一步”。'
        },
        {
          id: 'modal-title',
          title: '先填写考试标题',
          body: '标题会展示给学生和老师，建议写清楚年级、科目、范围和用途。',
          selector: '[data-guide-target="exam-modal-title"]',
          textTargets: ['考試標題', '考试标题', 'Exam Title'],
          example: '例子：G7 数学二次函数周测。'
        },
        {
          id: 'modal-mode',
          title: '选择考试模式',
          body: '传统考试用于正式测验和评分；速解训练用于课堂即时训练，学生答完一题就能看到反馈。',
          selector: '[data-guide-target="exam-modal-mode"]',
          textTargets: ['傳統考試', '传统考试', '速解訓練', '速解训练']
        },
        {
          id: 'modal-course',
          title: '选择关联课程和课时',
          body: '考试必须挂在某门课程和某个课时下，这样学生能在对应学习路径里看到它。',
          selector: '[data-guide-target="exam-modal-course"]',
          textTargets: ['課程', '课程', 'Course']
        },
        {
          id: 'modal-rules',
          title: '设置考试规则',
          body: '这里控制考试时长、允许尝试次数和通过分数。正式考试建议限制次数；练习可以放宽次数。',
          selector: '[data-guide-target="exam-modal-rules"]',
          textTargets: ['時長', '时长', '嘗試', '尝试', 'Duration']
        },
        {
          id: 'modal-result',
          title: '设置成绩显示方式',
          body: '成绩显示决定学生什么时候看到结果：批改后显示、立即显示，或由老师手动控制。',
          selector: '[data-guide-target="exam-modal-result"]',
          textTargets: ['成績顯示', '成绩显示', 'Show Result']
        },
        {
          id: 'modal-time',
          title: '设置开放时间',
          body: '开始时间和结束时间用于限制学生可作答的时间窗口。课堂练习可以不填，正式考试建议填写。',
          selector: '[data-guide-target="exam-modal-time"]',
          textTargets: ['開始時間', '开始时间', 'Available From']
        },
        {
          id: 'modal-continue',
          title: '继续进入题目编辑',
          body: '字段填好后点击继续，系统会创建考试草稿。之后进入编辑页添加题目、答案、解析和分值，再发布给学生。',
          selector: '[data-guide-target="exam-modal-continue"]',
          textTargets: ['繼續', '继续', 'Continue']
        }
      ]
    },
    community: {
      id: 'org-community',
      label: '社区',
      steps: [
        {
          id: 'intro',
          title: '这是社区功能',
          body: '社区用于发布讨论、沉淀答疑和整理常见问题，适合老师与学生围绕课程内容交流。',
          textTargets: ['社區', '社区', 'Community']
        },
        {
          id: 'list',
          title: '这里查看已有讨论',
          body: '先浏览是否已有类似问题，再决定回复已有主题或创建新主题。',
          textTargets: ['問題', '问题', 'Post', 'Topic']
        },
        {
          id: 'example',
          title: '使用建议',
          body: '高频问题可以整理成课程 FAQ，再放回课程资料里，减少重复答疑。',
          placement: 'center',
          example: '例子：把“二次函数顶点式怎么理解”整理成一条固定答疑。'
        }
      ]
    },
    aiTools: {
      id: 'org-ai-tools',
      label: 'AI 工具',
      steps: [
        {
          id: 'intro',
          title: '这是 AI 工具区',
          body: '这里适合生成教学材料草稿、课堂练习、知识点解释和备课辅助内容。',
          textTargets: ['AI工具', 'AI 工具', 'AI Tools']
        },
        {
          id: 'tool',
          title: '先选择工具',
          body: '不同工具对应不同任务。选择工具后，输入年级、科目、主题和输出要求。',
          textTargets: ['工具', 'Tool']
        },
        {
          id: 'review',
          title: '生成后要人工检查',
          body: 'AI 输出适合作为草稿，老师需要检查准确性、难度和是否符合本班学生情况。',
          placement: 'center',
          example: '例子：生成一份复习提纲后，再要求改成 10 分钟课堂版。'
        }
      ]
    },
    agent: {
      id: 'org-agent',
      label: 'AI Agent',
      steps: [
        {
          id: 'intro',
          title: '这是 AI Agent',
          body: 'Agent 适合连续对话，可以帮老师备课、改写通知、整理材料和设计练习。',
          textTargets: ['ailaeclass Agent', 'AI Agent']
        },
        {
          id: 'chat',
          title: '在输入框里说明目标',
          body: '越具体越好：说明年级、科目、主题、学生水平和想要的输出格式。',
          textTargets: ['輸入', '输入', 'Message', 'Ask']
        },
        {
          id: 'iterate',
          title: '用追问把结果调到可用',
          body: '可以继续要求“更简单”“改成表格”“补充例题”“适合 20 分钟课堂”。',
          placement: 'center'
        }
      ]
    },
    audience: {
      id: 'org-audience',
      label: '成员',
      steps: [
        {
          id: 'intro',
          title: '这是成员/受众管理',
          body: '这里用来查看机构里的学生、老师和相关用户，并确认他们的角色和状态。',
          textTargets: ['受眾', '受众', 'Audience', 'Members']
        },
        {
          id: 'search',
          title: '通过搜索找到用户',
          body: '可以按姓名、邮箱或角色快速定位用户，确认是否已经加入机构或课程。',
          textTargets: ['搜索', 'Search']
        },
        {
          id: 'role',
          title: '重点看角色和状态',
          body: '角色决定用户能看到管理端、教师端或学生端的哪些功能。',
          placement: 'center',
          example: '例子：搜索学生邮箱，确认他是否已经能看到课程。'
        }
      ]
    },
    setup: {
      id: 'org-setup',
      label: '设置',
      steps: [
        {
          id: 'intro',
          title: '这是设置',
          body: '设置用于维护机构信息、站点展示、LMS 配置和其他系统选项。',
          textTargets: ['設置', '设置', 'Settings']
        },
        {
          id: 'category',
          title: '先选配置分类',
          body: '不同设置项会分区展示，先找到你要修改的范围，再填写表单。',
          textTargets: ['General', 'LMS', 'Domain', 'Teams', 'Customize']
        },
        {
          id: 'save',
          title: '修改后记得保存并检查',
          body: '保存后建议切到前台或学生端刷新确认展示效果。',
          textTargets: ['保存', 'Save'],
          example: '例子：修改机构展示名称后，回到首页确认是否生效。'
        }
      ]
    }
  };

  const lmsGuides: Record<string, Guide> = {
    home: {
      id: 'lms-home',
      label: '学生首页',
      steps: [
        {
          id: 'intro',
          title: '这是学生首页',
          body: '学生首页用于查看学习入口、最近课程和个人学习状态。',
          textTargets: ['首頁', '首页', 'Home']
        },
        {
          id: 'continue',
          title: '从这里继续学习',
          body: '看到课程后，可以直接进入课程继续完成课时。',
          textTargets: ['繼續', '继续', 'Continue']
        }
      ]
    },
    myLearning: {
      id: 'lms-mylearning',
      label: '我的学习',
      steps: [
        {
          id: 'intro',
          title: '这是我的学习',
          body: '这里展示已经加入的课程，是学生每天继续学习的主要入口。',
          textTargets: ['我的學習', '我的学习']
        },
        {
          id: 'course-card',
          title: '课程卡片',
          body: '每张卡片代表一门课程，显示课程类型、课时数量和当前进度。',
          textTargets: ['課時', '课时', '0%']
        },
        {
          id: 'continue',
          title: '点击继续课程',
          body: '进入课程后按照章节和课时学习，完成后进度会更新。',
          textTargets: ['繼續課程', '继续课程'],
          example: '例子：打开“我的梦”，从 Lesson 1 继续学习。'
        }
      ]
    },
    exercises: {
      id: 'lms-exercises',
      label: '练习',
      steps: [
        {
          id: 'intro',
          title: '这是练习功能',
          body: '练习用于巩固课程知识点，学生提交后可以查看结果和反馈。',
          textTargets: ['練習', '练习', 'Exercises']
        },
        {
          id: 'choose',
          title: '先选择练习',
          body: '从列表里选择要完成的练习，再进入作答页面。',
          textTargets: ['開始', '开始', 'Start']
        },
        {
          id: 'feedback',
          title: '提交后看反馈',
          body: '完成后重点看错题、解析和需要复习的知识点。',
          placement: 'center'
        }
      ]
    },
    community: {
      id: 'lms-community',
      label: '学生社区',
      steps: [
        {
          id: 'intro',
          title: '这是学生社区',
          body: '学生可以在这里查看问题、发布提问，并阅读老师或同学的回复。',
          textTargets: ['社區', '社区', 'Community']
        },
        {
          id: 'ask',
          title: '先搜索再提问',
          body: '如果没有类似问题，再发布自己的问题，并补充课程、题目和卡住的位置。',
          textTargets: ['搜索', 'Search', '提問', '提问']
        }
      ]
    },
    aiTools: {
      id: 'lms-ai-tools',
      label: '学生 AI 工具',
      steps: [
        {
          id: 'intro',
          title: '这是学生 AI 工具',
          body: '学生可以用 AI 工具解释知识点、生成练习思路和整理复习材料。',
          textTargets: ['AI工具', 'AI 工具', 'AI Tools']
        },
        {
          id: 'prompt',
          title: '问题越具体越好',
          body: '说明科目、年级、知识点和不懂的地方，得到的解释会更有用。',
          placement: 'center',
          example: '例子：用简单的话解释二次函数顶点式，并给 3 道练习。'
        }
      ]
    },
    agent: {
      id: 'lms-agent',
      label: '学生 AI Agent',
      steps: [
        {
          id: 'intro',
          title: '这是学生 AI Agent',
          body: 'Agent 像学习伙伴，适合连续追问和拆解复杂问题。',
          textTargets: ['ailaeclass Agent', 'AI Agent']
        },
        {
          id: 'chat',
          title: '说出学习目标',
          body: '可以告诉它要复习什么、哪里不懂、希望用什么方式解释。',
          textTargets: ['輸入', '输入', 'Message', 'Ask']
        }
      ]
    },
    explore: {
      id: 'lms-explore',
      label: '探索课程',
      steps: [
        {
          id: 'intro',
          title: '这是探索课程',
          body: '探索页用于发现可加入或可学习的课程资源。',
          textTargets: ['探索', 'Explore']
        },
        {
          id: 'details',
          title: '先查看课程详情',
          body: '进入课程详情后看介绍、章节和学习目标，再决定是否加入。',
          textTargets: ['課程', '课程', 'Course']
        }
      ]
    }
  };

  function resolveGuide(pathname: string): Guide | null {
    if (pathname.includes('/guide') || pathname.includes('/coming-soon')) return null;

    if (scope === 'lms') {
      if (/\/lms\/mylearning(\/|$)/.test(pathname)) return lmsGuides.myLearning;
      if (/\/lms\/exercises(\/|$)/.test(pathname)) return lmsGuides.exercises;
      if (/\/lms\/community(\/|$)/.test(pathname)) return lmsGuides.community;
      if (/\/lms\/ai-tools(\/|$)/.test(pathname)) return lmsGuides.aiTools;
      if (/\/lms\/agent(\/|$)/.test(pathname)) return lmsGuides.agent;
      if (/\/lms\/explore(\/|$)/.test(pathname)) return lmsGuides.explore;
      if (/\/lms\/?$/.test(pathname)) return lmsGuides.home;
      return null;
    }

    if (/\/courses(\/|$)/.test(pathname)) return orgGuides.courses;
    if (/\/exams(\/|$)/.test(pathname)) return orgGuides.exams;
    if (/\/community(\/|$)/.test(pathname)) return orgGuides.community;
    if (/\/ai-tools(\/|$)/.test(pathname)) return orgGuides.aiTools;
    if (/\/agent(\/|$)/.test(pathname)) return orgGuides.agent;
    if (/\/audience(\/|$)/.test(pathname)) return orgGuides.audience;
    if (/\/setup(\/|$)/.test(pathname) || /\/settings(\/|$)/.test(pathname)) return orgGuides.setup;
    if (/\/org\/[^/]+\/?$/.test(pathname)) return orgGuides.dashboard;
    return null;
  }

  function storageKey(guideId: string) {
    return `ailaeclass-feature-tour-v2-seen:${guideId}`;
  }

  function isVisible(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }

  function findByText(textTargets: string[] = []) {
    if (!textTargets.length) return null;
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, a, input, textarea, [role="button"], h1, h2, h3, label, p, span, section, div[data-guide-target]'
      )
    );

    return (
      candidates.find((element) => {
        if (!isVisible(element)) return false;
        const text = `${element.innerText || ''} ${element.getAttribute('aria-label') || ''} ${
          element.getAttribute('placeholder') || ''
        } ${element.getAttribute('title') || ''}`;
        return textTargets.some((target) => text.includes(target));
      }) || null
    );
  }

  function resolveTarget(step: GuideStep) {
    if (!browser) return null;
    if (step.selector) {
      const selected = document.querySelector<HTMLElement>(step.selector);
      if (selected && isVisible(selected)) return selected;
    }
    return findByText(step.textTargets);
  }

  function text(value = '') {
    if ($locale === 'en') return englishText[value] || value;
    if ($locale === 'zh-TW') return toTraditional(value);
    return value;
  }

  function updateTarget() {
    if (!browser || !open || !guide || !currentStep) return;

    targetElement = currentStep.placement === 'center' ? null : resolveTarget(currentStep);
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      const outOfView =
        rect.top < 80 ||
        rect.bottom > window.innerHeight - 80 ||
        rect.left < 0 ||
        rect.right > window.innerWidth;

      if (outOfView) {
        highlightRect = null;
        panelStyle = getCenteredPanelStyle();
        return;
      }

      const padding = 8;
      highlightRect = {
        top: Math.max(rect.top - padding, 8),
        left: Math.max(rect.left - padding, 8),
        width: Math.min(rect.width + padding * 2, window.innerWidth - 16),
        height: Math.min(rect.height + padding * 2, window.innerHeight - 16)
      };
      panelStyle = getPanelStyle(highlightRect);
    } else {
      highlightRect = null;
      panelStyle = getCenteredPanelStyle();
    }
  }

  function getCenteredPanelStyle() {
    return 'left: 50%; top: 50%; transform: translate(-50%, -50%);';
  }

  function getPanelStyle(rect: HighlightRect) {
    const panelWidth = Math.min(380, window.innerWidth - 32);
    if (window.innerWidth < 760) {
      return `left: 16px; right: 16px; bottom: 20px; width: auto;`;
    }

    let left = rect.left + rect.width + 18;
    if (left + panelWidth > window.innerWidth - 16) {
      left = rect.left - panelWidth - 18;
    }
    if (left < 16) left = 16;

    let top = rect.top;
    if (top + 310 > window.innerHeight - 16) {
      top = Math.max(16, window.innerHeight - 326);
    }

    return `left: ${left}px; top: ${top}px; width: ${panelWidth}px;`;
  }

  function markSeen() {
    if (browser && guide) {
      localStorage.setItem(storageKey(guide.id), 'true');
    }
  }

  function closeGuide() {
    markSeen();
    open = false;
  }

  function openGuide() {
    currentIndex = 0;
    open = true;
    updateTarget();
  }

  function nextStep() {
    if (!guide) return;
    if (currentIndex < guide.steps.length - 1) {
      currentIndex += 1;
      updateTarget();
      return;
    }

    closeGuide();
  }

  function previousStep() {
    if (currentIndex > 0) {
      currentIndex -= 1;
      updateTarget();
    }
  }

  function handleDocumentClick(event: MouseEvent) {
    if (!open || !currentStep?.clickTargetToContinue || !targetElement) return;
    const clickedTarget = event.target instanceof Node && targetElement.contains(event.target);
    if (clickedTarget) {
      setTimeout(() => {
        nextStep();
        updateTarget();
      }, 350);
    }
  }

  $: guide = resolveGuide($page.url.pathname);
  $: currentStep = guide?.steps[currentIndex] || null;
  $: firstExampleIndex = guide?.steps.findIndex((step) => !!step.example) ?? -1;
  $: currentExample = firstExampleIndex === currentIndex ? currentStep?.example : '';

  $: if (browser && guide && activeGuideId !== guide.id) {
    activeGuideId = guide.id;
    currentIndex = 0;
    open = localStorage.getItem(storageKey(guide.id)) !== 'true';
    if (open) {
      updateTarget();
    }
  }

  $: if (browser && open && currentStep) {
    updateTarget();
  }

  $: if (!guide) {
    open = false;
    activeGuideId = '';
    currentIndex = 0;
  }
</script>

<svelte:window on:resize={updateTarget} on:scroll={updateTarget} on:click={handleDocumentClick} />

{#if guide}
  <button
    type="button"
    class="fixed right-5 top-16 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-primary-200 bg-white text-primary-800 shadow-md transition hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-primary-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800"
    aria-label={text('打开当前页面引导')}
    title={text('打开当前页面引导')}
    on:click={openGuide}
  >
    <HelpIcon size={20} class="carbon-icon" />
  </button>

  {#if open && currentStep}
    <div class="pointer-events-none fixed inset-0 z-50">
      {#if highlightRect}
        <div
          class="spotlight"
          style={`top: ${highlightRect.top}px; left: ${highlightRect.left}px; width: ${highlightRect.width}px; height: ${highlightRect.height}px;`}
        />
      {:else}
        <div class="absolute inset-0 bg-black/45" />
      {/if}

      <section
        class="pointer-events-auto fixed rounded-lg border border-gray-200 bg-white p-4 shadow-2xl dark:border-neutral-700 dark:bg-neutral-950"
        style={panelStyle}
        aria-live="polite"
      >
        <div class="mb-3 flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
              {text(guide.label)} · {currentIndex + 1}/{guide.steps.length}
            </p>
            <h2 class="mt-1 text-lg font-bold text-gray-950 dark:text-white">{text(currentStep.title)}</h2>
          </div>
          <button
            type="button"
            class="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
            on:click={closeGuide}
          >
            {text('跳过')}
          </button>
        </div>

        <p class="text-sm leading-6 text-gray-700 dark:text-neutral-300">{text(currentStep.body)}</p>

        {#if currentExample}
          <p class="mt-3 rounded-md bg-gray-50 p-3 text-sm leading-6 text-gray-700 dark:bg-neutral-900 dark:text-neutral-300">
            {text(currentExample)}
          </p>
        {/if}

        {#if currentStep.actionHint}
          <p class="mt-3 text-sm font-medium text-primary-700 dark:text-primary-300">{text(currentStep.actionHint)}</p>
        {/if}

        <div class="mt-4 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-neutral-800">
          <div
            class="h-full rounded-full bg-primary-700 transition-all"
            style={`width: ${((currentIndex + 1) / guide.steps.length) * 100}%`}
          />
        </div>

        <div class="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            class="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            disabled={currentIndex === 0}
            on:click={previousStep}
          >
            {text('上一步')}
          </button>
          <button
            type="button"
            class="rounded-md bg-primary-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
            on:click={nextStep}
          >
            {currentIndex === guide.steps.length - 1 ? text('完成') : currentStep.clickTargetToContinue ? text('我已点击 / 下一步') : text('下一步')}
          </button>
        </div>
      </section>
    </div>
  {/if}
{/if}

<style>
  .spotlight {
    position: absolute;
    border: 2px solid rgb(245 158 11);
    border-radius: 10px;
    background: rgb(251 191 36 / 0.16);
    box-shadow: 0 0 0 9999px rgb(0 0 0 / 0.5), 0 12px 30px rgb(0 0 0 / 0.28);
    transition: all 180ms ease;
  }
</style>
