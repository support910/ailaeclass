<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { beforeNavigate, goto } from '$app/navigation';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants.js';
  import Progress from '$lib/components/Progress/index.svelte';
  import QuestionTitle from '$lib/components/Question/QuestionTitle.svelte';
  import { QUESTION_TYPE } from '$lib/components/Question/constants';
  import { snackbar } from '$lib/components/Snackbar/store';
  import { t } from '$lib/utils/functions/translations';
  import TimerIcon from 'carbon-icons-svelte/lib/Time.svelte';

  export let exam: any;
  export let submission: any;
  export let onSubmit: (answers: Record<string, any>) => void;
  export let isSubmitting = false;
  export let submitFailed = false;
  export let isPreview = false;
  export let shuffleOnStart = false;
  export let onSaveProgress: (progress: {
    answers: Record<string, any>;
    feedbackByQuestion: Record<string, any>;
    currentQuestionIndex: number;
    questionOrder?: string[];
    optionOrders?: Record<string, string[]>;
  }) => Promise<{ success: boolean; message?: string }> = async () => ({ success: true });
  export let onExit: () => void = () => {};

  type Feedback = {
    isCorrect: boolean | null;
    correctLabels: string[];
    explanation: string;
  };

  let answers: Record<string, any> = {};
  let feedbackByQuestion: Record<string, Feedback> = {};
  let currentQuestionIndex = 0;
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let timeRemaining = 0;
  let isExpired = false;
  let hasSubmitted = false;
  let hasUnsavedChanges = false;
  let isSavingProgress = false;
  let allowNavigation = false;
  let questionOrder: string[] = [];
  let optionOrders: Record<string, string[]> = {};
  let orderReadyForExamId = '';
  let baseQuestions: any[] = [];
  let questions: any[] = [];

  $: baseQuestions = Array.isArray(exam?.questions)
    ? exam.questions.filter((q: any) => !q.deleted_at)
    : [];
  $: if (exam?.id && baseQuestions.length > 0 && orderReadyForExamId !== exam.id) {
    initializeDisplayOrder();
  }
  $: questions = orderByValues(baseQuestions, questionOrder, getQuestionKey);
  $: totalQuestions = questions.length;
  $: currentQuestion = questions[currentQuestionIndex];
  $: currentName = currentQuestion ? getQuestionKey(currentQuestion) : '';
  $: currentAnswer = currentName ? answers[currentName] : undefined;
  $: currentFeedback = currentName ? feedbackByQuestion[currentName] : undefined;
  $: progressValue = totalQuestions > 0 ? Math.round((currentQuestionIndex / totalQuestions) * 100) : 0;

  $: if (submitFailed) {
    hasSubmitted = false;
  }

  function getQuestionTypeId(question: any) {
    const id = question.question_type?.id ?? question.question_type_id;
    return id === QUESTION_TYPE.TRUE_FALSE ? QUESTION_TYPE.RADIO : id;
  }

  function getActiveOptions(question: any) {
    const active = (question?.options || []).filter((option: any) => !option.deleted_at);
    return orderByValues(
      active,
      optionOrders[question ? getQuestionKey(question) : ''] || [],
      (option: any) => String(option.value)
    );
  }

  function getRawActiveOptions(question: any) {
    return (question?.options || []).filter((option: any) => !option.deleted_at);
  }

  function shuffleArray<T>(items: T[]) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function orderByValues<T>(items: T[], order: string[], getValue: (item: T) => string) {
    if (!order?.length) return items;
    const itemMap = new Map(items.map((item) => [getValue(item), item]));
    const ordered = order.map((value) => itemMap.get(value)).filter(Boolean) as T[];
    const missing = items.filter((item) => !order.includes(getValue(item)));
    return [...ordered, ...missing];
  }

  function getQuestionKey(question: any) {
    return String(question?.name || question?.id || '');
  }

  function initializeDisplayOrder() {
    const keys = baseQuestions.map(getQuestionKey).filter(Boolean);
    questionOrder = shuffleOnStart ? shuffleArray(keys) : keys;
    optionOrders = Object.fromEntries(
      baseQuestions.map((q) => {
        const optionValues = getRawActiveOptions(q).map((o: any) => String(o.value));
        return [getQuestionKey(q), shuffleOnStart ? shuffleArray(optionValues) : optionValues];
      })
    );
    orderReadyForExamId = exam?.id || '';
    currentQuestionIndex = 0;
  }

  function hasCurrentAnswer() {
    if (!currentQuestion) return false;
    const value = currentAnswer;
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== '';
  }

  function setRadioAnswer(value: string) {
    if (!currentQuestion || currentFeedback || isExpired) return;
    answers = { ...answers, [getQuestionKey(currentQuestion)]: value };
    hasUnsavedChanges = true;
  }

  function toggleCheckboxAnswer(value: string) {
    if (!currentQuestion || currentFeedback || isExpired) return;
    const current = Array.isArray(currentAnswer) ? currentAnswer : [];
    const next = current.includes(value)
      ? current.filter((item: string) => item !== value)
      : [...current, value];
    answers = { ...answers, [getQuestionKey(currentQuestion)]: next };
    hasUnsavedChanges = true;
  }

  function setTextAnswer(value: string) {
    if (!currentQuestion || currentFeedback || isExpired) return;
    answers = { ...answers, [getQuestionKey(currentQuestion)]: value };
    hasUnsavedChanges = true;
  }

  function handleTextInput(event: Event) {
    setTextAnswer((event.target as HTMLTextAreaElement).value);
  }

  function arraysEqual(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    const sortedA = [...a].map(String).sort();
    const sortedB = [...b].map(String).sort();
    return sortedA.every((value, index) => value === sortedB[index]);
  }

  function getCorrectOptions(question: any) {
    return getActiveOptions(question).filter((option: any) => option.is_correct === true);
  }

  function getOptionLabel(option: any) {
    return option.label || option.value || '';
  }

  function submitCurrentAnswer() {
    if (!currentQuestion || currentFeedback || isExpired) return;

    if (!hasCurrentAnswer()) {
      snackbar.error($t('components.exam.quick.answer_required'));
      return;
    }

    const typeId = getQuestionTypeId(currentQuestion);
    const correctOptions = getCorrectOptions(currentQuestion);
    const correctValues = correctOptions.map((option: any) => String(option.value));
    let isCorrect: boolean | null = null;

    if (typeId === QUESTION_TYPE.TEXTAREA) {
      isCorrect = null;
    } else if (typeId === QUESTION_TYPE.CHECKBOX) {
      isCorrect = arraysEqual(Array.isArray(currentAnswer) ? currentAnswer : [], correctValues);
    } else {
      isCorrect = correctValues.length === 1 && String(currentAnswer) === correctValues[0];
    }

    feedbackByQuestion = {
      ...feedbackByQuestion,
      [getQuestionKey(currentQuestion)]: {
        isCorrect,
        correctLabels: correctOptions.map(getOptionLabel),
        explanation: currentQuestion.metadata?.explanation || ''
      }
    };
    hasUnsavedChanges = true;
  }

  function goToNext() {
    if (!currentFeedback) return;
    if (currentQuestionIndex < totalQuestions - 1) {
      currentQuestionIndex += 1;
      hasUnsavedChanges = true;
      return;
    }
    handleFinish();
  }

  function goToPrevious() {
    if (currentQuestionIndex > 0) {
      currentQuestionIndex -= 1;
      hasUnsavedChanges = true;
    }
  }

  function handleFinish() {
    if (hasSubmitted || isSubmitting) return;
    hasSubmitted = true;
    allowNavigation = true;
    onSubmit(answers);
  }

  function getProgressPayload() {
    return {
      answers,
      feedbackByQuestion,
      currentQuestionIndex,
      questionOrder,
      optionOrders
    };
  }

  async function saveProgress(showToast = true) {
    if (isPreview || !submission?.id) {
      hasUnsavedChanges = false;
      return true;
    }

    isSavingProgress = true;
    const result = await onSaveProgress(getProgressPayload());
    isSavingProgress = false;

    if (!result.success) {
      snackbar.error(result.message || $t('components.exam.quick.save_failed'));
      return false;
    }

    hasUnsavedChanges = false;
    if (showToast) {
      snackbar.success($t('components.exam.quick.progress_saved'));
    }
    return true;
  }

  function restoreProgress() {
    const saved = submission?.metadata?.quick_practice;
    if (!saved) return;

    answers = saved.answers || {};
    feedbackByQuestion = saved.feedbackByQuestion || {};
    if (Array.isArray(saved.questionOrder) && saved.questionOrder.length > 0) {
      questionOrder = saved.questionOrder;
    } else if (questionOrder.length === 0) {
      questionOrder = baseQuestions.map(getQuestionKey).filter(Boolean);
    }
    if (saved.optionOrders && typeof saved.optionOrders === 'object') {
      optionOrders = saved.optionOrders;
    } else if (Object.keys(optionOrders).length === 0) {
      optionOrders = Object.fromEntries(
        baseQuestions.map((q) => [getQuestionKey(q), getRawActiveOptions(q).map((o: any) => String(o.value))])
      );
    }
    orderReadyForExamId = exam?.id || '';
    const savedIndex = Number(saved.currentQuestionIndex) || 0;
    currentQuestionIndex = Math.max(0, Math.min(savedIndex, Math.max(totalQuestions - 1, 0)));
    hasUnsavedChanges = false;
  }

  async function confirmLeaveWithProgress() {
    if (!hasUnsavedChanges || hasSubmitted || isPreview) return true;

    const saveAndLeave = window.confirm($t('components.exam.quick.save_before_exit'));
    if (saveAndLeave) {
      return await saveProgress(false);
    }

    return window.confirm($t('components.exam.quick.discard_exit_confirm'));
  }

  async function requestExit() {
    const canLeave = await confirmLeaveWithProgress();
    if (!canLeave) return;
    allowNavigation = true;
    onExit();
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

  function startTimer() {
    if (!submission?.expires_at || isPreview) return;

    const updateTimer = () => {
      const diff = new Date(submission.expires_at).getTime() - Date.now();
      if (diff <= 0) {
        timeRemaining = 0;
        isExpired = true;
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = null;
        snackbar.error($t('components.exam.runner.time_up'));
        handleFinish();
        return;
      }
      timeRemaining = diff;
    };

    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
  }

  onMount(() => {
    restoreProgress();
    startTimer();
  });

  beforeNavigate(async (navigation) => {
    if (allowNavigation || !hasUnsavedChanges || hasSubmitted || isPreview) return;
    navigation.cancel();
    const canLeave = await confirmLeaveWithProgress();
    if (!canLeave || !navigation.to?.url) return;

    allowNavigation = true;
    const target = navigation.to.url;
    goto(`${target.pathname}${target.search}${target.hash}`);
  });

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
  });
