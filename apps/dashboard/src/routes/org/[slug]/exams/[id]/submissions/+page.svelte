<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants';
  import Box from '$lib/components/Box/index.svelte';
  import GradeExamModal from '$lib/components/Exam/GradeExamModal.svelte';
  import { snackbar } from '$lib/components/Snackbar/store';
  import { t } from '$lib/utils/functions/translations';
  import formatDate from '$lib/utils/functions/formatDate';
  import {
    fetchExamMeta,
    fetchExamSubmissions,
    fetchExamSubmissionDetail,
    gradeExamSubmission
  } from '$lib/utils/services/exams';
  import {
    currentOrg,
    currentOrgPath
  } from '$lib/utils/store/org';
  import { ROLE } from '$lib/utils/constants/roles';
  import { SkeletonPlaceholder } from 'carbon-components-svelte';
  import DownloadIcon from 'carbon-icons-svelte/lib/Download.svelte';
  import EditIcon from 'carbon-icons-svelte/lib/Edit.svelte';
  import ArrowLeftIcon from 'carbon-icons-svelte/lib/ArrowLeft.svelte';
  import Papa from 'papaparse';

  const examId = $page.params.id;

  let isLoading = false;
  let fetchError = false;
  let submissions: any[] = [];
  let examTitle = '';
  let courseId = '';

  let selectedSubmission: any = null;
  let selectedQuestions: any[] = [];
  let showGradeModal = false;
  let isSaving = false;
  let isDownloading = false;

  const statusLabels: Record<number, string> = {
    1: $t('course.navItem.submissions.submission_status.submitted'),
    2: $t('course.navItem.submissions.submission_status.in_progress'),
    3: $t('course.navItem.submissions.submission_status.graded')
  };

  async function loadExamInfo() {
    const { data: result, error } = await fetchExamMeta(examId);

    if (error || !result) {
      fetchError = true;
      snackbar.error($t('components.exam.load_error'));
      return false;
    }

    examTitle = result.title || '';
    courseId = result.course_id || '';
    return true;
  }

  async function loadSubmissions() {
    if (!courseId) return;
    isLoading = true;
    fetchError = false;

    const { data: result, error } = await fetchExamSubmissions(examId, courseId);

    if (error) {
      console.error('fetchExamSubmissions error', error);
      fetchError = true;
      snackbar.error($t('components.exam.grading.load_error'));
    } else {
      submissions = result?.submissions || [];
    }

    isLoading = false;
  }

  async function openGradeModal(submissionId: string) {
    if (!courseId) return;
    const { data: result, error } = await fetchExamSubmissionDetail(examId, submissionId, courseId);

    if (error || !result) {
      snackbar.error($t('components.exam.grading.load_detail_error'));
      return;
    }

    selectedSubmission = result.submission;
    selectedQuestions = result.questions || [];
    showGradeModal = true;
  }

  async function handleSaveGrade(payload: {
    questionGrades: { questionAnswerId: string; point: number; feedback: string }[];
    submissionFeedback: string;
  }) {
    if (!selectedSubmission || !courseId) return;
    isSaving = true;

    const { data: result, error } = await gradeExamSubmission(examId, selectedSubmission.id, {
      courseId,
      questionGrades: payload.questionGrades,
      submissionFeedback: payload.submissionFeedback
    });

    if (error) {
      snackbar.error($t('components.exam.grading.save_error'));
      isSaving = false;
      return;
    }

    snackbar.success($t('components.exam.grading.save_success'));
    showGradeModal = false;
    isSaving = false;

    // Refresh list
    await loadSubmissions();
  }

  function downloadCSV() {
    if (submissions.length === 0) return;
    isDownloading = true;

    const headers = [
      $t('components.exam.grading.student'),
      $t('components.exam.grading.email'),
      $t('components.exam.grading.student_id'),
      $t('components.exam.grading.attempt'),
      $t('components.exam.grading.status'),
      $t('components.exam.grading.started_at'),
      $t('components.exam.grading.submitted_at'),
      $t('components.exam.grading.total'),
      $t('components.exam.grading.late'),
      $t('components.exam.grading.expired')
    ];

    const rows = submissions.map((s) => [
      s.student?.fullname || '-',
      s.student?.email || '-',
      s.student?.assigned_student_id || '-',
      s.attempt_no,
      statusLabels[s.status_id] || '-',
      s.started_at ? formatDate(s.started_at) : '-',
      s.submitted_at ? formatDate(s.submitted_at) : '-',
      s.total ?? '-',
      s.is_late ? $t('components.exam.grading.yes') : $t('components.exam.grading.no'),
      s.is_expired ? $t('components.exam.grading.yes') : $t('components.exam.grading.no')
    ]);

    const csv = Papa.unparse({ fields: headers, data: rows });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${examTitle}-submissions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    isDownloading = false;
  }

  onMount(async () => {
    if ($currentOrg.role_id === ROLE.STUDENT) {
      goto($currentOrgPath);
      return;
    }
    const ok = await loadExamInfo();
    if (ok) await loadSubmissions();
  });
