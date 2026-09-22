<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Help, Launch, Renew, Close, ChevronLeft, ChevronRight, Send, Undo } from 'carbon-icons-svelte';
  import { locale, t } from '$lib/utils/functions/translations';
  import { getAccessToken } from '$lib/utils/functions/supabase';
  import { sharingCopy } from './sharingCopy';
  export let orgId = '';
  export let staff = false;
  $: copy = sharingCopy($locale || 'zh-TW');
  let courses: any[] = [], rows: any[] = [];
  let courseId = '', filter = '', title = '', flightType = 'simulator', scenario = 'figure_eight';
  let resultUrl = '', videoUrl = '', note = '', occurredAt = '', requestId = '';
  let consent = false, loading = false, sending = false, success = false, more = false, help = false, mounted = false;
  let error = '', selected: any = null, withdrawId = '', context = '', offset = 0;
  let generation = 0;
  let withdrawDialog: HTMLDialogElement;
  $: if(withdrawDialog) { if(withdrawId && !withdrawDialog.open) withdrawDialog.showModal(); else if(!withdrawId && withdrawDialog.open) withdrawDialog.close(); }
  const controller = new AbortController();
  const scenarios = ['figure_eight','hover','route','landing'];
  const message = (code: string) => (copy as any)[code] || copy.error;
  const formatTime = (value: string) => new Intl.DateTimeFormat($locale || 'zh-TW',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  async function api(path = '', options: RequestInit = {}) {
    const token = await getAccessToken();
    if (!token) throw new Error('unauthenticated');
    const response = await fetch(`/api/simulator/submissions${path}`,{...options,signal:controller.signal,
      headers:{Authorization:`Bearer ${token}`,...(options.body ? {'Content-Type':'application/json'} : {})}});
    const data = await response.json();
    if(!response.ok) throw new Error(data.code || 'error');
    return data;
  }
  function query() { return `?orgId=${encodeURIComponent(orgId)}&view=${staff ? 'staff' : 'mine'}&offset=${offset}${filter ? `&courseId=${encodeURIComponent(filter)}` : ''}`; }
  async function load(reset = false) {
    if (!orgId) return;
    const run = ++generation;
    loading = true; error = ''; selected = null;
    try {
      if(reset) {
        courses = []; rows = []; selected = null; offset = 0; filter = ''; courseId = '';
        const data = await api(`${query()}&options=1`);
        if(run !== generation) return;
        courses = data.courses; courseId = courses[0]?.id || '';
      }
      const data = await api(query());
      if(run === generation) { rows = data.submissions; more = data.more; }
    } catch(e) { if(run === generation && !controller.signal.aborted) { rows = []; error = (e as Error).message; } }
    finally { if(run === generation) loading = false; }
  }
  async function submit() {
    if(sending) return;
    sending = true; error = ''; success = false;
    try {
      if(!occurredAt || !Number.isFinite(Date.parse(occurredAt))) throw new Error('invalid_time');
      requestId ||= crypto.randomUUID();
      await api('',{method:'POST',body:JSON.stringify({courseId,requestId,title,flightType,scenario,
        occurredAt:new Date(occurredAt).toISOString(),resultUrl,videoUrl:flightType === 'real' ? videoUrl : '',note,consent})});
      success = true; title = ''; resultUrl = ''; videoUrl = ''; note = ''; consent = false; requestId = ''; offset = 0;
      await load();
    } catch(e) { if(!controller.signal.aborted) error = (e as Error).message; }
    finally { sending = false; }
  }
  async function view(id: string) {
    error = ''; selected = null;
    const run = ++generation;
    try { const data = await api(`/${id}`); if(run === generation) selected = data.submission; }
    catch(e) { if(run === generation && !controller.signal.aborted) error = (e as Error).message; }
  }
  async function withdraw() {
    if(sending || !withdrawId) return;
    sending = true; error = '';
    try { await api(`/${withdrawId}`,{method:'DELETE'}); withdrawId = ''; selected = null; success = false; await load(); }
    catch(e) { if(!controller.signal.aborted) error = (e as Error).message; }
    finally { sending = false; }
  }
  function page(delta: number) { offset = Math.max(0,offset+delta); selected = null; load(); }
  $: if(mounted && orgId && context !== `${orgId}:${staff}`) { context = `${orgId}:${staff}`; load(true); }
  onMount(() => { mounted = true; const now = new Date(); occurredAt = new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16); });
  onDestroy(() => { generation++; controller.abort(); });
