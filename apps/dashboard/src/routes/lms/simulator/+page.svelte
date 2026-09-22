<script lang="ts">
  import DroneSimulationDashboard from '$lib/components/Simulator/DroneSimulationDashboard.svelte';
  import DriveResults from '$lib/components/Simulator/DriveResults.svelte';
  import { driveCopy } from '$lib/components/Simulator/driveCopy';
  import { locale } from '$lib/utils/functions/translations';
  import FlightSubmissions from '$lib/components/Simulator/FlightSubmissions.svelte';
  import { sharingCopy } from '$lib/components/Simulator/sharingCopy';
  import { currentOrg } from '$lib/utils/store/org';
  let tab = 'mine';
  $: copy = driveCopy($locale || 'zh-TW');
</script>

<nav class="mx-auto flex max-w-7xl flex-wrap gap-x-6 gap-y-2 border-b border-gray-200 px-5 pt-5 dark:border-neutral-800" aria-label={copy.title}>
  {#each ['mine', 'demo'] as item}
    <button type="button" class="border-b-2 px-1 pb-3 text-sm font-medium {tab === item ? 'border-teal-700 text-teal-700 dark:text-teal-300' : 'border-transparent text-gray-500'}" aria-pressed={tab === item} on:click={() => tab = item}>{copy[item]}</button>
  {/each}
  <button type="button" class="border-b-2 px-1 pb-3 text-sm font-medium {tab === 'share' ? 'border-teal-700 text-teal-700 dark:text-teal-300' : 'border-transparent text-gray-500'}" aria-pressed={tab === 'share'} on:click={() => tab = 'share'}>{sharingCopy($locale || 'zh-TW').studentTab}</button>
</nav>
{#if tab === 'mine'}<DriveResults />{:else if tab === 'share'}<FlightSubmissions orgId={$currentOrg.id}/>{:else}<DroneSimulationDashboard />{/if}
