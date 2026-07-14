<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import CheckmarkFilledIcon from 'carbon-icons-svelte/lib/CheckmarkFilled.svelte';

  import Modal from '$lib/components/Modal/index.svelte';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants';
  import TabContent from '$lib/components/TabContent/index.svelte';
  import Tabs from '$lib/components/Tabs/index.svelte';
  import { handleOpenWidget } from '$lib/components/CourseLandingPage/store';
  import { snackbar } from '$lib/components/Snackbar/store';
  import { COURSE_COVER_OPTIONS } from '$lib/utils/courseCovers';
  import { t } from '$lib/utils/functions/translations';
  import { uploadCourseCover } from '$lib/utils/services/courses';
  import { currentOrg } from '$lib/utils/store/org';

  export let imageURL = '';

  const dispatch = createEventDispatcher();
  const tabs = [
    {
      label: 'course.navItem.landing_page.upload_widget.defaults_tab',
      value: 'defaults'
    },
    {
      label: 'course.navItem.landing_page.upload_widget.upload_tab',
      value: 'upload'
    }
  ];

  let currentTab = tabs[0].value;
  let pendingImageURL = imageURL;
  let pendingFile: File | null = null;
  let fileInput: HTMLInputElement;
  let isUploading = false;

  const onChange = (tabValue: string | number) => () => {
    currentTab = `${tabValue}`;
  };

  function closeWidget() {
    $handleOpenWidget.open = false;
  }

  function selectDefaultImage(src: string) {
    pendingFile = null;
    pendingImageURL = src;
  }

  function applyImage(src: string) {
    imageURL = src;
    dispatch('change', { imageURL: src });
    closeWidget();
  }

  function confirmDefaultImage() {
    applyImage(pendingImageURL);
  }

  function readFileAsDataURL(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(`${reader.result || ''}`);
      reader.onerror = () => reject(reader.error || new Error('Unable to preview image'));
      reader.readAsDataURL(file);
    });
  }

  async function onFileSelected() {
    const file = fileInput?.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      snackbar.error('courses.new_course_modal.cover_type_error');
      fileInput.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      snackbar.error('courses.new_course_modal.cover_size_error');
      fileInput.value = '';
      return;
    }

    try {
      pendingImageURL = await readFileAsDataURL(file);
      pendingFile = file;
    } catch (error) {
      console.error('Course cover preview error:', error);
      pendingFile = null;
      pendingImageURL = imageURL;
      fileInput.value = '';
      snackbar.error('courses.new_course_modal.cover_upload_error');
    }
  }

  function handleUpload() {
    fileInput?.click();
  }

  async function confirmUpload() {
    if (!pendingFile) return;
    if (!$currentOrg.id) {
      snackbar.error('courses.new_course_modal.cover_upload_error');
      return;
    }

    isUploading = true;
    try {
      const { data, error } = await uploadCourseCover(pendingFile, $currentOrg.id);
      if (error || !data) throw new Error(error?.message || 'Upload failed');
      applyImage(data);
      snackbar.success('snackbar.landing_page_settings.success.complete');
    } catch (error) {
      console.error('Course cover upload error:', error);
      snackbar.error('courses.new_course_modal.cover_upload_error');
    } finally {
      isUploading = false;
    }
  }
</script>

<Modal
  onClose={closeWidget}
  bind:open={$handleOpenWidget.open}
  width="w-[92vw] md:w-4/5 lg:w-3/5"
  maxWidth=""
  modalHeading={$t('course.navItem.landing_page.upload_widget.title')}
