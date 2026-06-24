<script lang="ts">
  import { tick } from 'svelte';
  import ArrowLeft from 'carbon-icons-svelte/lib/ArrowLeft.svelte';
  import Chat from 'carbon-icons-svelte/lib/Chat.svelte';
  import Document from 'carbon-icons-svelte/lib/Document.svelte';
  import Education from 'carbon-icons-svelte/lib/Education.svelte';
  import Idea from 'carbon-icons-svelte/lib/Idea.svelte';
  import Pen from 'carbon-icons-svelte/lib/Pen.svelte';
  import Search from 'carbon-icons-svelte/lib/Search.svelte';
  import Settings from 'carbon-icons-svelte/lib/Settings.svelte';
  import WarningAlt from 'carbon-icons-svelte/lib/WarningAlt.svelte';
  import { getAccessToken } from '$lib/utils/functions/supabase';
  import { locale } from '$lib/utils/functions/translations';
  import CopyButton from './CopyButton.svelte';

  type ToolId =
    | 'socratic'
    | 'vocabulary-practice'
    | 'english-writing-coach'
    | 'math-error-card'
    | 'reading-question-generator'
    | 'science-concept-map';

  type PlannedToolId =
    | 'general-studies-qa'
    | 'daily-practice'
    | 'learning-summary'
    | 'emotion-journal'
    | 'story-card'
    | 'photo-math';

  type AnyToolId = ToolId | PlannedToolId;
  type Mode = 'guided' | 'direct';
  type ViewMode = 'hub' | 'tool';
  type ToolGroup = '学生常用' | '教师备课' | '课堂复习' | '即将开放';
  type UiLanguage = 'zh-Hant' | 'zh-Hans' | 'en';

  interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
  }

  interface ToolField {
    key: string;
    label: string;
    rows: number;
    placeholder: string;
    required?: boolean;
  }

  interface ToolConfig {
    id: AnyToolId;
    label: string;
    description: string;
    group: ToolGroup;
    badge: string;
    details: string;
    endpoint?: string;
    fields?: ToolField[];
    available: boolean;
    icon: typeof Chat;
  }

  interface VocabularyPracticeResult {
    items: Array<{
      word: string;
      meaning: string;
      example: string;
      synonyms: string[];
      blankQuestion: string;
      answer: string;
    }>;
  }

  const COPY: Record<UiLanguage, Record<string, string>> = {
    'zh-Hant': {
      moduleName: 'ailaeclass Agent',
      title: 'AI 工具中心',
      subtitle: '選擇一個工具進入使用。學生、教師和管理端都可以從這裡進入適合自己的 AI 功能。',
      language: '語言',
      available: '可使用',
      planned: '預留',
      shared: '端共用',
      tools: '個工具',
      cardIntroTitle: '從工具開始，而不是從聊天開始',
      cardIntroBody: '每個工具都有固定輸入和結構化結果，學生更容易跟著做，教師也更容易複製到課堂材料。',
      privacyTitle: 'AI 生成與私隱提示',
      privacyBody:
        'AI 回答可能出現錯誤，只能作學習參考，不能取代教師判斷。請不要輸入身份證、電話、住址、完整學生檔案、醫療資料或其他敏感個人資料。教師在課堂或評分中使用前，應先核對內容。',
      dataTitle: '資料使用說明',
      dataBody:
        '系統會把你在本工具輸入的題目、文章或文字送到已配置的 AI 服務供生成結果使用。請只輸入完成學習任務所需的內容。',
      enter: '進入使用',
      viewPlan: '待開發',
      back: '返回 AI 工具中心',
      guided: '引導模式',
      direct: '直接解釋',
      plannedTitle: '這個工具已預留在 AI 模組中',
      chooseOther: '返回選擇其他工具',
      result: '結果',
      noResult: '在左側填寫內容後點擊生成，結果會顯示在這裡。',
      generating: '正在生成，請稍候...',
      thinking: '正在思考...',
      send: '發送',
      clear: '清除',
      me: '我',
      copy: '複製',
      copied: '已複製',
      colon: '：',
      listSeparator: '、',
      openParen: '（',
      closeParen: '）',
      arrow: ' → ',
      generate: '生成結果',
      generatingButton: '生成中...',
      loginRequired: '請先登入。',
      notConfigured: 'AI 服務尚未配置，請聯絡管理員。',
      unavailable: 'AI 服務暫時不可用，請稍後再試。',
      invalid: '請求格式不正確，請檢查輸入內容。',
      unexpected: '發生錯誤，請稍後再試。',
      requiredPrefix: '請填寫',
      welcome:
        '你好！你可以問我數學、中文、英文或科學的問題。逐步引導會先問關鍵問題；直接解釋會給出答案、推理和常見錯誤提醒。',
      inputQuestion: '輸入你想學習的題目或問題...',
      meaning: '釋義',
      example: '例句',
      synonyms: '近義詞',
      blankQuestion: '填空題',
      answer: '答案',
      overallFeedback: '整體評價',
      corrections: '語法修正',
      originalSentence: '原句',
      issue: '問題',
      suggestion: '建議',
      vocabularyUpgrades: '詞彙升級',
      sentenceSuggestions: '句式建議',
      originalPattern: '原句式',
      priorities: '優先改進',
      nextRevisionTask: '下一步修改任務',
      mistakeSummary: '錯誤總結',
      wrongStep: '錯在哪裡',
      correctStep: '正確做法',
      concept: '相關概念',
      similarQuestion: '類似練習題',
      showAnswer: '查看答案',
      multipleChoice: '選擇題',
      openQuestions: '開放式問題',
      suggestedAnswer: '建議答案',
      keywords: '關鍵詞',
      nodes: '概念節點',
      edges: '關係',
      misconceptions: '常見誤解',
      quiz: '小測驗'
    },
    'zh-Hans': {
      moduleName: 'ailaeclass Agent',
      title: 'AI 工具中心',
      subtitle: '选择一个工具进入使用。学生、教师和管理端都可以从这里进入适合自己的 AI 功能。',
      language: '语言',
      available: '可使用',
      planned: '预留',
      shared: '端共用',
      tools: '个工具',
      cardIntroTitle: '从工具开始，而不是从聊天开始',
      cardIntroBody: '每个工具都有固定输入和结构化结果，学生更容易跟着做，教师也更容易复制到课堂材料。',
      privacyTitle: 'AI 生成与隐私提示',
      privacyBody:
        'AI 回答可能出现错误，只能作为学习参考，不能取代教师判断。请不要输入身份证、电话、住址、完整学生档案、医疗资料或其他敏感个人资料。教师在课堂或评分中使用前，应先核对内容。',
      dataTitle: '资料使用说明',
      dataBody:
        '系统会把你在本工具输入的题目、文章或文字发送到已配置的 AI 服务用于生成结果。请只输入完成学习任务所需的内容。',
      enter: '进入使用',
      viewPlan: '待开发',
      back: '返回 AI 工具中心',
      guided: '引导模式',
      direct: '直接解释',
      plannedTitle: '这个工具已预留在 AI 模块中',
      chooseOther: '返回选择其他工具',
      result: '结果',
      noResult: '在左侧填写内容后点击生成，结果会显示在这里。',
      generating: '正在生成，请稍候...',
      thinking: '正在思考...',
      send: '发送',
      clear: '清除',
      me: '我',
      copy: '复制',
      copied: '已复制',
      colon: '：',
      listSeparator: '、',
      openParen: '（',
      closeParen: '）',
      arrow: ' → ',
      generate: '生成结果',
      generatingButton: '生成中...',
      loginRequired: '请先登录。',
      notConfigured: 'AI 服务尚未配置，请联系管理员。',
      unavailable: 'AI 服务暂时不可用，请稍后再试。',
      invalid: '请求格式不正确，请检查输入内容。',
      unexpected: '发生错误，请稍后再试。',
      requiredPrefix: '请填写',
      welcome:
        '你好！你可以问我数学、中文、英文或科学的问题。逐步引导会先问关键问题；直接解释会给出答案、推理和常见错误提醒。',
      inputQuestion: '输入你想学习的题目或问题...',
      meaning: '释义',
      example: '例句',
      synonyms: '近义词',
      blankQuestion: '填空题',
      answer: '答案',
      overallFeedback: '整体评价',
      corrections: '语法修正',
      originalSentence: '原句',
      issue: '问题',
      suggestion: '建议',
      vocabularyUpgrades: '词汇升级',
      sentenceSuggestions: '句式建议',
      originalPattern: '原句式',
      priorities: '优先改进',
      nextRevisionTask: '下一步修改任务',
      mistakeSummary: '错误总结',
      wrongStep: '错在哪里',
      correctStep: '正确做法',
      concept: '相关概念',
      similarQuestion: '类似练习题',
      showAnswer: '查看答案',
      multipleChoice: '选择题',
      openQuestions: '开放式问题',
      suggestedAnswer: '建议答案',
      keywords: '关键词',
      nodes: '概念节点',
      edges: '关系',
      misconceptions: '常见误解',
      quiz: '小测验'
    },
    en: {
      moduleName: 'ailaeclass Agent',
      title: 'AI Tools Center',
      subtitle: 'Choose a tool to start. Students, teachers, and admins can all access suitable AI tools here.',
      language: 'Language',
      available: 'Live',
      planned: 'Planned',
      shared: 'Roles',
      tools: 'tools',
      cardIntroTitle: 'Start with a tool, not an open chat',
      cardIntroBody:
        'Each tool has structured inputs and structured outputs, making it easier for students to follow and for teachers to reuse in class.',
      privacyTitle: 'AI and Privacy Notice',
      privacyBody:
        'AI-generated content may be inaccurate and is for learning reference only. It does not replace teacher judgement. Do not enter ID numbers, phone numbers, addresses, full student records, medical information, or other sensitive personal data. Teachers should review outputs before using them in class or assessment.',
      dataTitle: 'Data Use Notice',
      dataBody:
        'The questions, passages, or text you enter in this tool are sent to the configured AI service to generate a response. Only enter information needed for the learning task.',
      enter: 'Open tool',
      viewPlan: 'Pending',
      back: 'Back to AI Tools Center',
      guided: 'Guided',
      direct: 'Direct',
      plannedTitle: 'This tool is reserved in the AI module',
      chooseOther: 'Choose another tool',
      result: 'Result',
      noResult: 'Fill in the form on the left and generate. The result will appear here.',
      generating: 'Generating...',
      thinking: 'Thinking...',
      send: 'Send',
      clear: 'Clear',
      me: 'Me',
      copy: 'Copy',
      copied: 'Copied',
      colon: ': ',
      listSeparator: ', ',
      openParen: ' (',
      closeParen: ')',
      arrow: ' -> ',
      generate: 'Generate',
      generatingButton: 'Generating...',
      loginRequired: 'Please log in first.',
      notConfigured: 'AI service is not configured. Please contact an administrator.',
      unavailable: 'AI service is temporarily unavailable. Please try again later.',
      invalid: 'Invalid request. Please check your input.',
      unexpected: 'Something went wrong. Please try again later.',
      requiredPrefix: 'Please fill in',
      welcome:
        'Hello. You can ask math, Chinese, English, or science questions. Guided mode asks key questions step by step; direct mode gives the answer, reasoning, and common mistake warnings.',
      inputQuestion: 'Enter a question or topic...',
      meaning: 'Meaning',
      example: 'Example',
      synonyms: 'Synonyms',
      blankQuestion: 'Fill-in-the-blank',
      answer: 'Answer',
      overallFeedback: 'Overall Feedback',
      corrections: 'Grammar Corrections',
      originalSentence: 'Original',
      issue: 'Issue',
      suggestion: 'Suggestion',
      vocabularyUpgrades: 'Vocabulary Upgrades',
      sentenceSuggestions: 'Sentence Suggestions',
      originalPattern: 'Original pattern',
      priorities: 'Priorities',
      nextRevisionTask: 'Next Revision Task',
      mistakeSummary: 'Mistake Summary',
      wrongStep: 'Wrong Step',
      correctStep: 'Correct Step',
      concept: 'Concept',
      similarQuestion: 'Similar Practice',
      showAnswer: 'Show Answer',
      multipleChoice: 'Multiple Choice',
      openQuestions: 'Open Questions',
      suggestedAnswer: 'Suggested Answer',
      keywords: 'Keywords',
      nodes: 'Concept Nodes',
      edges: 'Relationships',
      misconceptions: 'Common Misconceptions',
      quiz: 'Quick Quiz'
    }
  };

  const GROUP_LABELS: Record<UiLanguage, Record<ToolGroup, string>> = {
    'zh-Hant': {
      学生常用: '學生常用',
      教师备课: '教師備課',
      课堂复习: '課堂複習',
      即将开放: '即將開放'
    },
    'zh-Hans': {
      学生常用: '学生常用',
      教师备课: '教师备课',
      课堂复习: '课堂复习',
      即将开放: '即将开放'
    },
    en: {
      学生常用: 'For Students',
      教师备课: 'Teacher Preparation',
      课堂复习: 'Class Review',
      即将开放: 'Coming Soon'
    }
  };

  const TOOL_BADGES: Record<UiLanguage, Record<AnyToolId, string>> = {
    'zh-Hant': {
      socratic: '已上線',
      'vocabulary-practice': '已上線',
      'english-writing-coach': '已上線',
      'math-error-card': '已上線',
      'reading-question-generator': '已上線',
      'science-concept-map': '已上線',
      'photo-math': '待開發',
      'general-studies-qa': '待開發',
      'daily-practice': '待開發',
      'learning-summary': '待開發',
      'emotion-journal': '待開發',
      'story-card': '待開發'
    },
    'zh-Hans': {
      socratic: '已上线',
      'vocabulary-practice': '已上线',
      'english-writing-coach': '已上线',
      'math-error-card': '已上线',
      'reading-question-generator': '已上线',
      'science-concept-map': '已上线',
      'photo-math': '待开发',
      'general-studies-qa': '待开发',
      'daily-practice': '待开发',
      'learning-summary': '待开发',
      'emotion-journal': '待开发',
      'story-card': '待开发'
    },
    en: {
      socratic: 'Live',
      'vocabulary-practice': 'Live',
      'english-writing-coach': 'Live',
      'math-error-card': 'Live',
      'reading-question-generator': 'Live',
      'science-concept-map': 'Live',
      'photo-math': 'Pending',
      'general-studies-qa': 'Pending',
      'daily-practice': 'Pending',
      'learning-summary': 'Pending',
      'emotion-journal': 'Pending',
      'story-card': 'Pending'
    }
  };

  const TOOLS: ToolConfig[] = [
    {
      id: 'socratic',
      label: 'AI 名师伴学',
      description: '学生可以把题目或主题发进来，AI 会一步一步引导。',
      details: '适合数学、中文、英文、科学等日常学习问题；可切换逐步引导或直接解释。',
      group: '学生常用',
      badge: '已上线',
      endpoint: '/api/ai-tools/socratic',
      available: true,
      icon: Chat,
      fields: [
        { key: 'message', label: '你的问题', rows: 3, placeholder: '输入你想学习的题目或问题...', required: true }
      ]
    },
    {
      id: 'vocabulary-practice',
      label: '生字句子练习器',
      description: '输入课文生字，生成解释、例句、近义词和填空题。',
      details: '适合小三至中一中文学习，可快速生成课堂练习或学生自学材料。',
      group: '学生常用',
      badge: '已上线',
      endpoint: '/api/ai-tools/vocabulary-practice',
      available: true,
      icon: Pen,
      fields: [
        { key: 'words', label: '生字（每行一个）', rows: 5, placeholder: '例如：\n毅力\n谦虚\n勤奋', required: true },
        { key: 'grade', label: '年级（可选）', rows: 1, placeholder: '例如：小四 / 中一' }
      ]
    },
    {
      id: 'english-writing-coach',
      label: '英文作文改进助手',
      description: '只给语法修正、词汇升级和句式建议，不直接代写全文。',
      details: '适合小五至中三。学生先写，AI 帮助指出可以改进的地方。',
      group: '学生常用',
      badge: '已上线',
      endpoint: '/api/ai-tools/english-writing-coach',
      available: true,
      icon: Document,
      fields: [
        { key: 'essay', label: '作文内容', rows: 7, placeholder: '贴上你的英文作文...', required: true },
        { key: 'grade', label: '年级（可选）', rows: 1, placeholder: '例如：小五 / 中二' },
        { key: 'focus', label: '重点（可选）', rows: 1, placeholder: 'grammar / vocabulary / sentence variety' }
      ]
    },
    {
      id: 'math-error-card',
      label: '数学错题讲解卡',
      description: '分析错题步骤，指出错在哪里，并给一题相似练习。',
      details: '适合小四至中二。重点不是直接给答案，而是帮助学生修正错误思路。',
      group: '课堂复习',
      badge: '已上线',
      endpoint: '/api/ai-tools/math-error-card',
      available: true,
      icon: Education,
      fields: [
        { key: 'question', label: '题目', rows: 3, placeholder: '输入数学题...', required: true },
        { key: 'studentAnswer', label: '你的答案', rows: 2, placeholder: '你当时写下的答案', required: true },
        { key: 'workingSteps', label: '你的步骤（可选）', rows: 3, placeholder: '写下你的解题步骤，帮助 AI 更准确定位错误' },
        { key: 'grade', label: '年级（可选）', rows: 1, placeholder: '例如：小四 / 中一' }
      ]
    },
    {
      id: 'reading-question-generator',
      label: '阅读理解出题器',
      description: '老师贴上文章，AI 生成选择题、开放题、关键词和答案。',
      details: '适合教师备课，也适合学生自测文章理解。',
      group: '教师备课',
      badge: '已上线',
      endpoint: '/api/ai-tools/reading-question-generator',
      available: true,
      icon: Search,
      fields: [
        { key: 'passage', label: '文章', rows: 8, placeholder: '贴上阅读文章...', required: true },
        { key: 'grade', label: '年级（可选）', rows: 1, placeholder: '例如：小四 / 中二' },
        { key: 'questionCount', label: '题目数量（可选，默认 5）', rows: 1, placeholder: '5' }
      ]
    },
    {
      id: 'science-concept-map',
      label: '科学概念图',
      description: '输入科学主题，生成概念节点、关系、误区和小测验。',
      details: '适合课堂导入、复习和学生整理知识结构。',
      group: '课堂复习',
      badge: '已上线',
      endpoint: '/api/ai-tools/science-concept-map',
      available: true,
      icon: Idea,
      fields: [
        { key: 'topic', label: '主题', rows: 2, placeholder: '例如：光合作用 / 水循环 / 电路', required: true },
        { key: 'grade', label: '年级（可选）', rows: 1, placeholder: '例如：小五 / 中一' },
        { key: 'keywords', label: '关键词（可选）', rows: 1, placeholder: '用逗号分隔' }
      ]
    },
    {
      id: 'photo-math',
      label: '拍题错题讲解',
      description: '使用 Kimi 视觉能力识别图片题目，再生成错题讲解卡。',
      details: '需要 Kimi API key。上线后会先让学生确认识别出的题目，再进行讲解。',
      group: '即将开放',
      badge: 'Kimi 预留',
      available: false,
      icon: Education
    },
    {
      id: 'general-studies-qa',
      label: '常识科知识库问答',
      description: '只根据老师指定资料回答，避免开放式乱答。',
      details: '适合香港常识科主题，需要先接入课程知识库来源。',
      group: '即将开放',
      badge: '规划中',
      available: false,
      icon: Chat
    },
    {
      id: 'daily-practice',
      label: 'AI 今日推荐练习',
      description: '根据考试和练习记录，推荐今天最值得做的题目。',
      details: '需要稳定的题目标签和学习记录，后续会接入课程与考试数据。',
      group: '即将开放',
      badge: '数据型',
      available: false,
      icon: Settings
    },
    {
      id: 'learning-summary',
      label: '学习数据摘要',
      description: '为学生、教师和管理端生成学习表现摘要。',
      details: '后续会汇总提交、考试、出勤和课程参与情况。',
      group: '即将开放',
      badge: '数据型',
      available: false,
      icon: Document
    },
    {
      id: 'emotion-journal',
      label: '情绪日记与关怀提醒',
      description: '学生记录心情，AI 给温和鼓励与学习建议。',
      details: '涉及学生隐私，需要先完成权限、保留期限和教师可见范围设计。',
      group: '即将开放',
      badge: '需安全设计',
      available: false,
      icon: WarningAlt
    },
    {
      id: 'story-card',
      label: 'AI 绘图故事卡',
      description: '输入角色和场景，生成故事卡和三句故事。',
      details: '文字故事卡可先做；图片生成需要额外图像模型与安全审核。',
      group: '即将开放',
      badge: '创作型',
      available: false,
      icon: Pen
    }
  ];

  const TOOL_TEXT: Record<UiLanguage, Record<AnyToolId, { label: string; description: string; details: string }>> = {
    'zh-Hant': {
      socratic: {
        label: 'AI 名師伴學',
        description: '學生可以把題目或主題發進來，AI 會一步一步引導。',
        details: '適合數學、中文、英文、科學等日常學習問題；可切換逐步引導或直接解釋。'
      },
      'vocabulary-practice': {
        label: '生字句子練習器',
        description: '輸入課文生字，生成解釋、例句、近義詞和填空題。',
        details: '適合小三至中一中文學習，可快速生成課堂練習或學生自學材料。'
      },
      'english-writing-coach': {
        label: '英文作文改進助手',
        description: '只給語法修正、詞彙升級和句式建議，不直接代寫全文。',
        details: '適合小五至中三。學生先寫，AI 幫助指出可以改進的地方。'
      },
      'math-error-card': {
        label: '數學錯題講解卡',
        description: '分析錯題步驟，指出錯在哪裡，並給一題相似練習。',
        details: '適合小四至中二。重點不是直接給答案，而是幫助學生修正錯誤思路。'
      },
      'reading-question-generator': {
        label: '閱讀理解出題器',
        description: '老師貼上文章，AI 生成選擇題、開放題、關鍵詞和答案。',
        details: '適合教師備課，也適合學生自測文章理解。'
      },
      'science-concept-map': {
        label: '科學概念圖',
        description: '輸入科學主題，生成概念節點、關係、誤區和小測驗。',
        details: '適合課堂導入、複習和學生整理知識結構。'
      },
      'photo-math': {
        label: '拍題錯題講解',
        description: '使用 Kimi 視覺能力識別圖片題目，再生成錯題講解卡。',
        details: '需要 Kimi API key。上線後會先讓學生確認識別出的題目，再進行講解。'
      },
      'general-studies-qa': {
        label: '常識科知識庫問答',
        description: '只根據老師指定資料回答，避免開放式亂答。',
        details: '適合香港常識科主題，需要先接入課程知識庫來源。'
      },
      'daily-practice': {
        label: 'AI 今日推薦練習',
        description: '根據考試和練習記錄，推薦今天最值得做的題目。',
        details: '需要穩定的題目標籤和學習記錄，後續會接入課程與考試數據。'
      },
      'learning-summary': {
        label: '學習數據摘要',
        description: '為學生、教師和管理端生成學習表現摘要。',
        details: '後續會匯總提交、考試、出勤和課程參與情況。'
      },
      'emotion-journal': {
        label: '情緒日記與關懷提醒',
        description: '學生記錄心情，AI 給溫和鼓勵與學習建議。',
        details: '涉及學生私隱，需要先完成權限、保留期限和教師可見範圍設計。'
      },
      'story-card': {
        label: 'AI 繪圖故事卡',
        description: '輸入角色和場景，生成故事卡和三句故事。',
        details: '文字故事卡可先做；圖片生成需要額外圖像模型與安全審核。'
      }
    },
    'zh-Hans': {
      socratic: {
        label: 'AI 名师伴学',
        description: '学生可以把题目或主题发进来，AI 会一步一步引导。',
        details: '适合数学、中文、英文、科学等日常学习问题；可切换逐步引导或直接解释。'
      },
      'vocabulary-practice': {
        label: '生字句子练习器',
        description: '输入课文生字，生成解释、例句、近义词和填空题。',
        details: '适合小三至中一中文学习，可快速生成课堂练习或学生自学材料。'
      },
      'english-writing-coach': {
        label: '英文作文改进助手',
        description: '只给语法修正、词汇升级和句式建议，不直接代写全文。',
        details: '适合小五至中三。学生先写，AI 帮助指出可以改进的地方。'
      },
      'math-error-card': {
        label: '数学错题讲解卡',
        description: '分析错题步骤，指出错在哪里，并给一题相似练习。',
        details: '适合小四至中二。重点不是直接给答案，而是帮助学生修正错误思路。'
      },
      'reading-question-generator': {
        label: '阅读理解出题器',
        description: '老师贴上文章，AI 生成选择题、开放题、关键词和答案。',
        details: '适合教师备课，也适合学生自测文章理解。'
      },
      'science-concept-map': {
        label: '科学概念图',
        description: '输入科学主题，生成概念节点、关系、误区和小测验。',
        details: '适合课堂导入、复习和学生整理知识结构。'
      },
      'photo-math': {
        label: '拍题错题讲解',
        description: '使用 Kimi 视觉能力识别图片题目，再生成错题讲解卡。',
        details: '需要 Kimi API key。上线后会先让学生确认识别出的题目，再进行讲解。'
      },
      'general-studies-qa': {
        label: '常识科知识库问答',
        description: '只根据老师指定资料回答，避免开放式乱答。',
        details: '适合香港常识科主题，需要先接入课程知识库来源。'
      },
      'daily-practice': {
        label: 'AI 今日推荐练习',
        description: '根据考试和练习记录，推荐今天最值得做的题目。',
        details: '需要稳定的题目标签和学习记录，后续会接入课程与考试数据。'
      },
      'learning-summary': {
        label: '学习数据摘要',
        description: '为学生、教师和管理端生成学习表现摘要。',
        details: '后续会汇总提交、考试、出勤和课程参与情况。'
      },
      'emotion-journal': {
        label: '情绪日记与关怀提醒',
        description: '学生记录心情，AI 给温和鼓励与学习建议。',
        details: '涉及学生隐私，需要先完成权限、保留期限和教师可见范围设计。'
      },
      'story-card': {
        label: 'AI 绘图故事卡',
        description: '输入角色和场景，生成故事卡和三句故事。',
        details: '文字故事卡可先做；图片生成需要额外图像模型与安全审核。'
      }
    },
    en: {
      socratic: {
        label: 'AI Learning Coach',
        description: 'Ask a question or topic and get step-by-step guidance.',
        details: 'Useful for math, Chinese, English, science, and general study questions. Switch between guided and direct modes.'
      },
      'vocabulary-practice': {
        label: 'Chinese Vocabulary Practice',
        description: 'Enter vocabulary words to generate meanings, examples, synonyms, and fill-in-the-blank tasks.',
        details: 'Designed for Primary 3 to Secondary 1 Chinese learning and quick classroom practice.'
      },
      'english-writing-coach': {
        label: 'English Writing Coach',
        description: 'Gives grammar, vocabulary, and sentence suggestions without rewriting the full essay.',
        details: 'Designed for Primary 5 to Secondary 3. Students write first, then revise with focused feedback.'
      },
      'math-error-card': {
        label: 'Math Mistake Card',
        description: 'Explains the wrong step and gives one similar practice question.',
        details: 'Designed for Primary 4 to Secondary 2. The focus is correcting thinking, not just giving an answer.'
      },
      'reading-question-generator': {
        label: 'Reading Question Generator',
        description: 'Paste a passage to generate multiple-choice questions, open questions, keywords, and answers.',
        details: 'Useful for teacher preparation and student reading self-checks.'
      },
      'science-concept-map': {
        label: 'Science Concept Map',
        description: 'Enter a science topic to generate concept nodes, relationships, misconceptions, and a quick quiz.',
        details: 'Useful for lesson introduction, revision, and organizing knowledge.'
      },
      'photo-math': {
        label: 'Photo Math Mistake Coach',
        description: 'Uses Kimi vision to read a photo question before generating a mistake card.',
        details: 'Requires a valid Kimi API key. Students will confirm recognized text before explanation.'
      },
      'general-studies-qa': {
        label: 'General Studies Knowledge Q&A',
        description: 'Answers only from teacher-approved materials.',
        details: 'Designed for Hong Kong General Studies topics after course knowledge sources are connected.'
      },
      'daily-practice': {
        label: 'AI Daily Practice',
        description: 'Recommends the most useful practice items based on exam and exercise records.',
        details: 'Requires stable question tags and learning records.'
      },
      'learning-summary': {
        label: 'Learning Data Summary',
        description: 'Generates learning summaries for students, teachers, and admins.',
        details: 'Will summarize submissions, exams, attendance, and course participation.'
      },
      'emotion-journal': {
        label: 'Mood Journal and Care Reminder',
        description: 'Students record a mood and receive gentle encouragement and study suggestions.',
        details: 'Requires privacy, retention, and teacher visibility rules before release.'
      },
      'story-card': {
        label: 'AI Story Card',
        description: 'Enter a character and scene to create a story card and three story sentences.',
        details: 'Text story cards can come first. Image generation requires a separate image model and safety review.'
      }
    }
  };

  const FIELD_TEXT: Record<UiLanguage, Partial<Record<AnyToolId, Record<string, { label: string; placeholder: string }>>>> = {
    'zh-Hant': {
      socratic: { message: { label: '你的問題', placeholder: '輸入你想學習的題目或問題...' } },
      'vocabulary-practice': {
        words: { label: '生字（每行一個）', placeholder: '例如：\n毅力\n謙虛\n勤奮' },
        grade: { label: '年級（可選）', placeholder: '例如：小四 / 中一' }
      },
      'english-writing-coach': {
        essay: { label: '作文內容', placeholder: '貼上你的英文作文...' },
        grade: { label: '年級（可選）', placeholder: '例如：小五 / 中二' },
        focus: { label: '重點（可選）', placeholder: 'grammar / vocabulary / sentence variety' }
      },
      'math-error-card': {
        question: { label: '題目', placeholder: '輸入數學題...' },
        studentAnswer: { label: '你的答案', placeholder: '你當時寫下的答案' },
        workingSteps: { label: '你的步驟（可選）', placeholder: '寫下你的解題步驟，幫助 AI 更準確定位錯誤' },
        grade: { label: '年級（可選）', placeholder: '例如：小四 / 中一' }
      },
      'reading-question-generator': {
        passage: { label: '文章', placeholder: '貼上閱讀文章...' },
        grade: { label: '年級（可選）', placeholder: '例如：小四 / 中二' },
        questionCount: { label: '題目數量（可選，預設 5）', placeholder: '5' }
      },
      'science-concept-map': {
        topic: { label: '主題', placeholder: '例如：光合作用 / 水循環 / 電路' },
        grade: { label: '年級（可選）', placeholder: '例如：小五 / 中一' },
        keywords: { label: '關鍵詞（可選）', placeholder: '用逗號分隔' }
      }
    },
    'zh-Hans': {
      socratic: { message: { label: '你的问题', placeholder: '输入你想学习的题目或问题...' } },
      'vocabulary-practice': {
        words: { label: '生字（每行一个）', placeholder: '例如：\n毅力\n谦虚\n勤奋' },
        grade: { label: '年级（可选）', placeholder: '例如：小四 / 中一' }
      },
      'english-writing-coach': {
        essay: { label: '作文内容', placeholder: '贴上你的英文作文...' },
        grade: { label: '年级（可选）', placeholder: '例如：小五 / 中二' },
        focus: { label: '重点（可选）', placeholder: 'grammar / vocabulary / sentence variety' }
      },
      'math-error-card': {
        question: { label: '题目', placeholder: '输入数学题...' },
        studentAnswer: { label: '你的答案', placeholder: '你当时写下的答案' },
        workingSteps: { label: '你的步骤（可选）', placeholder: '写下你的解题步骤，帮助 AI 更准确定位错误' },
        grade: { label: '年级（可选）', placeholder: '例如：小四 / 中一' }
      },
      'reading-question-generator': {
        passage: { label: '文章', placeholder: '贴上阅读文章...' },
        grade: { label: '年级（可选）', placeholder: '例如：小四 / 中二' },
        questionCount: { label: '题目数量（可选，默认 5）', placeholder: '5' }
      },
      'science-concept-map': {
        topic: { label: '主题', placeholder: '例如：光合作用 / 水循环 / 电路' },
        grade: { label: '年级（可选）', placeholder: '例如：小五 / 中一' },
        keywords: { label: '关键词（可选）', placeholder: '用逗号分隔' }
      }
    },
    en: {
      socratic: { message: { label: 'Your question', placeholder: 'Enter a question or topic...' } },
      'vocabulary-practice': {
        words: { label: 'Vocabulary words (one per line)', placeholder: 'For example:\nperseverance\nhumble\nhardworking' },
        grade: { label: 'Grade (optional)', placeholder: 'e.g. Primary 4 / Secondary 1' }
      },
      'english-writing-coach': {
        essay: { label: 'Essay text', placeholder: 'Paste your English writing...' },
        grade: { label: 'Grade (optional)', placeholder: 'e.g. Primary 5 / Secondary 2' },
        focus: { label: 'Focus (optional)', placeholder: 'grammar / vocabulary / sentence variety' }
      },
      'math-error-card': {
        question: { label: 'Question', placeholder: 'Enter the math question...' },
        studentAnswer: { label: 'Your answer', placeholder: 'The answer you wrote' },
        workingSteps: { label: 'Your working steps (optional)', placeholder: 'Write your steps so AI can identify the mistake more accurately' },
        grade: { label: 'Grade (optional)', placeholder: 'e.g. Primary 4 / Secondary 1' }
      },
      'reading-question-generator': {
        passage: { label: 'Passage', placeholder: 'Paste the reading passage...' },
        grade: { label: 'Grade (optional)', placeholder: 'e.g. Primary 4 / Secondary 2' },
        questionCount: { label: 'Number of questions (optional, default 5)', placeholder: '5' }
      },
      'science-concept-map': {
        topic: { label: 'Topic', placeholder: 'e.g. Photosynthesis / Water cycle / Electric circuits' },
        grade: { label: 'Grade (optional)', placeholder: 'e.g. Primary 5 / Secondary 1' },
        keywords: { label: 'Keywords (optional)', placeholder: 'Separate with commas' }
      }
    }
  };

  let viewMode: ViewMode = 'hub';
  let uiLanguage: UiLanguage = 'zh-Hant';
  let activeToolId: AnyToolId | null = null;
  let mode: Mode = 'guided';
  let isLoading = false;
  let errorMessage = '';
  let resultData: unknown = null;
  let resultText = '';
  let messages: ChatMessage[] = [];
  let messagesContainer: HTMLDivElement;
  let inputValues: Record<string, string> = {};
  let previousUiLanguage: UiLanguage | null = null;

  $: activeConfig = TOOLS.find((tool) => tool.id === activeToolId);
  $: availableTools = TOOLS.filter((tool) => tool.available);
  $: plannedTools = TOOLS.filter((tool) => !tool.available);
  $: uiLanguage = mapLocaleToUiLanguage($locale);
  $: if (previousUiLanguage !== uiLanguage) {
    if (previousUiLanguage) {
      errorMessage = '';
      resultData = null;
      resultText = '';
      messages = [];
    }
    previousUiLanguage = uiLanguage;
  }

  function mapLocaleToUiLanguage(currentLocale: string): UiLanguage {
    if (currentLocale === 'en') return 'en';
    if (currentLocale === 'zh') return 'zh-Hans';
    return 'zh-Hant';
  }

  function ui(key: string) {
    return COPY[uiLanguage][key] ?? COPY['zh-Hant'][key] ?? key;
  }

  function localizedTool(tool: ToolConfig) {
    return TOOL_TEXT[uiLanguage][tool.id] ?? TOOL_TEXT['zh-Hant'][tool.id];
  }

  function localizedField(toolId: AnyToolId, field: ToolField) {
    return FIELD_TEXT[uiLanguage][toolId]?.[field.key] ?? {
      label: field.label,
      placeholder: field.placeholder
    };
  }

  function toolBadge(tool: ToolConfig) {
    return TOOL_BADGES[uiLanguage][tool.id] ?? tool.badge;
  }

  function outputLanguageLabel() {
    if (uiLanguage === 'zh-Hant') return 'Traditional Chinese';
    if (uiLanguage === 'zh-Hans') return 'Simplified Chinese';
    return 'English';
  }

  function openTool(tool: ToolConfig) {
    activeToolId = tool.id;
    viewMode = 'tool';
    errorMessage = '';
    resultData = null;
    resultText = '';
  }

  function returnToHub() {
    viewMode = 'hub';
    activeToolId = null;
    errorMessage = '';
    resultData = null;
    resultText = '';
  }

  function getErrorMessage(status: number, code?: string) {
    if (status === 401) return ui('loginRequired');
    if (status === 503 && (code === 'missing_api_key' || code === 'missing_deepseek_key')) return ui('notConfigured');
    if (status === 502) return ui('unavailable');
    if (status === 400) return ui('invalid');
    return ui('unexpected');
  }

  async function scrollToBottom() {
    await tick();
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  function getRequestHistory(currentMessages: ChatMessage[]) {
    return currentMessages
      .slice(1)
      .slice(-8)
      .map((message) => ({ role: message.role, content: message.content.slice(0, 1500) }));
  }

  async function sendSocratic() {
    const text = (inputValues.message || '').trim();
    if (!text || isLoading) return;

    const previousMessages = messages;
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    messages = nextMessages;
    inputValues.message = '';
    errorMessage = '';
    isLoading = true;
    await scrollToBottom();

    try {
      const token = await getAccessToken();
      const response = await fetch('/api/ai-tools/socratic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: text,
          mode,
          outputLanguage: outputLanguageLabel(),
          history: getRequestHistory(previousMessages)
        })
      });

      let data: { reply?: string; error?: string; code?: string } = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok || !data.reply) {
        const friendly = getErrorMessage(response.status, data.code);
        errorMessage = friendly;
        messages = [...nextMessages, { role: 'assistant', content: friendly }];
        return;
      }

      messages = [...nextMessages, { role: 'assistant', content: data.reply }];
    } catch {
      const friendly = ui('unavailable');
      errorMessage = friendly;
      messages = [...nextMessages, { role: 'assistant', content: friendly }];
    } finally {
      isLoading = false;
      await scrollToBottom();
    }
  }

  async function submitTool() {
    if (isLoading || !activeConfig?.available || !activeConfig.endpoint || !activeConfig.fields) return;

    const body: Record<string, unknown> = {};
    for (const field of activeConfig.fields) {
      const value = (inputValues[field.key] || '').trim();
      if (field.required && !value) {
        errorMessage = `${ui('requiredPrefix')}「${localizedField(activeConfig.id, field).label}」`;
        return;
      }
      if (field.key === 'questionCount') {
        const n = Number(value);
        body[field.key] = Number.isFinite(n) && n > 0 ? n : 5;
      } else {
        body[field.key] = value;
      }
    }

    body.outputLanguage = outputLanguageLabel();

    errorMessage = '';
    resultData = null;
    resultText = '';
    isLoading = true;

    try {
      const token = await getAccessToken();
      const response = await fetch(activeConfig.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });

      let data: unknown = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        const err = data as { error?: string; code?: string };
        errorMessage = getErrorMessage(response.status, err.code);
        return;
      }

      resultData = data;
      resultText = formatResultForCopy(activeConfig.id, data);
    } catch {
      errorMessage = ui('unavailable');
    } finally {
      isLoading = false;
    }
  }

  function clearSocratic() {
    messages = [];
    inputValues.message = '';
    errorMessage = '';
  }

  function clearTool() {
    inputValues = {};
    errorMessage = '';
    resultData = null;
    resultText = '';
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (activeConfig?.id === 'socratic') sendSocratic();
    }
  }

  function stripMarkdown(text: string): string {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .trim();
  }

  function isVocabularyResult(data: unknown): data is VocabularyPracticeResult {
    return !!data && typeof data === 'object' && 'items' in data && Array.isArray((data as Record<string, unknown>).items);
  }

  function isWritingCoachResult(data: unknown): data is {
    overallFeedback: string;
    corrections: Array<{ originalSentence: string; issue: string; suggestion: string }>;
    vocabularyUpgrades: Array<{ original: string; upgrade: string; reason: string }>;
    sentenceSuggestions: Array<{ originalPattern: string; suggestedPattern: string; benefit: string }>;
    priorities: string[];
    nextRevisionTask: string;
  } {
    return !!data && typeof data === 'object' && 'overallFeedback' in data;
  }

  function isMathErrorCardResult(data: unknown): data is {
    mistakeSummary: string;
    wrongStep: string;
    correctStep: string;
    concept: string;
    similarQuestion: string;
    similarAnswer: string;
  } {
    return !!data && typeof data === 'object' && 'mistakeSummary' in data;
  }

  function isReadingQuestionsResult(data: unknown): data is {
    multipleChoice: Array<{ question: string; options: string[]; answer: string }>;
    openQuestions: Array<{ question: string; suggestedAnswer: string }>;
    keywords: string[];
    answerKey: string[];
  } {
    return !!data && typeof data === 'object' && 'multipleChoice' in data && Array.isArray((data as Record<string, unknown>).multipleChoice);
  }

  function isScienceConceptMapResult(data: unknown): data is {
    nodes: Array<{ id: string; label: string; definition: string }>;
    edges: Array<{ from: string; to: string; label: string }>;
    keywords: string[];
    misconceptions: string[];
    quiz: Array<{ question: string; answer: string }>;
  } {
    return !!data && typeof data === 'object' && 'nodes' in data && Array.isArray((data as Record<string, unknown>).nodes);
  }

  function formatResultForCopy(tool: AnyToolId, data: unknown): string {
    if (tool === 'vocabulary-practice' && isVocabularyResult(data)) {
      return data.items
        .map((item, index) =>
          [
            `${index + 1}. ${item.word}`,
            `${ui('meaning')}${ui('colon')}${stripMarkdown(item.meaning || '')}`,
            `${ui('example')}${ui('colon')}${stripMarkdown(item.example || '')}`,
            item.synonyms?.length ? `${ui('synonyms')}${ui('colon')}${item.synonyms.join(ui('listSeparator'))}` : '',
            `${ui('blankQuestion')}${ui('colon')}${stripMarkdown(item.blankQuestion || '')}`,
            `${ui('answer')}${ui('colon')}${stripMarkdown(item.answer || '')}`
          ]
            .filter(Boolean)
            .join('\n')
        )
        .join('\n\n');
    }

    if (tool === 'english-writing-coach' && isWritingCoachResult(data)) {
      const corrections = data.corrections
        .map((item, index) =>
          [
            `${index + 1}. ${ui('originalSentence')}${ui('colon')}${stripMarkdown(item.originalSentence || '')}`,
            `${ui('issue')}${ui('colon')}${stripMarkdown(item.issue || '')}`,
            `${ui('suggestion')}${ui('colon')}${stripMarkdown(item.suggestion || '')}`
          ].join('\n')
        )
        .join('\n\n');
      const upgrades = data.vocabularyUpgrades
        .map((item) => `${item.original}${ui('arrow')}${item.upgrade}${ui('colon')}${stripMarkdown(item.reason || '')}`)
        .join('\n');
      const patterns = data.sentenceSuggestions
        .map((item) => `${item.originalPattern}${ui('arrow')}${item.suggestedPattern}${ui('colon')}${stripMarkdown(item.benefit || '')}`)
        .join('\n');

      return [
        `${ui('overallFeedback')}${ui('colon')}${stripMarkdown(data.overallFeedback || '')}`,
        corrections ? `${ui('corrections')}${ui('colon')}\n${corrections}` : '',
        upgrades ? `${ui('vocabularyUpgrades')}${ui('colon')}\n${upgrades}` : '',
        patterns ? `${ui('sentenceSuggestions')}${ui('colon')}\n${patterns}` : '',
        data.priorities?.length ? `${ui('priorities')}${ui('colon')}\n${data.priorities.map((item, index) => `${index + 1}. ${stripMarkdown(item)}`).join('\n')}` : '',
        `${ui('nextRevisionTask')}${ui('colon')}${stripMarkdown(data.nextRevisionTask || '')}`
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    if (tool === 'math-error-card' && isMathErrorCardResult(data)) {
      return [
        `${ui('mistakeSummary')}${ui('colon')}${stripMarkdown(data.mistakeSummary || '')}`,
        `${ui('wrongStep')}${ui('colon')}${stripMarkdown(data.wrongStep || '')}`,
        `${ui('correctStep')}${ui('colon')}${stripMarkdown(data.correctStep || '')}`,
        `${ui('concept')}${ui('colon')}${stripMarkdown(data.concept || '')}`,
        `${ui('similarQuestion')}${ui('colon')}${stripMarkdown(data.similarQuestion || '')}`,
        `${ui('answer')}${ui('colon')}${stripMarkdown(data.similarAnswer || '')}`
      ].join('\n\n');
    }

    if (tool === 'reading-question-generator' && isReadingQuestionsResult(data)) {
      const mc = data.multipleChoice
        .map((item, index) =>
          [
            `${index + 1}. ${stripMarkdown(item.question || '')}`,
            ...(item.options || []).map(stripMarkdown),
            `${ui('answer')}${ui('colon')}${stripMarkdown(item.answer || '')}`
          ].join('\n')
        )
        .join('\n\n');
      const open = data.openQuestions
        .map((item, index) => `${index + 1}. ${stripMarkdown(item.question || '')}\n${ui('suggestedAnswer')}${ui('colon')}${stripMarkdown(item.suggestedAnswer || '')}`)
        .join('\n\n');

      return [
        mc ? `${ui('multipleChoice')}${ui('colon')}\n${mc}` : '',
        open ? `${ui('openQuestions')}${ui('colon')}\n${open}` : '',
        data.keywords?.length ? `${ui('keywords')}${ui('colon')}${data.keywords.join(ui('listSeparator'))}` : '',
        data.answerKey?.length ? `${ui('answer')}${ui('colon')}\n${data.answerKey.map(stripMarkdown).join('\n')}` : ''
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    if (tool === 'science-concept-map' && isScienceConceptMapResult(data)) {
      const nodes = data.nodes.map((node) => `${node.label}${ui('colon')}${stripMarkdown(node.definition || '')}`).join('\n');
      const edges = data.edges.map((edge) => `${edge.from}${ui('arrow')}${edge.to}${ui('colon')}${stripMarkdown(edge.label || '')}`).join('\n');
      const quiz = data.quiz.map((item, index) => `${index + 1}. ${stripMarkdown(item.question || '')}\n${ui('answer')}${ui('colon')}${stripMarkdown(item.answer || '')}`).join('\n\n');

      return [
        nodes ? `${ui('nodes')}${ui('colon')}\n${nodes}` : '',
        edges ? `${ui('edges')}${ui('colon')}\n${edges}` : '',
        data.keywords?.length ? `${ui('keywords')}${ui('colon')}${data.keywords.join(ui('listSeparator'))}` : '',
        data.misconceptions?.length ? `${ui('misconceptions')}${ui('colon')}\n${data.misconceptions.map(stripMarkdown).join('\n')}` : '',
        quiz ? `${ui('quiz')}${ui('colon')}\n${quiz}` : ''
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    return JSON.stringify(data, null, 2);
  }
</script>

<section class="mx-auto w-full max-w-7xl px-4 py-5 md:px-5">
  {#if viewMode === 'hub'}
    <div class="mb-5">
      <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
            {ui('moduleName')}
          </p>
          <h1 class="mt-1 text-2xl font-bold text-[#040F2D] dark:text-white md:text-3xl">
            {ui('title')}
          </h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            {ui('subtitle')}
          </p>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
            <div class="text-lg font-semibold text-[#040F2D] dark:text-white">{availableTools.length}</div>
            <div class="text-xs text-gray-500">{ui('available')}</div>
          </div>
          <div class="rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
            <div class="text-lg font-semibold text-[#040F2D] dark:text-white">{plannedTools.length}</div>
            <div class="text-xs text-gray-500">{ui('planned')}</div>
          </div>
          <div class="rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
            <div class="text-lg font-semibold text-[#040F2D] dark:text-white">3</div>
            <div class="text-xs text-gray-500">{ui('shared')}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="mb-4 grid gap-3 md:grid-cols-2">
      <div class="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
        <div class="flex gap-3">
          <WarningAlt size={20} class="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
          <div>
            <h2 class="text-sm font-semibold text-amber-900 dark:text-amber-200">{ui('privacyTitle')}</h2>
            <p class="mt-1 text-sm leading-6 text-amber-900/90 dark:text-amber-100/90">{ui('privacyBody')}</p>
          </div>
        </div>
      </div>
      <div class="rounded-md border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
        <div class="flex gap-3">
          <Document size={20} class="mt-0.5 shrink-0 text-gray-600 dark:text-gray-300" />
          <div>
            <h2 class="text-sm font-semibold text-gray-800 dark:text-white">{ui('dataTitle')}</h2>
            <p class="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{ui('dataBody')}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="mb-6 rounded-md border border-primary-100 bg-primary-50 p-4 dark:border-primary-900 dark:bg-primary-900/20">
      <div class="flex gap-3">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-800 text-white">
          <Chat size={20} />
        </div>
        <div>
          <h2 class="text-base font-semibold text-[#040F2D] dark:text-white">{ui('cardIntroTitle')}</h2>
          <p class="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-200">
            {ui('cardIntroBody')}
          </p>
        </div>
      </div>
    </div>

    <div class="space-y-7">
      {#each ['学生常用', '教师备课', '课堂复习', '即将开放'] as group}
        {@const groupTools = TOOLS.filter((tool) => tool.group === group)}
        {#if groupTools.length}
          <div>
            <div class="mb-3 flex items-center justify-between">
              <h2 class="text-sm font-semibold text-gray-800 dark:text-white">{GROUP_LABELS[uiLanguage][group]}</h2>
              <span class="text-xs text-gray-500">{groupTools.length} {ui('tools')}</span>
            </div>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {#each groupTools as tool (tool.id)}
                <button
                  type="button"
                  disabled={!tool.available}
                  class="group min-h-[178px] rounded-md border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md disabled:cursor-not-allowed disabled:bg-gray-50 disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:border-gray-300 dark:bg-neutral-900 dark:disabled:bg-neutral-900/60 {tool.available
                    ? 'border-gray-200 dark:border-neutral-700'
                    : 'border-dashed border-gray-300 opacity-70 grayscale dark:border-neutral-800'}"
                  on:click={() => openTool(tool)}
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-100 {tool.available ? 'text-primary-800 dark:text-primary-300' : 'text-gray-400 dark:text-gray-500'} dark:bg-neutral-800">
                      <svelte:component this={tool.icon} size={20} />
                    </div>
                    <span class="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium {tool.available ? 'text-gray-600 dark:text-gray-300' : 'text-gray-500 dark:text-gray-500'} dark:bg-neutral-800">
                      {toolBadge(tool)}
                    </span>
                  </div>
                  <h3 class="mt-4 text-base font-semibold {tool.available ? 'text-[#040F2D] dark:text-white' : 'text-gray-500 dark:text-gray-500'}">
                    {localizedTool(tool).label}
                  </h3>
                  <p class="mt-2 line-clamp-2 text-sm leading-6 {tool.available ? 'text-gray-600 dark:text-gray-300' : 'text-gray-500 dark:text-gray-500'}">
                    {localizedTool(tool).description}
                  </p>
                  <div class="mt-4 text-sm font-medium {tool.available ? 'text-primary-800 dark:text-primary-300' : 'text-gray-500'}">
                    {tool.available ? ui('enter') : ui('viewPlan')}
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {:else if activeConfig}
    <div class="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <button
          type="button"
          class="mb-3 inline-flex min-h-[38px] items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-200 dark:hover:bg-neutral-800"
          on:click={returnToHub}
        >
          <ArrowLeft size={16} />
          {ui('back')}
        </button>
        <div class="flex items-start gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-white">
            <svelte:component this={activeConfig.icon} size={22} />
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-2xl font-bold text-[#040F2D] dark:text-white md:text-3xl">
                {localizedTool(activeConfig).label}
              </h1>
              <span class="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-neutral-800 dark:text-gray-300">
                {toolBadge(activeConfig)}
              </span>
            </div>
            <p class="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              {localizedTool(activeConfig).details}
            </p>
          </div>
        </div>
      </div>

      {#if activeConfig.id === 'socratic'}
        <div class="w-full md:w-auto">
          <div class="grid grid-cols-2 rounded-md border border-gray-200 bg-gray-100 p-1 dark:border-neutral-700 dark:bg-neutral-800">
            <button
              type="button"
              class="min-h-[38px] rounded px-3 text-sm font-medium transition {mode === 'guided'
                ? 'bg-white text-primary-800 shadow-sm dark:bg-neutral-950 dark:text-white'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}"
              on:click={() => (mode = 'guided')}
            >
              {ui('guided')}
            </button>
            <button
              type="button"
              class="min-h-[38px] rounded px-3 text-sm font-medium transition {mode === 'direct'
                ? 'bg-white text-primary-800 shadow-sm dark:bg-neutral-950 dark:text-white'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'}"
              on:click={() => (mode = 'direct')}
            >
              {ui('direct')}
            </button>
          </div>
        </div>
      {/if}
    </div>

    <div class="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
      <div class="flex gap-2">
        <WarningAlt size={18} class="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
        <p class="text-sm leading-6 text-amber-900 dark:text-amber-100">
          <span class="font-semibold">{ui('privacyTitle')}{ui('colon')}</span>{ui('privacyBody')}
        </p>
      </div>
    </div>

    {#if !activeConfig.available}
      <div class="rounded-md border border-gray-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <div class="flex gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-gray-200">
            <Settings size={20} />
          </div>
          <div>
            <h2 class="text-base font-semibold text-[#040F2D] dark:text-white">{ui('plannedTitle')}</h2>
            <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              {localizedTool(activeConfig).details}
            </p>
            <button
              type="button"
              class="mt-4 inline-flex min-h-[38px] items-center gap-2 rounded-md bg-primary-800 px-4 text-sm font-medium text-white transition hover:bg-primary-900"
              on:click={returnToHub}
            >
              {ui('chooseOther')}
            </button>
          </div>
        </div>
      </div>
    {:else if activeConfig.id === 'socratic'}
      <div class="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <div class="grid min-h-[580px] grid-rows-[1fr_auto]">
          <div
            bind:this={messagesContainer}
            class="max-h-[calc(100vh-330px)] min-h-[380px] space-y-4 overflow-y-auto bg-gray-50 p-4 dark:bg-black md:p-5"
          >
            {#if messages.length === 0}
              <div class="rounded-md border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-300">
                {ui('welcome')}
              </div>
            {/if}
            {#each messages as message, index (`${message.role}-${index}`)}
              <div class="flex items-start gap-3 {message.role === 'user' ? 'justify-end' : 'justify-start'}">
                {#if message.role === 'assistant'}
                  <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-800 text-white">
                    <span class="text-xs font-bold">AI</span>
                  </div>
                {/if}
                <div
                  class="max-w-[85%] whitespace-pre-wrap break-words rounded-md px-4 py-3 text-sm leading-6 md:max-w-[760px] {message.role === 'user'
                    ? 'bg-primary-800 text-white'
                    : 'border border-gray-200 bg-white text-gray-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-200'}"
                >
                  {message.content}
                </div>
                {#if message.role === 'user'}
                  <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-300 text-white dark:bg-neutral-700">
                    <span class="text-xs font-bold">{ui('me')}</span>
                  </div>
                {/if}
              </div>
            {/each}
            {#if isLoading}
              <div class="flex items-center gap-3">
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-800 text-white">
                  <span class="text-xs font-bold">AI</span>
                </div>
                <div class="rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-300">
                  {ui('thinking')}
                </div>
              </div>
            {/if}
          </div>
          <div class="border-t border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
            {#if errorMessage}
              <p class="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{errorMessage}</p>
            {/if}
            <div class="flex flex-col gap-3 md:flex-row md:items-end">
              <label class="flex-1">
                <span class="sr-only">{ui('inputQuestion')}</span>
                <textarea
                  bind:value={inputValues.message}
                  rows="3"
                  placeholder={ui('inputQuestion')}
                  disabled={isLoading}
                  on:keydown={handleKeydown}
                  class="min-h-[92px] w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none placeholder:text-gray-500 focus:border-primary-700 disabled:cursor-not-allowed disabled:opacity-70 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200 dark:placeholder:text-gray-400"
                ></textarea>
              </label>
              <div class="flex gap-2 md:pb-0.5">
                <button
                  type="button"
                  class="inline-flex min-h-[40px] items-center justify-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-800"
                  disabled={isLoading}
                  on:click={clearSocratic}
                >
                  {ui('clear')}
                </button>
                <button
                  type="button"
                  class="inline-flex min-h-[40px] items-center justify-center rounded-md bg-primary-800 px-4 text-sm font-medium text-white transition hover:bg-primary-900 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!inputValues.message?.trim() || isLoading}
                  on:click={sendSocratic}
                >
                  {ui('send')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div class="xl:col-span-5">
          <div class="rounded-md border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 md:p-5">
            {#if errorMessage}
              <p class="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{errorMessage}</p>
            {/if}
            <div class="space-y-4">
              {#each activeConfig.fields ?? [] as field (field.key)}
                {@const fieldText = localizedField(activeConfig.id, field)}
                <label class="block">
                  <span class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">{fieldText.label}</span>
                  <textarea
                    bind:value={inputValues[field.key]}
                    rows={field.rows}
                    placeholder={fieldText.placeholder}
                    disabled={isLoading}
                    class="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none placeholder:text-gray-500 focus:border-primary-700 disabled:cursor-not-allowed disabled:opacity-70 dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-200 dark:placeholder:text-gray-400"
                  ></textarea>
                </label>
              {/each}
              <div class="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  class="inline-flex min-h-[40px] items-center justify-center rounded-md bg-primary-800 px-4 text-sm font-medium text-white transition hover:bg-primary-900 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isLoading}
                  on:click={submitTool}
                >
                  {isLoading ? ui('generatingButton') : ui('generate')}
                </button>
                <button
                  type="button"
                  class="inline-flex min-h-[40px] items-center justify-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-800"
                  disabled={isLoading}
                  on:click={clearTool}
                >
                  {ui('clear')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="xl:col-span-7">
          <div class="min-h-[420px] rounded-md border border-gray-200 bg-gray-50 p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-950 md:p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <h2 class="text-sm font-semibold text-gray-800 dark:text-white">{ui('result')}</h2>
              {#if resultText}
                <CopyButton text={resultText} copyLabel={ui('copy')} copiedLabel={ui('copied')} />
              {/if}
            </div>

            {#if isLoading}
              <div class="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-300">
                {ui('generating')}
              </div>
            {:else if !resultData}
              <div class="rounded-md border border-dashed border-gray-300 bg-white p-5 text-sm leading-6 text-gray-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-gray-300">
                {ui('noResult')}
              </div>
            {:else}
              {#if isVocabularyResult(resultData)}
                <div class="space-y-3">
                  {#each resultData.items as item, index (index)}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-primary-800 dark:text-primary-300">{item.word}</div>
                      <div class="mt-1 text-sm text-gray-700 dark:text-gray-200"><span class="text-gray-500">{ui('meaning')}{ui('colon')}</span>{item.meaning}</div>
                      <div class="mt-1 text-sm text-gray-700 dark:text-gray-200"><span class="text-gray-500">{ui('example')}{ui('colon')}</span>{item.example}</div>
                      {#if item.synonyms?.length}
                        <div class="mt-1 text-sm text-gray-700 dark:text-gray-200"><span class="text-gray-500">{ui('synonyms')}{ui('colon')}</span>{item.synonyms.join(ui('listSeparator'))}</div>
                      {/if}
                      <div class="mt-2 rounded-md bg-gray-50 p-2 text-sm text-gray-700 dark:bg-neutral-800 dark:text-gray-200">
                        <span class="text-gray-500">{ui('blankQuestion')}{ui('colon')}</span>{item.blankQuestion}
                      </div>
                      <div class="mt-1 text-sm text-gray-500">{ui('answer')}{ui('colon')}{item.answer}</div>
                    </div>
                  {/each}
                </div>
              {/if}

              {#if isWritingCoachResult(resultData)}
                <div class="space-y-4">
                  <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                    <div class="text-sm font-semibold text-gray-800 dark:text-white">{ui('overallFeedback')}</div>
                    <div class="mt-1 text-sm text-gray-700 dark:text-gray-200">{stripMarkdown(resultData.overallFeedback)}</div>
                  </div>
                  {#if resultData.corrections.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">{ui('corrections')}</div>
                      <div class="mt-2 space-y-2">
                        {#each resultData.corrections as correction, index (index)}
                          <div class="text-sm">
                            <div class="text-gray-500">{ui('originalSentence')}{ui('colon')}{correction.originalSentence}</div>
                            <div class="text-red-600 dark:text-red-400">{ui('issue')}{ui('colon')}{correction.issue}</div>
                            <div class="text-green-700 dark:text-green-400">{ui('suggestion')}{ui('colon')}{correction.suggestion}</div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if resultData.vocabularyUpgrades.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">{ui('vocabularyUpgrades')}</div>
                      <div class="mt-2 space-y-2">
                        {#each resultData.vocabularyUpgrades as item, index (index)}
                          <div class="text-sm">
                            <span class="text-gray-600">{item.original}</span>
                            <span class="mx-1 text-gray-400">{ui('arrow')}</span>
                            <span class="font-medium text-primary-800 dark:text-primary-300">{item.upgrade}</span>
                            <span class="text-gray-500">{ui('openParen')}{item.reason}{ui('closeParen')}</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if resultData.sentenceSuggestions.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">{ui('sentenceSuggestions')}</div>
                      <div class="mt-2 space-y-2">
                        {#each resultData.sentenceSuggestions as item, index (index)}
                          <div class="text-sm">
                            <div class="text-gray-500">{ui('originalPattern')}{ui('colon')}{item.originalPattern}</div>
                            <div class="text-primary-800 dark:text-primary-300">{ui('suggestion')}{ui('colon')}{item.suggestedPattern}</div>
                            <div class="text-gray-500">{item.benefit}</div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if resultData.priorities.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">{ui('priorities')}</div>
                      <ol class="mt-1 list-decimal pl-5 text-sm text-gray-700 dark:text-gray-200">
                        {#each resultData.priorities as item, index (index)}
                          <li>{stripMarkdown(item)}</li>
                        {/each}
                      </ol>
                    </div>
                  {/if}
                  <div class="rounded-md border border-primary-200 bg-primary-50 p-3 dark:border-primary-900 dark:bg-primary-900/20">
                    <div class="text-sm font-semibold text-primary-800 dark:text-primary-300">{ui('nextRevisionTask')}</div>
                    <div class="mt-1 text-sm text-gray-700 dark:text-gray-200">{stripMarkdown(resultData.nextRevisionTask)}</div>
                  </div>
                </div>
              {/if}

              {#if isMathErrorCardResult(resultData)}
                <div class="space-y-4">
                  <div class="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
                    <div class="text-sm font-semibold text-red-800 dark:text-red-300">{ui('mistakeSummary')}</div>
                    <div class="mt-1 text-sm text-gray-700 dark:text-gray-200">{stripMarkdown(resultData.mistakeSummary)}</div>
                  </div>
                  <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                    <div class="text-sm font-semibold text-gray-800 dark:text-white">{ui('wrongStep')}</div>
                    <div class="mt-1 text-sm text-gray-700 dark:text-gray-200">{stripMarkdown(resultData.wrongStep)}</div>
                  </div>
                  <div class="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
                    <div class="text-sm font-semibold text-green-800 dark:text-green-300">{ui('correctStep')}</div>
                    <div class="mt-1 text-sm text-gray-700 dark:text-gray-200">{stripMarkdown(resultData.correctStep)}</div>
                  </div>
                  <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                    <div class="text-sm font-semibold text-gray-800 dark:text-white">{ui('concept')}</div>
                    <div class="mt-1 text-sm text-gray-700 dark:text-gray-200">{stripMarkdown(resultData.concept)}</div>
                  </div>
                  <div class="rounded-md border border-primary-200 bg-primary-50 p-3 dark:border-primary-900 dark:bg-primary-900/20">
                    <div class="text-sm font-semibold text-primary-800 dark:text-primary-300">{ui('similarQuestion')}</div>
                    <div class="mt-1 text-sm text-gray-700 dark:text-gray-200">{stripMarkdown(resultData.similarQuestion)}</div>
                    <details class="mt-2">
                      <summary class="cursor-pointer text-sm font-medium text-primary-700 dark:text-primary-400">{ui('showAnswer')}</summary>
                      <div class="mt-1 text-sm text-gray-700 dark:text-gray-200">{stripMarkdown(resultData.similarAnswer)}</div>
                    </details>
                  </div>
                </div>
              {/if}

              {#if isReadingQuestionsResult(resultData)}
                <div class="space-y-4">
                  {#if resultData.multipleChoice.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">{ui('multipleChoice')}</div>
                      <div class="mt-2 space-y-3">
                        {#each resultData.multipleChoice as item, index (index)}
                          <div class="text-sm">
                            <div class="font-medium text-gray-800 dark:text-white">{index + 1}. {item.question}</div>
                            <div class="mt-1 space-y-0.5 pl-3">
                              {#each item.options as option, optionIndex (optionIndex)}
                                <div class="text-gray-700 dark:text-gray-200">{option}</div>
                              {/each}
                            </div>
                            <div class="mt-1 text-xs text-gray-500">{ui('answer')}{ui('colon')}{item.answer}</div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if resultData.openQuestions.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">{ui('openQuestions')}</div>
                      <div class="mt-2 space-y-3">
                        {#each resultData.openQuestions as item, index (index)}
                          <div class="text-sm">
                            <div class="font-medium text-gray-800 dark:text-white">{index + 1}. {item.question}</div>
                            <div class="mt-1 text-gray-500">{ui('suggestedAnswer')}{ui('colon')}{item.suggestedAnswer}</div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if resultData.keywords.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">{ui('keywords')}</div>
                      <div class="mt-1 flex flex-wrap gap-2">
                        {#each resultData.keywords as keyword, index (index)}
                          <span class="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-neutral-800 dark:text-gray-200">{keyword}</span>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}

              {#if isScienceConceptMapResult(resultData)}
                <div class="space-y-4">
                  {#if resultData.nodes.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">{ui('nodes')}</div>
                      <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {#each resultData.nodes as node (node.id)}
                          <div class="rounded-md border border-gray-100 bg-gray-50 p-2 dark:border-neutral-800 dark:bg-neutral-800">
                            <div class="text-sm font-medium text-primary-800 dark:text-primary-300">{node.label}</div>
                            <div class="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{node.definition}</div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if resultData.edges.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">{ui('edges')}</div>
                      <div class="mt-2 space-y-1">
                        {#each resultData.edges as edge, index (index)}
                          <div class="text-sm text-gray-700 dark:text-gray-200">
                            <span class="font-medium">{edge.from}</span>
                            <span class="mx-1 text-gray-400">{ui('arrow')}</span>
                            <span class="font-medium">{edge.to}</span>
                            <span class="text-gray-500">{ui('openParen')}{edge.label}{ui('closeParen')}</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                  {#if resultData.misconceptions.length}
                    <div class="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                      <div class="text-sm font-semibold text-amber-800 dark:text-amber-300">{ui('misconceptions')}</div>
                      <ul class="mt-1 list-disc pl-5 text-sm text-gray-700 dark:text-gray-200">
                        {#each resultData.misconceptions as item, index (index)}
                          <li>{stripMarkdown(item)}</li>
                        {/each}
                      </ul>
                    </div>
                  {/if}
                  {#if resultData.quiz.length}
                    <div class="rounded-md border border-gray-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900">
                      <div class="text-sm font-semibold text-gray-800 dark:text-white">{ui('quiz')}</div>
                      <div class="mt-2 space-y-2">
                        {#each resultData.quiz as item, index (index)}
                          <div class="text-sm">
                            <div class="font-medium text-gray-800 dark:text-white">{index + 1}. {item.question}</div>
                            <details class="mt-1">
                              <summary class="cursor-pointer text-xs font-medium text-primary-700 dark:text-primary-400">{ui('showAnswer')}</summary>
                              <div class="mt-0.5 text-xs text-gray-700 dark:text-gray-200">{item.answer}</div>
                            </details>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    {/if}
  {/if}
</section>
