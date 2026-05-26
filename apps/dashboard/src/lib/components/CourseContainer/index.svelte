<script lang="ts">
  import { goto } from '$app/navigation';
  import { Moon } from 'svelte-loading-spinners';
  import { browser } from '$app/environment';
  import { BRAND } from '$lib/utils/config/brand';
  import Navigation from '../Course/components/Navigation/index.svelte';
  import Backdrop from '$lib/components/Backdrop/index.svelte';
  import { course, setCourse, defaultCourse } from '../Course/store';
  import Confetti from '../Confetti/index.svelte';
  import { isMobile } from '$lib/utils/store/useMobile';
  import { fetchCourseFromAPI } from '$lib/utils/services/courses';
  import { globalStore } from '$lib/utils/store/app';
  import { lessons } from '../Course/components/Lesson/store/lessons';
  import Modal from '$lib/components/Modal/index.svelte';
  import { t } from '$lib/utils/functions/translations';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { isOrgTeacher, currentOrgPath } from '$lib/utils/store/org';

  export let courseId = '';
  export let path = '';
  export let isExercisePage = false;
  export let isFetching = false;
  export let containerClass = '';

  let prevCourseId = '';
  let isPermitted = true;
  let membershipResolved = false;
  let hasLoadedCourse = false;
  let courseLoadError = '';

  async function onCourseIdChange(courseId = '') {
    if (!courseId || !browser) return;
    if (prevCourseId === courseId && hasLoadedCourse && membershipResolved) return;

    isFetching = true;
    membershipResolved = false;
    hasLoadedCourse = false;
    courseLoadError = '';
    course.set(defaultCourse);
    lessons.set([]);
    $globalStore.isStudent = undefined;

    try {
      const { data: _data, error: fetchError } = await fetchCourseFromAPI(courseId);

      if (fetchError || !_data) {
        courseLoadError =
          typeof fetchError === 'string'
            ? fetchError
            : fetchError?.message || 'Failed to load course';
        isPermitted = false;
        membershipResolved = true;
        hasLoadedCourse = false;
        return;
      }

      $course.type = _data.type;
      setCourse(_data);

      // Use viewer returned by API instead of doing a second frontend auth lookup
      const viewer = _data.viewer;
      if (viewer?.hasAccess) {
        $globalStore.isStudent = viewer.isStudent === true;
        filterPollsByStatus($globalStore.isStudent);
        isPermitted = true;
      } else {
        isPermitted = false;
        $globalStore.isStudent = true;
      }
      membershipResolved = true;
      hasLoadedCourse = true;
    } catch (error) {
      console.error('Error fetching course:', error);
      courseLoadError = error instanceof Error ? error.message : 'Unexpected error loading course';
      isPermitted = false;
      membershipResolved = true;
    } finally {
      isFetching = false;
      prevCourseId = courseId;
    }
  }

  function filterPollsByStatus(shouldFilter: boolean) {
    if (!shouldFilter) return;
    $course.polls = $course.polls.filter((poll) => poll.status === 'published');
  }

  $: onCourseIdChange(courseId);
</script>

<svelte:head>
  <title>{$course.title || `${BRAND.name} Course`}</title>
</svelte:head>

{#if isFetching}
  <Backdrop>
    <Moon size="60" color="#1d4ed8" unit="px" duration="1s" />
  </Backdrop>
{/if}

<Modal open={!isPermitted && !courseLoadError} width="w-96" modalHeading={$t('course.not_permitted.header')}>
  <div>
    <p class="text-md text-center dark:text-white">
      {$t('course.not_permitted.body')}
    </p>

    <div class="mt-5 flex justify-center">
      <PrimaryButton
        className="px-6 py-3"
        label={$t('course.not_permitted.button')}
        onClick={() => {
          if ($isOrgTeacher) {
            goto($currentOrgPath);
          } else {
            goto('/lms');
          }
        }}
      />
    </div>
  </div>
</Modal>

<div class="root">
  <Navigation {path} isStudent={membershipResolved ? $globalStore.isStudent : true} />
  <div class="rightBar {containerClass}" class:isMobile={$isMobile}>
    {#if isExercisePage}
      <Confetti />
    {/if}

    <!-- Show slot only if fetch succeeded and user is permitted -->
    {#if isPermitted && hasLoadedCourse}
      <slot />
    {:else if courseLoadError}
      <div class="flex flex-col items-center justify-center py-20 px-4">
        <p class="dark:text-white text-lg mb-2">{$t('course.load_error')}</p>
        {#if courseLoadError}
          <p class="text-sm text-red-500 dark:text-red-400 mb-4 font-mono max-w-md text-center">
            {courseLoadError}
          </p>
        {/if}
        <button
          class="px-4 py-2 rounded-md bg-primary-700 text-white hover:bg-primary-900"
          on:click={() => goto('/lms/mylearning')}
        >
          {$t('course.load_error_button')}
        </button>
      </div>
    {:else if !isFetching && !hasLoadedCourse}
      <div class="flex items-center justify-center py-20">
        <p class="dark:text-white">{$t('course.loading_membership')}</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .root {
    display: flex;
    width: 100%;
  }

  .rightBar {
    flex-grow: 1;
    width: calc(100% - 360px);
  }
</style>
