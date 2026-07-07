<script lang="ts">
  import { page } from '$app/stores';

  const moduleNames: Record<string, string> = {
    'smart-wrongbook': '智能错题本',
    'ai-daily-practice': 'AI今日推荐练习',
    'learning-summary': '学习数据摘要',
    'growth-radar': '成长雷达',
    'subject-strength': '强弱科目提示',
    'learning-notice': '学习通知',
    'certificate-portfolio': '证书成长档案',
    'low-altitude-path': '低空学习路径'
  };

  $: moduleKey = $page.params.module || '';
  $: moduleTitle = moduleNames[moduleKey] || '待开放模块';
</script>

<svelte:head>
  <title>{moduleTitle}</title>
</svelte:head>

<section class="mx-auto max-w-6xl p-5">
  <div class="mb-6 flex flex-col justify-between gap-4 border-b border-gray-200 pb-5 dark:border-neutral-800 md:flex-row md:items-center">
    <div>
      <p class="mb-2 text-sm font-medium text-primary-700 dark:text-primary-300">学生端 Demo</p>
      <h1 class="text-2xl font-bold text-[#040F2D] dark:text-white md:text-3xl">{moduleTitle}</h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-neutral-300">另一个版本开放，本版本暂未开发。</p>
    </div>
    <span class="w-fit rounded-md bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 dark:bg-neutral-800 dark:text-neutral-200">
      未开放
    </span>
  </div>

  <div class="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
    <div class="rounded-md border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div class="mb-5 flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold text-gray-900 dark:text-white">功能预览框架</p>
          <p class="mt-1 text-xs text-gray-500 dark:text-neutral-400">当前仅展示入口和页面结构。</p>
        </div>
        <div class="h-8 w-24 rounded bg-gray-100 dark:bg-neutral-800" />
      </div>

      <div class="grid gap-3 sm:grid-cols-3">
        <div class="rounded border border-gray-200 p-4 dark:border-neutral-800">
          <p class="text-xs text-gray-500 dark:text-neutral-400">今日任务</p>
          <div class="mt-3 h-7 w-16 rounded bg-gray-100 dark:bg-neutral-800" />
        </div>
        <div class="rounded border border-gray-200 p-4 dark:border-neutral-800">
          <p class="text-xs text-gray-500 dark:text-neutral-400">学习进度</p>
          <div class="mt-3 h-7 w-20 rounded bg-gray-100 dark:bg-neutral-800" />
        </div>
        <div class="rounded border border-gray-200 p-4 dark:border-neutral-800">
          <p class="text-xs text-gray-500 dark:text-neutral-400">AI建议</p>
          <div class="mt-3 h-7 w-14 rounded bg-gray-100 dark:bg-neutral-800" />
        </div>
      </div>

      <div class="mt-5 space-y-3">
        {#each Array(4) as _, index}
          <div class="flex items-center gap-3 rounded border border-gray-200 p-3 dark:border-neutral-800">
            <div class="h-9 w-9 rounded bg-gray-100 dark:bg-neutral-800" />
            <div class="flex-1">
              <div class="h-3 w-2/5 rounded bg-gray-100 dark:bg-neutral-800" />
              <div class="mt-2 h-3 w-3/5 rounded bg-gray-100 dark:bg-neutral-800" />
            </div>
            <span class="text-xs text-gray-400">0{index + 1}</span>
          </div>
        {/each}
      </div>
    </div>

    <aside class="rounded-md border border-gray-200 bg-gray-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <p class="text-sm font-semibold text-gray-900 dark:text-white">开发状态</p>
      <div class="mt-4 rounded border border-dashed border-gray-300 p-4 text-center dark:border-neutral-700">
        <p class="text-base font-medium text-gray-900 dark:text-white">本版本暂未开放</p>
        <p class="mt-2 text-sm text-gray-600 dark:text-neutral-300">后续版本接入真实数据、交互流程和权限控制。</p>
      </div>
    </aside>
  </div>
</section>
