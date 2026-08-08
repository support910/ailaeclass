<script>
  import { page, navigating } from '$app/stores';
  import RouteProgress from '$lib/components/Navigation/RouteProgress.svelte';
  import AddOrgModal from '$lib/components/Org/AddOrgModal/AddOrgModal.svelte';
  import FeatureGuide from '$lib/components/Guide/FeatureGuide.svelte';
  import { isQuizPage } from '$lib/utils/functions/app';
  import OrgSideBar from '$lib/components/Org/SideBar.svelte';
  import VerifyEmailModal from '$lib/components/Org/VerifyEmail/VerifyEmailModal.svelte';
  import Box from '$lib/components/Box/index.svelte';
  import { currentOrg } from '$lib/utils/store/org';
  import { goto } from '$app/navigation';
  import { isSingleOrgMode } from '$lib/utils/config/singleOrg';

  export let data;

  let ref = null;

  // The layout is not remounted on client-side navigation, so a plain mount
  // animation would only ever play once. Flip a class when navigation finishes
  // instead. Opacity only: a transform here would become the containing block
  // for fixed-position children (modals, the chat button, exam toolbars).
  let viewEnter = false;
  let enterTimer;
  $: if ($navigating) {
    viewEnter = false;
  } else {
    clearTimeout(enterTimer);
    viewEnter = true;
    enterTimer = setTimeout(() => (viewEnter = false), 300);
  }

  $: if ($currentOrg.id && data.orgName === '*') {
    const newUrl = $page.url.pathname.replace('*', $currentOrg.siteName);
    goto(newUrl + $page.url.search);
  }
</script>

<RouteProgress />

{#if !isSingleOrgMode()}
  <AddOrgModal />
  <VerifyEmailModal />
{/if}

<div class="org-root w-full flex items-center justify-between">
  {#if !isQuizPage($page.url?.pathname)}
    <OrgSideBar />
  {/if}
  <div
    class="org-slot bg-white dark:bg-black w-full"
    class:is-navigating={!!$navigating}
    class:view-enter={viewEnter}
  >
    {#if data.orgName === '*'}
      <Box>Taking you to your organization...</Box>
    {:else}
      <slot />
    {/if}
  </div>
  {#if data.orgName !== '*' && !isQuizPage($page.url?.pathname)}
    <FeatureGuide scope="org" />
  {/if}
</div>

<style>
  /* Dim while SvelteKit resolves the next route, then fade the new view in.
     No transform anywhere: it would turn .org-slot into the containing block
     for fixed-position children and shift modals and the chat button. */
  .org-slot.is-navigating {
    opacity: 0.55;
    transition: opacity 140ms ease-out;
  }

  .org-slot.view-enter {
    animation: cio-view-in 260ms ease-out;
  }

  @keyframes cio-view-in {
    from {
      opacity: 0.55;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .org-slot.view-enter {
      animation: none;
    }
    .org-slot.is-navigating {
      opacity: 1;
    }
  }
</style>
