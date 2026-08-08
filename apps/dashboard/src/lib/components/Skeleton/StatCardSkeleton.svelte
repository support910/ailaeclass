<script lang="ts">
  import Shimmer from './Shimmer.svelte';
</script>

<!-- Mirrors ActivityCard's box so the layout does not shift when data lands. -->
<div
  class="rounded-xl border border-gray-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-900"
>
  <div class="mb-4 flex items-start justify-between">
    <Shimmer width="6.5rem" height="0.75rem" />
    <Shimmer width="2.25rem" height="2.25rem" rounded="rounded-lg" />
  </div>
  <Shimmer width="4rem" height="2rem" className="mb-2" />
  <Shimmer width="80%" height="0.7rem" />
</div>
