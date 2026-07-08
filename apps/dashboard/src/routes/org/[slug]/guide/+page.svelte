<script lang="ts">
  import OpenCC from 'opencc-js';
  import { currentOrg, currentOrgPath } from '$lib/utils/store/org';
  import { locale } from '$lib/utils/functions/translations';
  import { ROLE } from '$lib/utils/constants/roles';

  let query = '';
  let activeGroup = '全部';
  const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' });

  const text = (value: string) => ($locale === 'zh-TW' ? toTraditional(value) : value);

  interface GuideFeature {
    name: string;
    path: string;
    group: '开始' | '教学' | '管理' | 'AI';
    summary: string;
    when: string;
    steps: string[];
    example: string;
    faq: string;
  }

  $: isTeacherGuide = $currentOrg.role_id === ROLE.TUTOR;
  $: guideTitle = isTeacherGuide ? '教师端使用引导' : '管理端使用引导';
  $: searchLabel = isTeacherGuide ? '搜索教师端引导' : '搜索管理端引导';
  $: searchPlaceholder = isTeacherGuide
    ? '搜索功能、任务或问题，例如：创建课程、考试、AI'
    : '搜索功能、任务或问题，例如：创建课程、考试、成员';
  $: quickStart = isTeacherGuide
    ? [
        '确认当前机构和教师账号是否正确。',
        '进入课程，维护自己负责的课程、章节、课时和学习资料。',
        '需要测评时创建考试，并关联课程或课时。',
        '用社区沉淀答疑，用 AI 工具生成草稿后人工检查。',
        '如果需要成员、受众或系统设置权限，请联系管理员处理。'
      ]
    : [
        '确认当前机构和账号角色是否正确。',
        '先建立课程，再补充章节、课时和学习资料。',
        '需要测评时创建考试，并关联课程或课时。',
        '用社区沉淀答疑，用 AI 工具生成草稿后人工检查。',
        '管理员再处理成员、受众和系统设置。'
      ];

  $: features = [
    {
      name: '仪表盘',
      path: $currentOrgPath,
      group: '开始',
      summary: '查看机构概览、课程数量、学生数量和近期学习动态。',
      when: isTeacherGuide ? '刚进入教师端、需要确认自己负责的课程状态时。' : '刚进入管理端、需要确认机构状态时。',
      steps: ['查看左上角机构名称', '检查课程和学生统计', '从左侧进入要处理的模块'],
      example: isTeacherGuide ? '进入后先查看自己负责的课程，再进入课程维护内容。' : '发现课程数为 0 时，下一步进入“课程”创建第一门课。',
      faq: '如果数据为空，先确认账号是否在正确机构内。'
    },
    {
      name: '课程',
      path: `${$currentOrgPath}/courses`,
      group: '教学',
      summary: '创建和维护课程、章节、课时、视频、文件和学习材料。',
      when: '准备上线教学内容，或需要修改已有课程时。',
      steps: ['进入课程列表', '点击创建或打开已有课程', '维护课程介绍、章节和课时', '预览后发布给学生'],
      example: '创建“G6 英语阅读 Week 1”，添加 Lesson 1 视频和课后资料。',
      faq: '学生看不到课程时，检查课程是否发布，以及学生是否已加入课程。'
    },
    {
      name: '考试',
      path: `${$currentOrgPath}/exams`,
      group: '教学',
      summary: '创建考试、配置题目、发布测评并查看提交记录。',
      when: '需要周测、单元测、课后检测或正式测评时。',
      steps: ['进入考试列表', '点击创建考试', '填写名称、课程、时间和规则', '添加题目后发布', '查看学生提交和批改状态'],
      example: '创建“G7 数学二次函数周测”，设置 45 分钟并添加 10 道选择题。',
      faq: '考试加载失败时，先确认账号是管理端或教师端账号，并且属于当前机构。'
    },
    {
      name: '社区',
      path: `${$currentOrgPath}/community`,
      group: '教学',
      summary: '发布问题、回复学生、沉淀课程 FAQ 和课堂讨论。',
      when: '学生集中提问、老师需要统一答疑时。',
      steps: ['浏览已有问题', '发布新主题', '进入详情回复', '把高频问题整理回课程资料'],
      example: '发布“二次函数顶点式怎么理解？”并在回复中补充课时链接。',
      faq: '重复问题建议集中回复在同一主题下，避免学生分散查看。'
    },
    {
      name: 'AI工具',
      path: `${$currentOrgPath}/ai-tools`,
      group: 'AI',
      summary: '生成教学提纲、解释文本、练习草稿和课堂辅助材料。',
      when: '需要快速起草教学材料，但仍要老师最终确认时。',
      steps: ['选择合适工具', '写清楚年级、科目、主题和输出格式', '生成内容', '人工检查后使用'],
      example: '输入“给 G7 学生生成二次函数复习提纲，10 分钟课堂使用”。',
      faq: 'AI 内容适合做草稿，正式发布前需要老师检查。'
    },
    {
      name: 'AI Agent',
      path: `${$currentOrgPath}/agent`,
      group: 'AI',
      summary: '用连续对话处理备课、说明文案、答疑和材料整理。',
      when: '任务需要多轮澄清，或一次生成结果还需要继续优化时。',
      steps: ['说明目标', '补充课程和学生背景', '要求改短、改格式或改难度', '整理最终输出'],
      example: '先说“帮我准备明天 20 分钟复习课”，再要求“改成表格版”。',
      faq: '复杂任务拆成几轮问，结果会比一次性长指令更稳定。'
    },
    {
      name: '成员/受众',
      path: `${$currentOrgPath}/audience`,
      group: '管理',
      summary: '查看和维护机构内的学生、教师和相关成员。',
      when: '需要找人、确认角色、处理成员权限或学习对象时。',
      steps: ['进入成员列表', '按姓名或邮箱搜索', '确认角色和状态', '按需要维护信息'],
      example: '搜索学生邮箱，确认是否已加入机构和对应课程。',
      faq: '权限变更会影响用户看到的入口，修改前先确认用户身份。'
    },
    {
      name: '设置',
      path: `${$currentOrgPath}/setup`,
      group: '管理',
      summary: '维护机构展示、站点、LMS 和系统相关配置。',
      when: '需要调整机构名称、展示内容或系统配置时。',
      steps: ['进入设置', '选择要修改的配置区', '保存', '回到前台或学生端检查效果'],
      example: '修改机构展示名称后保存，再刷新首页确认显示正确。',
      faq: '只有管理端账号通常能看到完整设置项。'
    }
  ].filter((feature) => !isTeacherGuide || feature.group !== '管理') satisfies GuideFeature[];

  $: groups = ['全部', ...Array.from(new Set(features.map((feature) => feature.group)))];
  $: normalizedQuery = query.trim().toLowerCase();
  $: filteredFeatures = features.filter((feature) => {
    const matchesGroup = activeGroup === '全部' || feature.group === activeGroup;
    const searchable =
      `${feature.name} ${feature.summary} ${feature.when} ${feature.example} ${text(feature.name)} ${text(feature.summary)} ${text(feature.when)} ${text(feature.example)}`.toLowerCase();
    return matchesGroup && (!normalizedQuery || searchable.includes(normalizedQuery));
  });
