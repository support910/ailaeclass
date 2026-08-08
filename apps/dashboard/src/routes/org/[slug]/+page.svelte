<script lang="ts">
  import { goto } from '$app/navigation';
  import { ActivityCard } from '$lib/components/Analytics';
  import CourseIcon from '$lib/components/Icons/CourseIcon.svelte';
  import Progress from '$lib/components/Progress/index.svelte';
  import UserProfile from 'carbon-icons-svelte/lib/UserProfile.svelte';

  import { snackbar } from '$lib/components/Snackbar/store';
  import { calDateDiff } from '$lib/utils/functions/date';
  import { getAccessToken } from '$lib/utils/functions/supabase';
  import { currentOrg, currentOrgPath } from '$lib/utils/store/org';
  import { profile } from '$lib/utils/store/user';
  import type { OrganisationAnalytics } from '$lib/utils/types/analytics';
  import Add from 'carbon-icons-svelte/lib/Add.svelte';
  import Book from 'carbon-icons-svelte/lib/Book.svelte';
  import CurrencyDollar from 'carbon-icons-svelte/lib/CurrencyDollar.svelte';
  import UserMultiple from 'carbon-icons-svelte/lib/UserMultiple.svelte';

  import Avatar from '$lib/components/Avatar/index.svelte';
  import VisitOrgSiteButton from '$lib/components/Buttons/VisitOrgSite.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { getGreeting } from '$lib/utils/functions/date';
  import { t } from '$lib/utils/functions/translations';
  import { isOrgAdmin, isOrgTeacher } from '$lib/utils/store/org';
  import { isMobile } from '$lib/utils/store/useMobile';
  import Shimmer from '$lib/components/Skeleton/Shimmer.svelte';
  import StatCardSkeleton from '$lib/components/Skeleton/StatCardSkeleton.svelte';

  let dashAnalytics: OrganisationAnalytics;
  let analyticsOrgId = '';
  let analyticsLoading = false;

  function createCourse() {
    goto(`${$currentOrgPath}/courses?create=true`);
  }

  async function fetchDashAnalytics(orgId: string) {
    if (!orgId || analyticsLoading || analyticsOrgId === orgId) return;
    analyticsLoading = true;

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setTimeout(() => {
          analyticsLoading = false;
          fetchDashAnalytics(orgId);
        }, 300);
        return;
      }

      const response = await fetch('/api/analytics/dash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ orgId })
      });

      if (!response.ok) {
        console.warn('Failed to fetch analytics data', response.status);
        return;
      }

      dashAnalytics = (await response.json()) as OrganisationAnalytics;
      analyticsOrgId = orgId;
    } catch (error) {
      console.warn('Failed to fetch analytics data', error);
    } finally {
      analyticsLoading = false;
    }
  }

  $: fetchDashAnalytics($currentOrg.id);

  $: cards = [
    ...($isOrgAdmin ? [{
      icon: CurrencyDollar,
      title: `${$t('dashboard.revenue')} ($)`,
      percentage: dashAnalytics?.revenue ?? 0,
      description: $t('dashboard.revenue_description'),
      hidePercentage: true
    }] : []),
    {
      icon: Book,
      title: $t('dashboard.no_of_courses'),
      percentage: dashAnalytics?.numberOfCourses ?? 0,
      description: $t('dashboard.no_courses_description'),
      hidePercentage: true
    },
    {
      icon: UserMultiple,
      title: $t('dashboard.total_students'),
      percentage: dashAnalytics?.totalStudents ?? 0,
      description: $t('dashboard.total_students_description'),
      hidePercentage: true
    }
  ];
</script>

<svelte:head>
  <title>Dashboard — ailaeclass</title>
</svelte:head>

