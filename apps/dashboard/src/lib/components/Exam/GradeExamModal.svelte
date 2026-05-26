<script lang="ts">
  import Modal from '$lib/components/Modal/index.svelte';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants';
  import TextArea from '$lib/components/Form/TextArea.svelte';
  import { t } from '$lib/utils/functions/translations';
  import { QUESTION_TYPE } from '$lib/components/Question/constants';
  import CheckmarkFilledIcon from 'carbon-icons-svelte/lib/CheckmarkFilled.svelte';
  import CloseFilledIcon from 'carbon-icons-svelte/lib/CloseFilled.svelte';
  import WarningIcon from 'carbon-icons-svelte/lib/Warning.svelte';

  export let open = false;
  export let onClose = () => {};
  export let examTitle = '';
  export let submission: any = null;
  export let questions: any[] = [];
  export let onSave: (payload: {
    questionGrades: { questionAnswerId: string; point: number; feedback: string }[];
    submissionFeedback: string;
  }) => void = () => {};
  export let isSaving = false;

  let grades: Record<string, { point: number; feedback: string }> = {};
  let submissionFeedback = '';
  let totalScore = 0;
  let maxPoints = 0;

  function initGrades() {
    grades = {};
    maxPoints = 0;
    if (!questions || !submission) return;

    questions.forEach((q) => {
      maxPoints += q.points || 0;
      const answer = q.answer;
      if (answer && answer.id) {
        grades[q.id] = {
          point: typeof answer.point === 'number' ? answer.point : 0,
          feedback: answer.feedback || ''
        };
      }
    });

    submissionFeedback = submission.feedback || '';
  }

  function getAnswerDisplay(question: any) {
    const answer = question.answer;
    if (!answer) return $t('components.exam.result.no_answer');

    const typeId = question.question_type_id;
    if (typeId === QUESTION_TYPE.TEXTAREA) {
      return answer.open_answer || $t('components.exam.result.no_answer');
    }

    if (Array.isArray(answer.answers) && answer.answers.length > 0) {
      const optionMap = (question.options || []).reduce((m, o) => {
        m[o.value] = o.label || o.value;
        return m;
      }, {});
      return answer.answers.map((v) => optionMap[v] || v).join(', ');
    }

    return $t('components.exam.result.no_answer');
  }

  function getCorrectAnswerDisplay(question: any) {
    const correct = (question.correct_options || []).map((o) => o.label || o.value);
    if (correct.length === 0) return '-';
    return correct.join(', ');
  }

  function handlePointChange(questionId: string, value: string, maxPoints: number) {
    const num = parseFloat(value);
    const clamped = isNaN(num) ? 0 : Math.max(0, Math.min(num, maxPoints));
    grades = {
      ...grades,
      [questionId]: {
        ...grades[questionId],
        point: clamped
      }
    };
  }

  function handleFeedbackChange(questionId: string, value: string) {
    grades = {
      ...grades,
      [questionId]: {
        ...grades[questionId],
        feedback: value
      }
    };
  }

  function handleSave() {
    const questionGrades = questions
      .filter((q) => q.answer && q.answer.id && grades[q.id])
      .map((q) => ({
        questionAnswerId: q.answer.id,
        point: grades[q.id].point,
        feedback: grades[q.id].feedback
      }));

    onSave({
      questionGrades,
      submissionFeedback
    });
  }

  $: if (open) {
    initGrades();
  }

  $: totalScore = questions.reduce((sum, q) => {
    const g = grades[q.id];
    return sum + (g ? g.point : 0);
  }, 0);
</script>

<Modal
  bind:open
  {onClose}
  modalHeading="{examTitle} - {$t('components.exam.grading.title')}"
  width="w-11/12 max-w-5xl"
  containerClass="flex flex-col !max-h-[90vh] overflow-hidden"
