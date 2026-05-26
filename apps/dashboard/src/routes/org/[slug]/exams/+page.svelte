<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import NewExamModal from '$lib/components/Exam/NewExamModal.svelte';
  import Box from '$lib/components/Box/index.svelte';
  import CoursesEmptyIcon from '$lib/components/Icons/CoursesEmptyIcon.svelte';
  import { fetchOrgExams, deleteExam } from '$lib/utils/services/courses';
  import {
    currentOrg,
    currentOrgPath,
    createExamModal,
    examsStore,
    isOrgTeacher
  } from '$lib/utils/store/org';
  import { isMobile } from '$lib/utils/store/useMobile';
  import { Add } from 'carbon-icons-svelte';
  import { t } from '$lib/utils/functions/translations';
  import { snackbar } from '$lib/components/Snackbar/store';
  import { calDateDiff } from '$lib/utils/functions/date';
  import { ROLE } from '$lib/utils/constants/roles';
  import type { Exercise } from '$lib/utils/types';

  let isLoading = false;
  let fetchError = false;
  let lastLoadedOrgId = '';
  let loadingOrgId = '';

  // Redirect students away from teacher-side exam management
  // Guard: only redirect when currentOrgPath is resolved and role is student
  $: if ($currentOrgPath && $currentOrg.role_id === ROLE.STUDENT) {
    goto($currentOrgPath);
  }

  async function loadExamsForOrg(orgId: string) {
    if (!orgId) return;
    if (lastLoadedOrgId === orgId || loadingOrgId === orgId) return;

    loadingOrgId = orgId;
    isLoading = true;
    fetchError = false;
    try {
      const { data, error } = await fetchOrgExams(orgId);
      if (error) {
        console.error('fetchOrgExams error', error);
        fetchError = true;
        snackbar.error($t('components.exam.load_error'));
      }
      examsStore.set(data || []);
      lastLoadedOrgId = orgId;
    } catch (err) {
      console.error('loadExams unexpected error:', err);
      fetchError = true;
      snackbar.error($t('components.exam.load_error'));
    } finally {
      isLoading = false;
      loadingOrgId = '';
    }
  }

  onMount(() => {
    if ($currentOrg.id) {
      loadExamsForOrg($currentOrg.id);
    }
  });

  $: if ($currentOrg.id && $currentOrg.id !== lastLoadedOrgId && $currentOrg.id !== loadingOrgId) {
    loadExamsForOrg($currentOrg.id);
  }

  function getStatusLabel(exam: Exercise) {
    if (exam.published_at) {
      return $t('components.exam.status_published');
    }
    return $t('components.exam.status_draft');
  }

  function getStatusClass(exam: Exercise) {
    if (exam.published_at) {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
    }
    return 'bg-gray-200 text-gray-800 dark:bg-neutral-700 dark:text-gray-200';
  }

  async function handleDelete(exam: Exercise) {
    if (!exam?.id) return;
    if (exam.published_at) {
      snackbar.error($t('components.exam.delete_draft_only'));
      return;
    }

    const confirmed = confirm($t('components.exam.delete_draft_confirm'));
    if (!confirmed) return;

    const { error } = await deleteExam(exam.id);
    if (error) {
      console.error('deleteExam error', error);
      snackbar.error($t('components.exam.delete_error'));
    } else {
      snackbar.success($t('components.exam.delete_success'));
      examsStore.update((list) => list.filter((e) => e.id !== exam.id));
    }
  }
</script>

<svelte:head>
  <title>{$t('components.exam.title')}</title>
</svelte:head>

<section class="w-full max-w-6xl mx-auto">
  <div class="py-10 px-5">
    <div class="flex items-center justify-between mb-10">
      <h1 class="dark:text-white text-2xl md:text-3xl font-bold">{$t('components.exam.title')}</h1>
      {#if $isMobile}
        <PrimaryButton isDisabled={!$isOrgTeacher} onClick={() => ($createExamModal.open = true)}>
          <Add size={24} />
        </PrimaryButton>
      {:else}
        <PrimaryButton
          label={$t('components.exam.create_exam')}
          isDisabled={!$isOrgTeacher}
          onClick={() => ($createExamModal.open = true)}
        />
      {/if}
    </div>

    <NewExamModal />

    {#if isLoading}
      <div class="flex items-center justify-center py-20">
        <p class="dark:text-white">{$t('components.exam.loading')}</p>
      </div>
    {:else if fetchError}
      <Box>
        <CoursesEmptyIcon />
        <h3 class="dark:text-white text-2xl my-5">{$t('components.exam.load_error')}</h3>
        <p class="dark:text-white w-1/3 text-center">{$t('components.exam.load_error_desc')}</p>
      </Box>
    {:else if $examsStore.length === 0}
      <Box>
        <CoursesEmptyIcon />
        <h3 class="dark:text-white text-2xl my-5">{$t('components.exam.no_exams')}</h3>
        <p class="dark:text-white w-1/3 text-center">{$t('components.exam.create_first')}</p>
      </Box>
    {:else}
      <div class="space-y-4">
        {#each $examsStore as exam}
          <div
            class="w-full border hover:shadow-xl transition ease-in-out rounded-lg bg-gray-100 dark:bg-neutral-900 mb-4 relative flex flex-col lg:flex-row p-4"
          >
            <div class="flex flex-col justify-between w-full">
              <div class="flex justify-between items-start">
                <div>
                  <h4 class="dark:text-white text-lg font-bold capitalize">
                    <a href="{$currentOrgPath}/exams/{exam.id}/edit">{exam.title}</a>
                  </h4>
                  {#if exam.lesson}
                    <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      {exam.lesson.course?.title || ''} / {exam.lesson.title || ''}
                    </p>
                  {/if}
                </div>
                <span class="px-2 py-1 rounded-md text-xs font-medium {getStatusClass(exam)}">
                  {getStatusLabel(exam)}
                </span>
              </div>

              <div class="flex flex-wrap gap-4 mt-3 text-sm text-gray-700 dark:text-gray-300">
                {#if exam.duration_minutes}
                  <span>{$t('components.exam.duration')}: {exam.duration_minutes} {$t('components.exam.duration_minutes_suffix')}</span>
                {/if}
                {#if exam.attempts_allowed}
                  <span>{$t('components.exam.attempts')}: {exam.attempts_allowed}</span>
                {/if}
                {#if exam.passing_score !== undefined && exam.passing_score !== null}
                  <span>{$t('components.exam.passing_score')}: {exam.passing_score}</span>
                {/if}
                <span>{$t('components.exam.updated')}: {calDateDiff(exam.updated_at || exam.created_at)}</span>
                <a
                  href="{$currentOrgPath}/exams/{exam.id}/submissions"
                  class="text-primary-700 hover:underline font-medium"
                >
                  {$t('components.exam.grading.submissions')}
                </a>
                {#if $isOrgTeacher}
                  {#if !exam.published_at}
                    <button
                      class="text-red-600 hover:underline font-medium"
                      on:click={() => handleDelete(exam)}
                    >
                      {$t('components.exam.delete_draft')}
                    </button>
                  {/if}
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</section>

<style>
  a {
    text-decoration: none;
  }
</style>
