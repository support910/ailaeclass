<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import CourseContainer from '$lib/components/CourseContainer/index.svelte';
  import StudentExamIntro from '$lib/components/Exam/StudentExamIntro.svelte';
  import StudentExamRunner from '$lib/components/Exam/StudentExamRunner.svelte';
  import QuickPracticeRunner from '$lib/components/Exam/QuickPracticeRunner.svelte';
  import StudentExamResult from '$lib/components/Exam/StudentExamResult.svelte';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants.js';
  import WarningIcon from 'carbon-icons-svelte/lib/Warning.svelte';
  import { group, course } from '$lib/components/Course/store';
  import { profile } from '$lib/utils/store/user';
  import { currentOrg, currentOrgPath, isOrgTeacher } from '$lib/utils/store/org';
  import { ROLE } from '$lib/utils/constants/roles';
  import { snackbar } from '$lib/components/Snackbar/store';
  import { t } from '$lib/utils/functions/translations';
  import { getGroupMemberId } from '$lib/components/Course/function';
  import {
    fetchStudentExam,
    startExamAttempt,
    submitExamAttempt,
    saveExamProgress
  } from '$lib/utils/services/courses';

  export let data;

  const { courseId, examId } = data;

  let exam: any = null;
  let isLoading = true;
  let loadError = false;
  let loadErrorMessage = '';
  let submission: any = null;
  let attemptCount = 0;
  let isStarting = false;
  let isSubmitting = false;
  let submitFailed = false;
  let view: 'intro' | 'runner' | 'result' | 'hidden_result' = 'intro';
  let isPreview = false;
  let hasGroupLoaded = false;
  let shuffleNextAttempt = false;
  let loadRequestedFor = '';

  $: currentExamKey = `${courseId || ''}:${examId || ''}`;
  $: if (browser && currentExamKey !== ':' && loadRequestedFor !== currentExamKey) {
    loadRequestedFor = currentExamKey;
    loadExam();
  }

  $: groupPeople = Array.isArray($group.people) ? $group.people : [];
  $: groupMemberId = getGroupMemberId(groupPeople, $profile.id);
  $: isEnrolledStudent =
    groupPeople.some((p) => p.profile_id === $profile.id && p.role_id === ROLE.STUDENT);
  $: canAccess = isEnrolledStudent || $isOrgTeacher === true || isPreview;

  // Wait for CourseContainer to finish loading group membership before rendering access-denied
  $: if (groupPeople.length > 0 || $course.id) {
    hasGroupLoaded = true;
  }

  // Fallback: if loadExam finishes but group hasn't resolved yet, still show exam content
  $: if (!isLoading && exam && !hasGroupLoaded) {
    hasGroupLoaded = true;
  }

  function shouldShowResult(examObj: any, sub: any): boolean {
    if (!examObj || !sub) return false;
    const policy = examObj.show_result_policy || 'after_grade';

    if (policy === 'immediately') return true;
    if (policy === 'after_grade') return sub.status_id === 3;
    if (policy === 'after_due_date') {
      const deadline = examObj.available_until || examObj.due_by;
      if (!deadline) return true;
      return new Date(deadline).getTime() <= Date.now();
    }
    if (policy === 'manual') return false;
    return false;
  }

  function getExamMode(examObj: any) {
    return examObj?.settings?.exam_mode === 'quick_practice'
      ? 'quick_practice'
      : 'traditional';
  }

  async function loadExam() {
    isLoading = true;
    loadError = false;
    loadErrorMessage = '';

    try {
      const { data: resp, error } = await fetchStudentExam(examId, courseId);
      if (error || !resp?.success) {
        console.error('fetchStudentExam error', error);
        loadError = true;
        loadErrorMessage = error?.message || resp?.message || 'Failed to load exam';
        return;
      }

      exam = resp.exam;
      attemptCount = resp.attemptCount || 0;
      isPreview = resp.isPreview || false;

      if (resp.attempt) {
        submission = resp.attempt;
      } else {
        submission = null;
      }

      if (resp.view) {
        view = resp.view;
      } else {
        view = 'intro';
      }
    } catch (e) {
      console.error('loadExam unexpected error:', e);
      loadError = true;
      loadErrorMessage = e instanceof Error ? e.message : 'Unexpected error loading exam';
    } finally {
      isLoading = false;
    }
  }

  async function handleStart(options: { shuffle?: boolean } = {}) {
    shuffleNextAttempt = options.shuffle === true;

    if (isPreview) {
      view = 'runner';
      return;
    }

    if (!groupMemberId) {
      snackbar.error($t('components.exam.error_not_enrolled'));
      return;
    }

    // Client-side pre-check; server also enforces
    if (exam.attempts_allowed && attemptCount >= exam.attempts_allowed) {
      snackbar.error($t('components.exam.error_no_attempts'));
      return;
    }

    isStarting = true;
    const { data: newSubmission, error } = await startExamAttempt(examId, courseId);

    if (error || !newSubmission) {
      console.error('startExamAttempt error', error);
      const msg = error?.message || '';
      if (msg.includes('not yet available')) {
        snackbar.error($t('components.exam.intro.not_yet_available'));
      } else if (msg.includes('no longer available')) {
        snackbar.error($t('components.exam.intro.no_longer_available'));
      } else if (msg.includes('No attempts')) {
        snackbar.error($t('components.exam.error_no_attempts'));
      } else {
        snackbar.error($t('components.exam.start_error'));
      }
      shuffleNextAttempt = false;
      isStarting = false;
      return;
    }

    submission = newSubmission;
    attemptCount += 1;
    view = 'runner';
    isStarting = false;

    if (getExamMode(exam) === 'quick_practice') {
      await loadExam();
      return;
    }

    // Re-fetch exam questions if empty (creation race or caching issue)
    if (!exam.questions || exam.questions.length === 0) {
      await loadExam();
    }
  }

  async function handleSubmit(answers: Record<string, any>) {
    if (isPreview) {
      snackbar.success($t('components.exam.preview_submitted'));
      view = 'intro';
      return;
    }

    if (!submission?.id) {
      snackbar.error($t('components.exam.submit_error'));
      isSubmitting = false;
      return;
    }

    isSubmitting = true;
    submitFailed = false;

    const { data: result, error } = await submitExamAttempt(
      examId,
      courseId,
      submission.id,
      answers
    );

    if (error) {
      console.error('submitExamAttempt error', error);
      snackbar.error($t('components.exam.submit_error'));
      submitFailed = true;
      isSubmitting = false;
      return;
    }

    submitFailed = false;

    // Refresh submission data
    await loadExam();
    isSubmitting = false;

    if (result?.statusId === 3) {
      snackbar.success($t('components.exam.submit_success_graded'));
    } else {
      snackbar.success($t('components.exam.submit_success_pending'));
    }
  }

  async function handleSaveProgress(progress: {
    answers: Record<string, any>;
    feedbackByQuestion: Record<string, any>;
    currentQuestionIndex: number;
    questionOrder?: string[];
    optionOrders?: Record<string, string[]>;
  }) {
    if (isPreview) {
      return { success: true };
    }

    if (!submission?.id) {
      return { success: false, message: 'Missing submission' };
    }

    const { data, error } = await saveExamProgress(examId, courseId, submission.id, progress);
    if (error) {
      console.error('saveExamProgress error', error);
      return { success: false, message: error.message };
    }

    submission = { ...submission, metadata: data?.metadata || submission.metadata };
    return { success: true };
  }

  function handleExitExam() {
    goto(`/courses/${courseId}/exams`);
  }

  function handleBackToIntro() {
    view = 'intro';
    submission = null;
    shuffleNextAttempt = false;
  }

  async function handleRetakeFromResult(options: { shuffle?: boolean } = {}) {
    view = 'intro';
    submission = null;
    await handleStart(options);
  }
