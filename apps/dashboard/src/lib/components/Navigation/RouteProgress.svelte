<script lang="ts">
  import { navigating } from '$app/stores';

  // Driven by SvelteKit's navigating store, so it covers every client-side route
  // change without remounting anything the page owns.
  $: active = !!$navigating;
</script>

{#if active}
  <div class="cio-route-progress" role="progressbar" aria-label="Loading page">
    <span class="cio-route-progress__bar" />
  </div>
{/if}

<style>
  .cio-route-progress {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    z-index: 9999;
    background: transparent;
    pointer-events: none;
    overflow: hidden;
  }

  .cio-route-progress__bar {
    display: block;
    height: 100%;
    width: 100%;
    transform-origin: 0 50%;
    background: linear-gradient(90deg, #14a3a2 0%, #3ebaba 55%, #9edede 100%);
    animation: cio-route-progress 900ms cubic-bezier(0.22, 0.61, 0.36, 1) infinite;
  }

  @keyframes cio-route-progress {
    0% {
      transform: scaleX(0);
      opacity: 1;
    }
    70% {
      transform: scaleX(0.85);
      opacity: 1;
    }
    100% {
      transform: scaleX(1);
      opacity: 0.35;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cio-route-progress__bar {
      animation: none;
      transform: scaleX(1);
      opacity: 0.7;
    }
  }
</style>
