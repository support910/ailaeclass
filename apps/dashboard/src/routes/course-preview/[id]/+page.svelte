<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import ArrowLeft from 'carbon-icons-svelte/lib/ArrowLeft.svelte';
  import Book from 'carbon-icons-svelte/lib/Book.svelte';
  import CheckmarkFilled from 'carbon-icons-svelte/lib/CheckmarkFilled.svelte';
  import Education from 'carbon-icons-svelte/lib/Education.svelte';
  import UserMultiple from 'carbon-icons-svelte/lib/UserMultiple.svelte';
  import Avatar from '$lib/components/Avatar/index.svelte';
  import CourseFavoriteButton from '$lib/components/Courses/CourseFavoriteButton.svelte';
  import HTMLRender from '$lib/components/HTMLRender/HTMLRender.svelte';
  import { ROLE } from '$lib/utils/constants/roles';
  import { getAccessToken } from '$lib/utils/functions/supabase';
  import { t } from '$lib/utils/functions/translations';
  import type { Course } from '$lib/utils/types';
  import { getCourseCover } from '$lib/utils/courseCovers';

  type ViewerState = {
    org_role_id: number | null;
    is_course_member: boolean;
    course_role_id: number | null;
    application_status: 'pending' | 'approved' | 'rejected' | null;
    applied_at: string | null;
  };

  export let data: { id: string };
  let courseData: Course | null = null;
  let viewer: ViewerState | null = null;
  let loading = true;
  let applying = false;
  let error = '';
  let applicationMessage = '';
  let applicationError = '';

  $: metadata = (courseData?.metadata || {}) as Record<string, any>;
  $: learningContent = metadata.goals || courseData?.overview || metadata.description || courseData?.description || $t('explore.preview.learning_fallback');
  $: sections = [...((courseData as any)?.lesson_section || [])].sort(
    (a: any, b: any) => (a.order || 0) - (b.order || 0)
  );
  $: lessons = (courseData as any)?.lessons || [];
  $: teachers = courseData?.teachers || [];
  $: isStudent = viewer?.org_role_id === ROLE.STUDENT;
  $: isPending = viewer?.application_status === 'pending';

  onMount(loadCourse);

  async function loadCourse() {
    loading = true;
    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/courses/catalog/id/${data.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || $t('explore.preview.load_failed'));
      courseData = result.course;
      viewer = result.viewer;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : $t('explore.preview.load_failed');
    } finally {
      loading = false;
    }
  }

  function returnToExplore() {
    goto('/lms/explore');
  }

  function lessonCountForSection(sectionId: string) {
    return lessons.filter((lesson: any) => lesson.section_id === sectionId).length;
  }

  async function applyForCourse() {
    if (!isStudent || applying || isPending || viewer?.is_course_member) return;
    applying = true;
    applicationError = '';
    applicationMessage = '';
    try {
      const token = await getAccessToken();
      if (!token) throw new Error($t('explore.preview.login_required'));
      const response = await fetch(`/api/courses/${data.id}/join-requests`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || $t('explore.preview.apply_failed'));
      }
      if (result.state === 'joined') {
        viewer = viewer ? { ...viewer, is_course_member: true } : viewer;
        applicationMessage = $t('explore.preview.already_joined');
      } else {
        viewer = viewer ? { ...viewer, application_status: 'pending' } : viewer;
        applicationMessage = $t('explore.preview.apply_success');
      }
    } catch (cause) {
      applicationError = cause instanceof Error ? cause.message : $t('explore.preview.apply_failed');
    } finally {
      applying = false;
    }
  }
</script>

<svelte:head><title>{courseData?.title || $t('explore.preview.title')}</title></svelte:head>

