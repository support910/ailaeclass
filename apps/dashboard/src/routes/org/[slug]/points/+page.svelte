<script lang="ts">
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { getAccessToken } from '$lib/utils/functions/supabase';
  import PageNav from '$lib/components/Page/Nav.svelte';
  import PageBody from '$lib/components/Page/Body.svelte';

  type LedgerRow = {
    id: number;
    user_id: string;
    kind: string;
    delta: number;
    note: string;
    created_at: string;
    profile?: { fullname?: string; email?: string } | null;
  };

  let rows: LedgerRow[] = [];
  let balances: Record<string, number> = {};
  let members: { profile_id: string; fullname?: string; email?: string }[] = [];
  let selectedUserId = '';
  let loading = false;
  let apiRoleId: number | null = null;
  let message = '';
  let errorMessage = '';

  // 積分登記表單
  let formUserId = '';
  let formKind = 'manual';
  let formDelta: number | '' = '';
  let formNote = '';
  let saving = false;

  $: canRegister = $currentOrg?.role_id === 1 || $currentOrg?.role_id === 2;
  $: isStudentView = apiRoleId !== null ? apiRoleId === 3 : $currentOrg?.role_id === 3;
  $: ownBalance = balances[$profile?.id] ?? 0;
  $: orgTotal = Object.values(balances).reduce((a, b) => a + b, 0);

  const kindLabels: Record<string, string> = {
    register: '註冊獎勵',
    checkin: '簽到',
    manual: '人手登記',
    exercise: '練習',
    exam: '考試',
    referral: '推薦',
    redeem: '兌換'
  };

  function formatDate(value: string) {
    try {
      return new Date(value).toLocaleString('zh-HK');
    } catch {
      return value;
    }
  }

  async function loadMembers(orgId: string, token: string) {
    const res = await fetch(`/api/points/members?orgId=${orgId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.success ? json.members : [];
  }

  async function loadPoints() {
    const orgId = $currentOrg?.id;
    if (!orgId) return;
    loading = true;
    errorMessage = '';
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('請先登入');
      const params = new URLSearchParams({ orgId });
      if (selectedUserId) params.set('userId', selectedUserId);
      const res = await fetch(`/api/points?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '讀取積分失敗');
      rows = json.rows || [];
      balances = json.balances || {};
      apiRoleId = typeof json.roleId === 'number' ? json.roleId : null;
      if (!isStudentView) members = await loadMembers(orgId, token);
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : '讀取積分失敗';
      rows = [];
    } finally {
      loading = false;
    }
  }

  async function registerPoints() {
    const orgId = $currentOrg?.id;
    if (!orgId || !formUserId || formDelta === '' || Number(formDelta) === 0) {
      errorMessage = '請揀學生並輸入非零積分';
      return;
    }
    saving = true;
    errorMessage = '';
    message = '';
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/points', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orgId,
          userId: formUserId,
          kind: formKind || 'manual',
          delta: Number(formDelta),
          note: formNote
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '登記失敗');
      message = `已登記 ${Number(formDelta) > 0 ? '+' : ''}${formDelta} 分`;
      formDelta = '';
      formNote = '';
      await loadPoints();
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : '登記失敗';
    } finally {
      saving = false;
    }
  }

  let loadedOrgId = '';
  $: if ($currentOrg?.id && $currentOrg.id !== loadedOrgId) {
    loadedOrgId = $currentOrg.id;
    loadPoints();
  }
</script>

<PageNav title="積分 / Points" />

