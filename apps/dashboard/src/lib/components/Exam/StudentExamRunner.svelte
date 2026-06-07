<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import RadioQuestion from '$lib/components/Question/RadioQuestion/index.svelte';
  import CheckboxQuestion from '$lib/components/Question/CheckboxQuestion/index.svelte';
  import TextareaQuestion from '$lib/components/Question/TextareaQuestion/index.svelte';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants.js';
  import Progress from '$lib/components/Progress/index.svelte';
  import { QUESTION_TYPE } from '$lib/components/Question/constants';
  import { t } from '$lib/utils/functions/translations';
  import { snackbar } from '$lib/components/Snackbar/store';
  import WarningIcon from 'carbon-icons-svelte/lib/Warning.svelte';
  import TimerIcon from 'carbon-icons-svelte/lib/Time.svelte';

  export let exam: any;
  export let submission: any;
  export let onSubmit: (answers: Record<string, any>) => void;
  export let isSubmitting = false;
  export let submitFailed = false;

  let answers: Record<string, any> = {};
  let currentQuestionIndex = 0;
  let isReviewing = false;
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let timeRemaining = 0;
  let isExpired = false;
  let hasSubmitted = false;

  // Reset local guard when parent signals a failure so user can retry
  $: if (submitFailed) {
    hasSubmitted = false;
  }

  $: questions = (exam.questions || []).filter((q) => !q.deleted_at);
  $: totalQuestions = questions.length;
  $: currentQuestion = questions[currentQuestionIndex];
  $: progressValue = totalQuestions > 0 ? Math.round((currentQuestionIndex / totalQuestions) * 100) : 0;

  $: answeredCount = Object.keys(answers).filter((k) => {
    const v = answers[k];
    return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
  }).length;

  function startTimer() {
    if (!submission?.expires_at) return;

    const updateTimer = () => {
      const now = Date.now();
      const expiry = new Date(submission.expires_at).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        timeRemaining = 0;
        isExpired = true;
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
        snackbar.error($t('components.exam.runner.time_up'));
        handleSubmitOnce();
        return;
      }

      timeRemaining = diff;
    };

    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
  }

  function handleSubmitOnce() {
    if (hasSubmitted || isSubmitting) return;
    hasSubmitted = true;
    onSubmit(answers);
  }

  function formatTime(ms: number) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function handleQuestionSubmit(name: string, value: any) {
    if (isExpired) return;
    answers = { ...answers, [name]: value };
    // Auto-advance after a short delay so the user sees the Next button animate
    setTimeout(() => {
      if (currentQuestionIndex < totalQuestions - 1) {
        currentQuestionIndex += 1;
      } else {
        isReviewing = true;
      }
    }, 300);
  }

  function goToNext() {
    if (currentQuestionIndex < totalQuestions - 1) {
      currentQuestionIndex += 1;
    } else {
      isReviewing = true;
    }
  }

  function goToPrevious() {
    if (isReviewing) {
      isReviewing = false;
      currentQuestionIndex = totalQuestions - 1;
    } else if (currentQuestionIndex > 0) {
      currentQuestionIndex -= 1;
    }
  }

  function goToQuestion(index: number) {
    isReviewing = false;
    currentQuestionIndex = index;
  }

  function handleFinalSubmit() {
    if (isExpired || isSubmitting) return;
    if (answeredCount < totalQuestions) {
      const confirmed = window.confirm($t('components.exam.runner.unanswered_warning'));
      if (!confirmed) return;
    }
    handleSubmitOnce();
  }

  function getQuestionTypeId(question: any) {
    const id = question.question_type?.id ?? question.question_type_id;
    return id === QUESTION_TYPE.TRUE_FALSE ? QUESTION_TYPE.RADIO : id;
  }

  function getDefaultValue(question: any) {
    const val = answers[question.name];
    if (val === undefined) return '';
    return val;
  }

  function getQuestionProps(question: any, index: number) {
    const activeOptions = (question.options || [])
      .filter((o) => !o.deleted_at)
      .map((o) => ({
        value: o.value,
        label: o.label,
        metadata: o.metadata || {}
      }));

    const isLast = index === totalQuestions - 1;

    return {
      title: question.title,
      index: index + 1,
      name: question.name,
      options: activeOptions,
      metadata: question.metadata || {},
      onSubmit: handleQuestionSubmit,
      onPrevious: goToPrevious,
      defaultValue: getDefaultValue(question),
      disablePreviousButton: index === 0 && !isReviewing,
      isLast,
      disabled: isExpired,
      isPreview: false,
      nextButtonProps: { isDisabled: false, isActive: true },
      hideGrading: true
    };
  }

  onMount(() => {
    startTimer();
  });

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
  });
</script>

