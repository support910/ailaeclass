<script lang="ts">
  import { locale } from '$lib/utils/functions/translations';
  import { isOrgAdmin, currentOrg } from '$lib/utils/store/org';
  import { PageUnauthorized } from '$lib/components/Page';
  import { RELEASES, CURRENT_VERSION } from '$lib/utils/constants/releases';
  import type { ReleaseChangeKind } from '$lib/utils/constants/releases';

  type Lang = 'zh' | 'hant' | 'en';
  $: lang = ($locale === 'zh'
    ? 'zh'
    : String($locale).toLowerCase().includes('zh')
      ? 'hant'
      : 'en') as Lang;

  const COPY = {
    zh: {
      title: '版本记录',
      subtitle: '每一次迭代更新了什么，按版本先后顺序排列。仅管理端可见。',
      current: '当前版本',
      pending: '待发布',
      live: '已上线',
      empty: '暂无版本记录'
    },
    hant: {
      title: '版本紀錄',
      subtitle: '每一次迭代更新了什麼，按版本先後順序排列。僅管理端可見。',
      current: '目前版本',
      pending: '待發布',
      live: '已上線',
      empty: '暫無版本紀錄'
    },
    en: {
      title: 'Release notes',
      subtitle: 'What changed in each iteration, oldest first. Visible to administrators only.',
      current: 'Current version',
      pending: 'Not yet released',
      live: 'Live',
      empty: 'No releases recorded'
    }
  } as const;
  $: copy = COPY[lang];

  // RELEASES is authored newest-first so a new entry goes at the top of the file;
  // the page reads better oldest-first, as a history you follow forwards.
  $: ordered = [...RELEASES].reverse();

  const KIND: Record<ReleaseChangeKind, { zh: string; hant: string; en: string; cls: string }> = {
    feature: { zh: '新功能', hant: '新功能', en: 'Feature', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100' },
    fix: { zh: '修复', hant: '修復', en: 'Fix', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' },
    security: { zh: '安全', hant: '安全', en: 'Security', cls: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' },
    perf: { zh: '性能', hant: '效能', en: 'Performance', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100' },
    ui: { zh: '界面', hant: '介面', en: 'Interface', cls: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-100' },
    config: { zh: '配置', hant: '設定', en: 'Config', cls: 'bg-gray-200 text-gray-800 dark:bg-neutral-700 dark:text-gray-100' }
  };
</script>

<svelte:head><title>{copy.title} | ailaeclass</title></svelte:head>

{#if $isOrgAdmin === null}
  <div class="px-5 py-10" />
{:else if !$isOrgAdmin}
  <PageUnauthorized />
{:else}
  <div class="min-h-full bg-[#f6f8fa] px-4 py-6 dark:bg-neutral-950 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-4xl">
      <header class="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold text-gray-950 dark:text-white">{copy.title}</h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-neutral-300">{copy.subtitle}</p>
        </div>
        <div
          class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-right dark:border-neutral-700 dark:bg-neutral-900"
        >
          <p class="text-[11px] uppercase tracking-wide text-gray-500 dark:text-neutral-400">
            {copy.current}
          </p>
          <p class="text-lg font-bold text-gray-900 dark:text-white" style="font-variant-numeric: tabular-nums;">
            v{CURRENT_VERSION}
          </p>
        </div>
      </header>

      {#if !ordered.length}
        <p class="text-sm text-gray-500">{copy.empty}</p>
      {:else}
        <ol class="relative space-y-4 border-l border-gray-200 pl-6 dark:border-neutral-700">
          {#each ordered as release}
            <li class="relative">
              <span
                class="absolute -left-[31px] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-[#f6f8fa] dark:ring-neutral-950 {release.released
                  ? 'bg-teal-500'
                  : 'bg-amber-400'}"
              />
              <article
                class="rounded-xl border border-gray-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900"
              >
                <div class="mb-1 flex flex-wrap items-center gap-2">
                  <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                    v{release.version}
                  </h2>
                  <span
                    class="rounded-full px-2 py-0.5 text-[11px] font-medium {release.released
                      ? 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100'}"
                  >
                    {release.released ? copy.live : copy.pending}
                  </span>
                  <span class="ml-auto text-xs text-gray-500 dark:text-neutral-400">{release.date}</span>
                </div>
                <p class="mb-3 text-sm text-gray-700 dark:text-neutral-200">{release.title[lang]}</p>

                <ul class="space-y-2">
                  {#each release.changes as change}
                    <li class="flex gap-2.5">
                      <span
                        class="mt-0.5 h-fit shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium {KIND[change.kind].cls}"
                      >
                        {KIND[change.kind][lang]}
                      </span>
                      <span class="text-sm leading-relaxed text-gray-700 dark:text-neutral-200">
                        {change[lang]}
                      </span>
                    </li>
                  {/each}
                </ul>
              </article>
            </li>
          {/each}
        </ol>
      {/if}
    </div>
  </div>
{/if}
