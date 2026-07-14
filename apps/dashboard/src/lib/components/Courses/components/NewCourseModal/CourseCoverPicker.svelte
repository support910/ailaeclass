<script lang="ts">
  import { t } from '$lib/utils/functions/translations';
  import { COURSE_COVER_OPTIONS } from '$lib/utils/courseCovers';
  import CheckmarkFilledIcon from 'carbon-icons-svelte/lib/CheckmarkFilled.svelte';
  import ImageIcon from 'carbon-icons-svelte/lib/Image.svelte';

  export let value = COURSE_COVER_OPTIONS[0].src;
  export let selectedFile: File | null = null;

  let fileInput: HTMLInputElement;
  let error = '';

  function chooseDefault(src: string) {
    value = src;
    selectedFile = null;
    error = '';
    if (fileInput) fileInput.value = '';
  }

  function chooseFile() {
    fileInput?.click();
  }

  function onFileSelected() {
    const file = fileInput?.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      error = $t('courses.new_course_modal.cover_type_error');
      fileInput.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      error = $t('courses.new_course_modal.cover_size_error');
      fileInput.value = '';
      return;
    }

    error = '';
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') value = reader.result;
    };
    reader.readAsDataURL(file);
  }
</script>

<section class="mt-5" aria-labelledby="course-cover-heading">
  <div class="flex items-end justify-between gap-3">
    <div>
      <h3 id="course-cover-heading" class="text-sm font-semibold text-gray-900 dark:text-white">
        {$t('courses.new_course_modal.cover_title')}
      </h3>
      <p class="mt-1 text-xs text-gray-500 dark:text-neutral-400">
        {$t('courses.new_course_modal.cover_hint')}
      </p>
    </div>
    <button
      type="button"
      class="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700"
      on:click={chooseFile}
    >
      <ImageIcon size={17} />
      {$t('courses.new_course_modal.upload_cover')}
    </button>
    <input
      class="hidden"
      type="file"
      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
      bind:this={fileInput}
      on:change={onFileSelected}
    />
  </div>

  <div class="mt-3 overflow-hidden rounded-md border border-gray-200 bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900">
    <img class="aspect-[16/9] w-full object-cover" src={value} alt={$t('courses.new_course_modal.cover_preview')} />
  </div>

  {#if selectedFile}
    <p class="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
      {$t('courses.new_course_modal.custom_cover_selected')}: {selectedFile.name}
    </p>
  {/if}
  {#if error}<p class="mt-2 text-xs text-red-600">{error}</p>{/if}

  <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
    {#each COURSE_COVER_OPTIONS as cover}
      <button
        type="button"
        class="group relative overflow-hidden rounded-md border-2 bg-gray-100 text-left {value === cover.src && !selectedFile
          ? 'border-primary-500'
          : 'border-transparent hover:border-gray-300 dark:hover:border-neutral-500'}"
        aria-label={$t(cover.labelKey)}
        aria-pressed={value === cover.src && !selectedFile}
        on:click={() => chooseDefault(cover.src)}
      >
        <img class="aspect-[16/9] w-full object-cover" src={cover.src} alt={$t(cover.labelKey)} />
        <span class="block truncate bg-white px-2 py-1.5 text-xs text-gray-700 dark:bg-neutral-800 dark:text-neutral-200">
          {$t(cover.labelKey)}
        </span>
        {#if value === cover.src && !selectedFile}
          <span class="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-white shadow">
            <CheckmarkFilledIcon size={15} />
          </span>
        {/if}
      </button>
    {/each}
  </div>
</section>