</script>

<div class="w-full max-w-4xl mx-auto py-6 px-4">
  <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
    <div>
      <h2 class="dark:text-white text-xl font-bold">{exam.title}</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400">{$t('components.exam.mode_quick_practice')}</p>
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      {#if submission?.expires_at && !isPreview}
        <div
          class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium {timeRemaining < 60000
            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
            : 'bg-gray-100 text-gray-800 dark:bg-neutral-700 dark:text-gray-200'}"
        >
          <TimerIcon size={16} class="carbon-icon" />
          <span>{formatTime(timeRemaining)}</span>
        </div>
      {/if}
      <PrimaryButton
        variant={VARIANTS.OUTLINED}
        onClick={() => saveProgress()}
        label={$t('components.exam.quick.save_progress')}
        isDisabled={isSubmitting || isSavingProgress || isPreview}
        isLoading={isSavingProgress}
      />
      <PrimaryButton
        variant={VARIANTS.OUTLINED}
        onClick={requestExit}
        label={$t('components.exam.quick.exit')}
        isDisabled={isSubmitting || isSavingProgress}
      />
    </div>
  </div>

  {#if totalQuestions === 0}
    <div class="flex flex-col items-center justify-center py-20">
      <p class="dark:text-white text-lg mb-2">{$t('components.exam.runner.no_questions')}</p>
      <p class="text-sm text-gray-500 dark:text-gray-400">{$t('components.exam.runner.contact_teacher')}</p>
    </div>
  {:else if currentQuestion}
    <div class="mb-4">
      <Progress value={progressValue} />
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {$t('components.exam.runner.progress')}
        {currentQuestionIndex + 1} / {totalQuestions}
      </p>
    </div>

    <div class="bg-white dark:bg-black border border-gray-200 dark:border-neutral-600 rounded-md p-5">
      <QuestionTitle
        index={currentQuestionIndex + 1}
        title={currentQuestion.title}
        image={currentQuestion.metadata?.image || null}
      />

      <div class="mt-5 space-y-3">
        {#if getQuestionTypeId(currentQuestion) === QUESTION_TYPE.TEXTAREA}
          <textarea
            class="w-full rounded-md border border-gray-300 bg-gray-50 p-3 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            rows="5"
            value={currentAnswer || ''}
            disabled={!!currentFeedback || isExpired}
            on:input={handleTextInput}
            placeholder={$t('components.exam.quick.write_answer')}
          />
        {:else}
          {#each getActiveOptions(currentQuestion) as option}
            <button
              type="button"
              class="w-full rounded-md border p-3 text-left transition {currentFeedback
                ? option.is_correct
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : (Array.isArray(currentAnswer) ? currentAnswer.includes(option.value) : currentAnswer === option.value)
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                    : 'border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-900'
                : (Array.isArray(currentAnswer) ? currentAnswer.includes(option.value) : currentAnswer === option.value)
                  ? 'border-primary-700 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800'}"
              disabled={!!currentFeedback || isExpired}
              on:click={() =>
                getQuestionTypeId(currentQuestion) === QUESTION_TYPE.CHECKBOX
                  ? toggleCheckboxAnswer(option.value)
                  : setRadioAnswer(option.value)}
            >
              <div class="flex items-start gap-3">
                <span class="mt-1 h-4 w-4 rounded-full border border-gray-400 flex-shrink-0">
                  {#if Array.isArray(currentAnswer) ? currentAnswer.includes(option.value) : currentAnswer === option.value}
                    <span class="block h-2 w-2 rounded-full bg-primary-700 m-[3px]" />
                  {/if}
                </span>
                <span class="min-w-0">
                  {#if option.metadata?.image?.url}
                    <img
                      src={option.metadata.image.url}
                      alt={option.metadata.image.alt || 'Option image'}
                      class="mb-2 max-h-32 rounded-md object-contain"
                    />
                  {/if}
                  <span class="min-w-0 whitespace-pre-wrap break-words text-sm text-gray-900 dark:text-white">{option.label || option.value}</span>
                </span>
              </div>
            </button>
          {/each}
        {/if}
      </div>

      {#if currentFeedback}
        <div
          class="mt-5 rounded-md border p-4 {currentFeedback.isCorrect === true
            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
            : currentFeedback.isCorrect === false
              ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
              : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'}"
        >
          <p class="font-semibold {currentFeedback.isCorrect === true
            ? 'text-green-800 dark:text-green-200'
            : currentFeedback.isCorrect === false
              ? 'text-red-800 dark:text-red-200'
              : 'text-blue-800 dark:text-blue-200'}">
            {currentFeedback.isCorrect === true
              ? $t('components.exam.quick.correct')
              : currentFeedback.isCorrect === false
                ? $t('components.exam.quick.incorrect')
                : $t('components.exam.quick.reference')}
          </p>

          {#if (currentFeedback.correctLabels || []).length > 0}
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-200">
              <strong>{$t('components.exam.quick.correct_answer')}:</strong>
              {(currentFeedback.correctLabels || []).join(', ')}
            </p>
          {/if}

          <div class="mt-3 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
            <strong>{$t('components.exam.quick.explanation')}:</strong>
            {currentFeedback.explanation || $t('components.exam.quick.no_explanation')}
          </div>
        </div>
      {/if}

      {#if submitFailed}
        <div class="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {$t('components.exam.runner.submit_failed')}
        </div>
      {/if}

      <div class="mt-6 flex items-center justify-between">
        <PrimaryButton
          variant={VARIANTS.OUTLINED}
          onClick={goToPrevious}
          label={$t('components.exam.runner.back')}
          isDisabled={currentQuestionIndex === 0 || isSubmitting}
        />
        {#if currentFeedback}
          <PrimaryButton
            variant={VARIANTS.CONTAINED}
            onClick={goToNext}
            label={currentQuestionIndex === totalQuestions - 1
              ? $t('components.exam.quick.finish')
              : $t('course.navItem.lessons.exercises.all_exercises.next')}
            isDisabled={isSubmitting}
            isLoading={isSubmitting}
          />
        {:else}
          <PrimaryButton
            variant={VARIANTS.CONTAINED}
            onClick={submitCurrentAnswer}
            label={$t('components.exam.quick.check_answer')}
            isDisabled={isExpired || isSubmitting}
          />
        {/if}
      </div>
    </div>
  {/if}
</div>
