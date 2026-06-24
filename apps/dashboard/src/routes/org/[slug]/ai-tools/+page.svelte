<script lang="ts">
  import ToolHub from '$lib/components/AITools/ToolHub.svelte';
  import { locale } from '$lib/utils/functions/translations';

  $: pageTitle = $locale === 'en' ? 'AI Tools' : $locale === 'zh' ? 'AI 工具' : 'AI 工具';
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<ToolHub />
