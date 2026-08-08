<script lang="ts">
  // Shimmer placeholder. Prefer this over a flat grey block so the loading state
  // keeps the shape of the content it stands in for.
  export let width = '100%';
  export let height = '1rem';
  export let rounded = 'rounded-md';
  export let className = '';
</script>

<div
  class="cio-shimmer {rounded} {className}"
  style="width: {width}; height: {height};"
  aria-hidden="true"
/>

<style>
  .cio-shimmer {
    background-color: #eceef1;
    background-image: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.65) 50%,
      rgba(255, 255, 255, 0) 100%
    );
    background-size: 200% 100%;
    background-repeat: no-repeat;
    animation: cio-shimmer 1.4s ease-in-out infinite;
  }

  :global(.dark) .cio-shimmer {
    background-color: #2a2a2a;
    background-image: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.08) 50%,
      rgba(255, 255, 255, 0) 100%
    );
  }

  @keyframes cio-shimmer {
    0% {
      background-position: 180% 0;
    }
    100% {
      background-position: -180% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cio-shimmer {
      animation: none;
    }
  }
</style>
