<script lang="ts">
  import { page } from '$app/stores';
  import Avatar from '$lib/components/Avatar/index.svelte';
  import { VARIANTS } from '$lib/components/PrimaryButton/constants';
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import { t } from '$lib/utils/functions/translations';
  import { currentOrg } from '$lib/utils/store/org';
  import { BRAND } from '$lib/utils/config/brand';
  import type { SupabaseClient } from '@supabase/supabase-js';

  export let supabase: SupabaseClient;
  export let handleSubmit = () => {};
  export let isLogin = true;
  export let showOnlyContent = false;
  export let isLoading = false;
  export let showLogo = false;
  export let formRef;
  export let redirectPathname = '';
</script>

<div class="app-background flex min-h-screen w-full items-center justify-center">
  <div class="border-gray container border bg-white dark:bg-black">
    <div class="flex flex-col items-center p-2 lg:px-8 lg:py-3">
      {#if !showOnlyContent || showLogo}
        <div class="flex w-full flex-col items-center justify-center pt-2">
          <Avatar
            src={$currentOrg.avatar_url ? $currentOrg.avatar_url : BRAND.logo}
            name={$currentOrg.name ? $currentOrg.name : BRAND.name}
            shape="rounded-md"
            width="w-10"
            height="max-h-10"
            className="mr-2"
          />
          <a href="/">
            <h4 class="mt-0 text-xl dark:text-white">
              {$currentOrg.name ? $currentOrg.name : BRAND.name}
            </h4>
          </a>
        </div>
      {/if}
      <form
        bind:this={formRef}
        on:submit|preventDefault={handleSubmit}
        class="flex w-10/12 flex-col items-center"
      >
        <slot />
      </form>
    </div>
    {#if !showOnlyContent}
      <div class="border-grey w-full border-t p-6 text-center">
        {#if isLogin}
          {$t('login.not_registered_yet')}
          <a class="text-primary-700 hover:underline" href="/signup{$page.url.search}"
            >{$t('login.signup')}</a
          >
        {:else}
          {$t('login.already_have_account')}
          <a class="text-primary-700 hover:underline" href="/login{$page.url.search}"
            >{$t('login.login')}</a
          >
        {/if}
      </div>
      <div class="w-full border-t border-gray-100 p-4 text-center dark:border-neutral-800">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          若遇到问题，请联系
          <a href="mailto:support@5numultimedia.com" class="text-cyan-600 hover:underline">
            support@5numultimedia.com
          </a>
          ，我们将会为您解答。
        </p>
      </div>
    {/if}
  </div>
</div>

<style>
  .container {
    width: 450px;
  }
</style>
