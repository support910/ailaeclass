<script lang="ts">
  import DroneSimulationDashboard from '$lib/components/Simulator/DroneSimulationDashboard.svelte';
  import FlightSubmissions from '$lib/components/Simulator/FlightSubmissions.svelte';
  import { sharingCopy } from '$lib/components/Simulator/sharingCopy';
  import { driveCopy } from '$lib/components/Simulator/driveCopy';
  import { locale } from '$lib/utils/functions/translations';
  import { currentOrg } from '$lib/utils/store/org';
  let submissions = false;
</script>

<nav class="mx-auto flex max-w-7xl flex-wrap gap-x-6 gap-y-2 border-b border-gray-200 px-5 pt-5 dark:border-neutral-800" aria-label={sharingCopy($locale || 'zh-TW').staffTab}>
  <button type="button" class="border-b-2 px-1 pb-3 text-sm font-medium {submissions ? 'border-transparent text-gray-500' : 'border-teal-700 text-teal-700'}" aria-pressed={!submissions} on:click={() => submissions = false}>{driveCopy($locale || 'zh-TW').demo}</button>
  <button type="button" class="border-b-2 px-1 pb-3 text-sm font-medium {submissions ? 'border-teal-700 text-teal-700' : 'border-transparent text-gray-500'}" aria-pressed={submissions} on:click={() => submissions = true}>{sharingCopy($locale || 'zh-TW').staffTab}</button>
</nav>
{#if submissions}<FlightSubmissions orgId={$currentOrg.id} staff/>{:else}<DroneSimulationDashboard />{/if}