>
  <div class="w-full bg-white dark:bg-inherit">
    <p class="mb-4 text-sm text-gray-600 dark:text-neutral-300">
      {$t('course.navItem.landing_page.upload_widget.description')}
    </p>
    <Tabs {tabs} {currentTab} {onChange}>
      <slot:fragment slot="content">
        <TabContent value={tabs[0].value} index={currentTab}>
          <p class="mb-3 text-sm text-gray-500 dark:text-neutral-300">
            {$t('course.navItem.landing_page.upload_widget.selection_hint')}
          </p>
          <div class="grid max-h-[300px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
            {#each COURSE_COVER_OPTIONS as cover}
              <button
                type="button"
                class="group relative overflow-hidden rounded-md border-2 bg-gray-100 text-left {pendingImageURL ===
                cover.src
                  ? 'border-primary-500'
                  : 'border-transparent hover:border-gray-300 dark:hover:border-neutral-500'}"
                aria-label={$t(cover.labelKey)}
                aria-pressed={pendingImageURL === cover.src}
                on:click={() => selectDefaultImage(cover.src)}
              >
                <img class="aspect-[16/9] w-full object-cover" src={cover.src} alt={$t(cover.labelKey)} />
                <span class="block truncate bg-white px-2 py-1.5 text-xs text-gray-700 dark:bg-neutral-800 dark:text-neutral-200">
                  {$t(cover.labelKey)}
                </span>
                {#if pendingImageURL === cover.src}
                  <span class="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-white shadow">
                    <CheckmarkFilledIcon size={15} />
                  </span>
                {/if}
              </button>
            {/each}
          </div>
          {#if pendingImageURL}
            <div class="mt-4 border-t border-gray-200 pt-4 dark:border-neutral-600">
              <p class="mb-2 text-sm font-medium">
                {$t('course.navItem.landing_page.upload_widget.selected_preview')}
              </p>
              <img
                src={pendingImageURL}
                alt={$t('course.navItem.landing_page.upload_widget.selected_preview')}
                class="aspect-[16/9] w-full max-w-sm rounded-md object-cover"
              />
            </div>
          {/if}
          <div class="mt-5 flex flex-wrap justify-end gap-2">
            <PrimaryButton
              variant={VARIANTS.OUTLINED}
              label={$t('course.navItem.landing_page.upload_widget.cancel')}
              onClick={closeWidget}
            />
            <PrimaryButton
              label={$t('course.navItem.landing_page.upload_widget.confirm_use')}
              onClick={confirmDefaultImage}
              isDisabled={!pendingImageURL}
            />
          </div>
        </TabContent>

        <TabContent value={tabs[1].value} index={currentTab}>
          <div class="w-full">
            <p class="mb-3 text-sm text-gray-500 dark:text-neutral-300">
              {$t('course.navItem.landing_page.upload_widget.upload_hint')}
            </p>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              class="hidden"
              bind:this={fileInput}
              on:change={onFileSelected}
              disabled={isUploading}
            />
            <PrimaryButton
              label={$t('course.navItem.landing_page.upload_widget.upload_button')}
              onClick={handleUpload}
              isDisabled={isUploading}
              className="w-full font-semibold m-auto"
            />
            <p class="my-2 text-center text-sm text-gray-500">
              {$t('course.navItem.landing_page.upload_widget.width')}
            </p>
            <p class="text-center text-sm text-gray-500">
              {$t('course.navItem.landing_page.upload_widget.size_5mb')}
            </p>
            {#if pendingFile && pendingImageURL}
              <div class="mt-4 border-t border-gray-200 pt-4 dark:border-neutral-600">
                <p class="mb-2 text-sm font-medium">
                  {$t('course.navItem.landing_page.upload_widget.selected_preview')}
                </p>
                <img
                  src={pendingImageURL}
                  alt={$t('course.navItem.landing_page.upload_widget.selected_preview')}
                  class="aspect-[16/9] w-full max-w-md rounded-md object-cover"
                />
                <p class="mt-2 break-all text-xs text-gray-500">{pendingFile.name}</p>
              </div>
            {/if}
            <div class="mt-5 flex flex-wrap justify-end gap-2">
              <PrimaryButton
                variant={VARIANTS.OUTLINED}
                label={$t('course.navItem.landing_page.upload_widget.cancel')}
                onClick={closeWidget}
                isDisabled={isUploading}
              />
              <PrimaryButton
                label={$t('course.navItem.landing_page.upload_widget.upload_and_use')}
                onClick={confirmUpload}
                isLoading={isUploading}
                isDisabled={!pendingFile || isUploading}
              />
            </div>
          </div>
        </TabContent>
      </slot:fragment>
    </Tabs>
  </div>
</Modal>
