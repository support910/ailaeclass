<script lang="ts">
  import { onDestroy } from 'svelte';
  import { snackbar } from '$lib/components/Snackbar/store';
  import { t } from '$lib/utils/functions/translations';
  import {
    ImageUploader,
    ImageUploadNetworkError
  } from '$lib/utils/services/courses/presign';
  import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from '$lib/utils/constants/imageUpload';
  import ImageIcon from 'carbon-icons-svelte/lib/Image.svelte';
  import TrashCanIcon from 'carbon-icons-svelte/lib/TrashCan.svelte';

  type ExamImage = { url: string; key: string; alt?: string };

  export let image: ExamImage | null = null;
  export let onChange: (image: ExamImage | null) => void = () => {};
  export let label = '';

  let fileInput: HTMLInputElement;
  let isUploading = false;
  let uploadProgress = 0;
  let displayedUrl = '';
  let inputUrl = '';
  let refreshAttemptedKey = '';
  let imageLoadFailed = false;
  let localPreviewUrl = '';
  let localPreviewAlt = '';
  let previewReader: FileReader | null = null;
  let pendingImage: ExamImage | null = null;
  let effectiveImage: ExamImage | null = null;
  let pendingFile: File | null = null;
  let uploadError = '';

  const imageUploader = new ImageUploader();

  $: {
    if (pendingImage && image?.key === pendingImage.key) {
      pendingImage = null;
    }

    const propUrl = image?.url || '';
    if (!pendingImage && propUrl !== inputUrl) {
      inputUrl = propUrl;
      displayedUrl = propUrl;
      refreshAttemptedKey = '';
      imageLoadFailed = false;
    }
  }

  $: effectiveImage = pendingImage || image;

  function validateFile(file: File): string | null {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return $t('components.exam.image_upload.invalid_type');
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return $t('components.exam.image_upload.too_large');
    }
    return null;
  }

  function clearLocalPreview() {
    if (previewReader?.readyState === FileReader.LOADING) previewReader.abort();
    previewReader = null;
    localPreviewUrl = '';
    localPreviewAlt = '';
  }

  function createLocalPreview(file: File) {
    clearLocalPreview();

    const reader = new FileReader();
    previewReader = reader;
    localPreviewAlt = file.name;
    reader.onload = () => {
      if (previewReader === reader && typeof reader.result === 'string') {
        localPreviewUrl = reader.result;
      }
    };
    reader.onerror = () => {
      if (previewReader === reader) clearLocalPreview();
    };
    reader.readAsDataURL(file);
  }

  async function uploadImage(file: File, keepPreview = false) {
    const error = validateFile(file);
    if (error) {
      snackbar.error(error);
      return;
    }

    if (!keepPreview) createLocalPreview(file);
    pendingFile = file;
    uploadError = '';
    imageLoadFailed = false;
    isUploading = true;
    uploadProgress = 10;

    try {
      const result = await imageUploader.uploadDirect(file);
      uploadProgress = 100;

      if (!result.url || !result.fileKey) {
        throw new Error('Uploaded image response is missing URL or key');
      }

      const uploadedImage = {
        url: result.url,
        key: result.fileKey,
        alt: file.name
      };

      pendingImage = uploadedImage;
      pendingFile = null;
      uploadError = '';
      displayedUrl = uploadedImage.url;
      inputUrl = uploadedImage.url;
      onChange(uploadedImage);

      // Keep the data URL visible for this editing session. A newly uploaded
      // private object can take a moment before its signed URL is readable.
      snackbar.success($t('components.exam.image_upload.success'));
    } catch (err) {
      console.error('Image upload error:', err);
      uploadError =
        err instanceof ImageUploadNetworkError
          ? $t('components.exam.image_upload.network_error')
          : err instanceof Error && err.message
            ? err.message
            : $t('components.exam.image_upload.error');
      snackbar.error(uploadError);
    } finally {
      isUploading = false;
      if (fileInput) fileInput.value = '';
    }
  }

  async function retryUpload() {
    if (!pendingFile || isUploading) return;
    await uploadImage(pendingFile, true);
  }

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    await uploadImage(file);
  }

  function handleRemove() {
    pendingImage = null;
    pendingFile = null;
    uploadError = '';
    displayedUrl = '';
    inputUrl = '';
    imageLoadFailed = false;
    clearLocalPreview();
    onChange(null);
  }

  async function handleImageLoadError() {
    if (localPreviewUrl) {
      clearLocalPreview();
      imageLoadFailed = true;
      return;
    }

    const key = effectiveImage?.key || '';

    if (!key || refreshAttemptedKey === key) {
      imageLoadFailed = true;
      return;
    }

    refreshAttemptedKey = key;

    try {
      const result = await imageUploader.getDownloadPresignedUrl([key]);
      const refreshedUrl = result?.urls?.[key];
      if (!refreshedUrl) throw new Error('Missing refreshed image URL');
      displayedUrl = refreshedUrl;
      imageLoadFailed = false;
    } catch (error) {
      console.error('Image URL refresh error:', error);
      imageLoadFailed = true;
    }
  }

  onDestroy(clearLocalPreview);
</script>

<div class="mt-2">
  {#if label}
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
  {/if}

  {#if (effectiveImage?.url || localPreviewUrl) && !imageLoadFailed}
    <div class="relative inline-block group">
      <img
        src={localPreviewUrl || displayedUrl || effectiveImage?.url}
        alt={localPreviewAlt || effectiveImage?.alt || $t('components.exam.question_image_alt')}
        class="min-h-24 min-w-24 max-h-48 rounded-md border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-neutral-900 object-contain"
        on:error={handleImageLoadError}
      />
      {#if isUploading}
        <span class="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-center text-xs text-white">
          {$t('components.exam.image_upload.uploading', { progress: uploadProgress })}
        </span>
      {:else}
        <button
          type="button"
          on:click={handleRemove}
          class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
          title={$t('components.exam.image_upload.remove')}
        >
          <TrashCanIcon size={14} />
        </button>
      {/if}
    </div>
    {#if uploadError && pendingFile}
      <div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-red-700 dark:text-red-300">
        <span>{uploadError}</span>
        <button type="button" class="font-semibold underline" on:click={retryUpload}>
          {$t('components.exam.image_upload.retry')}
        </button>
      </div>
    {/if}
  {:else if effectiveImage?.url && imageLoadFailed}
    <div class="flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
      <span>{$t('components.exam.image_upload.load_error')}</span>
      <button type="button" class="font-semibold underline" on:click={handleRemove}>
        {$t('components.exam.image_upload.remove')}
      </button>
    </div>
  {:else}
    <label
      aria-disabled={isUploading}
      class="relative flex w-fit cursor-pointer items-center gap-2 overflow-hidden px-3 py-2 rounded-md border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      <ImageIcon size={16} />
      <span>
        {isUploading
          ? $t('components.exam.image_upload.uploading', { progress: uploadProgress })
          : $t('components.exam.image_upload.add')}
      </span>
      <input
        bind:this={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        on:change={handleFileSelect}
        disabled={isUploading}
        aria-label={label || $t('components.exam.image_upload.add')}
        class="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </label>
  {/if}
</div>