{#if loading}
  <div class="flex min-h-[60vh] w-full flex-1 items-center justify-center bg-white text-sm text-gray-500 dark:bg-black dark:text-neutral-300">
    {$t('explore.preview.loading')}
  </div>
{:else if error}
  <div class="flex min-h-[60vh] w-full flex-1 flex-col items-center justify-center gap-4 bg-white px-5 text-center dark:bg-black">
    <p class="text-red-600">{error}</p>
    <button type="button" class="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm dark:border-neutral-600 dark:text-white" on:click={returnToExplore}>
      <ArrowLeft size={16} />{$t('explore.preview.back')}
    </button>
  </div>
{:else if courseData}
  <main class="min-h-full min-w-0 w-full flex-1 bg-white text-gray-900 dark:bg-black dark:text-white">
    <header
      class="relative min-h-[390px] overflow-hidden bg-neutral-900 bg-cover bg-center"
      style:background-image={`url(${getCourseCover(courseData)})`}
    >
      <div class="absolute inset-0 bg-black/70" />
      <div class="relative mx-auto flex min-h-[390px] max-w-6xl flex-col px-5 py-6 md:px-8">
        <button type="button" class="inline-flex w-fit items-center gap-2 rounded-md border border-white/60 bg-black/30 px-3 py-2 text-sm font-medium text-white hover:bg-black/50" on:click={returnToExplore}>
          <ArrowLeft size={16} />{$t('explore.preview.back')}
        </button>

        <div class="my-auto max-w-3xl py-10">
          <p class="mb-3 text-sm font-semibold text-emerald-300">{$t('explore.preview.course_label')}</p>
          <h1 class="text-3xl font-bold text-white md:text-5xl">{courseData.title}</h1>
          <p class="mt-5 max-w-2xl text-base leading-7 text-neutral-100 md:text-lg">
            {courseData.description || courseData.overview || $t('explore.preview.description_fallback')}
          </p>
          {#if teachers.length}
            <p class="mt-4 text-sm text-neutral-200">
              {$t('explore.preview.taught_by')} {teachers.map((teacher) => teacher.fullname).filter(Boolean).join('、')}
            </p>
          {/if}
          <div class="mt-7 flex flex-wrap items-center gap-3">
            {#if isStudent}
              <button
                type="button"
                class="inline-flex h-11 min-w-[148px] items-center justify-center gap-2 rounded-md bg-emerald-500 px-5 text-sm font-semibold text-neutral-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-600"
                disabled={applying || isPending || viewer?.is_course_member}
                on:click={applyForCourse}
              >
                {#if isPending || viewer?.is_course_member}<CheckmarkFilled size={18} />{/if}
                {applying
                  ? $t('explore.preview.applying')
                  : viewer?.is_course_member
                    ? $t('explore.preview.already_joined')
                    : isPending
                      ? $t('explore.preview.applied')
                      : $t('explore.preview.apply_now')}
              </button>
            {/if}
            <CourseFavoriteButton courseId={courseData.id} tone="dark" />
          </div>
          {#if applicationMessage}
            <p class="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-300"><CheckmarkFilled size={16} />{applicationMessage}</p>
          {:else if applicationError}
            <p class="mt-3 text-sm font-medium text-red-300">{applicationError}</p>
          {:else if isPending}
            <p class="mt-3 text-sm text-neutral-200">{$t('explore.preview.pending_hint')}</p>
          {/if}
        </div>
      </div>
    </header>

    <section class="border-b border-gray-200 bg-gray-50 dark:border-neutral-800 dark:bg-neutral-950">
      <div class="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-5 py-5 sm:grid-cols-3 md:px-8">
        <div class="flex items-center gap-3"><Book size={24} /><div><p class="text-xs text-gray-500">{$t('explore.preview.course_structure')}</p><p class="font-semibold">{sections.length} {$t('explore.preview.modules')} · {lessons.length} {$t('explore.preview.lessons')}</p></div></div>
        <div class="flex items-center gap-3"><UserMultiple size={24} /><div><p class="text-xs text-gray-500">{$t('explore.preview.teaching_team')}</p><p class="font-semibold">{teachers.length || 1} {$t('explore.preview.teachers')}</p></div></div>
        <div class="flex items-center gap-3"><Education size={24} /><div><p class="text-xs text-gray-500">{$t('explore.preview.learning_mode')}</p><p class="font-semibold">{$t('explore.preview.structured_learning')}</p></div></div>
      </div>
    </section>

    <section class="mx-auto grid max-w-6xl gap-12 px-5 py-12 md:grid-cols-[1.35fr_0.65fr] md:px-8 md:py-16">
      <div>
        <p class="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{$t('explore.preview.highlight_label')}</p>
        <h2 class="mt-2 text-2xl font-bold">{$t('explore.preview.what_you_learn')}</h2>
        <div class="mt-6 border-l-4 border-emerald-500 pl-5 text-base leading-7 text-gray-700 dark:text-neutral-200">
          <HTMLRender content={learningContent} disableMaxWidth={true} />
        </div>
      </div>
      <div>
        <h2 class="text-xl font-bold">{$t('explore.preview.highlights')}</h2>
        <ul class="mt-5 space-y-5">
          <li class="flex gap-3"><CheckmarkFilled class="mt-0.5 shrink-0 text-emerald-600" size={20} /><span>{$t('explore.preview.highlight_goal')}</span></li>
          <li class="flex gap-3"><CheckmarkFilled class="mt-0.5 shrink-0 text-emerald-600" size={20} /><span>{$t('explore.preview.highlight_structure')}</span></li>
          <li class="flex gap-3"><CheckmarkFilled class="mt-0.5 shrink-0 text-emerald-600" size={20} /><span>{$t('explore.preview.highlight_teacher')}</span></li>
        </ul>
      </div>
    </section>

    {#if sections.length}
      <section class="border-y border-gray-200 bg-gray-50 dark:border-neutral-800 dark:bg-neutral-950">
        <div class="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
          <h2 class="text-2xl font-bold">{$t('explore.preview.outline')}</h2>
          <p class="mt-2 text-sm text-gray-600 dark:text-neutral-300">{$t('explore.preview.outline_hint')}</p>
          <div class="mt-7 divide-y divide-gray-200 border-y border-gray-200 dark:divide-neutral-700 dark:border-neutral-700">
            {#each sections as section, index}
              <div class="flex items-center justify-between gap-5 py-5">
                <div class="flex min-w-0 items-center gap-4"><span class="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{String(index + 1).padStart(2, '0')}</span><p class="truncate font-semibold">{section.title}</p></div>
                <span class="shrink-0 text-sm text-gray-500">{lessonCountForSection(section.id)} {$t('explore.preview.lessons')}</span>
              </div>
            {/each}
          </div>
        </div>
      </section>
    {/if}

    <section class="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
      <h2 class="text-2xl font-bold">{$t('explore.preview.instructors')}</h2>
      {#if teachers.length}
        <div class="mt-7 grid gap-5 sm:grid-cols-2">
          {#each teachers as teacher}
            <div class="flex items-center gap-4 border-b border-gray-200 pb-5 dark:border-neutral-700">
              <Avatar src={teacher.avatar_url} name={teacher.fullname} width="w-14" height="h-14" />
              <div><p class="font-semibold">{teacher.fullname}</p><p class="mt-1 text-sm text-gray-500">{$t('explore.preview.course_instructor')}</p></div>
            </div>
          {/each}
        </div>
      {:else}
        <p class="mt-4 text-sm text-gray-500">{$t('explore.preview.teacher_pending')}</p>
      {/if}
    </section>
  </main>
{/if}
