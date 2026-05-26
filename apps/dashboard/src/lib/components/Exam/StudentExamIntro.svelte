<script lang="ts">
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants.js';
  import { t } from '$lib/utils/functions/translations';
  import type { Exercise } from '$lib/utils/types';
  import TimeIcon from 'carbon-icons-svelte/lib/Time.svelte';
  import RetryIcon from 'carbon-icons-svelte/lib/RetryFailed.svelte';
  import CheckmarkOutlineIcon from 'carbon-icons-svelte/lib/CheckmarkOutline.svelte';
  import WarningIcon from 'carbon-icons-svelte/lib/Warning.svelte';

  export let exam: Partial<Exercise>;
  export let attemptCount = 0;
  export let attemptsAllowed: number | undefined = undefined;
  export let onStart: () => void;
  export let isStarting = false;

  $: remainingAttempts =
    attemptsAllowed !== undefined && attemptsAllowed !== null
      ? Math.max(0, attemptsAllowed - attemptCount)
      : Infinity;

  $: canStart = remainingAttempts > 0;

  $: now = new Date();
  $: isAvailable =
    (!exam.available_from || new Date(exam.available_from) <= now) &&
    (!exam.available_until || new Date(exam.available_until) > now);

  $: startDisabled = !canStart || !isAvailable || isStarting;
</script>

<div class="w-full max-w-3xl mx-auto py-8 px-4">
  <h1 class="dark:text-white text-2xl md:text-3xl font-bold mb-4">{exam.title}</h1>

  {#if exam.description}
    <div class="prose prose-sm dark:prose-invert mb-6 max-w-none">
      <p class="dark:text-gray-300">{exam.description}</p>
    </div>
  {/if}

  <div class="bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg p-5 mb-6">
    <h3 class="dark:text-white text-lg font-semibold mb-3">
      {$t('components.exam.intro.exam_info')}
    </h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      {#if exam.duration_minutes}
        <div class="flex items-center gap-2 dark:text-gray-300">
          <TimeIcon size={18} class="carbon-icon" />
          <span>
            {$t('components.exam.duration')}: {exam.duration_minutes}
            {$t('components.exam.duration_minutes_suffix')}
          </span>
        </div>
      {/if}
      {#if exam.questions && exam.questions.length > 0}
        <div class="flex items-center gap-2 dark:text-gray-300">
          <CheckmarkOutlineIcon size={18} class="carbon-icon" />
          <span>
            {$t('components.exam.questions_count')}: {exam.questions.length}
          </span>
        </div>
      {/if}
      {#if attemptsAllowed !== undefined && attemptsAllowed !== null}
        <div class="flex items-center gap-2 dark:text-gray-300">
          <RetryIcon size={18} class="carbon-icon" />
          <span>
            {$t('components.exam.attempts')}: {attemptCount} / {attemptsAllowed}
          </span>
        </div>
      {/if}
      {#if exam.passing_score !== undefined && exam.passing_score !== null}
        <div class="flex items-center gap-2 dark:text-gray-300">
          <CheckmarkOutlineIcon size={18} class="carbon-icon" />
          <span>
            {$t('components.exam.passing_score')}: {exam.passing_score}
          </span>
        </div>
      {/if}
    </div>
  </div>

  <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-5 mb-6">
    <h3 class="dark:text-white text-lg font-semibold mb-3">
      {$t('components.exam.intro.rules_title')}
    </h3>
    <ul class="list-disc list-inside space-y-2 text-sm dark:text-gray-300">
      <li>{$t('components.exam.intro.rule_answer_all')}</li>
      {#if exam.duration_minutes}
        <li>{$t('components.exam.intro.rule_timer')}</li>
      {/if}
      {#if attemptsAllowed !== undefined && attemptsAllowed !== null}
        <li>
          {$t('components.exam.intro.rule_attempts').replace('{count}', String(attemptsAllowed))}
        </li>
      {/if}
      <li>{$t('components.exam.intro.rule_submit')}</li>
      <li>{$t('components.exam.intro.rule_cheating')}</li>
    </ul>
  </div>

  {#if !isAvailable}
    <div
      class="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6"
    >
      <WarningIcon size={20} class="carbon-icon flex-shrink-0" />
      <span class="text-sm">
        {#if exam.available_from && new Date(exam.available_from) > now}
          {$t('components.exam.intro.not_yet_available')}
        {:else if exam.available_until && new Date(exam.available_until) <= now}
          {$t('components.exam.intro.no_longer_available')}
        {/if}
      </span>
    </div>
  {:else if !canStart}
    <div
      class="flex items-center gap-2 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6"
    >
      <WarningIcon size={20} class="carbon-icon flex-shrink-0" />
      <span class="text-sm">{$t('components.exam.intro.no_attempts_left')}</span>
    </div>
  {/if}

  <div class="flex justify-end">
    <PrimaryButton
      variant={VARIANTS.CONTAINED}
      onClick={onStart}
      isLoading={isStarting}
      isDisabled={startDisabled}
      label={$t('components.exam.intro.start_button')}
    />
  </div>
</div>