</script>

<CourseContainer {courseId}>
  {#if isLoading}
    <div class="flex items-center justify-center py-20">
      <p class="dark:text-white">{$t('components.exam.loading')}</p>
    </div>
  {:else if loadError}
    <div class="flex flex-col items-center justify-center py-20">
      <p class="dark:text-white text-lg mb-2">{$t('components.exam.load_error')}</p>
      {#if loadErrorMessage}
        <p class="text-sm text-red-500 dark:text-red-400 mb-4 font-mono max-w-md text-center">
          {loadErrorMessage}
        </p>
      {/if}
      <button
        class="px-4 py-2 rounded-md bg-primary-700 text-white hover:bg-primary-900"
        on:click={() => goto(`/courses/${courseId}/exams`)}
      >
        {$t('components.exam.back_to_course')}
      </button>
    </div>
  {:else if hasGroupLoaded && !canAccess}
    <div class="flex items-center justify-center py-20">
      <p class="dark:text-white">{$t('components.exam.access_denied')}</p>
    </div>
  {:else if exam}
    {#if isPreview}
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 mx-4 mt-4">
        <p class="text-sm text-blue-800 dark:text-blue-200 text-center">
          {$t('components.exam.preview_mode')}
        </p>
      </div>
    {/if}

    {#if view === 'intro'}
      <StudentExamIntro
        {exam}
        {attemptCount}
        attemptsAllowed={exam.attempts_allowed}
        onStart={handleStart}
        onStartShuffled={() => handleStart({ shuffle: true })}
        {isStarting}
        {isPreview}
      />
    {:else if view === 'runner'}
      {#if getExamMode(exam) === 'quick_practice'}
        <QuickPracticeRunner
          {exam}
          {submission}
          onSubmit={handleSubmit}
          {isSubmitting}
          {submitFailed}
          {isPreview}
          shuffleOnStart={shuffleNextAttempt}
          onSaveProgress={handleSaveProgress}
          onExit={handleExitExam}
        />
      {:else}
        <StudentExamRunner
          {exam}
          {submission}
          onSubmit={handleSubmit}
          {isSubmitting}
          {submitFailed}
          shuffleOnStart={shuffleNextAttempt}
        />
      {/if}
    {:else if view === 'result'}
      <StudentExamResult
        {exam}
        {submission}
        onBack={getExamMode(exam) === 'quick_practice' ? handleRetakeFromResult : handleBackToIntro}
        onRestartShuffled={getExamMode(exam) === 'quick_practice' ? () => handleRetakeFromResult({ shuffle: true }) : null}
        backLabel={getExamMode(exam) === 'quick_practice' ? $t('components.exam.intro.restart_button') : ''}
      />
    {:else if view === 'hidden_result'}
      <!-- Submitted but result hidden by policy -->
      <div class="w-full max-w-3xl mx-auto py-20 px-4 text-center">
        <WarningIcon size={48} class="mx-auto mb-4 text-yellow-600 dark:text-yellow-400" />
        <h2 class="dark:text-white text-2xl font-bold mb-2">
          {$t('components.exam.result.submitted_waiting')}
        </h2>
        <p class="dark:text-gray-300">{$t('components.exam.result.result_hidden')}</p>
        <div class="mt-6">
          <PrimaryButton variant={VARIANTS.OUTLINED} onClick={handleBackToIntro} label={$t('components.exam.result.back')} />
        </div>
      </div>
    {/if}
  {:else}
    <!-- Fallback: should never reach here, but prevents blank page -->
    <div class="flex flex-col items-center justify-center py-20">
      <p class="dark:text-white text-lg mb-2">{$t('components.exam.load_error')}</p>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Debug: isLoading={isLoading}, loadError={loadError}, hasGroupLoaded={hasGroupLoaded}, canAccess={canAccess}, exam={exam ? 'yes' : 'no'}
      </p>
      <button
        class="px-4 py-2 rounded-md bg-primary-700 text-white hover:bg-primary-900"
        on:click={() => goto(`/courses/${courseId}/exams`)}
      >
        {$t('components.exam.back_to_course')}
      </button>
    </div>
  {/if}
</CourseContainer>
