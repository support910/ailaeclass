<script lang="ts">
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { getAccessToken } from '$lib/utils/functions/supabase';
  import PageNav from '$lib/components/Page/Nav.svelte';
  import PageBody from '$lib/components/Page/Body.svelte';

  type FaqRow = {
    id: string;
    question: string;
    answer: string;
    status: 'pending' | 'published' | 'rejected';
    ai_verdict?: { publish?: boolean; score?: number; reason?: string } | null;
    points_awarded: number;
    created_at: string;
    submitted_by_profile?: { fullname?: string; email?: string } | null;
  };

  let published: FaqRow[] = [];
  let pending: FaqRow[] = [];
  let loading = false;
  let apiRoleId: number | null = null;
  let message = '';
  let errorMessage = '';

  let question = '';
  let answer = '';
  let submitting = false;
  let openId = '';

  let reviewScores: Record<string, number> = {};

  $: isStaff = apiRoleId !== null ? apiRoleId !== 3 : [1, 2].includes(Number($currentOrg?.role_id));

  function formatDate(value: string) {
    try {
      return new Date(value).toLocaleString('zh-HK');
    } catch {
      return value;
    }
  }

  async function loadFaq() {
    const orgId = $currentOrg?.id;
    if (!orgId) return;
    loading = true;
    errorMessage = '';
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('請先登入');
      const res = await fetch(`/api/faq?orgId=${orgId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '讀取 FAQ 失敗');
      apiRoleId = typeof json.roleId === 'number' ? json.roleId : null;
      const rows: FaqRow[] = json.rows || [];
      published = rows.filter((row) => row.status === 'published');
      pending = rows.filter((row) => row.status === 'pending');
      for (const row of pending) {
        if (!reviewScores[row.id]) reviewScores[row.id] = 6;
      }
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : '讀取 FAQ 失敗';
    } finally {
      loading = false;
    }
  }

  async function submitFaq() {
    const orgId = $currentOrg?.id;
    if (!orgId) return;
    if (question.trim().length < 5) {
      errorMessage = '問題至少 5 個字';
      return;
    }
    submitting = true;
    errorMessage = '';
    message = '';
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/faq', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, question: question.trim(), answer: answer.trim() })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '提交失敗');
      message = json.message || '已提交';
      question = '';
      answer = '';
      await loadFaq();
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : '提交失敗';
    } finally {
      submitting = false;
    }
  }

  async function reviewFaq(id: string, action: 'publish' | 'reject', row?: FaqRow) {
    const orgId = $currentOrg?.id;
    if (!orgId) return;
    errorMessage = '';
    message = '';
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/faq', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          id,
          action,
          answer: row?.answer || '',
          score: reviewScores[id] || 6
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '審核失敗');
      message = action === 'publish' ? `已公開，並發 ${json.awarded || 0} 分` : '已拒絕';
      await loadFaq();
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : '審核失敗';
    }
  }

  let loadedOrgId = '';
  $: if ($currentOrg?.id && $currentOrg.id !== loadedOrgId) {
    loadedOrgId = $currentOrg.id;
    loadFaq();
  }
</script>

<PageNav title="常見問題 / FAQ" />

<PageBody width="w-full max-w-4xl">
  <div class="mb-5 rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
    <p class="mb-2 text-sm font-medium dark:text-white">提交問題</p>
    <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
      任何成員都可以提交。AI Tutor 會判斷是否適合公開，公開後按質素發 10／8／6／3 分給提供者。
    </p>
    <textarea
      class="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
      rows="2"
      placeholder="你的問題（必填，5–500 字）"
      bind:value={question}
    ></textarea>
    <textarea
      class="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
      rows="2"
      placeholder="你建議的答案（可選）"
      bind:value={answer}
    ></textarea>
    <button
      class="rounded-md bg-primary-700 px-4 py-2 text-sm text-white disabled:opacity-50"
      disabled={submitting}
      on:click={submitFaq}
    >
      {submitting ? '提交中…' : '提交'}
    </button>
    {#if message}<p class="mt-2 text-sm text-green-700 dark:text-green-400">{message}</p>{/if}
    {#if errorMessage}<p class="mt-2 text-sm text-red-700 dark:text-red-400">{errorMessage}</p>{/if}
  </div>

  {#if isStaff && pending.length > 0}
    <div class="mb-5 rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
      <p class="mb-2 text-sm font-medium text-yellow-900 dark:text-yellow-200">待審核（{pending.length}）</p>
      {#each pending as row (row.id)}
        <div class="mb-2 rounded-md border border-yellow-200 bg-white p-3 dark:border-yellow-800 dark:bg-neutral-900">
          <p class="text-sm font-medium dark:text-white">{row.question}</p>
          {#if row.ai_verdict?.reason}
            <p class="mt-1 text-xs text-gray-600 dark:text-gray-300">AI：{row.ai_verdict.reason}</p>
          {/if}
          {#if row.answer}
            <p class="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">{row.answer}</p>
          {/if}
          <p class="mt-1 text-xs text-gray-500">
            {row.submitted_by_profile?.fullname || row.submitted_by_profile?.email || '—'} · {formatDate(row.created_at)}
          </p>
          <div class="mt-2 flex items-center gap-2">
            <select
              class="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
              bind:value={reviewScores[row.id]}
            >
              <option value={10}>10 分</option>
              <option value={8}>8 分</option>
              <option value={6}>6 分</option>
              <option value={3}>3 分</option>
            </select>
            <button class="rounded-md bg-primary-700 px-3 py-1 text-xs text-white" on:click={() => reviewFaq(row.id, 'publish', row)}>
              公開
            </button>
            <button class="rounded-md border border-gray-300 px-3 py-1 text-xs dark:border-neutral-600 dark:text-white" on:click={() => reviewFaq(row.id, 'reject', row)}>
              拒絕
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <div class="rounded-lg border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
    <p class="border-b border-gray-100 px-4 py-3 text-sm font-medium dark:border-neutral-700 dark:text-white">
      已公開問題（{published.length}）
    </p>
    {#if loading}
      <p class="px-4 py-6 text-center text-sm text-gray-500">載入中…</p>
    {:else if published.length === 0}
      <p class="px-4 py-6 text-center text-sm text-gray-500">暫時未有已公開的 FAQ</p>
    {:else}
      {#each published as row (row.id)}
        <div class="border-b border-gray-100 px-4 py-3 last:border-b-0 dark:border-neutral-700">
          <button class="flex w-full items-start justify-between text-left" on:click={() => (openId = openId === row.id ? '' : row.id)}>
            <span class="text-sm font-medium dark:text-white">{row.question}</span>
            <span class="ml-3 text-xs text-gray-400">{openId === row.id ? '−' : '+'}</span>
          </button>
          {#if openId === row.id}
            <p class="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">{row.answer || '（待補充）'}</p>
            <p class="mt-2 text-xs text-gray-500">
              由 {row.submitted_by_profile?.fullname || row.submitted_by_profile?.email || '—'} 提供
              {#if row.points_awarded > 0}· 獲 {row.points_awarded} 分{/if}
            </p>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</PageBody>
