<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import CourseContainer from '$lib/components/CourseContainer/index.svelte';
  import { PageBody, PageNav } from '$lib/components/Page';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants';
  import { getAccessToken } from '$lib/utils/functions/supabase';
  import { snackbar } from '$lib/components/Snackbar/store';
  import { SkeletonPlaceholder } from 'carbon-components-svelte';
  import RoleBasedSecurity from '$lib/components/RoleBasedSecurity/index.svelte';
  import { locale } from '$lib/utils/functions/translations';

  export let data;
  const { courseId } = data;
  type UiLanguage = 'zh-Hant' | 'zh-Hans' | 'en';

  const COPY: Record<UiLanguage, Record<string, string>> = {
    'zh-Hant': {
      pageTitle: '學生日誌',
      pageDescription: '查看學生加入課程與答題記錄',
      exportExcel: '匯出為 Excel',
      course: '課程',
      joinRecords: '加入記錄',
      submissionRecords: '答題記錄',
      name: '姓名',
      email: '電郵',
      studentId: '學號',
      joinedAt: '加入時間',
      student: '學生',
      assessment: '考試/練習',
      type: '類型',
      status: '狀態',
      score: '分數',
      attempts: '次數',
      startedAt: '開始時間',
      submittedAt: '提交時間',
      updatedAt: '更新時間',
      studentCount: '學生人數',
      submissionCount: '答題記錄',
      completedCount: '已完成',
      inProgressCount: '進行中',
      emptyJoins: '暫無學生加入記錄',
      emptySubmissions: '暫無答題記錄',
      loadFailed: '無法載入課程日誌',
      submitted: '已提交',
      inProgress: '進行中',
      graded: '已評分'
    },
    'zh-Hans': {
      pageTitle: '学生日志',
      pageDescription: '查看学生加入课程与答题记录',
      exportExcel: '导出为 Excel',
      course: '课程',
      joinRecords: '加入记录',
      submissionRecords: '答题记录',
      name: '姓名',
      email: '邮箱',
      studentId: '学号',
      joinedAt: '加入时间',
      student: '学生',
      assessment: '考试/练习',
      type: '类型',
      status: '状态',
      score: '分数',
      attempts: '次数',
      startedAt: '开始时间',
      submittedAt: '提交时间',
      updatedAt: '更新时间',
      studentCount: '学生人数',
      submissionCount: '答题记录',
      completedCount: '已完成',
      inProgressCount: '进行中',
      emptyJoins: '暂无学生加入记录',
      emptySubmissions: '暂无答题记录',
      loadFailed: '无法加载课程日志',
      submitted: '已提交',
      inProgress: '进行中',
      graded: '已评分'
    },
    en: {
      pageTitle: 'Student Logs',
      pageDescription: 'View student course joins and assessment activity',
      exportExcel: 'Export to Excel',
      course: 'Course',
      joinRecords: 'Join Records',
      submissionRecords: 'Assessment Records',
      name: 'Name',
      email: 'Email',
      studentId: 'Student ID',
      joinedAt: 'Joined At',
      student: 'Student',
      assessment: 'Exam / Practice',
      type: 'Type',
      status: 'Status',
      score: 'Score',
      attempts: 'Attempts',
      startedAt: 'Started At',
      submittedAt: 'Submitted At',
      updatedAt: 'Updated At',
      studentCount: 'Students',
      submissionCount: 'Records',
      completedCount: 'Completed',
      inProgressCount: 'In Progress',
      emptyJoins: 'No student join records yet',
      emptySubmissions: 'No assessment records yet',
      loadFailed: 'Failed to load course logs',
      submitted: 'Submitted',
      inProgress: 'In Progress',
      graded: 'Graded'
    }
  };

  let isLoading = true;
  let errorMessage = '';
  let courseTitle = '';
  let summary = {
    studentCount: 0,
    submissionCount: 0,
    completedCount: 0,
    inProgressCount: 0
  };
  let joins: any[] = [];
  let submissions: any[] = [];
  $: uiLanguage = mapLocaleToUiLanguage($locale);
  $: summaryCards = [
    { label: ui('studentCount'), value: summary.studentCount },
    { label: ui('submissionCount'), value: summary.submissionCount },
    { label: ui('completedCount'), value: summary.completedCount },
    { label: ui('inProgressCount'), value: summary.inProgressCount }
  ];

  function mapLocaleToUiLanguage(currentLocale: string): UiLanguage {
    if (currentLocale === 'en') return 'en';
    if (currentLocale === 'zh') return 'zh-Hans';
    return 'zh-Hant';
  }

  function ui(key: string) {
    return COPY[uiLanguage][key] ?? COPY['zh-Hant'][key] ?? key;
  }

  function formatDate(value: string | null | undefined) {
    if (!value) return '';
    const dateLocale = uiLanguage === 'en' ? 'en-US' : uiLanguage === 'zh-Hans' ? 'zh-CN' : 'zh-HK';
    return new Date(value).toLocaleString(dateLocale);
  }

  function escapeCell(value: any) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function statusLabel(statusId: number | string | null | undefined, fallback = '') {
    const id = Number(statusId);
    if (id === 1) return ui('submitted');
    if (id === 2) return ui('inProgress');
    if (id === 3) return ui('graded');
    return fallback || String(statusId || '');
  }

  async function loadLogs() {
    isLoading = true;
    errorMessage = '';
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/courses/${courseId}/logs`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        errorMessage = result.message || ui('loadFailed');
        snackbar.error(errorMessage);
        return;
      }

      courseTitle = result.course?.title || '';
      summary = result.summary || summary;
      joins = result.joins || [];
      submissions = result.submissions || [];
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : ui('loadFailed');
      snackbar.error(errorMessage);
    } finally {
      isLoading = false;
    }
  }

  function exportExcel() {
    const joinRows = joins
      .map(
        (row) => `<tr>
          <td>${escapeCell(row.name)}</td>
          <td>${escapeCell(row.email)}</td>
          <td>${escapeCell(row.assignedStudentId)}</td>
          <td>${escapeCell(formatDate(row.joinedAt))}</td>
        </tr>`
      )
      .join('');

    const submissionRows = submissions
      .map(
        (row) => `<tr>
          <td>${escapeCell(row.studentName)}</td>
          <td>${escapeCell(row.studentEmail)}</td>
          <td>${escapeCell(row.exerciseTitle)}</td>
          <td>${escapeCell(row.assessmentType)}</td>
          <td>${escapeCell(statusLabel(row.statusId, row.statusLabel))}</td>
          <td>${escapeCell(row.total)}</td>
          <td>${escapeCell(row.attemptNo)}</td>
          <td>${escapeCell(formatDate(row.startedAt))}</td>
          <td>${escapeCell(formatDate(row.submittedAt))}</td>
          <td>${escapeCell(formatDate(row.updatedAt))}</td>
        </tr>`
      )
      .join('');

    const html = `<!doctype html>
      <html>
        <head><meta charset="utf-8" /></head>
        <body>
          <h2>${escapeCell(courseTitle || ui('course'))} - ${ui('pageTitle')}</h2>
          <h3>${ui('joinRecords')}</h3>
          <table border="1">
            <thead><tr><th>${ui('name')}</th><th>${ui('email')}</th><th>${ui('studentId')}</th><th>${ui('joinedAt')}</th></tr></thead>
            <tbody>${joinRows}</tbody>
          </table>
          <h3>${ui('submissionRecords')}</h3>
          <table border="1">
            <thead>
              <tr><th>${ui('name')}</th><th>${ui('email')}</th><th>${ui('assessment')}</th><th>${ui('type')}</th><th>${ui('status')}</th><th>${ui('score')}</th><th>${ui('attempts')}</th><th>${ui('startedAt')}</th><th>${ui('submittedAt')}</th><th>${ui('updatedAt')}</th></tr>
            </thead>
            <tbody>${submissionRows}</tbody>
          </table>
        </body>
      </html>`;

    const blob = new Blob(['\ufeff', html], {
      type: 'application/vnd.ms-excel;charset=utf-8;'
    });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${courseTitle || 'course'}-student-logs.xls`;
    link.click();
    URL.revokeObjectURL(url);
  }

  onMount(loadLogs);
