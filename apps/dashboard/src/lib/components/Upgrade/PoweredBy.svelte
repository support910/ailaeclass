<script>
  import { t } from '$lib/utils/functions/translations';
  import { currentOrg, isFreePlan } from '$lib/utils/store/org';
  import { BRAND } from '$lib/utils/config/brand';
</script>

{#if $isFreePlan}
  <span
    class="group fixed bottom-14 right-9 z-50"
  >
    <span
      class="overflow-hidden shadow-md flex items-center gap-1 dark:text-black bg-white border border-gray-50 rounded-md px-2 py-1 text-black text-sm font-medium"
    >
      <img src={BRAND.logo} alt="logo" class="h-[24px]" />
      {$t('course.navItem.landing_page.powered_by')} {BRAND.name}
    </span>
  </span>
{/if}
