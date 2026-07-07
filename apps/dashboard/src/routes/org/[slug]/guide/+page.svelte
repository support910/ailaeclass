<script lang="ts">
  import { currentOrgPath } from '$lib/utils/store/org';

  const quickStart = [
    '先在“仪表盘”确认机构状态和当前账号角色。',
    '进入“课程”创建或维护课程，补充章节、课时和学习材料。',
    '需要测评时进入“考试”，创建考试、配置题目并查看提交情况。',
    '通过“成员/受众”管理机构内学生、教师或成员。',
    '用“AI工具”和“AI Agent”辅助生成教学材料、活动方案和答疑内容。'
  ];

  $: features = [
    {
      name: '仪表盘',
      path: $currentOrgPath,
      usage: '查看机构首页、基础数据和进入各管理模块的入口。',
      steps: ['确认当前机构', '查看近期课程与活动', '进入需要处理的模块']
    },
    {
      name: '课程',
      path: `${$currentOrgPath}/courses`,
      usage: '创建、编辑和管理课程，是教学内容上线的核心入口。',
      steps: ['创建课程', '补充课程介绍', '维护章节课时', '发布给学生学习']
    },
    {
      name: '考试',
      path: `${$currentOrgPath}/exams`,
      usage: '创建测评、管理考试内容，并查看学生提交与成绩。',
      steps: ['新建考试', '配置题目和规则', '发布考试', '查看提交结果']
    },
    {
      name: '社区',
      path: `${$currentOrgPath}/community`,
      usage: '沉淀教学问答、公告讨论和学习交流内容。',
      steps: ['浏览问题', '发布主题', '回复学生', '维护讨论秩序']
    },
    {
      name: 'AI工具',
      path: `${$currentOrgPath}/ai-tools`,
      usage: '使用已上线 AI 工具生成教学内容、课堂材料和辅助说明。',
      steps: ['选择工具', '输入课程主题', '生成内容', '人工检查后使用']
    },
    {
      name: 'AI Agent',
      path: `${$currentOrgPath}/agent`,
      usage: '通过连续对话处理更复杂的教学准备、运营说明或答疑任务。',
      steps: ['说明任务背景', '提供课程信息', '持续追问优化', '整理输出结果']
    },
    {
      name: '成员/受众',
      path: `${$currentOrgPath}/audience`,
      usage: '管理机构成员、学习对象和相关用户列表。',
      steps: ['查看成员列表', '搜索用户', '处理成员信息', '按角色维护权限']
    },
    {
      name: '设置',
      path: `${$currentOrgPath}/setup`,
      usage: '维护机构基础配置、站点和系统相关设置。',
      steps: ['检查机构信息', '配置展示内容', '保存设置', '回到前台确认效果']
    }
  ];
</script>

<svelte:head>
  <title>管理端使用引导</title>
</svelte:head>

<section class="mx-auto max-w-6xl p-5">
  <div class="mb-6 border-b border-gray-200 pb-5 dark:border-neutral-800">
    <p class="mb-2 text-sm font-medium text-primary-700 dark:text-primary-300">?</p>
    <h1 class="text-2xl font-bold text-[#040F2D] dark:text-white md:text-3xl">管理端使用引导</h1>
    <p class="mt-2 max-w-3xl text-sm text-gray-600 dark:text-neutral-300">
      本页说明当前已经上线的管理端功能。左侧“管理端待开放”的模块可点击查看 demo 框架，但真实功能会在后续版本开放。
    </p>
  </div>

  <div class="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
    <aside class="rounded-md border border-gray-200 bg-gray-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <p class="text-sm font-semibold text-gray-900 dark:text-white">新手先做这几步</p>
      <ol class="mt-4 space-y-3">
        {#each quickStart as item, index}
          <li class="flex gap-3 text-sm text-gray-700 dark:text-neutral-300">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-white text-xs font-semibold text-gray-700 dark:bg-neutral-800 dark:text-neutral-200">
              {index + 1}
            </span>
            <span>{item}</span>
          </li>
        {/each}
      </ol>
    </aside>

    <div class="space-y-4">
      {#each features as feature}
        <article class="rounded-md border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div class="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{feature.name}</h2>
              <p class="mt-1 text-sm text-gray-600 dark:text-neutral-300">{feature.usage}</p>
            </div>
            <a
              href={feature.path}
              class="w-fit rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 no-underline hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              打开
            </a>
          </div>
          <div class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {#each feature.steps as step, index}
              <div class="rounded border border-gray-200 p-3 dark:border-neutral-800">
                <p class="text-xs font-semibold text-gray-400">步骤 {index + 1}</p>
                <p class="mt-1 text-sm text-gray-700 dark:text-neutral-300">{step}</p>
              </div>
            {/each}
          </div>
        </article>
      {/each}
    </div>
  </div>
</section>
