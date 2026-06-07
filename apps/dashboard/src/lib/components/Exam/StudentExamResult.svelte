<script lang="ts">
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants.js';
  import { t } from '$lib/utils/functions/translations';
  import { QUESTION_TYPE } from '$lib/components/Question/constants';
  import CheckmarkFilledIcon from 'carbon-icons-svelte/lib/CheckmarkFilled.svelte';
  import CloseFilledIcon from 'carbon-icons-svelte/lib/CloseFilled.svelte';
  import WarningIcon from 'carbon-icons-svelte/lib/Warning.svelte';

  export let exam: any;
  export let submission: any;
  export let onBack: () => void;

  $: questions = (exam.questions || []).filter((q) => !q.deleted_at);
  $: totalPossible = questions.reduce((sum, q) => sum + (parseFloat(q.points) || 0), 0);
  $: totalScore = submission?.total ?? 0;
  $: passingScore = exam?.passing_score ?? 0;
  $: isPassed = totalScore >= passingScore;
  $: isGraded = submission?.status_id === 3;
  $: isSubmitted = submission?.status_id === 1 || isGraded;

  $: answersByQuestionId = (submission?.answers || []).reduce((acc, a) => {
    acc[a.question_id] = a;
    return acc;
  }, {});

  function getQuestionTypeId(question: any) {
    return question.question_type?.id ?? question.question_type_id;
  }

  function getAnswerDisplay(question: any, answerRecord: any) {
    if (!answerRecord) return $t('components.exam.result.no_answer');

    const typeId = getQuestionTypeId(question);
    if (typeId === QUESTION_TYPE.TEXTAREA) {
      return answerRecord.open_answer || $t('components.exam.result.no_answer');
    }

    if (Array.isArray(answerRecord.answers) && answerRecord.answers.length > 0) {
      const optionMap = (question.options || []).reduce((m, o) => {
        m[o.value] = o.label || o.value;
        return m;
      }, {});
      return answerRecord.answers.map((v) => optionMap[v] || v).join(', ');
    }

    return $t('components.exam.result.no_answer');
  }

  function isObjective(question: any) {
    const id = getQuestionTypeId(question);
    return id === QUESTION_TYPE.RADIO || id === QUESTION_TYPE.CHECKBOX;
  }
</script>

<div class="w-full max-w-4xl mx-auto py-8 px-4">
  <!-- Result Summary -->
  <div
    class="rounded-lg p-6 mb-6 text-center {isPassed
      ? 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800'
      : 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800'}"
  >
    {#if isGraded}
      <div class="flex items-center justify-center gap-2 mb-2">
        {#if isPassed}
          <CheckmarkFilledIcon size={28} class="text-green-600 dark:text-green-400" />
          <h2 class="text-2xl font-bold text-green-800 dark:text-green-100">
            {$t('components.exam.result.passed')}
          </h2>
        {:else}
          <CloseFilledIcon size={28} class="text-red-600 dark:text-red-400" />
          <h2 class="text-2xl font-bold text-red-800 dark:text-red-100">
            {$t('components.exam.result.failed')}
          </h2>
        {/if}
      </div>
      <p class="text-lg dark:text-white">
        <strong>{totalScore}</strong> / {totalPossible}
        {$t('components.exam.result.points')}
      </p>
      {#if passingScore > 0}
        <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
          {$t('components.exam.passing_score')}: {passingScore}
        </p>
      {/if}
    {:else if isSubmitted}
      <div class="flex items-center justify-center gap-2 mb-2">
        <WarningIcon size={28} class="text-yellow-600 dark:text-yellow-400" />
        <h2 class="text-2xl font-bold text-yellow-800 dark:text-yellow-100">
          {$t('components.exam.result.pending_grade')}
        </h2>
      </div>
      <p class="text-lg dark:text-white">
        {$t('components.exam.result.submitted_waiting')}
      </p>
    {:else}
      <h2 class="text-2xl font-bold dark:text-white mb-2">{$t('components.exam.result.incomplete')}</h2>
      <p class="text-lg dark:text-white">{$t('components.exam.result.not_submitted')}</p>
    {/if}
  </div>

  <!-- Answers Review -->
  {#if isSubmitted || isGraded}
    <div class="bg-white dark:bg-black border border-gray-200 dark:border-neutral-600 rounded-md p-5 mb-6">
      <h3 class="dark:text-white text-lg font-bold mb-4">{$t('components.exam.result.answers_review')}</h3>

      <div class="space-y-5">
        {#each questions as q, i}
          <div class="border-b border-gray-100 dark:border-neutral-700 pb-4 last:border-0">
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1">
                <p class="dark:text-white font-medium mb-2">
                  <span class="text-gray-500 dark:text-gray-400 mr-2">{i + 1}.</span>
                  {q.title}
                </p>
                <div class="ml-6 space-y-1 text-sm">
                  <div>
                    <span class="text-gray-500 dark:text-gray-400">
                      {$t('components.exam.result.your_answer')}:
                    </span>
                    <span class="dark:text-gray-200">{getAnswerDisplay(q, answersByQuestionId[q.id])}</span>
                  </div>
                  {#if isObjective(q) && isGraded}
                    <div class="flex items-center gap-1 mt-1">
                      {#if answersByQuestionId[q.id]?.is_correct}
                        <CheckmarkFilledIcon size={16} class="text-green-600 dark:text-green-400" />
                        <span class="text-green-600 dark:text-green-400 text-xs">
                          {$t('components.exam.result.correct')} (+{answersByQuestionId[q.id]?.point || 0})
                        </span>
                      {:else if answersByQuestionId[q.id]?.is_correct === false}
                        <CloseFilledIcon size={16} class="text-red-600 dark:text-red-400" />
                        <span class="text-red-600 dark:text-red-400 text-xs">
                          {$t('components.exam.result.incorrect')} (0)
                        </span>
                      {/if}
                    </div>
                  {/if}
                </div>
              </div>
              {#if isGraded}
                <div class="text-right">
                  <span class="text-sm font-semibold dark:text-white">
                    {answersByQuestionId[q.id]?.point ?? 0} / {parseFloat(q.points) || 0}
                  </span>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="flex justify-center">
    <PrimaryButton variant={VARIANTS.OUTLINED} onClick={onBack} label={$t('components.exam.result.back')} />
  </div>
</div>