<PageBody width="w-full max-w-6xl">
  <div class="mb-4 grid gap-3 md:grid-cols-3">
    <div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {isStudentView ? '目前積分' : '機構積分合計'}
      </p>
      <p class="text-3xl font-bold dark:text-white">
        {loading ? '—' : isStudentView ? ownBalance : orgTotal}
      </p>
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">10 分 = HK$1（可兌換折扣／權益，不可兌現金）</p>
    </div>
    <div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <p class="text-xs text-gray-500 dark:text-gray-400">本頁顯示範圍</p>
      <p class="text-sm dark:text-white">
        {isStudentView ? '只顯示你自己的積分明細' : selectedUserId ? '指定學員' : '全機構學員'}
      </p>
    </div>
    <div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <p class="text-xs text-gray-500 dark:text-gray-400">積分規則（v4）</p>
      <p class="text-sm dark:text-white">課堂表現 10／8／6／3 · 投稿成功 20／未成功 3 · 推薦 100（上限 2 次）</p>
    </div>
  </div>

  {#if !isStudentView}
    <div class="mb-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <div class="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <p class="mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">學員</p>
          <select
            class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
            bind:value={selectedUserId}
            on:change={loadPoints}
          >
            <option value="">全部學員</option>
            {#each members as member}
              <option value={member.profile_id}>{member.fullname || member.email || member.profile_id}</option>
            {/each}
          </select>
        </div>
        <button
          class="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-neutral-600 dark:text-white"
          on:click={loadPoints}
        >
          重新整理
        </button>
      </div>

      {#if canRegister}
        <div class="mt-3 border-t border-gray-100 pt-3 dark:border-neutral-700">
          <p class="mb-2 text-sm font-medium dark:text-white">積分登記</p>
          <div class="flex flex-wrap items-end gap-2">
            <select
              class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
              bind:value={formUserId}
            >
              <option value="">選擇學員</option>
              {#each members as member}
                <option value={member.profile_id}>{member.fullname || member.email}</option>
              {/each}
            </select>
            <select
              class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
              bind:value={formKind}
            >
              <option value="manual">人手登記</option>
              <option value="exercise">練習</option>
              <option value="exam">考試</option>
              <option value="referral">推薦</option>
              <option value="redeem">兌換（負數）</option>
            </select>
            <input
              class="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
              type="number"
              placeholder="分數"
              bind:value={formDelta}
            />
            <input
              class="min-w-[12rem] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
              type="text"
              placeholder="備註（例如：第 3 堂表現 8 分）"
              bind:value={formNote}
            />
            <button
              class="rounded-md bg-primary-700 px-4 py-2 text-sm text-white disabled:opacity-50"
              disabled={saving}
              on:click={registerPoints}
            >
              {saving ? '儲存中…' : '登記'}
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if message}<p class="mb-2 text-sm text-green-700 dark:text-green-400">{message}</p>{/if}
  {#if errorMessage}<p class="mb-2 text-sm text-red-700 dark:text-red-400">{errorMessage}</p>{/if}

  <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-700">
    <table class="min-w-full text-sm">
      <thead class="bg-gray-100 dark:bg-neutral-800">
        <tr>
          {#if !isStudentView}<th class="px-3 py-2 text-left dark:text-white">學員</th>{/if}
          <th class="px-3 py-2 text-left dark:text-white">時間</th>
          <th class="px-3 py-2 text-left dark:text-white">類型</th>
          <th class="px-3 py-2 text-right dark:text-white">分數</th>
          <th class="px-3 py-2 text-left dark:text-white">備註</th>
        </tr>
      </thead>
      <tbody>
        {#if loading}
          <tr><td class="px-3 py-6 text-center text-gray-500" colspan="5">載入中…</td></tr>
        {:else if rows.length === 0}
          <tr><td class="px-3 py-6 text-center text-gray-500" colspan="5">暫時沒有積分紀錄</td></tr>
        {:else}
          {#each rows as row (row.id)}
            <tr class="border-t border-gray-100 dark:border-neutral-700">
              {#if !isStudentView}
                <td class="px-3 py-2 dark:text-white">
                  {row.profile?.fullname || row.profile?.email || row.user_id.slice(0, 8)}
                </td>
              {/if}
              <td class="px-3 py-2 text-gray-600 dark:text-gray-300">{formatDate(row.created_at)}</td>
              <td class="px-3 py-2 text-gray-600 dark:text-gray-300">{kindLabels[row.kind] || row.kind}</td>
              <td class="px-3 py-2 text-right font-medium {row.delta >= 0 ? 'text-green-700' : 'text-red-700'}">
                {row.delta > 0 ? '+' : ''}{row.delta}
              </td>
              <td class="px-3 py-2 text-gray-600 dark:text-gray-300">{row.note}</td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</PageBody>
