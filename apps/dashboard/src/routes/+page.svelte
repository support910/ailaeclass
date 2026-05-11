<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { isSingleOrgMode } from '$lib/utils/config/singleOrg';
  import { hasSession } from '$lib/utils/functions/supabase';
  import { BRAND } from '$lib/utils/config/brand';

  onMount(() => {
    if (isSingleOrgMode()) {
      goto(hasSession() ? '/lms' : '/login');
    }
  });
</script>

<svelte:head>
  <title>{BRAND.name} - Learning Platform</title>
</svelte:head>

{#if !isSingleOrgMode()}
  <div class="md:h-[93vh] w-screen flex items-center justify-center flex-col m-2 sm:m-0 font-sans">
    <div>
      <h3 class="dark:text-white text-4xl text-center">
        {BRAND.name}
      </h3>
      <p class="dark:text-white text-lg text-center">
        {BRAND.description}
      </p>
    </div>
  </div>
{/if}
