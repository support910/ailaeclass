<script lang="ts">
  import { currentOrg } from '$lib/utils/store/org';
  import { getAccessToken } from '$lib/utils/functions/supabase';
  import PageNav from '$lib/components/Page/Nav.svelte';
  import PageBody from '$lib/components/Page/Body.svelte';

  type Req = {
    id: string;
    organization_id: string;
    organization_name?: string;
    district_name?: string;
    scope: string;
    reason?: string;
    status: 'pending' | 'approved' | 'rejected' | 'revoked' | 'expired';
    expires_at?: string | null;
    created_at: string;
    requester_name?: string | null;
  };
  type School = { organization_id: string; name: string; district_id: string; district_name: string };
  type Summary = {
    organization_id: string;
    name: string;
    district: string;
    via: 'hk' | 'request';
    expires_at: string | null;
    students: number;
    points_total: number;
    last_activity: string | null;
    is_own_org: boolean;
  };

  let loading = false;
  let message = '';
  let errorMessage = '';

  let isHkAdmin = false;
  let isSchoolAdmin = false;
  let schools: School[] = [];
  let myRequests: Req[] = [];
  let pendingForMe: Req[] = [];
  let summary: Summary[] = [];

  let formSchool = '';
  let formReason = '';
  let formScope = 'summary';
  let submitting = false;
  let dayById: Record<string, number> = {};

  const statusLabel: Record<string, string> = {
    pending: '待批',
    approved: '生效中',
    rejected: '已拒絕',
    revoked: '已撤銷',
    expired: '已過期'
  };
  const scopeLabel: Record<string, string> = {
    summary: '僅彙總數字',
    partial: '部分欄位',
    all_fields: '全部欄位'
  };

  function formatDate(value?: string | null) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleDateString('zh-HK');
    } catch {
      return value;
    }
  }

  async function loadAll() {
    const orgId = $currentOrg?.id;
    if (!orgId) return;
    loading = true;
    errorMessage = '';
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('請先登入');

      const [distRes, sumRes] = await Promise.all([
        fetch('/api/district', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/district/summary', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const dist = await distRes.json();
      if (!distRes.ok || !dist.success) throw new Error(dist.message || '讀取地區資料失敗');
      isHkAdmin = !!dist.isHkAdmin;
      isSchoolAdmin = !!dist.isSchoolAdmin;
      schools = dist.schools || [];
      myRequests = dist.myRequests || [];
      pendingForMe = dist.pendingForMe || [];
      for (const row of pendingForMe) if (!dayById[row.id]) dayById[row.id] = 30;

      const sum = await sumRes.json();
      summary = sumRes.ok && sum.success ? sum.schools || [] : [];
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : '讀取失敗';
    } finally {
      loading = false;
    }
  }

  async function submitRequest() {
    if (!formSchool) {
      errorMessage = '請先揀學校';
      return;
    }
    submitting = true;
    message = '';
    errorMessage = '';
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/district', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: formSchool, reason: formReason, scope: formScope })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '提交失敗');
      message = json.message || '已提交';
      formSchool = '';
      formReason = '';
      await loadAll();
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : '提交失敗';
    } finally {
      submitting = false;
    }
  }

  async function review(id: string, action: 'approve' | 'reject') {
    message = '';
    errorMessage = '';
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/district/requests', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, days: dayById[id] || 30 })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '審批失敗');
      message = json.message;
      await loadAll();
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : '審批失敗';
    }
  }

  let loadedOrgId = '';
  $: if ($currentOrg?.id && $currentOrg.id !== loadedOrgId) {
    loadedOrgId = $currentOrg.id;
    loadAll();
  }
</script>

<PageNav title="地區資料 / Data access" />

