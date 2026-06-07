<script lang="ts">
  export let index: number;
  export let title: string;
  export let image: { url: string; alt?: string } | null = null;
</script>

<span class="flex flex-col gap-2">
  <span class="flex gap-2">
    <p class="text-md font-medium">{index}</p>
    <p class="text-md font-medium">{title}</p>
  </span>
  {#if image?.url}
    <img
      src={image.url}
      alt={image.alt || 'Question image'}
      class="max-w-full max-h-64 rounded-md border border-gray-200 dark:border-gray-700 object-contain"
    />
  {/if}
</span>
