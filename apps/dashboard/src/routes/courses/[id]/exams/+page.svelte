<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import CourseContainer from '$lib/components/CourseContainer/index.svelte';
  import { PageBody, PageNav } from '$lib/components/Page';
  import Box from '$lib/components/Box/index.svelte';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants.js';
  import { t } from '$lib/utils/functions/translations';
  import { globalStore } from '$lib/utils/store/app';
  import { currentOrg, currentOrgPath } from '$lib/utils/store/org';
  import { deleteExam } from '$lib/utils/services/courses';
  import { snackbar } from '$lib/components/Snackbar/store';
  import { SkeletonPlaceholder } from 'carbon-components-svelte';
  import TaskIcon from 'carbon-icons-svelte/lib/Task.svelte';
  import TimeIcon from 'carbon-icons-svelte/lib/Time.svelte';
  import RepeatIcon from 'carbon-icons-svelte/lib/Repeat.svelte';
  import { getAccessToken } from '$lib/utils/functions/supabase';

  export let data;
  const { courseId } = data;

  interface ExamItem {
    id: string;
    title: string;
    description: string | null;
    lesson_id: string;
    published_at: string | null;
    available_from: string | null;
    available_until: string | null;
    duration_minutes: number | null;
    attempts_allowed: number | null;
    passing_score: number | null;
  }

  let exams: ExamItem[] = [];
  let isLoading = true;
  let hasError = false;
  let errorMessage = '';

  $: canNavigateToOrg = !!$currentOrg.siteName;

  async function loadExams() {
    isLoading = true;
    hasError = false;
    errorMessage = '';
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/courses/${courseId}/exams`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`loadExams HTTP ${res.status}:`, text);
        errorMessage = `${res.status}${text ? ' — ' + text : ''}`;
        hasError = true;
        exams = [];
        isLoading = false;
        return;
      }
      const json = await res.json();
      if (!json.success) {
        console.error('loadExams API error:', json.message || json);
        errorMessage = json.message || '';
        hasError = true;
        exams = [];
      } else {
        exams = json.exams || [];
      }
    } catch (e) {
      console.error('loadExams error', e);
      errorMessage = e instanceof Error ? e.message : String(e);
      hasError = true;
      exams = [];
    } finally {
      isLoading = false;
    }
  }

  function goToExam(examId: string) {
    goto(`/courses/${courseId}/exams/${examId}`);
  }

  function goToEdit(examId: string) {
    if (!canNavigateToOrg) return;
    goto(`${$currentOrgPath}/exams/${examId}/edit`);
  }

  function goToSubmissions(examId: string) {
    if (!canNavigateToOrg) return;
    goto(`${$currentOrgPath}/exams/${examId}/submissions`);
  }

  async function handleDeleteDraft(exam: ExamItem) {
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
      return;
    }

    exams = exams.filter((item) => item.id !== exam.id);
    snackbar.success($t('components.exam.delete_success'));
  }

  onMount(() => {
    loadExams();
  });
</script>

<CourseContainer {courseId}>
  <PageNav title={$t('components.exam.title')} />

  <PageBody width="w-full max-w-6xl md:w-11/12">
    {#if isLoading}
      <div class="space-y-4">
        <SkeletonPlaceholder class="h-32 w-full rounded-md" />
        <SkeletonPlaceholder class="h-32 w-full rounded-md" />
        <SkeletonPlaceholder class="h-32 w-full rounded-md" />
      </div>
    {:else if hasError}
      <div class="flex flex-col items-center justify-center py-20">
        <p class="text-lg dark:text-white mb-2">{$t('components.exam.load_error')}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">
          {$t('components.exam.load_error_desc')}
        </p>
        {#if errorMessage}
          <p class="text-xs text-red-500 dark:text-red-400 mb-6 font-mono">{errorMessage}</p>
        {/if}
        <PrimaryButton
          variant={VARIANTS.CONTAINED}
          onClick={loadExams}
          label={$t('components.exam.retry')}
        />
      </div>
    {:else if exams.length === 0}
      <Box>
        <TaskIcon size={48} class="carbon-icon mb-4 text-gray-400" />
        <h3 class="text-2xl text-gray-500 dark:text-white mb-2">
          {$globalStore.isStudent
            ? $t('components.exam.no_available_exams')
            : $t('components.exam.no_exams')}
        </h3>
        <p class="text-gray-400 dark:text-gray-300">
          {$globalStore.isStudent
            ? $t('components.exam.no_available_exams_desc')
            : $t('components.exam.create_first')}
        </p>
      </Box>
    {:else}
      <div class="grid gap-4">
        {#each exams as exam}
          <div
            class="flex flex-col rounded-md border border-gray-200 bg-white p-5 transition hover:shadow-md dark:border-neutral-600 dark:bg-neutral-800"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 class="text-lg font-bold text-black dark:text-white truncate">
                    {exam.title || $t('components.exam.unnamed_question')}
                  </h3>
                  {#if exam.published_at}
                    <span
                      class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200"
                    >
                      {$t('components.exam.status_published')}
                    </span>
                  {:else}
                    <span
                      class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-neutral-700 dark:text-gray-300"
                    >
                      {$t('components.exam.status_draft')}
                    </span>
                  {/if}
                </div>
                {#if exam.description}
                  <p class="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                    {exam.description}
                  </p>
                {/if}
                <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  {#if exam.duration_minutes}
                    <div class="flex items-center gap-1">
                      <TimeIcon size={16} />
                      <span
                        >{exam.duration_minutes}
                        {$t('components.exam.duration_minutes_suffix')}</span
                      >
                    </div>
                  {/if}
                  {#if exam.attempts_allowed}
                    <div class="flex items-center gap-1">
                      <RepeatIcon size={16} />
                      <span>{exam.attempts_allowed} {$t('components.exam.attempts')}</span>
                    </div>
                  {/if}
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                {#if $globalStore.isStudent === false}
                  <PrimaryButton
                    className="rounded-md text-sm px-3 py-1"
                    variant={VARIANTS.OUTLINED}
                    onClick={() => goToEdit(exam.id)}
                    isDisabled={!canNavigateToOrg}
                    label={$t('components.exam.edit_action')}
                  />
                  <PrimaryButton
                    className="rounded-md text-sm px-3 py-1"
                    variant={VARIANTS.OUTLINED}
                    onClick={() => goToSubmissions(exam.id)}
                    isDisabled={!canNavigateToOrg}
                    label={$t('components.exam.grading.submissions')}
                  />
                  {#if !exam.published_at}
                    <PrimaryButton
                      className="rounded-md text-sm px-3 py-1"
                      variant={VARIANTS.OUTLINED}
                      onClick={() => handleDeleteDraft(exam)}
                      label={$t('components.exam.delete_draft')}
                    />
                  {/if}
                  {#if !canNavigateToOrg}
                    <span class="text-xs text-gray-400 dark:text-gray-500 ml-1" title={$t('components.exam.org_not_ready')}>
                      ?
                    </span>
                  {/if}
                {/if}
                <PrimaryButton
                  className="rounded-md text-sm px-3 py-1"
                  variant={VARIANTS.CONTAINED}
                  onClick={() => goToExam(exam.id)}
                  label={$globalStore.isStudent === true
                    ? $t('components.exam.intro.start_button')
                    : $t('components.exam.preview_action')}
                />
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </PageBody>
</CourseContainer>
