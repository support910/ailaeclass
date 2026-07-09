<script lang="ts">
  import { page } from '$app/stores';
  import { currentOrg } from '$lib/utils/store/org';
  import { ROLE } from '$lib/utils/constants/roles';
  import { t } from '$lib/utils/functions/translations';

  const moduleNames: Record<string, string> = {
    'principal-dashboard': 'org_navigation.future.principal_dashboard',
    'class-management': 'org_navigation.future.class_management',
    'grade-analysis': 'org_navigation.future.grade_analysis',
    'attendance-discipline': 'org_navigation.future.attendance_discipline',
    'ai-comments-recommendation': 'org_navigation.future.ai_comments_recommendation',
    'academic-notice': 'org_navigation.future.academic_notice',
    'ai-academic-report': 'org_navigation.future.ai_academic_report',
    'exam-plan': 'org_navigation.future.exam_plan',
    'course-resource-center': 'org_navigation.future.course_resource_center'
  };

  $: moduleKey = $page.params.module || '';
  $: moduleTitle = $t(moduleNames[moduleKey] || 'coming_soon.module_title');
  $: moduleScope =
    $currentOrg.role_id === ROLE.TUTOR
      ? $t('coming_soon.teacher_demo')
      : $t('coming_soon.admin_demo');
</script>

<svelte:head>
  <title>{moduleTitle}</title>
</svelte:head>

<section class="mx-auto max-w-6xl p-5">
  <div class="mb-6 flex flex-col justify-between gap-4 border-b border-gray-200 pb-5 dark:border-neutral-800 md:flex-row md:items-center">
    <div>
      <p class="mb-2 text-sm font-medium text-primary-700 dark:text-primary-300">{moduleScope}</p>
      <h1 class="text-2xl font-bold text-[#040F2D] dark:text-white md:text-3xl">{moduleTitle}</h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-neutral-300">{$t('coming_soon.description')}</p>
    </div>
    <span class="w-fit rounded-md bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 dark:bg-neutral-800 dark:text-neutral-200">
      {$t('coming_soon.unavailable')}
    </span>
  </div>

  <div class="grid gap-4 lg:grid-cols-[1fr_1fr]">
    <div class="rounded-md border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div class="mb-5 flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold text-gray-900 dark:text-white">{$t('coming_soon.dashboard_frame')}</p>
          <p class="mt-1 text-xs text-gray-500 dark:text-neutral-400">{$t('coming_soon.dashboard_note')}</p>
        </div>
        <div class="h-8 w-24 rounded bg-gray-100 dark:bg-neutral-800" />
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded border border-gray-200 p-4 dark:border-neutral-800">
          <p class="text-xs text-gray-500 dark:text-neutral-400">{$t('coming_soon.core_metrics')}</p>
          <div class="mt-3 h-8 w-20 rounded bg-gray-100 dark:bg-neutral-800" />
        </div>
        <div class="rounded border border-gray-200 p-4 dark:border-neutral-800">
          <p class="text-xs text-gray-500 dark:text-neutral-400">{$t('coming_soon.todo_items')}</p>
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
      <p class="text-sm font-semibold text-gray-900 dark:text-white">{$t('coming_soon.business_list_frame')}</p>
      <div class="mt-4 space-y-3">
        {#each Array(5) as _, index}
          <div class="grid grid-cols-[32px_1fr_90px] items-center gap-3 rounded border border-gray-200 p-3 dark:border-neutral-800">
            <div class="h-8 w-8 rounded bg-gray-100 dark:bg-neutral-800" />
            <div>
              <div class="h-3 w-2/5 rounded bg-gray-100 dark:bg-neutral-800" />
              <div class="mt-2 h-3 w-4/5 rounded bg-gray-100 dark:bg-neutral-800" />
            </div>
            <span class="text-right text-xs text-gray-400">{$t('coming_soon.pending_config')} {index + 1}</span>
          </div>
        {/each}
      </div>

      <div class="mt-5 rounded border border-dashed border-gray-300 p-4 text-center dark:border-neutral-700">
        <p class="text-base font-medium text-gray-900 dark:text-white">{$t('coming_soon.unavailable_in_version')}</p>
        <p class="mt-2 text-sm text-gray-600 dark:text-neutral-300">{$t('coming_soon.admin_future_note')}</p>
      </div>
    </div>
  </div>
</section>