>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Student info header -->
    {#if submission?.student}
      <div class="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200 dark:border-neutral-600">
        <img
          src={submission.student.avatar_url || '/default-avatar.png'}
          alt=""
          class="w-10 h-10 rounded-full"
        />
        <div>
          <p class="font-semibold dark:text-white">{submission.student.fullname}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">{submission.student.email}</p>
        </div>
        {#if submission.student.assigned_student_id}
          <span class="ml-auto text-sm text-gray-500 dark:text-gray-400">
            #{$submission.student.assigned_student_id}
          </span>
        {/if}
      </div>
    {/if}

    <!-- Questions list -->
    <div class="flex-1 overflow-y-auto pr-2 space-y-4">
      {#each questions as q, i}
        <div class="border border-gray-200 dark:border-neutral-600 rounded-md p-4">
          <div class="flex items-start justify-between gap-3 mb-2">
            <p class="dark:text-white font-medium flex-1">
              <span class="text-gray-500 dark:text-gray-400 mr-2">{i + 1}.</span>
              {q.title}
              <span class="text-xs text-gray-500 dark:text-gray-400 ml-2">
                ({q.points} {$t('components.exam.result.points')})
              </span>
            </p>
            {#if q.answer?.is_correct === true}
              <span class="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs">
                <CheckmarkFilledIcon size={14} />
                {$t('components.exam.result.correct')}
              </span>
            {:else if q.answer?.is_correct === false}
              <span class="flex items-center gap-1 text-red-600 dark:text-red-400 text-xs">
                <CloseFilledIcon size={14} />
                {$t('components.exam.result.incorrect')}
              </span>
            {:else}
              <span class="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 text-xs">
                <WarningIcon size={14} />
                {$t('components.exam.grading.manual_required')}
              </span>
            {/if}
          </div>

          <!-- Student answer -->
          <div class="bg-gray-50 dark:bg-neutral-900 rounded p-3 mb-3 text-sm">
            <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">
              {$t('components.exam.result.your_answer')}:
            </p>
            <p class="dark:text-white">{getAnswerDisplay(q)}</p>
          </div>

          <!-- Correct answer (for objective) -->
          {#if q.question_type_id !== QUESTION_TYPE.TEXTAREA}
            <div class="bg-green-50 dark:bg-green-900/20 rounded p-3 mb-3 text-sm">
              <p class="text-green-700 dark:text-green-300 text-xs mb-1">
                {$t('components.exam.grading.correct_answer')}:
              </p>
              <p class="dark:text-white">{getCorrectAnswerDisplay(q)}</p>
            </div>
          {/if}

          <!-- Auto score -->
          {#if typeof q.answer?.auto_score === 'number'}
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {$t('components.exam.grading.auto_score')}: {q.answer.auto_score}
            </div>
          {/if}

          <!-- Grading inputs -->
          <div class="flex flex-col sm:flex-row gap-3">
            <div class="flex items-center gap-2">
              <label class="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                {$t('components.exam.grading.score')}:
              </label>
              <input
                type="number"
                min="0"
                max={q.points}
                step="0.1"
                value={grades[q.id]?.point ?? 0}
                on:input={(e) => handlePointChange(q.id, e.currentTarget.value, q.points)}
                class="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-neutral-600 rounded dark:bg-neutral-800 dark:text-white"
                disabled={isSaving}
              />
              <span class="text-sm text-gray-500 dark:text-gray-400">/ {q.points}</span>
            </div>
            <div class="flex-1">
              <TextArea
                label={$t('components.exam.grading.question_feedback')}
                value={grades[q.id]?.feedback || ''}
                rows={1}
                onChange={(e) => handleFeedbackChange(q.id, e.currentTarget.value)}
                className="text-sm"
                bgColor="bg-gray-50 dark:bg-neutral-800 dark:text-white"
              />
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Footer: total + feedback + save -->
    <div class="mt-4 pt-4 border-t border-gray-200 dark:border-neutral-600 space-y-4">
      <div class="flex items-center justify-between">
        <div class="text-sm">
          <span class="font-semibold dark:text-white">
            {$t('components.exam.grading.total')}: {totalScore} / {maxPoints}
          </span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <span class="text-gray-500 dark:text-gray-400">
            {$t('components.exam.grading.status')}:
          </span>
          <span class="font-medium dark:text-white">
            {#if submission?.status_id === 3}
              {$t('components.exam.grading.status_graded')}
            {:else}
              {$t('components.exam.grading.status_pending')}
            {/if}
          </span>
        </div>
      </div>

      <TextArea
        label={$t('components.exam.grading.overall_feedback')}
        bind:value={submissionFeedback}
        rows={2}
        onChange={() => {}}
        bgColor="bg-gray-50 dark:bg-neutral-800 dark:text-white"
      />

      <div class="flex justify-end gap-3">
        <PrimaryButton
          variant={VARIANTS.OUTLINED}
          onClick={onClose}
          label={$t('components.exam.result.back')}
          isDisabled={isSaving}
        />
        <PrimaryButton
          variant={VARIANTS.CONTAINED}
          onClick={handleSave}
          label={$t('components.exam.grading.save_grades')}
          isLoading={isSaving}
          isDisabled={isSaving}
        />
      </div>
    </div>
  </div>
</Modal>
