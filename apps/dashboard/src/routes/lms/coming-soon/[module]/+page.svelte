<script lang="ts">
  import { page } from '$app/stores';
  import { t } from '$lib/utils/functions/translations';

  const moduleNames: Record<string, string> = {
    'smart-wrongbook': 'lms_navigation.future.smart_wrongbook',
    'ai-daily-practice': 'lms_navigation.future.ai_daily_practice',
    'learning-summary': 'lms_navigation.future.learning_summary',
    'growth-radar': 'lms_navigation.future.growth_radar',
    'subject-strength': 'lms_navigation.future.subject_strength',
    'learning-notice': 'lms_navigation.future.learning_notice',
    'certificate-portfolio': 'lms_navigation.future.certificate_portfolio',
    'low-altitude-path': 'lms_navigation.future.low_altitude_path'
  };

  $: moduleKey = $page.params.module || '';
  $: moduleTitle = $t(moduleNames[moduleKey] || 'coming_soon.module_title');
</script>

<svelte:head>
  <title>{moduleTitle}</title>
</svelte:head>

<section class="mx-auto max-w-6xl p-5">
  <div class="mb-6 flex flex-col justify-between gap-4 border-b border-gray-200 pb-5 dark:border-neutral-800 md:flex-row md:items-center">
    <div>
      <p class="mb-2 text-sm font-medium text-primary-700 dark:text-primary-300">{$t('coming_soon.student_demo')}</p>
      <h1 class="text-2xl font-bold text-[#040F2D] dark:text-white md:text-3xl">{moduleTitle}</h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-neutral-300">{$t('coming_soon.description')}</p>
    </div>
    <span class="w-fit rounded-md bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 dark:bg-neutral-800 dark:text-neutral-200">
      {$t('coming_soon.unavailable')}
    </span>
  </div>

  <div class="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
    <div class="rounded-md border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div class="mb-5 flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold text-gray-900 dark:text-white">{$t('coming_soon.feature_preview_frame')}</p>
          <p class="mt-1 text-xs text-gray-500 dark:text-neutral-400">{$t('coming_soon.feature_preview_note')}</p>
        </div>
        <div class="h-8 w-24 rounded bg-gray-100 dark:bg-neutral-800" />
      </div>

      <div class="grid gap-3 sm:grid-cols-3">
        <div class="rounded border border-gray-200 p-4 dark:border-neutral-800">
          <p class="text-xs text-gray-500 dark:text-neutral-400">{$t('coming_soon.today_tasks')}</p>
          <div class="mt-3 h-7 w-16 rounded bg-gray-100 dark:bg-neutral-800" />
        </div>
        <div class="rounded border border-gray-200 p-4 dark:border-neutral-800">
          <p class="text-xs text-gray-500 dark:text-neutral-400">{$t('coming_soon.learning_progress')}</p>
          <div class="mt-3 h-7 w-20 rounded bg-gray-100 dark:bg-neutral-800" />
        </div>
        <div class="rounded border border-gray-200 p-4 dark:border-neutral-800">
          <p class="text-xs text-gray-500 dark:text-neutral-400">{$t('coming_soon.ai_suggestions')}</p>
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
      <p class="text-sm font-semibold text-gray-900 dark:text-white">{$t('coming_soon.development_status')}</p>
      <div class="mt-4 rounded border border-dashed border-gray-300 p-4 text-center dark:border-neutral-700">
        <p class="text-base font-medium text-gray-900 dark:text-white">{$t('coming_soon.unavailable_in_version')}</p>
        <p class="mt-2 text-sm text-gray-600 dark:text-neutral-300">{$t('coming_soon.student_future_note')}</p>
      </div>
    </aside>
  </div>
</section>
