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

  export let data;
  const { courseId } = data;

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

  function formatDate(value: string | null | undefined) {
    if (!value) return '';
    return new Date(value).toLocaleString();
  }

  function escapeCell(value: any) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
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
        errorMessage = result.message || 'Failed to load course logs';
        snackbar.error(errorMessage);
        return;
      }

      courseTitle = result.course?.title || '';
      summary = result.summary || summary;
      joins = result.joins || [];
      submissions = result.submissions || [];
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to load course logs';
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
          <td>${escapeCell(row.statusLabel)}</td>
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
          <h2>${escapeCell(courseTitle || '课程')} - 学生日志</h2>
          <h3>加入记录</h3>
          <table border="1">
            <thead><tr><th>姓名</th><th>邮箱</th><th>学号</th><th>加入时间</th></tr></thead>
            <tbody>${joinRows}</tbody>
          </table>
          <h3>答题记录</h3>
          <table border="1">
            <thead>
              <tr><th>姓名</th><th>邮箱</th><th>考试/练习</th><th>类型</th><th>状态</th><th>分数</th><th>次数</th><th>开始时间</th><th>提交时间</th><th>更新时间</th></tr>
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
    <PageNav title="学生日志" />

    <PageBody width="w-full max-w-6xl md:w-11/12">
      <div class="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold text-gray-900 dark:text-white">学生日志</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">查看学生加入课程与答题记录</p>
        </div>
        <PrimaryButton
          label="导出为 Excel"
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
          {#each [
            ['学生人数', summary.studentCount],
            ['答题记录', summary.submissionCount],
            ['已完成', summary.completedCount],
            ['进行中', summary.inProgressCount]
          ] as item}
            <div class="rounded-md border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
              <p class="text-xs text-gray-500 dark:text-gray-400">{item[0]}</p>
              <p class="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{item[1]}</p>
            </div>
          {/each}
        </div>

        <section class="mb-8 rounded-md border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
          <div class="border-b border-gray-200 px-4 py-3 dark:border-neutral-700">
            <h2 class="font-semibold text-gray-900 dark:text-white">加入记录</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-gray-50 text-xs text-gray-500 dark:bg-neutral-800 dark:text-gray-300">
                <tr>
                  <th class="px-4 py-3">姓名</th>
                  <th class="px-4 py-3">邮箱</th>
                  <th class="px-4 py-3">学号</th>
                  <th class="px-4 py-3">加入时间</th>
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
                  <tr><td class="px-4 py-6 text-gray-500" colspan="4">暂无学生加入记录</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>

        <section class="rounded-md border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
          <div class="border-b border-gray-200 px-4 py-3 dark:border-neutral-700">
            <h2 class="font-semibold text-gray-900 dark:text-white">答题记录</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-gray-50 text-xs text-gray-500 dark:bg-neutral-800 dark:text-gray-300">
                <tr>
                  <th class="px-4 py-3">学生</th>
                  <th class="px-4 py-3">邮箱</th>
                  <th class="px-4 py-3">考试/练习</th>
                  <th class="px-4 py-3">状态</th>
                  <th class="px-4 py-3">分数</th>
                  <th class="px-4 py-3">次数</th>
                  <th class="px-4 py-3">提交时间</th>
                </tr>
              </thead>
              <tbody>
                {#each submissions as row}
                  <tr class="border-t border-gray-100 dark:border-neutral-800">
                    <td class="px-4 py-3 dark:text-white">{row.studentName || '-'}</td>
                    <td class="px-4 py-3 dark:text-white">{row.studentEmail || '-'}</td>
                    <td class="px-4 py-3 dark:text-white">{row.exerciseTitle || '-'}</td>
                    <td class="px-4 py-3 dark:text-white">{row.statusLabel || '-'}</td>
                    <td class="px-4 py-3 dark:text-white">{row.total ?? '-'}</td>
                    <td class="px-4 py-3 dark:text-white">{row.attemptNo || '-'}</td>
                    <td class="px-4 py-3 dark:text-white">{formatDate(row.submittedAt) || '-'}</td>
                  </tr>
                {:else}
                  <tr><td class="px-4 py-6 text-gray-500" colspan="7">暂无答题记录</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>
      {/if}
    </PageBody>
  </RoleBasedSecurity>
</CourseContainer>
