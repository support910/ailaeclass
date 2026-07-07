<script lang="ts">
  const quickStart = [
    '先在“首页”确认当前机构、个人资料和最近学习状态。',
    '进入“我的学习”打开已加入课程，按课程、章节、课时顺序学习。',
    '需要练习时进入“练习”，完成题目后查看结果与反馈。',
    '遇到学习问题，可进入“AI工具”或“AI Agent”生成解释、提纲、练习建议。',
    '需要讨论时进入“社区”，浏览问题或发布学习提问。'
  ];

  const features = [
    {
      name: '首页',
      path: '/lms',
      usage: '查看学习入口、课程进度和机构公告，是学生登录后的起点。',
      steps: ['确认欢迎区和当前机构信息', '查看学习进度', '点击课程入口继续学习']
    },
    {
      name: '我的学习',
      path: '/lms/mylearning',
      usage: '集中查看自己已经加入的课程，并从课程章节继续学习。',
      steps: ['选择课程', '进入课程详情', '打开课时内容', '完成学习后查看进度变化']
    },
    {
      name: '练习',
      path: '/lms/exercises',
      usage: '完成教师或机构配置的练习内容，用于巩固知识点。',
      steps: ['进入练习列表', '选择练习', '按题目作答', '提交后查看结果']
    },
    {
      name: '社区',
      path: '/lms/community',
      usage: '用于学生之间、学生与教师之间的问题交流。',
      steps: ['浏览已有问题', '进入问题详情', '发布新问题', '查看回复']
    },
    {
      name: 'AI工具',
      path: '/lms/ai-tools',
      usage: '使用已上线的 AI 学习工具辅助理解内容、生成提纲和学习材料。',
      steps: ['选择工具', '输入学习主题或问题', '生成内容', '根据结果继续追问或整理']
    },
    {
      name: 'AI Agent',
      path: '/lms/agent',
      usage: '以对话方式获得更连续的学习辅导和问题拆解。',
      steps: ['描述学习目标', '补充课程背景', '根据回复继续追问', '整理成自己的笔记']
    },
    {
      name: '探索',
      path: '/lms/explore',
      usage: '发现机构内可学习或可加入的课程资源。',
      steps: ['浏览课程', '查看课程介绍', '按需要进入或加入课程']
    }
  ];
</script>

<svelte:head>
  <title>学生端使用引导</title>
</svelte:head>

<section class="mx-auto max-w-6xl p-5">
  <div class="mb-6 border-b border-gray-200 pb-5 dark:border-neutral-800">
    <p class="mb-2 text-sm font-medium text-primary-700 dark:text-primary-300">?</p>
    <h1 class="text-2xl font-bold text-[#040F2D] dark:text-white md:text-3xl">学生端使用引导</h1>
    <p class="mt-2 max-w-3xl text-sm text-gray-600 dark:text-neutral-300">
      本页说明当前已经上线的学生端功能。左侧“学生端待开放”的模块可点击查看 demo 框架，但真实功能会在后续版本开放。
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
