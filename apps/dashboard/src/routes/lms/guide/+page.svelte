<script lang="ts">
  import OpenCC from 'opencc-js';
  import { locale } from '$lib/utils/functions/translations';

  let query = '';
  let activeGroup = '全部';
  const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' });

  const text = (value: string) => ($locale === 'zh-TW' ? toTraditional(value) : value);

  interface GuideFeature {
    name: string;
    path: string;
    group: '开始' | '学习' | '互动' | 'AI';
    summary: string;
    when: string;
    steps: string[];
    example: string;
    faq: string;
  }

  const quickStart = [
    '确认头像和姓名，确保正在使用自己的账号。',
    '进入“我的学习”，打开已经加入的课程。',
    '按章节和课时顺序学习，完成后查看进度。',
    '有练习时先完成练习，再查看结果和反馈。',
    '遇到问题时使用社区、AI 工具或 AI Agent。'
  ];

  const features: GuideFeature[] = [
    {
      name: '首页',
      path: '/lms',
      group: '开始',
      summary: '查看学习入口、课程进度和下一步学习方向。',
      when: '刚登录学生端，想知道今天从哪里开始学习时。',
      steps: ['确认账号信息', '查看最近学习或推荐区域', '进入课程或练习入口'],
      example: '看到“我的梦”课程后，点击课程继续上一次的学习。',
      faq: '如果首页没有课程，先去“探索”或联系老师确认是否已加入课程。'
    },
    {
      name: '我的学习',
      path: '/lms/mylearning',
      group: '学习',
      summary: '查看已加入课程，并从课程章节和课时继续学习。',
      when: '已经加入课程，需要继续上课、看视频或查看资料时。',
      steps: ['进入我的学习', '选择课程', '打开章节和课时', '完成学习并查看进度'],
      example: '打开“数学强化课”，从 Chapter 1 Lesson 1 继续学习。',
      faq: '看不到课程时，确认老师是否已经把你加入课程。'
    },
    {
      name: '练习',
      path: '/lms/exercises',
      group: '学习',
      summary: '完成老师布置或系统展示的练习，提交后查看结果。',
      when: '需要巩固课程知识点，或老师要求完成练习时。',
      steps: ['进入练习列表', '选择练习', '逐题作答', '提交后查看结果和反馈'],
      example: '完成“Week 1 课后练习”，提交后把错题整理到笔记里。',
      faq: '提交前检查是否漏题；如果没有练习，等待老师发布。'
    },
    {
      name: '社区',
      path: '/lms/community',
      group: '互动',
      summary: '搜索问题、发布提问、查看老师或同学的回复。',
      when: '学习中卡住，想提问或查看别人是否问过同样问题时。',
      steps: ['先浏览或搜索已有问题', '发布清楚的问题标题', '补充课程背景', '查看回复并继续追问'],
      example: '发布“二次函数顶点式怎么理解？”并补充题目文字。',
      faq: '问题越具体，老师越容易给出有效回复。'
    },
    {
      name: 'AI工具',
      path: '/lms/ai-tools',
      group: 'AI',
      summary: '用 AI 辅助解释知识点、生成练习思路和整理学习材料。',
      when: '想快速理解一个概念、题目步骤或复习主题时。',
      steps: ['选择学习工具', '输入科目、年级和具体问题', '阅读解释', '继续追问不懂的地方'],
      example: '输入“用简单的话解释二次函数顶点式，并给 3 道练习”。',
      faq: 'AI 用来帮助理解，不建议直接替代自己的作业过程。'
    },
    {
      name: 'AI Agent',
      path: '/lms/agent',
      group: 'AI',
      summary: '像学习伙伴一样连续对话，拆解复杂问题。',
      when: '一个问题需要多轮解释，或你想制定复习计划时。',
      steps: ['说出学习目标', '补充年级和课程主题', '要求一步步解释', '整理成自己的笔记'],
      example: '告诉 Agent“我明天考英语阅读，帮我做 30 分钟复习计划”。',
      faq: '如果解释太难，可以要求“用更简单的话讲”。'
    },
    {
      name: '探索',
      path: '/lms/explore',
      group: '学习',
      summary: '发现机构内可学习或可加入的课程资源。',
      when: '想找新课程，或老师让你加入某门课程时。',
      steps: ['浏览课程卡片', '打开课程详情', '确认课程对象和介绍', '加入或开始学习'],
      example: '找到“无人机基础课程”，查看介绍后加入学习。',
      faq: '如果课程需要授权，联系老师或管理员。'
    }
  ];

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
  <title>{text('学生端使用引导')}</title>
</svelte:head>

<section class="mx-auto max-w-6xl px-4 py-6">
  <div class="border-b border-gray-200 pb-6 dark:border-neutral-800">
    <p class="text-sm font-semibold text-primary-700 dark:text-primary-300">ailaeclass Docs</p>
    <h1 class="mt-2 text-2xl font-bold text-[#040F2D] dark:text-white md:text-3xl">{text('学生端使用引导')}</h1>
    <p class="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-neutral-300">
      {text('按学习任务查找当前已上线功能的使用方式。待开放模块可以点击查看 demo 框架，正式功能会在后续版本开放。')}
    </p>

    <label class="mt-5 block max-w-2xl">
      <span class="sr-only">{text('搜索学生端引导')}</span>
      <input
        bind:value={query}
        type="search"
        placeholder={text('搜索功能、任务或问题，例如：我的学习、练习、提问')}
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
          {text('没有找到匹配内容。换一个关键词试试，例如“课程”“练习”“AI”。')}
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
