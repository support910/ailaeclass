<script>
  import { goto } from '$app/navigation';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { t } from '$lib/utils/functions/translations';

  export let isOrg = false;

  function handleClick() {
    return goto('/');
  }
</script>

<div class="root flex w-screen flex-col items-center justify-center">
  <img src="/logo-512.png" alt="error_image" />
  <div class="flex w-4/5 flex-col items-center justify-center gap-3 dark:text-white lg:w-2/5">
    <p class="mb-5 text-4xl font-semibold dark:text-white">
      {#if isOrg}
        {$t('not_found.org_not_exist')}
      {:else}
        {$t('not_found.title')}
      {/if}
    </p>
    <p class=" mb-5 text-center text-lg text-gray-700 dark:text-white">
      {$t('not_found.description')}
    </p>
    <PrimaryButton
      variant={VARIANTS.CONTAINED_DARK}
      label={$t('not_found.go_home')}
      className="text-lg"
      onClick={handleClick}
    />
  </div>
</div>

<style>
  .root {
    height: calc(100vh - 45px);
  }
</style>