<PageBody width="w-full max-w-5xl">
  {#if message}<p class="mb-2 text-sm text-green-700 dark:text-green-400">{message}</p>{/if}
  {#if errorMessage}<p class="mb-2 text-sm text-red-700 dark:text-red-400">{errorMessage}</p>{/if}

  {#if isHkAdmin}
    <div class="mb-4 rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm dark:border-primary-800 dark:bg-primary-900/20 dark:text-white">
      HK admin：你可以讀取全港所有已分配地區的學校；每次讀取都會寫入審計記錄。
    </div>
  {/if}

  <div class="mb-5 rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
    <p class="mb-2 text-sm font-medium dark:text-white">申請學校資料</p>
    <p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
      地區 admin 需要逐間學校申請；由該校 school admin 批准並設定到期日，過期自動失效。
    </p>
    <div class="flex flex-wrap items-end gap-2">
      <select
        class="min-w-[14rem] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
        bind:value={formSchool}
      >
        <option value="">選擇學校</option>
        {#each schools as school}
          <option value={school.organization_id}>{school.name}{school.district_name ? ` · ${school.district_name}` : ''}</option>
        {/each}
      </select>
      <select
        class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
        bind:value={formScope}
      >
        <option value="summary">僅彙總數字</option>
        <option value="partial">部分欄位</option>
        <option value="all_fields">全部欄位</option>
      </select>
      <input
        class="min-w-[14rem] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
        type="text"
        placeholder="申請原因（例如：區內 STEAM 課程成效統計）"
        bind:value={formReason}
      />
      <button
        class="rounded-md bg-primary-700 px-4 py-2 text-sm text-white disabled:opacity-50"
        disabled={submitting}
        on:click={submitRequest}
      >
        {submitting ? '提交中…' : '提交申請'}
      </button>
    </div>
  </div>

  {#if isSchoolAdmin && pendingForMe.length > 0}
    <div class="mb-5 rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
      <p class="mb-2 text-sm font-medium text-yellow-900 dark:text-yellow-200">待我批准（{pendingForMe.length}）</p>
      {#each pendingForMe as row (row.id)}
        <div class="mb-2 rounded-md border border-yellow-200 bg-white p-3 dark:border-yellow-800 dark:bg-neutral-900">
          <p class="text-sm dark:text-white">
            {row.requester_name || '—'} 申請讀取 <strong>{row.organization_name}</strong> 的資料（{scopeLabel[row.scope] || row.scope}）
          </p>
          {#if row.reason}<p class="mt-1 text-xs text-gray-600 dark:text-gray-300">原因：{row.reason}</p>{/if}
          <div class="mt-2 flex items-center gap-2">
            <input
              class="w-20 rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
              type="number"
              min="1"
              max="365"
              bind:value={dayById[row.id]}
            />
            <span class="text-xs text-gray-500">日</span>
            <button class="rounded-md bg-primary-700 px-3 py-1 text-xs text-white" on:click={() => review(row.id, 'approve')}>
              批准
            </button>
            <button class="rounded-md border border-gray-300 px-3 py-1 text-xs dark:border-neutral-600 dark:text-white" on:click={() => review(row.id, 'reject')}>
              拒絕
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <div class="mb-5 overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-700">
    <p class="border-b border-gray-100 px-4 py-3 text-sm font-medium dark:border-neutral-700 dark:text-white">
      我可以讀取的學校（{summary.length}）
    </p>
    <table class="min-w-full text-sm">
      <thead class="bg-gray-100 dark:bg-neutral-800">
        <tr>
          <th class="px-3 py-2 text-left dark:text-white">學校</th>
          <th class="px-3 py-2 text-left dark:text-white">地區</th>
          <th class="px-3 py-2 text-left dark:text-white">授權</th>
          <th class="px-3 py-2 text-right dark:text-white">學生</th>
          <th class="px-3 py-2 text-right dark:text-white">積分合計</th>
          <th class="px-3 py-2 text-left dark:text-white">到期</th>
        </tr>
      </thead>
      <tbody>
        {#if loading}
          <tr><td class="px-3 py-6 text-center text-gray-500" colspan="6">載入中…</td></tr>
        {:else if summary.length === 0}
          <tr><td class="px-3 py-6 text-center text-gray-500" colspan="6">暫時未有可讀取的學校</td></tr>
        {:else}
          {#each summary as school (school.organization_id)}
            <tr class="border-t border-gray-100 dark:border-neutral-700">
              <td class="px-3 py-2 dark:text-white">{school.name}{#if school.is_own_org}<span class="ml-1 text-xs text-gray-400">（本校）</span>{/if}</td>
              <td class="px-3 py-2 text-gray-600 dark:text-gray-300">{school.district || '—'}</td>
              <td class="px-3 py-2 text-gray-600 dark:text-gray-300">{school.via === 'hk' ? 'HK admin' : '學校批准'}</td>
              <td class="px-3 py-2 text-right dark:text-white">{school.students}</td>
              <td class="px-3 py-2 text-right dark:text-white">{school.points_total}</td>
              <td class="px-3 py-2 text-gray-600 dark:text-gray-300">{formatDate(school.expires_at)}</td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>

  <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-700">
    <p class="border-b border-gray-100 px-4 py-3 text-sm font-medium dark:border-neutral-700 dark:text-white">
      我的申請（{myRequests.length}）
    </p>
    <table class="min-w-full text-sm">
      <thead class="bg-gray-100 dark:bg-neutral-800">
        <tr>
          <th class="px-3 py-2 text-left dark:text-white">學校</th>
          <th class="px-3 py-2 text-left dark:text-white">範圍</th>
          <th class="px-3 py-2 text-left dark:text-white">狀態</th>
          <th class="px-3 py-2 text-left dark:text-white">到期</th>
          <th class="px-3 py-2 text-left dark:text-white">提交時間</th>
        </tr>
      </thead>
      <tbody>
        {#if myRequests.length === 0}
          <tr><td class="px-3 py-6 text-center text-gray-500" colspan="5">未有申請</td></tr>
        {:else}
          {#each myRequests as row (row.id)}
            <tr class="border-t border-gray-100 dark:border-neutral-700">
              <td class="px-3 py-2 dark:text-white">{row.organization_name}</td>
              <td class="px-3 py-2 text-gray-600 dark:text-gray-300">{scopeLabel[row.scope] || row.scope}</td>
              <td class="px-3 py-2">
                <span class="rounded-full px-2 py-0.5 text-xs {row.status === 'approved'
                  ? 'bg-green-100 text-green-800'
                  : row.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-700'}">{statusLabel[row.status] || row.status}</span>
              </td>
              <td class="px-3 py-2 text-gray-600 dark:text-gray-300">{formatDate(row.expires_at)}</td>
              <td class="px-3 py-2 text-gray-600 dark:text-gray-300">{formatDate(row.created_at)}</td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</PageBody>
