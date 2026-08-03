<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { locale } from '$lib/utils/functions/translations';
  import { getAccessToken } from '$lib/utils/functions/supabase';
  import { currentOrg, isOrgAdmin } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { SUPER_ADMIN_EMAIL } from '$lib/utils/constants/admin';
  import Download from 'carbon-icons-svelte/lib/Download.svelte';
  import Renew from 'carbon-icons-svelte/lib/Renew.svelte';
  import Security from 'carbon-icons-svelte/lib/Security.svelte';
  import UserMultiple from 'carbon-icons-svelte/lib/UserMultiple.svelte';
  import Book from 'carbon-icons-svelte/lib/Book.svelte';
  import Activity from 'carbon-icons-svelte/lib/Activity.svelte';
  import CheckmarkOutline from 'carbon-icons-svelte/lib/CheckmarkOutline.svelte';
  import WarningAlt from 'carbon-icons-svelte/lib/WarningAlt.svelte';
  import { onMount } from 'svelte';
  import { ScaleTypes } from '@carbon/charts-svelte';
  import '@carbon/charts-svelte/styles.css';

  type UiLanguage = 'zh-Hant' | 'zh-Hans' | 'en';
  type DashboardData = Record<string, any>;

  const COPY = {
    'zh-Hant': {
      title: '數據駕駛艙', subtitle: '查看平台使用、學習、考試及隱私審計記錄',
      refresh: '重新整理', export: '匯出 CSV', loading: '正在整理數據...', denied: '此頁面僅供超級管理員查看。',
      students: '學生總數', teachers: '教師總數', courses: '課程總數', active: '活躍用戶',
      completion: '課程完成率', passRate: '考試通過率', records: '期間記錄', published: '已發佈課程',
      trend: '活動趨勢', roles: '角色分佈', courseState: '課程狀態', examMode: '考試模式',
      topCourses: '課程參與概覽', recent: '最近記錄', privacy: '隱私與審計',
      course: '課程', enrolled: '學生', submissions: '提交', completions: '完成',
      time: '時間', category: '分類', action: '操作', actor: '匿名帳號', resource: '資源', result: '結果', risk: '風險',
      adminOnly: '僅管理員可存取', retention: '資料保留', noAiContent: '不保存 AI 原始問答', pseudonym: '匯出資料匿名化', hashed: '網絡識別資料雜湊處理',
      days: '天', empty: '此期間暫無記錄', generated: '資料更新時間', error: '無法載入數據駕駛艙'
    },
    'zh-Hans': {
      title: '数据驾驶舱', subtitle: '查看平台使用、学习、考试及隐私审计记录',
      refresh: '刷新', export: '导出 CSV', loading: '正在整理数据...', denied: '此页面仅供超级管理员查看。',
      students: '学生总数', teachers: '教师总数', courses: '课程总数', active: '活跃用户',
      completion: '课程完成率', passRate: '考试通过率', records: '期间记录', published: '已发布课程',
      trend: '活动趋势', roles: '角色分布', courseState: '课程状态', examMode: '考试模式',
      topCourses: '课程参与概览', recent: '最近记录', privacy: '隐私与审计',
      course: '课程', enrolled: '学生', submissions: '提交', completions: '完成',
      time: '时间', category: '分类', action: '操作', actor: '匿名账号', resource: '资源', result: '结果', risk: '风险',
      adminOnly: '仅管理员可访问', retention: '数据保留', noAiContent: '不保存 AI 原始问答', pseudonym: '导出数据匿名化', hashed: '网络识别数据哈希处理',
      days: '天', empty: '此期间暂无记录', generated: '数据更新时间', error: '无法加载数据驾驶舱'
    },
    en: {
      title: 'Data cockpit', subtitle: 'Platform usage, learning, assessment, privacy and audit records',
      refresh: 'Refresh', export: 'Export CSV', loading: 'Preparing data...', denied: 'This page is available to the super administrator only.',
      students: 'Students', teachers: 'Teachers', courses: 'Courses', active: 'Active users',
      completion: 'Completion rate', passRate: 'Exam pass rate', records: 'Period records', published: 'Published courses',
      trend: 'Activity trend', roles: 'Role distribution', courseState: 'Course status', examMode: 'Assessment modes',
      topCourses: 'Course participation', recent: 'Recent records', privacy: 'Privacy and audit',
      course: 'Course', enrolled: 'Students', submissions: 'Submissions', completions: 'Completions',
      time: 'Time', category: 'Category', action: 'Action', actor: 'Pseudonymous actor', resource: 'Resource', result: 'Outcome', risk: 'Risk',
      adminOnly: 'Administrator-only access', retention: 'Data retention', noAiContent: 'Raw AI conversations are not stored', pseudonym: 'Exports are pseudonymized', hashed: 'Network identifiers are hashed',
      days: 'days', empty: 'No records in this period', generated: 'Updated', error: 'Unable to load the data cockpit'
    }
  } as const;

  let uiLanguage: UiLanguage = 'en';
  let data: DashboardData | null = null;
  let loading = false;
  let errorMessage = '';
  let days = 30;
  let loadedKey = '';
  let PieChart: any;
  let BarChartGrouped: any;

  $: uiLanguage = $locale === 'zh' ? 'zh-Hans' : String($locale).toLowerCase().includes('zh') ? 'zh-Hant' : 'en';
  $: copy = COPY[uiLanguage];
  $: isSuperAdmin = $isOrgAdmin === true && ($profile.email || '').toLowerCase() === SUPER_ADMIN_EMAIL;
  $: {
    const requestedDays = Number($page.url.searchParams.get('days') || 30);
    days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  }
  $: if (browser && isSuperAdmin && $currentOrg.id && loadedKey !== `${$currentOrg.id}:${days}` && !loading) {
    loadDashboard();
  }

  onMount(async () => {
    const charts = await import('@carbon/charts-svelte');
    PieChart = charts.PieChart;
    BarChartGrouped = charts.BarChartGrouped;
  });

  function chartHasValues(items: any[] = []) {
    return items.some((item) => Number(item.value) > 0);
  }

  async function loadDashboard(force = false) {
    if (!$currentOrg.id || !isSuperAdmin) return;
    const key = `${$currentOrg.id}:${days}`;
    if (!force && loadedKey === key) return;
    loading = true;
    errorMessage = '';
    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/admin/data-cockpit?orgId=${encodeURIComponent($currentOrg.id)}&days=${days}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(await response.text());
      data = await response.json();
      loadedKey = key;
    } catch (error) {
      console.error('Data cockpit load failed:', error);
      errorMessage = copy.error;
    } finally {
      loading = false;
    }
  }

  async function exportCsv() {
    if (!$currentOrg.id || !isSuperAdmin) return;
    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/admin/data-cockpit?orgId=${encodeURIComponent($currentOrg.id)}&days=${days}&format=csv`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `ailaeclass-data-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Data cockpit export failed:', error);
      errorMessage = copy.error;
    }
  }

  $: trendChartData = data?.charts?.activityTrend
    ? data.charts.activityTrend.flatMap((item: any) => [
        { group: 'Enrollments', key: item.date.slice(5), value: item.enrollments },
        { group: 'Completions', key: item.date.slice(5), value: item.completions },
        { group: 'Submissions', key: item.date.slice(5), value: item.submissions },
        { group: 'AI queries', key: item.date.slice(5), value: item.aiQueries }
      ])
    : [];
  $: trendOptions = {
    axes: {
      left: { mapsTo: 'value', scaleType: ScaleTypes.LINEAR },
      bottom: { mapsTo: 'key', scaleType: ScaleTypes.LABELS }
    },
    height: '300px',
    legend: { alignment: 'center' },
    toolbar: { enabled: false },
    color: { scale: { Enrollments: '#0E7372', Completions: '#24A148', Submissions: '#4589FF', 'AI queries': '#8A3FFC' } }
  };
  $: pieOptions = {
    height: '250px',
    donut: { center: { label: 'Total' } },
    legend: { alignment: 'center' },
    toolbar: { enabled: false }
  };

  function formatDate(value: string) {
    return new Intl.DateTimeFormat(uiLanguage === 'en' ? 'en-GB' : 'zh-HK', {
      month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(new Date(value));
  }
</script>

<svelte:head><title>{copy.title} | ailaeclass</title></svelte:head>

<div class="min-h-full bg-[#f6f8fa] px-4 py-5 dark:bg-neutral-950 sm:px-6 lg:px-8">
  {#if !isSuperAdmin}
    <div class="mx-auto mt-16 max-w-xl rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-neutral-700 dark:bg-neutral-900">
      <Security size={32} class="mx-auto mb-3 text-gray-500" />
      <h1 class="text-xl font-semibold text-gray-900 dark:text-white">{copy.title}</h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-neutral-300">{copy.denied}</p>
    </div>
  {:else}
    <div class="mx-auto max-w-[1500px]">
      <header class="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-gray-950 dark:text-white">{copy.title}</h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-neutral-300">{copy.subtitle}</p>
          {#if data?.generatedAt}<p class="mt-1 text-xs text-gray-500">{copy.generated}: {formatDate(data.generatedAt)}</p>{/if}
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="inline-flex overflow-hidden rounded-md border border-gray-300 bg-white dark:border-neutral-600 dark:bg-neutral-900">
            {#each [7, 30, 90] as period}
              <a href="?days={period}" aria-current={days === period ? 'page' : undefined} class="flex h-9 items-center px-3 text-sm font-medium no-underline {days === period ? 'bg-gray-900 text-white dark:bg-white dark:text-black' : 'text-gray-700 hover:bg-gray-100 dark:text-neutral-200 dark:hover:bg-neutral-800'}">
                {period} {copy.days}
              </a>
            {/each}
          </div>
          <button type="button" on:click={() => loadDashboard(true)} class="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium hover:bg-gray-100 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800" title={copy.refresh}>
            <Renew size={17} /> {copy.refresh}
          </button>
          <button type="button" on:click={exportCsv} class="inline-flex h-9 items-center gap-2 rounded-md bg-[#0E7372] px-3 text-sm font-semibold text-white hover:bg-[#095e5d]">
            <Download size={17} /> {copy.export}
          </button>
        </div>
      </header>

      {#if errorMessage}
        <div class="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><WarningAlt size={18} /> {errorMessage}</div>
      {/if}

      {#if loading && !data}
        <div class="flex min-h-[420px] items-center justify-center text-sm text-gray-500"><Renew size={20} class="mr-2 animate-spin" />{copy.loading}</div>
      {:else if data}
        <section class="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {#each [
            [copy.students, data.summary.totalStudents, UserMultiple], [copy.teachers, data.summary.totalTeachers, UserMultiple],
            [copy.courses, data.summary.totalCourses, Book], [copy.published, data.summary.publishedCourses, CheckmarkOutline],
            [copy.active, data.summary.activeUsers, Activity], [copy.completion, `${data.summary.completionRate}%`, CheckmarkOutline],
            [copy.passRate, `${data.summary.examPassRate}%`, CheckmarkOutline], [copy.records, data.summary.totalRecords, Activity]
          ] as metric}
            <div class="min-w-0 rounded-lg border border-gray-200 bg-white p-3.5 dark:border-neutral-700 dark:bg-neutral-900">
              <div class="mb-3 flex items-center justify-between text-gray-500"><span class="truncate text-xs font-medium">{metric[0]}</span><svelte:component this={metric[2]} size={17} /></div>
              <div class="text-2xl font-semibold text-gray-950 dark:text-white">{metric[1]}</div>
            </div>
          {/each}
        </section>

        <section class="mt-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900 sm:p-5">
          <h2 class="mb-3 text-base font-semibold text-gray-900 dark:text-white">{copy.trend}</h2>
          {#if BarChartGrouped && trendChartData.length}<svelte:component this={BarChartGrouped} data={trendChartData} options={trendOptions} />{:else}<div class="h-[300px] animate-pulse bg-gray-50 dark:bg-neutral-800" />{/if}
        </section>

        <section class="mt-4 grid gap-4 lg:grid-cols-3">
          {#each [[copy.roles, data.charts.roleDistribution], [copy.courseState, data.charts.courseStatus], [copy.examMode, data.charts.examModes]] as chart}
            <div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
              <h2 class="mb-2 text-base font-semibold text-gray-900 dark:text-white">{chart[0]}</h2>
              {#if PieChart && chartHasValues(chart[1])}<svelte:component this={PieChart} data={chart[1]} options={pieOptions} />{:else}<div class="flex h-[250px] items-center justify-center text-sm text-gray-500">{copy.empty}</div>{/if}
            </div>
          {/each}
        </section>

        <section class="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div class="min-w-0 rounded-lg border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
            <h2 class="border-b border-gray-200 px-4 py-3 text-base font-semibold dark:border-neutral-700 dark:text-white">{copy.topCourses}</h2>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead class="bg-gray-50 text-xs text-gray-500 dark:bg-neutral-800"><tr><th class="px-4 py-2.5">{copy.course}</th><th class="px-3 py-2.5">{copy.enrolled}</th><th class="px-3 py-2.5">{copy.submissions}</th><th class="px-3 py-2.5">{copy.completions}</th></tr></thead>
                <tbody>{#each data.charts.topCourses as course}<tr class="border-t border-gray-100 dark:border-neutral-800"><td class="max-w-[220px] truncate px-4 py-3 font-medium dark:text-white">{course.title}</td><td class="px-3">{course.students}</td><td class="px-3">{course.submissions}</td><td class="px-3">{course.completions}</td></tr>{/each}</tbody>
              </table>
            </div>
          </div>

          <div class="min-w-0 rounded-lg border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
            <h2 class="border-b border-gray-200 px-4 py-3 text-base font-semibold dark:border-neutral-700 dark:text-white">{copy.recent}</h2>
            <div class="max-h-[430px] overflow-auto">
              <table class="w-full min-w-[760px] text-left text-sm">
                <thead class="sticky top-0 bg-gray-50 text-xs text-gray-500 dark:bg-neutral-800"><tr><th class="px-4 py-2.5">{copy.time}</th><th class="px-3 py-2.5">{copy.category}</th><th class="px-3 py-2.5">{copy.action}</th><th class="px-3 py-2.5">{copy.actor}</th><th class="px-3 py-2.5">{copy.resource}</th><th class="px-3 py-2.5">{copy.result}</th><th class="px-3 py-2.5">{copy.risk}</th></tr></thead>
                <tbody>
                  {#each data.recentRecords as record}<tr class="border-t border-gray-100 dark:border-neutral-800"><td class="whitespace-nowrap px-4 py-2.5 text-xs">{formatDate(record.occurredAt)}</td><td class="px-3">{record.category}</td><td class="px-3 font-medium dark:text-white">{record.action}</td><td class="px-3 font-mono text-xs">{record.actor}</td><td class="max-w-[180px] truncate px-3">{record.resource}</td><td class="px-3">{record.outcome}</td><td class="px-3"><span class="rounded px-2 py-1 text-xs {record.risk === 'high' ? 'bg-red-100 text-red-800' : record.risk === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}">{record.risk}</span></td></tr>{/each}
                  {#if !data.recentRecords.length}<tr><td colspan="7" class="px-4 py-12 text-center text-gray-500">{copy.empty}</td></tr>{/if}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section class="mt-4 rounded-lg border border-gray-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900">
          <div class="mb-4 flex items-center gap-2"><Security size={20} class="text-[#0E7372]" /><h2 class="text-base font-semibold text-gray-900 dark:text-white">{copy.privacy}</h2></div>
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {#each [[copy.adminOnly, true], [`${copy.retention}: ${data.privacy.retentionDays} ${copy.days}`, true], [copy.noAiContent, !data.privacy.storesAiContent], [copy.pseudonym, data.privacy.pseudonymizedExports], [copy.hashed, data.privacy.hashedNetworkIdentifiers]] as item}
              <div class="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-3 text-sm text-gray-700 dark:bg-neutral-800 dark:text-neutral-200"><CheckmarkOutline size={18} class={item[1] ? 'text-green-600' : 'text-gray-400'} /><span>{item[0]}</span></div>
            {/each}
          </div>
        </section>
      {/if}
    </div>
  {/if}
</div>
