<script lang="ts">
  import { onMount } from 'svelte';
  import Modal from '$lib/components/Modal/index.svelte';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { getAccessToken } from '$lib/utils/functions/supabase';
  import { currentOrg } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import { t } from '$lib/utils/functions/translations';
  import CheckmarkOutline from 'carbon-icons-svelte/lib/CheckmarkOutline.svelte';
  import ImageIcon from 'carbon-icons-svelte/lib/Image.svelte';
  import ViewIcon from 'carbon-icons-svelte/lib/View.svelte';

  type FeedbackStatus = 'unread' | 'read' | 'resolved';
  type FeedbackItem = {
    id: string;
    reporter_email: string;
    reporter_name: string;
    issue_location: string;
    description: string;
    occurred_at: string;
    page_url: string;
    page_port: string;
    status: FeedbackStatus;
    created_at: string;
    screenshot_count: number;
  };

  const ADMIN_EMAIL = 'admin@5gnu.com';
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const statusOrder: Record<FeedbackStatus, number> = { unread: 0, read: 1, resolved: 2 };

  let activeTab: 'upload' | 'review' = 'upload';
  let issueLocation = '';
  let description = '';
  let occurredAt = '';
  let pageUrl = '';
  let pagePort = '';
  let screenshots: File[] = [];
  let previewUrls: string[] = [];
  let fileInput: HTMLInputElement;
  let submitting = false;
  let submissionSucceeded = false;
  let loading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'success';
  let feedback: FeedbackItem[] = [];
  let selectedFeedback: FeedbackItem | null = null;
  let detailScreenshotUrls: string[] = [];
  let loadingDetailScreenshots = false;
  let detailScreenshotError = '';

  $: isAdmin = $profile.email?.trim().toLowerCase() === ADMIN_EMAIL;
  $: activeFeedback = feedback
    .filter((item) => item.status !== 'resolved')
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || Date.parse(b.created_at) - Date.parse(a.created_at));
  $: resolvedFeedback = feedback
    .filter((item) => item.status === 'resolved')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  function localDateTimeValue(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }

  function setCurrentPageDetails() {
    if (typeof window === 'undefined') return;
    pageUrl = window.location.href;
    pagePort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
  }

  function imageToDataUrl(image: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error($t('feedback.load_failed')));
      reader.readAsDataURL(image);
    });
  }

  onMount(() => {
    occurredAt = localDateTimeValue();
    setCurrentPageDetails();
  });

  async function chooseScreenshots(event: Event) {
    const files = Array.from((event.currentTarget as HTMLInputElement).files || []);
    message = '';
    if (files.length > 3) {
      showMessage($t('feedback.max_images'), 'error');
      screenshots = [];
      return;
    }
    if (files.some((file) => file.size > MAX_FILE_SIZE)) {
      showMessage($t('feedback.image_too_large'), 'error');
      screenshots = [];
      return;
    }
    screenshots = files;
    try {
      previewUrls = await Promise.all(files.map((file) => imageToDataUrl(file)));
    } catch {
      screenshots = [];
      previewUrls = [];
      showMessage($t('feedback.load_failed'), 'error');
    }
  }

  function removeScreenshot(index: number) {
    screenshots = screenshots.filter((_, itemIndex) => itemIndex !== index);
    previewUrls = previewUrls.filter((_, itemIndex) => itemIndex !== index);
    if (!screenshots.length && fileInput) fileInput.value = '';
  }

  function showMessage(text: string, type: 'success' | 'error') {
    message = text;
    messageType = type;
  }

  async function submitFeedback() {
    submissionSucceeded = false;
    if (!issueLocation.trim() || !description.trim() || !occurredAt || !pageUrl.trim() || !screenshots.length) {
      showMessage($t('feedback.required_error'), 'error');
      return;
    }
    submitting = true;
    message = '';
    try {
      const token = await getAccessToken();
      if (!token) throw new Error($t('feedback.login_required'));
      const body = new FormData();
      body.set('issueLocation', issueLocation.trim());
      body.set('description', description.trim());
      body.set('occurredAt', new Date(occurredAt).toISOString());
      body.set('pageUrl', pageUrl.trim());
      body.set('pagePort', pagePort.trim());
      body.set('orgId', $currentOrg.id || '');
      screenshots.forEach((file) => body.append('screenshots', file));
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || $t('feedback.submit_failed'));
      showMessage($t('feedback.submit_success'), 'success');
      submissionSucceeded = true;
      issueLocation = '';
      description = '';
      occurredAt = localDateTimeValue();
      screenshots = [];
      previewUrls = [];
      if (fileInput) fileInput.value = '';
      setCurrentPageDetails();
      if (isAdmin) await loadFeedback();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : $t('feedback.submit_failed'), 'error');
    } finally {
      submitting = false;
    }
  }

  async function loadFeedback() {
    if (!isAdmin) return;
    loading = true;
    message = '';
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/feedback', { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || $t('feedback.load_failed'));
      feedback = result.feedback || [];
    } catch (error) {
      showMessage(error instanceof Error ? error.message : $t('feedback.load_failed'), 'error');
    } finally {
      loading = false;
    }
  }

  async function selectTab(tab: 'upload' | 'review') {
    activeTab = tab;
    if (tab === 'review') await loadFeedback();
  }

  async function updateStatus(item: FeedbackItem, status: 'read' | 'resolved') {
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, status })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || $t('feedback.update_failed'));
      feedback = feedback.map((entry) => (entry.id === item.id ? { ...entry, status } : entry));
      if (selectedFeedback?.id === item.id) selectedFeedback = { ...selectedFeedback, status };
    } catch (error) {
      showMessage(error instanceof Error ? error.message : $t('feedback.update_failed'), 'error');
    }
  }

  async function openFeedback(item: FeedbackItem) {
    detailScreenshotUrls = [];
    detailScreenshotError = '';
    selectedFeedback = item;
    if (!item.screenshot_count) return;

    loadingDetailScreenshots = true;
    try {
      const token = await getAccessToken();
      if (!token) throw new Error($t('feedback.login_required'));
      const urls: string[] = [];
      for (let index = 0; index < item.screenshot_count; index += 1) {
        const response = await fetch(`/api/feedback/${item.id}/screenshots/${index}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error($t('feedback.load_failed'));
        urls.push(await imageToDataUrl(await response.blob()));
      }
      detailScreenshotUrls = urls;
    } catch (error) {
      detailScreenshotError = error instanceof Error ? error.message : $t('feedback.load_failed');
    } finally {
      loadingDetailScreenshots = false;
    }
  }

  function closeFeedbackDetails() {
    selectedFeedback = null;
    detailScreenshotUrls = [];
    detailScreenshotError = '';
    loadingDetailScreenshots = false;
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }
</script>

<svelte:head><title>{$t('feedback.title')}</title></svelte:head>

<main class="h-[calc(100vh-48px)] overflow-y-auto bg-white px-5 py-6 dark:bg-black md:px-8">
  <div class="mx-auto max-w-5xl">
    <header class="mb-6">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{$t('feedback.title')}</h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-neutral-300">{$t('feedback.subtitle')}</p>
    </header>

    {#if isAdmin}
      <div class="mb-7 inline-flex rounded-md border border-gray-300 bg-gray-50 p-1 dark:border-neutral-600 dark:bg-neutral-900">
        <button
          class="rounded px-5 py-2 text-sm font-medium {activeTab === 'upload' ? 'bg-white text-primary-700 shadow-sm dark:bg-neutral-700 dark:text-white' : 'text-gray-600 dark:text-neutral-300'}"
          on:click={() => selectTab('upload')}
        >{$t('feedback.upload_tab')}</button>
        <button
          class="rounded px-5 py-2 text-sm font-medium {activeTab === 'review' ? 'bg-white text-primary-700 shadow-sm dark:bg-neutral-700 dark:text-white' : 'text-gray-600 dark:text-neutral-300'}"
          on:click={() => selectTab('review')}
        >{$t('feedback.review_tab')}</button>
      </div>
    {/if}

    {#if message}
      <div class="mb-5 rounded-md border px-4 py-3 text-sm {messageType === 'success' ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200' : 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'}">
        {message}
      </div>
    {/if}

    {#if activeTab === 'upload'}
      <form class="max-w-3xl space-y-5" on:submit|preventDefault={submitFeedback}>
        <div>
          <label for="feedback-location" class="mb-2 block text-sm font-medium text-gray-800 dark:text-white">{$t('feedback.location')} *</label>
          <input id="feedback-location" bind:value={issueLocation} maxlength="200" placeholder={$t('feedback.location_placeholder')} class="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-white" />
        </div>

        <div>
          <label for="feedback-description" class="mb-2 block text-sm font-medium text-gray-800 dark:text-white">{$t('feedback.description')} *</label>
          <textarea id="feedback-description" bind:value={description} maxlength="2000" rows="5" placeholder={$t('feedback.description_placeholder')} class="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-white" />
          <p class="mt-1 text-right text-xs text-gray-500">{description.length}/2000</p>
        </div>

        <div class="grid gap-5 md:grid-cols-2">
          <div>
            <label for="feedback-time" class="mb-2 block text-sm font-medium text-gray-800 dark:text-white">{$t('feedback.occurred_at')} *</label>
            <input id="feedback-time" type="datetime-local" bind:value={occurredAt} class="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-white" />
          </div>
          <div>
            <label for="feedback-port" class="mb-2 block text-sm font-medium text-gray-800 dark:text-white">{$t('feedback.port')}</label>
            <input id="feedback-port" bind:value={pagePort} readonly class="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-white" />
          </div>
        </div>

        <div>
          <label for="feedback-url" class="mb-2 block text-sm font-medium text-gray-800 dark:text-white">{$t('feedback.page_url')} *</label>
          <input id="feedback-url" type="url" bind:value={pageUrl} class="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-600 dark:bg-neutral-900 dark:text-white" />
        </div>

        <div>
          <p class="mb-2 text-sm font-medium text-gray-800 dark:text-white">{$t('feedback.screenshots')} *</p>
          <label class="flex min-h-[96px] cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-gray-400 bg-gray-50 px-4 py-5 text-sm text-gray-700 hover:border-primary-600 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200">
            <ImageIcon size={22} />
            <span>{$t('feedback.choose_images')}</span>
            <input bind:this={fileInput} class="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple on:change={chooseScreenshots} />
          </label>
          <p class="mt-2 text-xs text-gray-500 dark:text-neutral-400">{$t('feedback.image_hint')}</p>
          {#if previewUrls.length}
            <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {#each previewUrls as url, index}
                <div class="relative aspect-video overflow-hidden rounded-md border border-gray-200 dark:border-neutral-700">
                  <img src={url} alt={$t('feedback.screenshot_preview')} class="h-full w-full object-contain" />
                  <button type="button" title={$t('feedback.remove_image')} aria-label={$t('feedback.remove_image')} class="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded bg-black/70 text-lg text-white" on:click={() => removeScreenshot(index)}>×</button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="flex flex-wrap items-center gap-3" aria-live="polite">
          <PrimaryButton type="submit" isLoading={submitting} label={$t('feedback.submit')} />
          {#if submissionSucceeded}
            <div class="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
              <CheckmarkOutline size={18} />
              <span>{$t('feedback.submit_success')}</span>
            </div>
          {/if}
        </div>
      </form>
    {:else if isAdmin}
      {#if loading}
        <p class="py-10 text-center text-sm text-gray-500">{$t('feedback.loading')}</p>
      {:else}
        <section>
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{$t('feedback.pending')}</h2>
            <span class="text-sm text-gray-500">{activeFeedback.length}</span>
          </div>
          {#if !activeFeedback.length}
            <p class="border-t border-gray-200 py-8 text-sm text-gray-500 dark:border-neutral-700">{$t('feedback.empty_pending')}</p>
          {:else}
            <div class="space-y-3">
              {#each activeFeedback as item}
                <article class="rounded-md border p-4 {item.status === 'unread' ? 'border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30' : 'border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-900'}">
                  <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="rounded px-2 py-0.5 text-xs font-medium {item.status === 'unread' ? 'bg-amber-200 text-amber-900' : 'bg-gray-200 text-gray-700 dark:bg-neutral-700 dark:text-neutral-200'}">{$t(`feedback.status_${item.status}`)}</span>
                        <span class="truncate text-sm font-semibold text-gray-900 dark:text-white">{item.issue_location}</span>
                      </div>
                      <p class="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-neutral-300">{item.description}</p>
                      <p class="mt-2 text-xs text-gray-500">{item.reporter_name || item.reporter_email} · {formatDate(item.created_at)} · {$t('feedback.port')} {item.page_port || '-'}</p>
                    </div>
                    <div class="flex shrink-0 flex-wrap gap-2">
                      <button class="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-neutral-600 dark:text-white" on:click={() => openFeedback(item)}><ViewIcon size={16} />{$t('feedback.view')}</button>
                      <button disabled={item.status !== 'unread'} class="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-600 dark:text-white" on:click={() => updateStatus(item, 'read')}><CheckmarkOutline size={16} />{$t('feedback.mark_read')}</button>
                      <button class="inline-flex min-h-[36px] items-center gap-1.5 rounded-md bg-primary-700 px-3 py-2 text-sm text-white" on:click={() => updateStatus(item, 'resolved')}><CheckmarkOutline size={16} />{$t('feedback.mark_resolved')}</button>
                    </div>
                  </div>
                </article>
              {/each}
            </div>
          {/if}
        </section>

        <section class="mt-10 border-t border-gray-200 pt-6 dark:border-neutral-700">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{$t('feedback.resolved')}</h2>
            <span class="text-sm text-gray-500">{resolvedFeedback.length}</span>
          </div>
          {#if !resolvedFeedback.length}
            <p class="py-8 text-sm text-gray-500">{$t('feedback.empty_resolved')}</p>
          {:else}
            <div class="space-y-3">
              {#each resolvedFeedback as item}
                <article class="rounded-md border border-gray-200 bg-gray-50 p-4 opacity-80 dark:border-neutral-700 dark:bg-neutral-900">
                  <div class="flex items-center justify-between gap-4">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-semibold text-gray-900 dark:text-white">{item.issue_location}</p>
                      <p class="mt-1 text-xs text-gray-500">{item.reporter_name || item.reporter_email} · {formatDate(item.created_at)}</p>
                    </div>
                    <button class="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-neutral-600 dark:text-white" on:click={() => openFeedback(item)}><ViewIcon size={16} />{$t('feedback.view')}</button>
                  </div>
                </article>
              {/each}
            </div>
          {/if}
        </section>
      {/if}
    {/if}
  </div>
</main>

<Modal open={!!selectedFeedback} onClose={closeFeedbackDetails} modalHeading={$t('feedback.details')} width="w-[92vw]" maxWidth="max-w-3xl">
  {#if selectedFeedback}
    <div class="space-y-5 text-sm text-gray-700 dark:text-neutral-200">
      <div class="grid gap-4 sm:grid-cols-2">
        <div><p class="text-xs text-gray-500">{$t('feedback.reporter')}</p><p class="mt-1 font-medium">{selectedFeedback.reporter_name || '-'}</p><p>{selectedFeedback.reporter_email}</p></div>
        <div><p class="text-xs text-gray-500">{$t('feedback.occurred_at')}</p><p class="mt-1 font-medium">{formatDate(selectedFeedback.occurred_at)}</p></div>
      </div>
      <div><p class="text-xs text-gray-500">{$t('feedback.location')}</p><p class="mt-1 whitespace-pre-wrap font-medium">{selectedFeedback.issue_location}</p></div>
      <div><p class="text-xs text-gray-500">{$t('feedback.description')}</p><p class="mt-1 whitespace-pre-wrap">{selectedFeedback.description}</p></div>
      <div><p class="text-xs text-gray-500">{$t('feedback.page_url')} / {$t('feedback.port')}</p><a href={selectedFeedback.page_url} target="_blank" rel="noreferrer" class="mt-1 block break-all text-primary-700 hover:underline">{selectedFeedback.page_url}</a><p class="mt-1">{selectedFeedback.page_port || '-'}</p></div>
      <div>
        <p class="mb-2 text-xs text-gray-500">{$t('feedback.screenshots')}</p>
        {#if loadingDetailScreenshots}
          <p class="rounded-md bg-gray-50 px-3 py-5 text-center text-sm text-gray-500 dark:bg-neutral-900">{$t('feedback.loading')}</p>
        {:else if detailScreenshotError}
          <p class="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{detailScreenshotError}</p>
        {:else}
          <div class="grid gap-3 sm:grid-cols-2">
            {#each detailScreenshotUrls as screenshot}
              <a href={screenshot} target="_blank" rel="noreferrer" class="block overflow-hidden rounded-md border border-gray-200 bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900"><img src={screenshot} alt={$t('feedback.screenshot_preview')} class="h-auto min-h-[120px] w-full object-contain" /></a>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</Modal>
