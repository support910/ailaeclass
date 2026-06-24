<script lang="ts">
  import Copy from 'carbon-icons-svelte/lib/Copy.svelte';
  import Checkmark from 'carbon-icons-svelte/lib/Checkmark.svelte';

  export let text: string;
  export let copyLabel = 'Copy';
  export let copiedLabel = 'Copied';

  let copied = false;

  async function handleCopy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      // ignore
    }
  }
</script>

<button
  type="button"
  class="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-800"
  on:click={handleCopy}
  title={copied ? copiedLabel : copyLabel}
>
  {#if copied}
    <Checkmark size={14} />
    {copiedLabel}
  {:else}
    <Copy size={14} />
    {copyLabel}
  {/if}
</button>
