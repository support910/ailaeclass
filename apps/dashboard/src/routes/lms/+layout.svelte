<script>
  import { navigating } from '$app/stores';
  import RouteProgress from '$lib/components/Navigation/RouteProgress.svelte';
  import FeatureGuide from '$lib/components/Guide/FeatureGuide.svelte';
  import LMSSideBar from '$lib/components/LMS/SideBar.svelte';

  // Same approach as the org layout: this layout is not remounted on client-side
  // navigation, and no transform is used so fixed-position children stay anchored
  // to the viewport.
  let viewEnter = false;
  let enterTimer;
  $: if ($navigating) {
    viewEnter = false;
  } else {
    clearTimeout(enterTimer);
    viewEnter = true;
    enterTimer = setTimeout(() => (viewEnter = false), 300);
  }
</script>

<RouteProgress />

<div class="org-root w-full flex items-center justify-between">
  <LMSSideBar />
  <div
    class="org-slot bg-white dark:bg-black w-full"
    class:is-navigating={!!$navigating}
    class:view-enter={viewEnter}
  >
    <slot />
  </div>
  <FeatureGuide scope="lms" />
</div>

<style>
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