<div class="w-full max-w-6xl px-4 py-8 md:mx-auto">
  <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-2xl font-bold tracking-tight dark:text-white md:text-3xl">
      {$t(getGreeting())}
      {$profile.fullname}!
    </h1>
    <div class="flex items-center">
      <PrimaryButton
        variant={VARIANTS.OUTLINED}
        onClick={createCourse}
        isDisabled={!$isOrgTeacher}
        className="min-h-[36px]"
      >
        {#if $isMobile}
          <Add size={24} />
        {:else}
          {$t('dashboard.create_course')}
        {/if}
      </PrimaryButton>

      <VisitOrgSiteButton />
    </div>
  </div>

  <div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each cards as card}
      {#if !dashAnalytics}
        <StatCardSkeleton />
      {:else}
        <ActivityCard activity={card} />
      {/if}
    {/each}
  </div>

  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <div
      class="flex min-h-[45vh] w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-900"
    >
      <h3
        class="mt-0 border-b border-gray-100 px-5 py-4 text-base font-semibold text-gray-900 dark:border-neutral-800 dark:text-white"
      >
        {$t('dashboard.top_courses')}
      </h3>

      <div class="h-full px-2 py-2">
        {#if !dashAnalytics}
          <div class="space-y-2 px-3 py-1">
            {#each Array(5) as _}
              <div class="flex items-center gap-3 py-2">
                <div class="flex-1 space-y-2">
                  <Shimmer width="70%" height="0.8rem" />
                  <Shimmer width="30%" height="0.65rem" />
                </div>
                <Shimmer width="5.5rem" height="1.4rem" />
              </div>
            {/each}
          </div>
        {:else}
          {#each dashAnalytics.topCourses as course}
            <a
              href={`/courses/${course.id}`}
              class="flex items-center gap-4 rounded-lg px-3 py-3 no-underline transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800"
            >
              <div class="min-w-0 flex-1">
                <p
                  class="line-clamp-2 text-sm font-medium leading-snug text-gray-900 dark:text-white"
                >
                  {course.title}
                </p>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {course.enrollments}
                  {$t(course.enrollments === 1 ? 'dashboard.student' : 'dashboard.students')}
                </p>
              </div>
              <div class="w-24 shrink-0 text-right">
                <Progress value={course.completion} />
                <div
                  class="mt-1.5 text-xs font-medium text-gray-600 dark:text-gray-300"
                  style="font-variant-numeric: tabular-nums;"
                >
                  {course.completion}% {$t('dashboard.completion')}
                </div>
              </div>
            </a>
          {:else}
            <div class="flex flex-col h-full items-center justify-center p-3">
              <div class="bg-primary-200 w-fit rounded-full p-4 text-black">
                <CourseIcon width="30" height="30" />
              </div>
              <div class="my-4 text-center">
                <p class=" text-xl font-semibold">
                  {$t('dashboard.create_first_course')}
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-300">
                  {$t('dashboard.create_first_course_description')}
                </p>
              </div>
              <PrimaryButton
                variant={VARIANTS.OUTLINED}
                onClick={createCourse}
                label={$t('dashboard.create_course')}
              />
            </div>
          {/each}
        {/if}
      </div>
    </div>

    <div
      class="flex min-h-[45vh] w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-900"
    >
      <h3
        class="mt-0 border-b border-gray-100 px-5 py-4 text-base font-semibold text-gray-900 dark:border-neutral-800 dark:text-white"
      >
        {$t('dashboard.recent_enrollments')}
      </h3>

      <div class="h-full px-2 py-2">
        {#if !dashAnalytics}
          <div class="space-y-2 px-3 py-1">
            {#each Array(5) as _}
              <div class="flex items-center gap-3 py-2">
                <Shimmer width="1.75rem" height="1.75rem" rounded="rounded-full" />
                <div class="flex-1 space-y-2">
                  <Shimmer width="45%" height="0.8rem" />
                  <Shimmer width="25%" height="0.65rem" />
                </div>
                <Shimmer width="30%" height="0.8rem" />
              </div>
            {/each}
          </div>
        {:else}
          {#each dashAnalytics.enrollments as enrollment}
            <a
              href={`/courses/${enrollment.courseId}`}
              class="flex items-center gap-3 rounded-lg px-3 py-3 no-underline transition-colors hover:bg-gray-50 dark:hover:bg-neutral-800"
            >
              <Avatar src={enrollment.avatarUrl} name={enrollment.name} width="w-7" height="h-7" />

              <div class="min-w-0 flex-1">
                <p
                  class="truncate text-sm font-medium capitalize leading-tight text-gray-900 dark:text-white"
                >
                  {enrollment.name}
                </p>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {calDateDiff(enrollment.date)}
                </p>
              </div>

              <p
                class="line-clamp-2 w-2/5 shrink-0 text-right text-xs leading-snug text-gray-600 dark:text-gray-300"
              >
                {enrollment.course}
              </p>
            </a>
          {:else}
            <div class="flex flex-col h-full items-center justify-center p-3">
              <div class="bg-primary-200 w-fit rounded-full p-4 text-black">
                <UserProfile size={24} />
              </div>
              <div class="my-4 text-center">
                <p class=" text-xl font-semibold">
                  {$t('dashboard.publish_first_course')}
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-300">
                  {$t('dashboard.publish_first_course_description')}
                </p>
              </div>
              <PrimaryButton
                variant={VARIANTS.OUTLINED}
                onClick={() => goto(`${$currentOrgPath}/courses`)}
                label={$t('dashboard.publish_course')}
              />
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</div>