</script>

<CourseContainer {courseId}>
  <RoleBasedSecurity
    allowedRoles={[1, 2]}
    onDenied={() => {
      goto(`/courses/${courseId}/lessons`);
    }}
  >
    <PageNav title={ui('pageTitle')} />

    <PageBody width="w-full max-w-6xl md:w-11/12">
      <div class="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold text-gray-900 dark:text-white">{ui('pageTitle')}</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">{ui('pageDescription')}</p>
        </div>
        <PrimaryButton
          label={ui('exportExcel')}
          variant={VARIANTS.OUTLINED}
          onClick={exportExcel}
          isDisabled={isLoading || (joins.length === 0 && submissions.length === 0)}
        />
      </div>

      {#if isLoading}
        <div class="space-y-4">
          <SkeletonPlaceholder class="h-24 w-full rounded-md" />
          <SkeletonPlaceholder class="h-56 w-full rounded-md" />
          <SkeletonPlaceholder class="h-56 w-full rounded-md" />
        </div>
      {:else if errorMessage}
        <div class="rounded-md border border-red-200 bg-red-50 p-5 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {errorMessage}
        </div>
      {:else}
        <div class="mb-6 grid gap-3 md:grid-cols-4">
          {#each summaryCards as item}
            <div class="rounded-md border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
              <p class="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
              <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{item.value}</p>
            </div>
          {/each}
        </div>

        <section class="mb-8 rounded-md border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
          <div class="border-b border-gray-200 px-4 py-3 dark:border-neutral-700">
            <h2 class="font-semibold text-gray-900 dark:text-white">{ui('joinRecords')}</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-gray-50 text-xs text-gray-500 dark:bg-neutral-800 dark:text-gray-300">
                <tr>
                  <th class="px-4 py-3">{ui('name')}</th>
                  <th class="px-4 py-3">{ui('email')}</th>
                  <th class="px-4 py-3">{ui('studentId')}</th>
                  <th class="px-4 py-3">{ui('joinedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {#each joins as row}
                  <tr class="border-t border-gray-100 dark:border-neutral-800">
                    <td class="px-4 py-3 dark:text-white">{row.name || '-'}</td>
                    <td class="px-4 py-3 dark:text-white">{row.email || '-'}</td>
                    <td class="px-4 py-3 dark:text-white">{row.assignedStudentId || '-'}</td>
                    <td class="px-4 py-3 dark:text-white">{formatDate(row.joinedAt) || '-'}</td>
                  </tr>
                {:else}
                  <tr><td class="px-4 py-6 text-gray-500" colspan="4">{ui('emptyJoins')}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>

        <section class="rounded-md border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
          <div class="border-b border-gray-200 px-4 py-3 dark:border-neutral-700">
            <h2 class="font-semibold text-gray-900 dark:text-white">{ui('submissionRecords')}</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-gray-50 text-xs text-gray-500 dark:bg-neutral-800 dark:text-gray-300">
                <tr>
                  <th class="px-4 py-3">{ui('student')}</th>
                  <th class="px-4 py-3">{ui('email')}</th>
                  <th class="px-4 py-3">{ui('assessment')}</th>
                  <th class="px-4 py-3">{ui('status')}</th>
                  <th class="px-4 py-3">{ui('score')}</th>
                  <th class="px-4 py-3">{ui('attempts')}</th>
                  <th class="px-4 py-3">{ui('submittedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {#each submissions as row}
                  <tr class="border-t border-gray-100 dark:border-neutral-800">
                    <td class="px-4 py-3 dark:text-white">{row.studentName || '-'}</td>
                    <td class="px-4 py-3 dark:text-white">{row.studentEmail || '-'}</td>
                    <td class="px-4 py-3 dark:text-white">{row.exerciseTitle || '-'}</td>
                    <td class="px-4 py-3 dark:text-white">{statusLabel(row.statusId, row.statusLabel) || '-'}</td>
                    <td class="px-4 py-3 dark:text-white">{row.total ?? '-'}</td>
                    <td class="px-4 py-3 dark:text-white">{row.attemptNo || '-'}</td>
                    <td class="px-4 py-3 dark:text-white">{formatDate(row.submittedAt) || '-'}</td>
                  </tr>
                {:else}
                  <tr><td class="px-4 py-6 text-gray-500" colspan="7">{ui('emptySubmissions')}</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>
      {/if}
    </PageBody>
  </RoleBasedSecurity>
</CourseContainer>
