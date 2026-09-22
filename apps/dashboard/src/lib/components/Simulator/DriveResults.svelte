<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Help, Download, TrashCan, Launch, Renew, Analytics } from 'carbon-icons-svelte';
  import { locale, t } from '$lib/utils/functions/translations';
  import { getAccessToken } from '$lib/utils/functions/supabase';
  import { driveCopy } from './driveCopy';
  import { extractMedia } from './media';

  $: copy = driveCopy($locale || 'zh-TW');
  let title = '';
  let url = '';
  let flightType = 'simulator';
  let videoUrl = '';
  let scenario = 'figure_eight';
  let consent = false;
  let help = false;
  let busy = '';
  let errorCode = '';
  let historyError = '';
  let selected: any = null;
  let history: any[] = [];
  let media: Blob | null = null;
  let mediaUrl = '';
  let recording: Blob | null = null;
  let recordingUrl = '';
  let frames: { at: number; dataUrl: string }[] = [];
  let duration = 0;
  let extracted = 0;
  let more = false;
  let deleteId = '';
  let disposed = false;
  const controller = new AbortController();
  const scenarios = ['figure_eight', 'hover', 'route', 'landing'];
  const message = (code: string) => copy[code as keyof typeof copy] || copy.analysis_failed;

  async function api(path = '', options: RequestInit = {}) {
    const token = await getAccessToken();
    if (!token) throw new Error('unauthenticated');
    const res = await fetch(`/api/simulator/reviews${path}`, {
      ...options, signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.code || 'analysis_failed');
    }
    return res;
  }

  async function loadHistory(append = false) {
    historyError = '';
    try {
      const result = await (await api(`?offset=${append ? history.length : 0}`)).json();
      history = append ? [...history, ...result.reviews] : result.reviews;
      more = result.reviews.length === 20;
    } catch (error) { historyError = (error as Error).message; }
  }

  function clearMedia() {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    recordingUrl = ''; recording = null;
    mediaUrl = ''; media = null; frames = []; duration = 0;
  }

  async function importFile() {
    if (busy) return;
    busy = 'importing'; errorCode = ''; selected = null; clearMedia();
    try {
      const response = await api('', { method: 'POST', body: JSON.stringify({ title, url, scenario, consent, flightType, videoUrl: flightType === 'real' ? videoUrl : '' }) });
      if (response.headers.get('content-type')?.includes('application/json')) {
        const result = await response.json();
        selected = { id: result.id, title, scenario, flight_type: flightType, source_url: url, source_kind: 'data', status: 'imported', data_summary: result.summary };
      } else if (response.headers.get('x-review-kind') === 'image_video') {
        const files = await response.formData();
        if (disposed) return;
        const screenshot = files.get('image'); const video = files.get('video');
        if (!(screenshot instanceof Blob) || !(video instanceof Blob)) throw new Error('download_failed');
        media = screenshot; recording = video;
        mediaUrl = URL.createObjectURL(media); recordingUrl = URL.createObjectURL(recording);
        selected = { id: response.headers.get('x-review-id'), title, scenario, flight_type: flightType, source_url: url, video_source_url: videoUrl, source_kind: 'image_video', status: 'imported' };
      } else {
        media = await response.blob();
        if (disposed) return;
        mediaUrl = URL.createObjectURL(media);
        selected = { id: response.headers.get('x-review-id'), title, scenario, flight_type: flightType, source_url: url, source_kind: response.headers.get('x-review-kind'), status: 'imported' };
      }
      await loadHistory();
    } catch (error) { errorCode = (error as Error).message; }
    finally { busy = ''; }
  }

  async function analyze() {
    if (!selected || busy) return;
    errorCode = ''; busy = 'analyzing';
    try {
      if (selected.source_kind !== 'data') {
        if (!media) throw new Error('reloadMedia');
        if (!frames.length) {
          busy = 'extracting'; extracted = 0;
          if (selected.source_kind === 'image_video') {
            if (!recording) throw new Error('reloadMedia');
            const screenshot = await extractMedia(media, 'image', () => {});
            const output = await extractMedia(recording, 'video', (n) => { extracted = n; });
            frames = [...screenshot.frames, ...output.frames]; duration = output.duration;
          } else {
            const output = await extractMedia(media, selected.source_kind, (n) => { extracted = n; });
            frames = output.frames; duration = output.duration;
          }
        }
      }
      if (disposed) return;
      busy = 'analyzing';
      const output = await (await api(`/${selected.id}/analyze`, { method: 'POST', body: JSON.stringify({ locale: $locale, frames, duration }) })).json();
      selected = output.review;
      await loadHistory();
    } catch (error) { errorCode = (error as Error).message; }
    finally { busy = ''; }
  }

  async function openReview(id: string) {
    busy = 'importing'; errorCode = '';
    try {
      const output = await (await api(`/${id}`)).json();
      clearMedia(); selected = output.review;
      title = selected.title; url = selected.source_url; scenario = selected.scenario;
      flightType = selected.flight_type || 'simulator'; videoUrl = selected.video_source_url || '';
    } catch (error) { errorCode = (error as Error).message; }
    finally { busy = ''; }
  }

  async function removeReview() {
    busy = 'importing'; errorCode = '';
    try {
      await api(`/${deleteId}`, { method: 'DELETE' });
      if (selected?.id === deleteId) { selected = null; clearMedia(); }
      deleteId = ''; await loadHistory();
    } catch (error) { errorCode = (error as Error).message; }
    finally { busy = ''; }
  }

  function downloadReport() {
    const blob = new Blob([JSON.stringify({ title: selected.title, scenario: selected.scenario, flightType: selected.flight_type,
      data: selected.data_summary, report: selected.report }, null, 2)], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = objectUrl;
    anchor.download = `simulator-review-${selected.id}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  onMount(() => { loadHistory(); });
  onDestroy(() => { disposed = true; controller.abort(); clearMedia(); });
</script>

<section class="drive-results mx-auto max-w-7xl px-5 py-6 text-gray-900 dark:text-neutral-100" aria-busy={!!busy}>
  <header class="flex items-start justify-between gap-4 border-b border-gray-200 pb-5 dark:border-neutral-800">
    <div><h1 class="text-2xl font-semibold">{copy.flightTitle}</h1><p class="mt-2 text-sm text-gray-600 dark:text-neutral-300">{copy.subtitle}</p></div>
    <button type="button" class="icon-button" on:click={() => help = !help} aria-label={copy.help} title={copy.help} aria-expanded={help}><Help size={24} /></button>
  </header>
  {#if help}
    <aside class="mt-4 border-l-4 border-teal-600 bg-gray-50 p-4 text-sm dark:bg-neutral-900">
      <h2 class="font-semibold">{copy.help}</h2>
      <ol class="mt-2 list-decimal space-y-2 pl-5"><li>{copy.guide1}</li><li>{copy.guide2}</li><li>{copy.guide3}</li><li>{copy.guide4}</li></ol>
      <a class="mt-3 inline-flex items-center gap-2 text-teal-700 underline dark:text-teal-300" href="/downloads/simulator-results-template.csv" download><Download size={16} />{copy.template}</a>
    </aside>
  {/if}
  <form class="grid gap-4 border-b border-gray-200 py-5 dark:border-neutral-800 sm:grid-cols-2" on:submit|preventDefault={importFile}>
    <fieldset class="sm:col-span-2"><legend class="mb-2 text-sm">{copy.flightType}</legend><div class="inline-flex border border-gray-400 rounded" role="group" aria-label={copy.flightType}>
      <button type="button" class="mode-button" class:active={flightType === 'simulator'} aria-pressed={flightType === 'simulator'} disabled={!!busy} on:click={() => flightType = 'simulator'}>{copy.simulatorMode}</button>
      <button type="button" class="mode-button" class:active={flightType === 'real'} aria-pressed={flightType === 'real'} disabled={!!busy} on:click={() => flightType = 'real'}>{copy.realMode}</button>
    </div></fieldset>
    <label><span>{copy.name}</span><input bind:value={title} required maxlength="120" disabled={!!busy} /></label>
    <label><span>{copy.scenario}</span><select bind:value={scenario} disabled={!!busy}>{#each scenarios as item}<option value={item}>{$t(`simulator.scenarios.${item}.title`)}</option>{/each}</select></label>
    <label class="sm:col-span-2"><span>{copy.link}</span><input type="url" bind:value={url} placeholder="https://drive.google.com/file/d/…/view" required maxlength="2048" disabled={!!busy} /></label>
    <p class="text-sm text-gray-600 dark:text-neutral-300 sm:col-span-2">{flightType === 'real' ? copy.pairHelp : copy.screenshotHelp}</p>
    {#if flightType === 'real'}<label class="sm:col-span-2"><span>{copy.videoLink}</span><input type="url" bind:value={videoUrl} placeholder="https://drive.google.com/file/d/…/view" maxlength="2048" disabled={!!busy} /></label>{/if}
    <p class="text-xs leading-6 text-gray-500 dark:text-neutral-400 sm:col-span-2">{copy.formats}</p>
    <label class="flex items-start gap-3 text-sm sm:col-span-2"><input class="mt-1 shrink-0" type="checkbox" bind:checked={consent} required disabled={!!busy} /><span>{copy.consent}</span></label>
    <div class="flex flex-wrap items-center gap-4 sm:col-span-2">
      <button type="submit" class="primary" disabled={!!busy || !consent}><Launch size={18} />{copy.importFile}</button>
      <a class="inline-flex items-center gap-2 text-sm text-teal-700 underline dark:text-teal-300" href="/downloads/simulator-results-template.csv" download><Download size={16} />{copy.template}</a>
    </div>
  </form>
  {#if busy}<p class="my-4 text-sm text-teal-700 dark:text-teal-300" role="status">{message(busy)}{busy === 'extracting' ? ` ${extracted}/12` : ''}</p>{/if}
  {#if errorCode}<p class="my-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200" role="alert">{message(errorCode)}</p>{/if}

  {#if selected}
    <section class="border-b border-gray-200 py-5 dark:border-neutral-800">
      <div class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-lg font-semibold">{selected.title}</h2><span class="text-sm">{message(selected.status)}</span></div>
      <div class="mt-3 flex flex-wrap gap-4 text-sm">
        <a class="inline-flex items-center gap-1 text-teal-700 underline dark:text-teal-300" href={selected.source_url} target="_blank" rel="noopener noreferrer"><Launch size={16} />{selected.source_kind === 'image_video' ? copy.screenshot : copy.source}</a>
        {#if selected.video_source_url}<a class="inline-flex items-center gap-1 text-teal-700 underline dark:text-teal-300" href={selected.video_source_url} target="_blank" rel="noopener noreferrer"><Launch size={16} />{copy.recording}</a>{/if}
      </div>
      {#if mediaUrl && selected.source_kind === 'video'}<video class="mt-4 max-h-[400px] w-full bg-black" src={mediaUrl} controls aria-label={copy.preview}><track kind="captions" /></video>{/if}
      {#if mediaUrl && ['image', 'image_video'].includes(selected.source_kind)}<h3 class="mt-4 text-sm font-medium">{copy.screenshot}</h3><img class="mt-2 max-h-[400px] max-w-full object-contain" src={mediaUrl} alt={copy.preview} />{/if}
      {#if recordingUrl}<h3 class="mt-4 text-sm font-medium">{copy.recording}</h3><video class="mt-2 max-h-[400px] w-full bg-black" src={recordingUrl} controls aria-label={copy.recording}><track kind="captions" /></video>{/if}
      {#if selected.data_summary}
        <h3 class="mt-5 font-semibold">{copy.numeric}</h3>
        <div class="mt-3 flex flex-wrap gap-4 text-sm"><span class="text-emerald-700 dark:text-emerald-300">{copy.good}: {selected.data_summary.good}</span><span class="text-amber-700 dark:text-amber-300">{copy.improve}: {selected.data_summary.improve}</span><span>{copy.unknown}: {selected.data_summary.unknown}</span><span>{copy.invalidRows}: {selected.data_summary.invalidRows}</span></div>
        <div class="mt-3 overflow-x-auto"><table class="w-full min-w-[640px] text-left text-sm"><thead><tr>{#each [copy.metric, copy.value, copy.target, copy.deviation, copy.status] as label}<th>{label}</th>{/each}</tr></thead><tbody>
          {#each selected.data_summary.metrics as item}<tr><td>{item.name}</td><td>{item.value} {item.unit}</td><td>{item.direction === 'lower' ? '≤' : item.direction === 'higher' ? '≥' : item.direction === 'equal' ? '=' : ''} {item.target ?? '—'} {item.unit}</td><td>{item.deviation === null ? '—' : Number(item.deviation.toPrecision(6))}</td><td><span class:good={item.status === 'good'} class:improve={item.status === 'improve'}>{message(item.status)}</span></td></tr>{/each}
        </tbody></table></div>
        {#if selected.data_summary.issues.length}<details class="mt-3 text-sm"><summary>{copy.warnings} ({selected.data_summary.issues.length})</summary><ul class="mt-2 list-disc pl-5">{#each selected.data_summary.issues as issue}<li>#{issue.row}: {message(issue.code)}</li>{/each}</ul></details>{/if}
      {/if}
      {#if frames.length}<div class="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">{#each frames as frame,i}<figure><img class="aspect-video w-full object-contain bg-black" src={frame.dataUrl} alt={`${copy.frame} ${i+1}`} /><figcaption class="mt-1 text-xs">#{i+1} · {selected.source_kind === 'image' || (selected.source_kind === 'image_video' && i === 0) ? copy.screenshot : `${frame.at.toFixed(1)}s`}</figcaption></figure>{/each}</div>{/if}
      {#if selected.report}
        <div class="mt-6 flex flex-wrap items-center justify-between gap-3"><h3 class="text-lg font-semibold">{copy.ai}</h3><span class="text-sm text-emerald-700 dark:text-emerald-300" role="status">{copy.saved}</span></div>
        <p class="mt-3 whitespace-pre-line leading-7">{selected.report.summary}</p>
        {#if selected.report.crossCheck}<div class="mt-4 border-l-4 border-teal-600 bg-gray-50 p-4 dark:bg-neutral-900"><h4 class="font-semibold">{copy.crossCheck} · {message(selected.report.crossCheck.status)}</h4><p class="mt-2 text-sm leading-6">{selected.report.crossCheck.detail}</p></div>{/if}
        <div class="mt-4 divide-y divide-gray-200 dark:divide-neutral-800">{#each selected.report.findings as finding}<article class="py-4"><span class="text-sm font-semibold" class:good={finding.status === 'good'} class:improve={finding.status === 'improve'}>{message(finding.status)}</span><p class="mt-1 font-medium">{finding.observation}</p><p class="mt-2 text-sm leading-6"><strong>{copy.evidence}:</strong> {finding.evidence}{finding.frame ? ` (${copy.frame} ${finding.frame})` : ''}</p><p class="mt-1 text-sm leading-6"><strong>{copy.advice}:</strong> {finding.advice}</p></article>{/each}</div>
        {#if selected.report.limitations.length}<h4 class="mt-4 font-semibold">{copy.limitations}</h4><ul class="mt-2 list-disc space-y-1 pl-5 text-sm">{#each selected.report.limitations as item}<li>{item}</li>{/each}</ul>{/if}
        <button type="button" class="secondary mt-4" on:click={downloadReport}><Download size={18} />{copy.download}</button>
      {:else if selected.source_kind === 'data' || media}
        <button type="button" class="primary mt-4" disabled={!!busy || selected.attempts >= 3} on:click={analyze}><Analytics size={18} />{copy.analyze}</button>
      {:else}<p class="mt-4 text-sm">{copy.reloadMedia}</p>{/if}
      <p class="mt-4 text-xs leading-6 text-gray-600 dark:text-neutral-300">{copy.reference}</p>
    </section>
  {/if}

  <section class="py-5">
    <div class="flex items-center justify-between"><h2 class="text-lg font-semibold">{copy.history}</h2><button class="icon-button" type="button" title={copy.retry} aria-label={copy.retry} on:click={() => loadHistory()} disabled={!!busy}><Renew size={20} /></button></div>
    {#if historyError}<p class="mt-3 text-sm text-amber-700 dark:text-amber-300" role="alert">{message(historyError)}</p>{:else if !history.length}<p class="py-8 text-sm text-gray-500">{copy.empty}</p>{/if}
    <ul class="mt-3 divide-y divide-gray-200 dark:divide-neutral-800">{#each history as item}<li class="flex flex-wrap items-center gap-3 py-3"><div class="min-w-0 flex-1"><p class="break-words font-medium">{item.title}</p><p class="mt-1 text-xs text-gray-500">{new Date(item.created_at).toLocaleString($locale || 'zh-TW')} · {message(item.status)}</p></div><button class="secondary" type="button" disabled={!!busy} on:click={() => openReview(item.id)}>{copy.open}</button><button class="icon-button" type="button" title={copy.remove} aria-label={`${copy.remove}: ${item.title}`} disabled={!!busy} on:click={() => deleteId = item.id}><TrashCan size={20} /></button></li>{/each}</ul>
    {#if more}<button type="button" class="secondary mt-4" disabled={!!busy} on:click={() => loadHistory(true)}>{copy.more}</button>{/if}
    {#if deleteId}<div class="mt-4 border border-red-200 p-4" role="alert"><p class="text-sm">{copy.confirmDelete}</p><div class="mt-3 flex gap-3"><button class="secondary" disabled={!!busy} on:click={removeReview}>{copy.remove}</button><button class="secondary" disabled={!!busy} on:click={() => deleteId = ''}>{copy.cancel}</button></div></div>{/if}
    <p class="mt-5 text-xs leading-6 text-gray-500 dark:text-neutral-400">{copy.privacy}</p>
  </section>
</section>

<style>
  .drive-results { overflow-wrap: anywhere; }
  label > span:first-child { font-size: 0.875rem; }
  input:not([type='checkbox']), select { display: block; width: 100%; margin-top: 0.4rem; padding: 0.65rem; border: 1px solid #9ca3af; border-radius: 4px; background: transparent; color: inherit; font-size: 0.875rem; }
  .primary, .secondary { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.65rem 1rem; min-height: 42px; border: 1px solid #9ca3af; border-radius: 4px; font-size: 0.875rem; }
  .primary { background: #0f766e; color: white; border-color: #0f766e; }
  .mode-button { padding: 0.65rem 1rem; min-height: 42px; font-size: 0.875rem; }
  .mode-button.active { background: #0f766e; color: white; }
  .icon-button { display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; flex-shrink: 0; border-radius: 4px; }
  button:hover:not(:disabled) { filter: brightness(0.92); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  th, td { padding: 0.7rem 0.75rem 0.7rem 0; border-bottom: 1px solid #d1d5db; }
  th { font-weight: 500; }
  .good { color: #047857; } .improve { color: #b45309; }
  :global(.dark) .good { color: #6ee7b7; } :global(.dark) .improve { color: #fcd34d; }
</style>