</script>

<svelte:head>
  <title>{text(guideTitle)}</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-4 py-6">
  <div class="border-b border-gray-200 pb-6 dark:border-neutral-800">
    <p class="text-sm font-semibold text-primary-700 dark:text-primary-300">ailaeclass Docs</p>
    <h1 class="mt-2 text-2xl font-bold text-[#040F2D] dark:text-white md:text-3xl">{text(guideTitle)}</h1>
    <p class="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-neutral-300">
      {text('按任务查找当前已上线功能的使用方式。待开放模块可以点击查看 demo 框架，正式功能会在后续版本开放。')}
    </p>

    <label class="mt-5 block max-w-2xl">
      <span class="sr-only">{text(searchLabel)}</span>
      <input
        bind:value={query}
        type="search"
        placeholder={text(searchPlaceholder)}
        class="w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary-700 focus:ring-2 focus:ring-primary-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
      />
    </label>
  </div>

  <div class="grid gap-6 py-6 lg:grid-cols-[240px_1fr]">
    <aside class="lg:sticky lg:top-4 lg:self-start">
      <div class="border-b border-gray-200 pb-5 dark:border-neutral-800">
        <p class="text-sm font-semibold text-gray-900 dark:text-white">{text('快速开始')}</p>
        <ol class="mt-3 space-y-2">
          {#each quickStart as item, index}
            <li class="flex gap-2 text-sm leading-6 text-gray-700 dark:text-neutral-300">
              <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-semibold text-gray-700 dark:bg-neutral-800 dark:text-neutral-200">
                {index + 1}
              </span>
              <span>{text(item)}</span>
            </li>
          {/each}
        </ol>
      </div>

      <nav class="mt-5">
        <p class="text-sm font-semibold text-gray-900 dark:text-white">{text('本页内容')}</p>
        <div class="mt-3 flex flex-wrap gap-2 lg:flex-col">
          {#each groups as group}
            <button
              type="button"
              class="rounded-md px-3 py-2 text-left text-sm transition {activeGroup === group
                ? 'bg-primary-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'}"
              on:click={() => (activeGroup = group)}
            >
              {text(group)}
            </button>
          {/each}
        </div>
      </nav>
    </aside>

    <div>
      {#if filteredFeatures.length === 0}
        <div class="rounded-md border border-dashed border-gray-300 p-8 text-sm text-gray-600 dark:border-neutral-700 dark:text-neutral-300">
          {text('没有找到匹配内容。换一个关键词试试，例如“课程”“考试”“AI”。')}
        </div>
      {:else}
        <div class="space-y-5">
          {#each filteredFeatures as feature}
            <article id={feature.name} class="rounded-md border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
              <div class="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <p class="text-xs font-semibold text-primary-700 dark:text-primary-300">{text(feature.group)}</p>
                  <h2 class="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{text(feature.name)}</h2>
                  <p class="mt-2 text-sm leading-6 text-gray-600 dark:text-neutral-300">{text(feature.summary)}</p>
                </div>
                <a
                  href={feature.path}
                  class="w-fit rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 no-underline hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                >
                  {text('打开')}
                </a>
              </div>

              <div class="mt-5 grid gap-5 md:grid-cols-[1fr_1.3fr]">
                <div class="space-y-4 text-sm leading-6 text-gray-700 dark:text-neutral-300">
                  <p><span class="font-semibold text-gray-900 dark:text-white">{text('什么时候用：')}</span>{text(feature.when)}</p>
                  <p><span class="font-semibold text-gray-900 dark:text-white">{text('例子：')}</span>{text(feature.example)}</p>
                  <p><span class="font-semibold text-gray-900 dark:text-white">{text('常见问题：')}</span>{text(feature.faq)}</p>
                </div>

                <div>
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">{text('操作步骤')}</p>
                  <ol class="mt-3 space-y-2">
                    {#each feature.steps as step, index}
                      <li class="flex gap-3 text-sm text-gray-700 dark:text-neutral-300">
                        <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-semibold text-gray-700 dark:bg-neutral-800 dark:text-neutral-200">
                          {index + 1}
                        </span>
                        <span class="pt-0.5">{text(step)}</span>
                      </li>
                    {/each}
                  </ol>
                </div>
              </div>
            </article>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</section>
