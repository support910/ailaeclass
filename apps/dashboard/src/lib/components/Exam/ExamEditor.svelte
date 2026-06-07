<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import ExamSettingsPanel from './ExamSettingsPanel.svelte';
  import ExamQuestionEditor from './ExamQuestionEditor.svelte';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants.js';
  import {
    fetchExamById,
    updateExamSettings,
    upsertExercise,
    publishExam,
    unpublishExam
  } from '$lib/utils/services/courses';
  import { currentOrg, currentOrgPath } from '$lib/utils/store/org';
  import { t } from '$lib/utils/functions/translations';
  import { snackbar } from '$lib/components/Snackbar/store';
  import { ROLE } from '$lib/utils/constants/roles';
  import type { Exercise } from '$lib/utils/types';
  import { QUESTION_TYPE, QUESTION_TYPES } from '$lib/components/Question/constants';
  import ArrowLeftIcon from 'carbon-icons-svelte/lib/ArrowLeft.svelte';
  import SaveIcon from 'carbon-icons-svelte/lib/Save.svelte';
  import LaunchIcon from 'carbon-icons-svelte/lib/Launch.svelte';
  import CircleDashIcon from 'carbon-icons-svelte/lib/CircleDash.svelte';

  export let examId: string;

  let exam: Partial<Exercise> = {};
  let questions: any[] = [];
  let isLoading = true;
  let loadError = false;
  let isSaving = false;
  let isPublishing = false;
  let settingsDirty = false;

  // Defense-in-depth: redirect students away
  $: if ($currentOrg.role_id === ROLE.STUDENT && $currentOrg.id) {
    goto(`${$currentOrgPath}/exams`);
  }

  // Detect TRUE_FALSE on load: RADIO with exactly True/False options
  function detectTrueFalse(loadedQuestions: any[]) {
    return loadedQuestions.map((q) => {
      if (q.question_type?.id === QUESTION_TYPE.RADIO && q.options?.length === 2) {
        const labels = q.options
          .map((o) => (o.label || '').toLowerCase())
          .sort();
        if (labels[0] === 'false' && labels[1] === 'true') {
          return { ...q, question_type: QUESTION_TYPES.find((t) => t.id === QUESTION_TYPE.TRUE_FALSE) };
        }
      }
      return q;
    });
  }

  // Map TRUE_FALSE back to RADIO for DB save
  function mapTrueFalseToRadio(questionsToSave: any[]) {
    return questionsToSave.map((q) => {
      if (q.question_type?.id === QUESTION_TYPE.TRUE_FALSE) {
        return {
          ...q,
          question_type: { ...q.question_type, id: QUESTION_TYPE.RADIO }
        };
      }
      return q;
    });
  }

  function getActiveQuestions(all: any[]) {
    return all.filter((q) => !q.deleted_at);
  }

  function getActiveOptions(question: any) {
    return (question.options || []).filter((o) => !o.deleted_at);
  }

  function hasQuestionContent(question: any) {
    return Boolean((question.title || '').trim() || question.metadata?.image?.url);
  }

  function hasOptionContent(option: any) {
    return Boolean((option.label || '').trim() || option.metadata?.image?.url);
  }

  function validateSettings(): string | null {
    if (exam.attempts_allowed !== undefined && exam.attempts_allowed !== null) {
      const val = Number(exam.attempts_allowed);
      if (isNaN(val) || val < 1) {
        return $t('components.exam.error_attempts_min');
      }
    }

    if (exam.duration_minutes !== undefined && exam.duration_minutes !== null) {
      const val = Number(exam.duration_minutes);
      if (isNaN(val) || val <= 0) {
        return $t('components.exam.error_duration_min');
      }
    }

    if (exam.passing_score !== undefined && exam.passing_score !== null) {
      const val = Number(exam.passing_score);
      if (isNaN(val) || val < 0) {
        return $t('components.exam.error_passing_score_min');
      }
    }

    if (exam.available_from && exam.available_until) {
      const fromDate = new Date(exam.available_from).getTime();
      const untilDate = new Date(exam.available_until).getTime();
      if (untilDate <= fromDate) {
        return $t('components.exam.error_dates');
      }
    }

    return null;
  }

  function validateBeforePublish(allQuestions: any[]): string | null {
    const active = getActiveQuestions(allQuestions);
    if (active.length === 0) {
      return $t('components.exam.error_publish_no_questions');
    }

    for (const q of active) {
      if (!hasQuestionContent(q)) {
        return $t('components.exam.error_publish_empty_title');
      }
    }

    const objectiveTypes = [QUESTION_TYPE.RADIO, QUESTION_TYPE.TRUE_FALSE];
    for (const q of active) {
      const typeId = q.question_type?.id;
      if (typeId === QUESTION_TYPE.CHECKBOX || objectiveTypes.includes(typeId)) {
        const activeOptions = getActiveOptions(q);
        const contentOptions = activeOptions.filter(hasOptionContent);
        if (contentOptions.length < 2) {
          return $t('components.exam.error_publish_not_enough_options').replace('{title}', q.title || $t('components.exam.unnamed_question'));
        }

        const correctCount = activeOptions.filter((o) => o.is_correct).length;
        if (typeId === QUESTION_TYPE.CHECKBOX) {
          if (correctCount < 1) {
            return $t('components.exam.error_publish_no_correct_answer').replace('{title}', q.title || $t('components.exam.unnamed_question'));
          }
        } else {
          // RADIO / TRUE_FALSE: exactly 1 correct answer
          if (correctCount !== 1) {
            return $t('components.exam.error_publish_exactly_one_correct').replace('{title}', q.title || $t('components.exam.unnamed_question'));
          }
        }
      }
    }

    return null;
  }

  async function saveExamDraft() {
    const { error: saveError } = await updateExamSettings(examId, {
      title: exam.title,
      description: exam.description,
      duration_minutes: exam.duration_minutes,
      attempts_allowed: exam.attempts_allowed,
      passing_score: exam.passing_score,
      show_result_policy: exam.show_result_policy,
      available_from: exam.available_from,
      available_until: exam.available_until,
      shuffle_questions: exam.shuffle_questions,
      shuffle_options: exam.shuffle_options
    });

    if (saveError) {
      throw saveError;
    }
    settingsDirty = false;

    const questionnaire = {
      questions: mapTrueFalseToRadio(questions),
      title: exam.title,
      description: exam.description,
      due_by: null,
      is_title_dirty: false,
      is_description_dirty: false,
      is_due_by_dirty: false
    };

    const updatedQuestions = await upsertExercise(questionnaire, examId);
    if (Array.isArray(updatedQuestions)) {
      questions = detectTrueFalse(updatedQuestions);
    } else {
      throw new Error('Failed to save questions');
    }
  }

  async function loadExam() {
    isLoading = true;
    loadError = false;
    const { data, error } = await fetchExamById(examId);
    if (error || !data) {
      console.error('fetchExamById error', error);
      loadError = true;
      isLoading = false;
      return;
    }
    exam = data;
    questions = detectTrueFalse(data.questions || []);
    isLoading = false;
  }

  function handleSettingsChange() {
    settingsDirty = true;
  }

  function handleQuestionsChange(newQuestions: any[]) {
    questions = newQuestions;
  }

  async function handleSave() {
    if (isSaving || isPublishing) return;

    const settingsError = validateSettings();
    if (settingsError) {
      snackbar.error(settingsError);
      return;
    }

    isSaving = true;

    try {
      await saveExamDraft();
      snackbar.success($t('components.exam.save_success'));
    } catch (err) {
      console.error('saveExamDraft error', err);
      snackbar.error($t('components.exam.save_error'));
    }

    isSaving = false;
  }

  async function handlePublish() {
    if (isSaving || isPublishing) return;

    const settingsError = validateSettings();
    if (settingsError) {
      snackbar.error(settingsError);
      return;
    }

    const validationError = validateBeforePublish(questions);
    if (validationError) {
      snackbar.error(validationError);
      return;
    }

    isPublishing = true;

    try {
      await saveExamDraft();
    } catch (err) {
      console.error('save before publish error', err);
      snackbar.error($t('components.exam.save_error'));
      isPublishing = false;
      return;
    }

    const { error } = await publishExam(examId);
    if (error) {
      console.error('publishExam error', error);
      snackbar.error($t('components.exam.publish_error'));
    } else {
      exam.published_at = new Date().toISOString();
      snackbar.success($t('components.exam.publish_success'));
    }
    isPublishing = false;
  }

  async function handleUnpublish() {
    if (isSaving || isPublishing) return;

    isPublishing = true;
    const { error } = await unpublishExam(examId);
    if (error) {
      console.error('unpublishExam error', error);
      snackbar.error($t('components.exam.unpublish_error'));
    } else {
      exam.published_at = null;
      snackbar.success($t('components.exam.unpublish_success'));
    }
    isPublishing = false;
  }

  onMount(() => {
    loadExam();
  });
