<script lang="ts">
  interface Activity {
    icon: any;
    title: string;
    percentage: number | string;
    description: string;
    hidePercentage?: boolean;
  }

  export let activity: Activity;
</script>

<div
  class="group rounded-xl border border-gray-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[0_6px_20px_-8px_rgba(15,23,42,0.18)] dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-neutral-500 dark:hover:shadow-[0_6px_20px_-8px_rgba(0,0,0,0.7)]"
>
  <div class="mb-3 flex items-start justify-between gap-3">
    <p class="text-sm font-medium leading-tight text-gray-600 dark:text-gray-300">
      {activity.title}
    </p>
    <span
      class="bg-primary-100 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-800 transition-transform duration-200 group-hover:scale-105"
    >
      <svelte:component this={activity.icon} size={20} />
    </span>
  </div>

  <p
    class="text-3xl font-bold leading-none tracking-tight text-gray-900 dark:text-white"
    style="font-variant-numeric: tabular-nums;"
  >
    {activity.percentage}{#if !activity.hidePercentage}<span
        class="ml-0.5 text-xl font-semibold text-gray-500 dark:text-gray-400">%</span
      >{/if}
  </p>

  <p class="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
    {activity.description}
  </p>
</div>
