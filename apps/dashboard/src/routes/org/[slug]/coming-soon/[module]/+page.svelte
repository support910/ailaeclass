<script lang="ts">
  import { page } from '$app/stores';
  import { currentOrg } from '$lib/utils/store/org';
  import { ROLE } from '$lib/utils/constants/roles';

  const moduleNames: Record<string, string> = {
    'principal-dashboard': '校长驾驶舱',
    'class-management': '班级管理',
    'grade-analysis': '成绩录入与分析',
    'attendance-discipline': '考勤与纪律',
    'ai-comments-recommendation': 'AI评语/推荐信',
    'academic-notice': '教务通知',
    'ai-academic-report': 'AI教务报告',
    'exam-plan': '考试计划',
    'course-resource-center': '课程资源中心'
  };

  $: moduleKey = $page.params.module || '';
  $: moduleTitle = moduleNames[moduleKey] || '待开放模块';
  $: moduleScope = $currentOrg.role_id === ROLE.TUTOR ? '教师端 Demo' : '管理端 Demo';
</script>

<svelte:head>
  <title>{moduleTitle}</title>
</svelte:head>

<section class="mx-auto max-w-6xl p-5">
  <div class="mb-6 flex flex-col justify-between gap-4 border-b border-gray-200 pb-5 dark:border-neutral-800 md:flex-row md:items-center">
    <div>
      <p class="mb-2 text-sm font-medium text-primary-700 dark:text-primary-300">{moduleScope}</p>
      <h1 class="text-2xl font-bold text-[#040F2D] dark:text-white md:text-3xl">{moduleTitle}</h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-neutral-300">另一个版本开放，本版本暂未开发。</p>
    </div>
    <span class="w-fit rounded-md bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 dark:bg-neutral-800 dark:text-neutral-200">
      未开放
    </span>
  </div>

  <div class="grid gap-4 lg:grid-cols-[1fr_1fr]">
    <div class="rounded-md border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div class="mb-5 flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold text-gray-900 dark:text-white">数据看板框架</p>
          <p class="mt-1 text-xs text-gray-500 dark:text-neutral-400">当前仅展示模块入口，不包含真实业务数据。</p>
        </div>
        <div class="h-8 w-24 rounded bg-gray-100 dark:bg-neutral-800" />
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded border border-gray-200 p-4 dark:border-neutral-800">
          <p class="text-xs text-gray-500 dark:text-neutral-400">核心指标</p>
          <div class="mt-3 h-8 w-20 rounded bg-gray-100 dark:bg-neutral-800" />
        </div>
        <div class="rounded border border-gray-200 p-4 dark:border-neutral-800">
          <p class="text-xs text-gray-500 dark:text-neutral-400">待办事项</p>
          <div class="mt-3 h-8 w-16 rounded bg-gray-100 dark:bg-neutral-800" />
        </div>
      </div>

      <div class="mt-5 h-48 rounded border border-dashed border-gray-300 p-4 dark:border-neutral-700">
        <div class="mb-4 h-3 w-1/3 rounded bg-gray-100 dark:bg-neutral-800" />
        <div class="flex h-32 items-end gap-3">
          <div class="h-1/3 flex-1 rounded-t bg-gray-100 dark:bg-neutral-800" />
          <div class="h-2/3 flex-1 rounded-t bg-gray-100 dark:bg-neutral-800" />
          <div class="h-1/2 flex-1 rounded-t bg-gray-100 dark:bg-neutral-800" />
          <div class="h-4/5 flex-1 rounded-t bg-gray-100 dark:bg-neutral-800" />
          <div class="h-3/5 flex-1 rounded-t bg-gray-100 dark:bg-neutral-800" />
        </div>
      </div>
    </div>

    <div class="rounded-md border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <p class="text-sm font-semibold text-gray-900 dark:text-white">业务列表框架</p>
      <div class="mt-4 space-y-3">
        {#each Array(5) as _, index}
          <div class="grid grid-cols-[32px_1fr_90px] items-center gap-3 rounded border border-gray-200 p-3 dark:border-neutral-800">
            <div class="h-8 w-8 rounded bg-gray-100 dark:bg-neutral-800" />
            <div>
              <div class="h-3 w-2/5 rounded bg-gray-100 dark:bg-neutral-800" />
              <div class="mt-2 h-3 w-4/5 rounded bg-gray-100 dark:bg-neutral-800" />
            </div>
            <span class="text-right text-xs text-gray-400">待配置 {index + 1}</span>
          </div>
        {/each}
      </div>

      <div class="mt-5 rounded border border-dashed border-gray-300 p-4 text-center dark:border-neutral-700">
        <p class="text-base font-medium text-gray-900 dark:text-white">本版本暂未开放</p>
        <p class="mt-2 text-sm text-gray-600 dark:text-neutral-300">后续版本接入真实数据、审批流程和权限控制。</p>
      </div>
    </div>
  </div>
</section>
