<script>
  import PrimaryButton from '$lib/components/PrimaryButton/index.svelte';
  import Audience from '$lib/components/Org/Audience/index.svelte';
  import { PageUnauthorized } from '$lib/components/Page';
  import { t } from '$lib/utils/functions/translations';
  import { orgAudience, currentOrgPlan, currentOrgMaxAudience, isOrgAdmin } from '$lib/utils/store/org';
  import { PLAN } from 'shared/src/plans/constants';
  import { snackbar } from '$lib/components/Snackbar/store';

  let isLoading = false;

  // plain <script>, not lang="ts" -- no type annotations here
  function csvCell(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  }

  // Was alert('This feature is coming soon') on a prominent primary button.
  // Export exactly the columns already rendered on this page for this admin --
  // convenience, not new data exposure. The pseudonymisation rules in the
  // interaction doc §12.3/12.4 cover the data-cockpit analytics export, which is
  // a different dataset and stays untouched.
  function exportAudience() {
    if (isLoading) return;
    isLoading = true;
    try {
      const rows = [
        ['name', 'email', 'date_joined'],
        ...$orgAudience.map((a) => [a.name, a.email, a.date_joined])
      ];
      const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `audience-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Audience export failed:', error);
      snackbar.error('snackbar.generic_error');
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Audience</title>
</svelte:head>

{#if $isOrgAdmin === null}
  <div class="py-10 px-5" />
{:else if !$isOrgAdmin}
  <PageUnauthorized />
{:else}
  <section class="w-full max-w-4xl mx-auto">
    <div class="py-10 px-5">
      <div class="flex items-center justify-between mb-10">
        <div class="flex items-end">
          <h1 class="dark:text-white text-2xl md:text-3xl font-bold m-0">{$t('audience.title')}</h1>
          {#if $currentOrgPlan?.plan_name !== PLAN.ENTERPRISE}
            <span class="ml-2">
              ({$orgAudience.length} / {$currentOrgMaxAudience})
            </span>
          {/if}
        </div>
        <PrimaryButton
          label={$t('audience.export')}
          onClick={exportAudience}
          isDisabled={isLoading}
          {isLoading}
        />
      </div>

      <Audience />
    </div>
  </section>
{/if}