</script>

{#if isLoading}
  <div class="flex items-center justify-center py-20">
    <p class="dark:text-white">{$t('components.exam.loading')}</p>
  </div>
{:else if loadError}
  <div class="flex flex-col items-center justify-center py-20">
    <p class="dark:text-white text-lg mb-4">{$t('components.exam.load_error')}</p>
    <button
      class="px-4 py-2 rounded-md bg-primary-700 text-white hover:bg-primary-900"
      on:click={() => goto(`${$currentOrgPath}/exams`)}
    >
      {$t('components.exam.back_to_list')}
    </button>
  </div>
{:else}
  <div class="w-full max-w-4xl mx-auto py-6 px-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
      <div class="flex items-center gap-3">
        <button
          class="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-neutral-700"
          on:click={() => goto(`${$currentOrgPath}/exams`)}
        >
          <ArrowLeftIcon size={20} class="carbon-icon dark:text-white" />
        </button>
        <h1 class="dark:text-white text-xl md:text-2xl font-bold">
          {$t('components.exam.edit_title')}
        </h1>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        {#if exam.published_at}
          <PrimaryButton
            variant={VARIANTS.OUTLINED}
            onClick={handleUnpublish}
            isLoading={isPublishing}
            label={$t('components.exam.unpublish')}
          >
            <CircleDashIcon size={18} class="carbon-icon dark:text-white mr-1" />
          </PrimaryButton>
        {:else}
          <PrimaryButton
            variant={VARIANTS.CONTAINED_SUCCESS}
            onClick={handlePublish}
            isLoading={isPublishing}
            label={$t('components.exam.publish')}
          >
            <LaunchIcon size={18} class="carbon-icon text-white mr-1" />
          </PrimaryButton>
        {/if}
        <PrimaryButton
          variant={VARIANTS.CONTAINED}
          onClick={handleSave}
          isLoading={isSaving}
          label={$t('components.exam.save')}
        >
          <SaveIcon size={18} class="carbon-icon text-white mr-1" />
        </PrimaryButton>
      </div>
    </div>

    <!-- Status badge -->
    <div class="mb-4">
      {#if exam.published_at}
        <span
          class="px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
        >
          {$t('components.exam.status_published')}
        </span>
      {:else}
        <span
          class="px-2 py-1 rounded-md text-xs font-medium bg-gray-200 text-gray-800 dark:bg-neutral-700 dark:text-gray-200"
        >
          {$t('components.exam.status_draft')}
        </span>
      {/if}
    </div>

    <!-- Settings -->
    <ExamSettingsPanel bind:exam onChange={handleSettingsChange} />

    <!-- Questions -->
    <div class="bg-white dark:bg-black border border-gray-200 dark:border-neutral-600 rounded-md p-4 mb-6">
      <h3 class="dark:text-white text-lg font-bold mb-4">
        {$t('components.exam.questions_title')}
      </h3>
      <ExamQuestionEditor bind:questions onQuestionsChange={handleQuestionsChange} />
    </div>
  </div>
{/if}
