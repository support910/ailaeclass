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
  export let onRestartShuffled: (() => void) | null = null;
  export let backLabel = '';

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

    // Older single-choice submissions stored the selected option in open_answer.
    if (answerRecord.open_answer) {
      const matchingOption = (question.options || []).find(
        (option: any) => option.value === answerRecord.open_answer
      );
      return matchingOption?.label || answerRecord.open_answer;
    }

    return $t('components.exam.result.no_answer');
  }

  function getCorrectAnswerDisplay(question: any) {
    const correct = (question.options || []).filter((option: any) => option.is_correct === true);
    if (correct.length === 0) return $t('components.exam.result.no_reference_answer');
    return correct.map((option: any) => option.label || option.value).filter(Boolean).join(', ');
  }

  function isSelectedOption(option: any, answerRecord: any) {
    return (
      (Array.isArray(answerRecord?.answers) && answerRecord.answers.includes(option.value)) ||
      answerRecord?.open_answer === option.value
    );
  }

  function hasOptionImages(question: any) {
    return (question.options || []).some((option: any) => option.metadata?.image?.url);
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
          <div
            class="rounded-md border p-4 {answersByQuestionId[q.id]?.is_correct === true
              ? 'border-green-200 bg-green-50/40 dark:border-green-900 dark:bg-green-950/10'
              : answersByQuestionId[q.id]?.is_correct === false
                ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/10'
                : 'border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-900'}"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1">
                <p class="dark:text-white font-medium mb-2">
                  <span class="text-gray-500 dark:text-gray-400 mr-2">{i + 1}.</span>
                  {q.title}
                </p>
                {#if q.metadata?.image?.url}
                  <img
                    src={q.metadata.image.url}
                    alt={q.metadata.image.alt || $t('components.exam.question_image_alt')}
                    class="ml-6 mb-3 max-h-64 max-w-full rounded-md border border-gray-200 object-contain dark:border-neutral-700"
                  />
                {/if}
                <div class="ml-6 space-y-2 text-sm">
                  <div>
                    <span class="text-gray-500 dark:text-gray-400">
                      {$t('components.exam.result.your_answer')}:
                    </span>
                    <span class="dark:text-gray-200">{getAnswerDisplay(q, answersByQuestionId[q.id])}</span>
                  </div>
                  {#if isObjective(q)}
                    <div>
                      <span class="text-gray-500 dark:text-gray-400">
                        {$t('components.exam.result.correct_answer')}:
                      </span>
                      <span class="font-medium text-green-700 dark:text-green-300">
                        {getCorrectAnswerDisplay(q)}
                      </span>
                    </div>

                    {#if hasOptionImages(q)}
                      <div class="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                        {#each q.options || [] as option}
                          <div
                            class="rounded-md border p-2 {option.is_correct
                              ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/20'
                              : isSelectedOption(option, answersByQuestionId[q.id])
                                ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
                                : 'border-gray-200 bg-gray-50 dark:border-neutral-700 dark:bg-neutral-800'}"
                          >
                            {#if option.metadata?.image?.url}
                              <img
                                src={option.metadata.image.url}
                                alt={option.metadata.image.alt || $t('components.exam.option_image_alt')}
                                class="mb-2 max-h-32 max-w-full rounded object-contain"
                              />
                            {/if}
                            <span class="break-words text-xs text-gray-800 dark:text-gray-200">
                              {option.label || option.value}
                            </span>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  {/if}

                  {#if q.metadata?.explanation}
                    <div class="rounded-md bg-gray-50 px-3 py-2 dark:bg-neutral-800">
                      <span class="font-semibold text-gray-700 dark:text-gray-200">
                        {$t('components.exam.result.explanation')}:
                      </span>
                      <span class="whitespace-pre-wrap text-gray-700 dark:text-gray-200">
                        {q.metadata.explanation}
                      </span>
                    </div>
                  {/if}

                  {#if isObjective(q) && answersByQuestionId[q.id]?.is_correct !== null && answersByQuestionId[q.id]?.is_correct !== undefined}
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
              {#if isGraded || answersByQuestionId[q.id]?.point !== undefined}
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

  <div class="flex flex-col sm:flex-row justify-center gap-3">
    {#if onRestartShuffled}
      <PrimaryButton
        variant={VARIANTS.OUTLINED}
        onClick={onRestartShuffled}
        label={$t('components.exam.result.restart_shuffled')}
      />
    {/if}
    <PrimaryButton
      variant={onRestartShuffled ? VARIANTS.CONTAINED : VARIANTS.OUTLINED}
      onClick={onBack}
      label={backLabel || $t('components.exam.result.back')}
    />
  </div>
</div>
