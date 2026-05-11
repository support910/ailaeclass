<script>
  import { BRAND } from '$lib/utils/config/brand';
</script>

<!-- markup (zero or more items) goes here -->
<div class="my-1">
  <hr />
  <div class="flex flex-col items-center w-full py-3 gap-1">
    <span class="text-gray-700 text-sm">
      Powered by {BRAND.fullName}
    </span>
    <span class="text-gray-500 text-xs">
      {BRAND.address}
    </span>
    <span class="text-gray-500 text-xs">
      Contact us: <a href="mailto:{BRAND.contactEmail}" class="text-primary-600 hover:underline">{BRAND.contactEmail}</a>
    </span>
  </div>
</div>

<style>
  /* your styles go here */
</style>