<div class="w-full max-w-4xl mx-auto py-6 px-4">
  <!-- Header -->
  <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
    <h2 class="dark:text-white text-xl font-bold">{exam.title}</h2>

    {#if submission?.expires_at}
      <div
        class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium {timeRemaining < 60000
          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
          : 'bg-gray-100 text-gray-800 dark:bg-neutral-700 dark:text-gray-200'}"
      >
        <TimerIcon size={16} class="carbon-icon" />
        <span>{formatTime(timeRemaining)}</span>
      </div>
    {/if}
  </div>

  <!-- Expired overlay -->
  {#if isExpired}
    <div
      class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-4 text-center"
    >
      <p class="text-red-800 dark:text-red-100 font-semibold">
        {$t('components.exam.runner.time_up')}
      </p>
    </div>
  {/if}

  {#if totalQuestions === 0}
    <div class="flex flex-col items-center justify-center py-20">
      <p class="dark:text-white text-lg mb-2">{$t('components.exam.runner.no_questions')}</p>
      <p class="text-sm text-gray-500 dark:text-gray-400">{$t('components.exam.runner.contact_teacher')}</p>
    </div>
  {:else}
    <!-- Progress -->
    <div class="mb-4">
      <Progress value={progressValue} />
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {$t('components.exam.runner.progress')}
        {currentQuestionIndex + 1} / {totalQuestions}
      </p>
    </div>

    <!-- Question nav dots -->
    <div class="flex flex-wrap gap-2 mb-6">
      {#each questions as q, i}
        <button
          class="w-8 h-8 rounded-full text-xs font-medium border transition {i === currentQuestionIndex && !isReviewing
            ? 'bg-primary-700 text-white border-primary-700'
            : answers[q.name] !== undefined && answers[q.name] !== '' && !(Array.isArray(answers[q.name]) && answers[q.name].length === 0)
              ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-100'
              : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-neutral-800 dark:text-gray-300'}"
          on:click={() => goToQuestion(i)}
          disabled={isExpired || isSubmitting}
        >
          {i + 1}
        </button>
      {/each}
      <button
        class="w-auto px-3 h-8 rounded-full text-xs font-medium border transition {isReviewing
          ? 'bg-primary-700 text-white border-primary-700'
          : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-neutral-800 dark:text-gray-300'}"
        on:click={() => (isReviewing = true)}
        disabled={isExpired || isSubmitting}
      >
        {$t('components.exam.runner.review')}
      </button>
    </div>

    <!-- Question or Review -->
    {#if isReviewing}
      <div class="bg-white dark:bg-black border border-gray-200 dark:border-neutral-600 rounded-md p-5">
        <h3 class="dark:text-white text-lg font-bold mb-4">{$t('components.exam.runner.review_title')}</h3>

        <div class="space-y-3">
          {#each questions as q, i}
            <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-neutral-700">
              <div class="flex items-center gap-3">
                <span class="text-sm text-gray-500 dark:text-gray-400 w-6">{i + 1}.</span>
                <span class="dark:text-white text-sm truncate max-w-xs md:max-w-md">{q.title}</span>
              </div>
              <div class="flex items-center gap-3">
                {#if answers[q.name] !== undefined && answers[q.name] !== '' && !(Array.isArray(answers[q.name]) && answers[q.name].length === 0)}
                  <span class="text-xs text-green-600 dark:text-green-400">
                    {$t('components.exam.runner.answered')}
                  </span>
                {:else}
                  <span class="text-xs text-red-600 dark:text-red-400">
                    {$t('components.exam.runner.unanswered')}
                  </span>
                {/if}
                <button
                  class="text-xs text-primary-700 hover:underline"
                  on:click={() => goToQuestion(i)}
                  disabled={isSubmitting}
                >
                  {$t('components.exam.runner.edit')}
                </button>
              </div>
            </div>
          {/each}
        </div>

        {#if answeredCount < totalQuestions}
          <div
            class="flex items-center gap-2 mt-4 text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3"
          >
            <WarningIcon size={18} class="carbon-icon flex-shrink-0" />
            <span class="text-sm">
              {$t('components.exam.runner.unanswered_count', { count: String(totalQuestions - answeredCount) })}
            </span>
          </div>
        {/if}

        {#if submitFailed}
          <div
            class="flex items-center gap-2 mt-4 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3"
          >
            <WarningIcon size={18} class="carbon-icon flex-shrink-0" />
            <span class="text-sm">{$t('components.exam.runner.submit_failed')}</span>
            <button
              class="text-sm font-semibold underline ml-auto"
              on:click={handleFinalSubmit}
              disabled={isSubmitting}
            >
              {$t('components.exam.runner.retry_submit')}
            </button>
          </div>
        {/if}

        <div class="flex items-center justify-between mt-6">
          <PrimaryButton
            variant={VARIANTS.OUTLINED}
            onClick={goToPrevious}
            label={$t('components.exam.runner.back')}
            isDisabled={isExpired || isSubmitting}
          />
          <PrimaryButton
            variant={VARIANTS.CONTAINED}
            onClick={handleFinalSubmit}
            label={$t('components.exam.runner.submit_exam')}
            isDisabled={isExpired || isSubmitting}
            isLoading={isSubmitting}
          />
        </div>
      </div>
    {:else if currentQuestion}
      <div class="bg-white dark:bg-black border border-gray-200 dark:border-neutral-600 rounded-md p-5">
        {#key currentQuestion.id}
          {#if getQuestionTypeId(currentQuestion) === QUESTION_TYPE.RADIO}
            <RadioQuestion {...getQuestionProps(currentQuestion, currentQuestionIndex)} />
          {:else if getQuestionTypeId(currentQuestion) === QUESTION_TYPE.CHECKBOX}
            <CheckboxQuestion {...getQuestionProps(currentQuestion, currentQuestionIndex)} />
          {:else if getQuestionTypeId(currentQuestion) === QUESTION_TYPE.TEXTAREA}
            <TextareaQuestion {...getQuestionProps(currentQuestion, currentQuestionIndex)} />
          {/if}
        {/key}
      </div>
    {/if}
  {/if}
</div>
