<script>
  import FlightSubmissions from '../../../src/lib/components/Simulator/FlightSubmissions.svelte';
  import { locale } from '$lib/utils/functions/translations';
  let role = 'student';
  let language = 'zh-TW';
  $: window.__flightSharingRole = role;
  $: locale.set(language);
</script>
<div class="flex flex-wrap items-center gap-4 border-b border-amber-300 bg-amber-50 p-4 text-sm text-gray-900">
  <strong>本地隔離驗收 · 非正式系統 · 不寫入 Supabase</strong>
  <label>測試身分 <select aria-label="測試身分" bind:value={role}><option value="student">學生甲</option><option value="studentB">學生乙</option><option value="teacher">教師甲（八字課程）</option><option value="teacherB">教師乙（其他課程）</option><option value="admin">管理員</option><option value="outsider">其他機構教師</option></select></label>
  <label>語言 <select aria-label="語言" bind:value={language}>{#each ['zh-TW','zh','en','ms','id','th','hi'] as value}<option>{value}</option>{/each}</select></label>
</div>
{#key role}<FlightSubmissions orgId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" staff={!['student','studentB'].includes(role)}/>{/key}
