<script>
  import { course } from '$lib/components/Course/store';
  import { BRAND } from '$lib/utils/config/brand';
</script>

<div
  class="certificate-preview flex w-[218px] flex-col items-center justify-center rounded-md border border-gray-200 bg-white px-5 py-6 text-center shadow-sm"
  aria-label="Certificate preview"
>
  <img src={BRAND.logoLarge} alt={`${BRAND.name} logo`} class="mb-3 h-9 w-9 rounded-md" />
  <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
    {BRAND.name}
  </p>
  <p class="mt-3 text-base font-semibold text-gray-900">Certificate of Completion</p>
  <div class="my-4 h-px w-full bg-gray-200"></div>
  <p class="text-[11px] text-gray-500">Awarded for completing</p>
  <p class="mt-1 line-clamp-2 text-sm font-semibold text-primary-800">
    {$course.title || 'Course'}
  </p>
</div>

<style>
  .certificate-preview {
    min-height: 154px;
  }
</style>