</script>

<section class="sharing mx-auto max-w-7xl p-5 md:p-8 dark:text-white">
  <header class="mb-6 flex items-center justify-between gap-4">
    <h1 class="text-xl font-semibold">{staff ? copy.staffTab : copy.studentTab}</h1>
    <button class="icon" type="button" title={copy.help} aria-label={copy.help} aria-expanded={help} on:click={() => help = !help}><Help size={20}/></button>
  </header>
  {#if help}<p class="mb-5 border-l-2 border-teal-600 pl-4 text-sm leading-6">{copy.guide}</p>{/if}
  {#if success}<p role="status" class="mb-4 border-l-4 border-green-600 bg-green-50 p-3 text-sm text-green-900 dark:bg-green-950 dark:text-green-100">{copy.success}</p>{/if}
  {#if error}<p role="alert" class="mb-4 border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">{message(error)}</p>{/if}
  {#if !staff}
    <form on:submit|preventDefault={submit} on:input={() => { requestId = ''; success = false; }}>
      <fieldset disabled={sending || loading || !courses.length} class="grid gap-4 border-b border-gray-200 pb-6 md:grid-cols-2 dark:border-neutral-700">
        <label>{copy.course}<select bind:value={courseId} required>{#each courses as course}<option value={course.id}>{course.title}</option>{/each}</select></label>
        <label>{copy.title}<input bind:value={title} maxlength="120" required/></label>
        <label>{copy.flightType}<select aria-label={copy.flightType} bind:value={flightType}><option value="simulator">{copy.simulator}</option><option value="real">{copy.real}</option></select></label>
        <label>{copy.scenario}<select aria-label={copy.scenario} bind:value={scenario}>{#each scenarios as item}<option value={item}>{$t(`simulator.scenarios.${item}.title`)}</option>{/each}</select></label>
        <label>{copy.time}<input type="datetime-local" bind:value={occurredAt} required/></label>
        <label>{copy.result}<input type="url" bind:value={resultUrl} maxlength="2048" required={flightType === 'simulator' || !videoUrl} placeholder="https://drive.google.com/file/d/…/view"/></label>
        {#if flightType === 'real'}<label class="md:col-span-2">{copy.video}<input type="url" bind:value={videoUrl} maxlength="2048" placeholder="https://drive.google.com/file/d/…/view"/></label>{/if}
        <label class="md:col-span-2">{copy.note}<textarea bind:value={note} maxlength="2000" rows="3"></textarea></label>
        <label class="flex items-start gap-2 md:col-span-2"><input class="mt-1 shrink-0" type="checkbox" bind:checked={consent} required/><span>{copy.consent}</span></label>
        <button class="action justify-self-start bg-teal-700 text-white" type="submit" disabled={!consent || sending}><Send size={18}/>{sending ? copy.loading : copy.submit}</button>
      </fieldset>
    </form>
  {/if}
  {#if !loading && !courses.length && !error}<p class="py-4 text-sm text-gray-500">{copy.noCourses}</p>{/if}
  <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
    <h2 class="text-base font-semibold">{staff ? copy.staffTab : copy.history}</h2>
    <div class="flex min-w-0 items-center gap-2">
      <select aria-label={copy.course} class="max-w-[16rem]" bind:value={filter} disabled={loading} on:change={() => {offset = 0; selected = null; load();}}><option value="">{copy.all}</option>{#each courses as c}<option value={c.id}>{c.title}</option>{/each}</select>
      <button class="icon" title={copy.refresh} aria-label={copy.refresh} disabled={loading} on:click={() => load()}><Renew size={20}/></button>
    </div>
  </div>
  {#if loading}<p role="status" class="py-8 text-sm">{copy.loading}</p>{:else if !rows.length && !error}<p class="py-8 text-sm text-gray-500">{copy.empty}</p>{/if}
  <ul class="mt-3 divide-y divide-gray-200 dark:divide-neutral-700">
    {#each rows as row}
      <li class="flex flex-wrap items-center justify-between gap-3 py-4">
        <div class="min-w-0 flex-1"><h3 class="break-words text-sm font-medium">{row.title}</h3><p class="break-words text-sm text-gray-600 dark:text-gray-300">{row.course_title}{#if staff} · {row.student_name}{/if}</p><p class="text-xs text-gray-500">{formatTime(row.created_at)} · {row.status === 'withdrawn' ? copy.withdrawn : copy.submitted} · {copy.ungraded}</p></div>
        <button class="action border border-gray-300" disabled={loading || sending} on:click={() => view(row.id)}>{copy.view}</button>
        {#if !staff && row.status === 'submitted'}<button class="icon" title={copy.withdraw} aria-label={`${copy.withdraw} ${row.title}`} on:click={() => withdrawId = row.id}><Undo size={20}/></button>{/if}
      </li>
    {/each}
  </ul>
  <div class="my-4 flex items-center justify-end gap-3"><button class="icon" title={copy.previous} aria-label={copy.previous} disabled={offset === 0 || loading} on:click={() => page(-20)}><ChevronLeft size={20}/></button><span class="text-sm">{Math.floor(offset/20)+1}</span><button class="icon" title={copy.next} aria-label={copy.next} disabled={!more || loading} on:click={() => page(20)}><ChevronRight size={20}/></button></div>
  {#if selected}
    <section class="mt-5 border-t border-gray-200 pt-5 dark:border-neutral-700" aria-label={copy.detail}>
      <div class="flex items-center justify-between gap-4"><h2 class="text-lg font-semibold">{copy.detail}</h2><button class="icon" title={copy.close} aria-label={copy.close} on:click={() => selected = null}><Close size={20}/></button></div>
      <h3 class="my-3 break-words font-medium">{selected.title}</h3>
      <dl class="grid gap-3 text-sm md:grid-cols-2"><div><dt>{copy.student}</dt><dd>{selected.student_name}</dd></div><div><dt>{copy.course}</dt><dd>{selected.course_title}</dd></div><div><dt>{copy.flightType}</dt><dd>{selected.flight_type === 'real' ? copy.real : copy.simulator}</dd></div><div><dt>{copy.time}</dt><dd>{formatTime(selected.occurred_at)}</dd></div><div><dt>{copy.scenario}</dt><dd>{$t(`simulator.scenarios.${selected.scenario}.title`)}</dd></div><div><dt>{copy.status}</dt><dd>{selected.status === 'withdrawn' ? copy.withdrawn : copy.submitted} · {copy.ungraded}</dd></div></dl>
      {#each [['result_url',copy.result],['video_url',copy.video]] as [field,label]}
        {#if selected[field]}<div class="mt-4"><p class="mb-1 text-sm font-medium">{label}</p><a class="flex items-start gap-2 break-all text-sm text-teal-700 underline dark:text-teal-300" href={selected[field]} target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer"><Launch size={18} class="shrink-0"/><span>{selected[field]}</span></a></div>{/if}
      {/each}
      {#if selected.note}<p class="mt-4 whitespace-pre-wrap break-words text-sm">{selected.note}</p>{/if}
    </section>
  {/if}
  <dialog bind:this={withdrawDialog} aria-labelledby="withdraw-title" class="w-[calc(100%-2rem)] max-w-md rounded-md bg-white p-5 text-gray-900 shadow-lg dark:bg-neutral-900 dark:text-white" on:cancel={(event) => { if(sending) event.preventDefault(); else withdrawId = ''; }} on:close={() => withdrawId = ''}><h2 id="withdraw-title" class="font-semibold">{copy.confirm}</h2><p class="my-4 text-sm leading-6">{copy.withdrawNotice}</p>{#if error}<p class="mb-3 text-sm text-red-700">{message(error)}</p>{/if}<div class="flex flex-wrap justify-end gap-3"><button class="action border border-gray-300" disabled={sending} on:click={() => withdrawId = ''}>{copy.cancel}</button><button class="action bg-red-700 text-white" disabled={sending} on:click={withdraw}>{copy.confirm}</button></div></dialog>
</section>

<style>
  label { display:block; min-width:0; font-size:14px; }
  input:not([type=checkbox]),select,textarea { display:block; width:100%; min-width:0; margin-top:6px; border:1px solid #9ca3af; border-radius:4px; padding:9px 10px; background:transparent; font-size:14px; color:inherit; }
  select { text-overflow:ellipsis; }
  .icon { display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; width:36px; height:36px; border-radius:4px; }
  .icon:hover { background:#d1fae5; color:#115e59; }
  .action { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:36px; padding:8px 14px; border-radius:4px; font-size:14px; }
  button:disabled,fieldset:disabled { opacity:.55; }
  button:disabled { cursor:not-allowed; }
  dt { color:#6b7280; } dd { overflow-wrap:anywhere; margin-top:3px; }
  dialog::backdrop { background:rgba(0,0,0,.4); }
</style>