</script>

<svelte:head>
  <title>{examTitle} - {$t('components.exam.grading.submissions')}</title>
</svelte:head>

<GradeExamModal
  bind:open={showGradeModal}
  onClose={() => (showGradeModal = false)}
  {examTitle}
  submission={selectedSubmission}
  questions={selectedQuestions}
  onSave={handleSaveGrade}
  {isSaving}
/>

<section class="w-full max-w-6xl mx-auto">
  <div class="py-10 px-5">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <a
          href="{$currentOrgPath}/exams/{examId}/edit"
          class="text-gray-600 dark:text-gray-300 hover:text-primary-700"
        >
          <ArrowLeftIcon size={20} />
        </a>
        <h1 class="dark:text-white text-2xl md:text-3xl font-bold">
          {examTitle}
        </h1>
      </div>

      <PrimaryButton
        variant={VARIANTS.OUTLINED}
        onClick={downloadCSV}
        isLoading={isDownloading}
        isDisabled={isDownloading || submissions.length === 0}
        label={$t('components.exam.grading.export_csv')}
      >
        <span slot="icon"><DownloadIcon size={16} /></span>
      </PrimaryButton>
    </div>

    {#if isLoading}
      <div class="space-y-3">
        <SkeletonPlaceholder class="h-10 w-full" />
        <SkeletonPlaceholder class="h-10 w-full" />
        <SkeletonPlaceholder class="h-10 w-full" />
        <SkeletonPlaceholder class="h-10 w-full" />
      </div>
    {:else if fetchError}
      <Box>
        <h3 class="dark:text-white text-2xl my-5">{$t('components.exam.grading.load_error')}</h3>
      </Box>
    {:else if submissions.length === 0}
      <Box>
        <h3 class="dark:text-white text-2xl my-5">{$t('components.exam.grading.no_submissions')}</h3>
      </Box>
    {:else}
      <div class="overflow-x-auto rounded-md border border-gray-200 dark:border-neutral-600">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-neutral-800">
            <tr>
              <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">
                {$t('components.exam.grading.student')}
              </th>
              <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">
                {$t('components.exam.grading.attempt')}
              </th>
              <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">
                {$t('components.exam.grading.status')}
              </th>
              <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">
                {$t('components.exam.grading.started_at')}
              </th>
              <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">
                {$t('components.exam.grading.submitted_at')}
              </th>
              <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">
                {$t('components.exam.grading.total')}
              </th>
              <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">
                {$t('components.exam.grading.late')}
              </th>
              <th class="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">
                {$t('components.exam.grading.actions')}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-neutral-700">
            {#each submissions as sub}
              <tr class="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <img
                      src={sub.student?.avatar_url || '/default-avatar.png'}
                      alt=""
                      class="w-8 h-8 rounded-full"
                    />
                    <div>
                      <p class="font-medium dark:text-white">
                        {sub.student?.fullname || '-'}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        {sub.student?.email || '-'}
                        {#if sub.student?.assigned_student_id}
                          <span class="ml-1">#{sub.student.assigned_student_id}</span>
                        {/if}
                      </p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 dark:text-white">{sub.attempt_no}</td>
                <td class="px-4 py-3">
                  <span
                    class="px-2 py-1 rounded-md text-xs font-medium {sub.status_id === 3
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                      : sub.status_id === 1
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'}"
                  >
                    {statusLabels[sub.status_id] || '-'}
                  </span>
                </td>
                <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {sub.started_at ? formatDate(sub.started_at) : '-'}
                </td>
                <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {sub.submitted_at ? formatDate(sub.submitted_at) : '-'}
                </td>
                <td class="px-4 py-3 font-semibold dark:text-white">
                  {sub.total ?? '-'}
                </td>
                <td class="px-4 py-3">
                  {#if sub.is_late}
                    <span class="text-xs text-red-600 dark:text-red-400 font-medium">
                      {$t('components.exam.grading.yes')}
                    </span>
                  {:else}
                    <span class="text-xs text-green-600 dark:text-green-400">
                      {$t('components.exam.grading.no')}
                    </span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    class="inline-flex items-center gap-1 text-primary-700 hover:underline text-sm"
                    on:click={() => openGradeModal(sub.id)}
                  >
                    <EditIcon size={14} />
                    <span>{$t('components.exam.grading.grade')}</span>
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</section>
