<script lang="ts">
  import { goto } from '$app/navigation';
  import { profile } from '$lib/utils/store/user';
  import { t } from '$lib/utils/functions/translations';
  import { BRAND } from '$lib/utils/config/brand';

  function goToHome() {
    goto('/');
  }
</script>

<svelte:head>
  <title>{$t('signup.teacher_pending_title')} — {BRAND.name}</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center px-4 text-center">
  <div class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300">
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  </div>

  <h1 class="mb-2 text-2xl font-bold dark:text-white">
    {$t('signup.teacher_pending_title')}
  </h1>
  <p class="mb-6 max-w-md text-gray-600 dark:text-gray-300">
    {$t('signup.teacher_pending_desc')}
  </p>

  {#if $profile.email}
    <p class="mb-8 text-sm text-gray-500 dark:text-gray-400">
      {$profile.email}
    </p>
  {/if}

  <button
    on:click={goToHome}
    class="rounded-md bg-primary-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-800 dark:bg-primary-600 dark:hover:bg-primary-500"
  >
    {$t('signup.teacher_pending_action')}
  </button>
</div>
