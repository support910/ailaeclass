<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { searchCourseByCode, submitJoinRequest } from '$lib/utils/services/courses';
  import { getSupabase } from '$lib/utils/functions/supabase';
  import { profile } from '$lib/utils/store/user';
  import { snackbar } from '$lib/components/Snackbar/store';
  import { t } from '$lib/utils/functions/translations';
  let searchCode = '';
  let isSearching = false;
  let isSubmitting = false;
  let foundCourse: any = null;
  let searchError = '';
  let applicationStatus: 'idle' | 'pending' | 'already_member' | 'submitted' = 'idle';

  const supabase = getSupabase();

  async function handleSearch() {
    const code = searchCode.trim().toUpperCase();
    if (!code) {
      searchError = $t('course.join.error_empty');
      return;
    }

    isSearching = true;
    searchError = '';
    foundCourse = null;
    applicationStatus = 'idle';

    const { data, error } = await searchCourseByCode(code);

    if (error || !data) {
      searchError = $t('course.join.error_not_found');
      isSearching = false;
      return;
    }

    foundCourse = data;

    // Check if already a member or already applied
    if ($profile?.id && foundCourse?.group_id) {
      const { data: memberData } = await supabase
        .from('groupmember')
        .select('id')
        .eq('group_id', foundCourse.group_id)
        .eq('profile_id', $profile.id)
        .single();

      if (memberData) {
        applicationStatus = 'already_member';
        isSearching = false;
        return;
      }

      const { data: requestData } = await supabase
        .from('course_join_request')
        .select('status')
        .eq('course_id', foundCourse.id)
        .eq('profile_id', $profile.id)
        .in('status', ['pending', 'approved'])
        .single();

      if (requestData) {
        applicationStatus = requestData.status === 'approved' ? 'already_member' : 'pending';
        isSearching = false;
        return;
      }
    }

    isSearching = false;
  }

  async function handleApply() {
    if (!foundCourse?.id) return;
    if (!$profile?.id) {
      goto(`/login?redirect=${encodeURIComponent($page.url.pathname)}`);
      return;
    }

    isSubmitting = true;
    const { error } = await submitJoinRequest(foundCourse.id);

    if (error) {
      snackbar.error(error.message || $t('course.join.error_submit'));
      isSubmitting = false;
      return;
    }

    applicationStatus = 'submitted';
    snackbar.success($t('course.join.success_submit'));
    isSubmitting = false;
  }

  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Allow viewing search without login, but applying requires login
    }
  });
</script>

<svelte:head>
  <title>{$t('course.join.title')} — AilaeClass</title>
</svelte:head>

<section class="mx-auto max-w-xl px-4 py-10">
  <h1 class="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
    {$t('course.join.title')}
  </h1>
  <p class="mb-8 text-sm text-gray-500 dark:text-gray-400">
    {$t('course.join.description')}
  </p>

  <!-- Search Box -->
  <div class="mb-8 flex gap-2">
    <input
      type="text"
      bind:value={searchCode}
      placeholder={$t('course.join.search_placeholder')}
      class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm uppercase tracking-widest text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-white"
      maxlength="10"
      on:keydown={(e) => e.key === 'Enter' && handleSearch()}
    />
    <PrimaryButton
      label={$t('course.join.search_button')}
      onClick={handleSearch}
      isLoading={isSearching}
      isDisabled={isSearching}
    />
  </div>

  {#if searchError}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
      {searchError}
    </div>
  {/if}

  <!-- Course Result -->
  {#if foundCourse}
    <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
      <div class="mb-4 flex items-start gap-4">
        <img
          src={foundCourse.logo || '/images/ailaeclass-course-img-template.jpg'}
          alt={foundCourse.title}
          class="h-16 w-16 rounded-lg object-cover"
        />
        <div class="flex-1">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {foundCourse.title}
          </h2>
          {#if foundCourse.description}
            <p class="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
              {foundCourse.description}
            </p>
          {/if}
        </div>
      </div>

      <div class="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-neutral-700">
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {$t('course.join.code_label')}: <span class="font-mono font-bold text-primary-600">{foundCourse.join_code}</span>
        </div>

        {#if applicationStatus === 'already_member'}
          <span class="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
            {$t('course.join.already_member')}
          </span>
        {:else if applicationStatus === 'pending'}
          <span class="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
            {$t('course.join.pending')}
          </span>
        {:else if applicationStatus === 'submitted'}
          <span class="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {$t('course.join.submitted')}
          </span>
        {:else}
          <PrimaryButton
            label={$t('course.join.apply')}
            onClick={handleApply}
            isLoading={isSubmitting}
            isDisabled={isSubmitting || !$profile.id}
          />
        {/if}
      </div>

      {#if !$profile.id}
        <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {$t('course.join.login_required')}
        </p>
      {/if}
    </div>
  {/if}
</section>
