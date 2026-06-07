<script lang="ts">
  import { snackbar } from '$lib/components/Snackbar/store';
  import { t } from '$lib/utils/functions/translations';
  import { ImageUploader } from '$lib/utils/services/courses/presign';
  import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from '$lib/utils/constants/imageUpload';
  import ImageIcon from 'carbon-icons-svelte/lib/Image.svelte';
  import TrashCanIcon from 'carbon-icons-svelte/lib/TrashCan.svelte';

  export let image: { url: string; key: string; alt?: string } | null = null;
  export let onChange: (image: { url: string; key: string; alt?: string } | null) => void = () => {};
  export let label = '';

  let fileInput: HTMLInputElement;
  let isUploading = false;
  let uploadProgress = 0;

  const imageUploader = new ImageUploader();

  function validateFile(file: File): string | null {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return 'Only JPEG, PNG, WebP, GIF images are allowed';
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return 'Image must be under 5MB';
    }
    return null;
  }

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      snackbar.error(error);
      return;
    }

    isUploading = true;
    uploadProgress = 0;

    try {
      const { url: presignedUrl, fileKey } = await imageUploader.getPresignedUrl(file);
      uploadProgress = 30;

      await imageUploader.uploadFile({ url: presignedUrl, file });
      uploadProgress = 70;

      const { urls: presignedUrls } = await imageUploader.getDownloadPresignedUrl([fileKey]);
      uploadProgress = 100;

      const url = presignedUrls?.[fileKey];
      if (!url) throw new Error('Presigned download URL missing for uploaded file');

      onChange({
        url,
        key: fileKey,
        alt: file.name
      });

      snackbar.success('Image uploaded');
    } catch (err) {
      console.error('Image upload error:', err);
      snackbar.error('Failed to upload image');
    } finally {
      isUploading = false;
      if (fileInput) fileInput.value = '';
    }
  }

  function handleRemove() {
    onChange(null);
  }
</script>

<div class="mt-2">
  {#if label}
    <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
  {/if}

  {#if image?.url}
    <div class="relative inline-block group">
      <img
        src={image.url}
        alt={image.alt || 'Question image'}
        class="max-h-48 rounded-md border border-gray-200 dark:border-gray-700 object-contain"
      />
      <button
        type="button"
        on:click={handleRemove}
        class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        title="Remove image"
      >
        <TrashCanIcon size={14} />
      </button>
    </div>
  {:else}
    <button
      type="button"
      on:click={() => fileInput?.click()}
      disabled={isUploading}
      class="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
    >
      <ImageIcon size={16} />
      <span>{isUploading ? `Uploading ${uploadProgress}%...` : 'Add image'}</span>
    </button>
  {/if}

  <input
    bind:this={fileInput}
    type="file"
    accept="image/jpeg,image/png,image/webp,image/gif"
    on:change={handleFileSelect}
    class="hidden"
  />
</div>
