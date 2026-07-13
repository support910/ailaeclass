<script lang="ts">
  import { onMount } from 'svelte';
  import Star from 'carbon-icons-svelte/lib/Star.svelte';
  import StarFilled from 'carbon-icons-svelte/lib/StarFilled.svelte';
  import { getAccessToken } from '$lib/utils/functions/supabase';
  import { setCourseFavorite } from '$lib/utils/services/courses';
  import { snackbar } from '$lib/components/Snackbar/store';
  import { t } from '$lib/utils/functions/translations';

  export let courseId: string | undefined;
  export let tone: 'light' | 'dark' = 'dark';
  let isFavorite = false;
  let visible = false;
  let loading = false;

  onMount(async () => {
    if (!courseId) return;
    const token = await getAccessToken();
    if (!token) return;
    visible = true;
    const response = await fetch(`/api/courses/${courseId}/favorite`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.ok) isFavorite = (await response.json()).isFavorite === true;
  });

  async function toggle() {
    if (!courseId || loading) return;
    loading = true;
    try {
      isFavorite = await setCourseFavorite(courseId, !isFavorite);
    } catch (error) {
      snackbar.error(error instanceof Error ? error.message : 'Failed to update favorite');
    } finally {
      loading = false;
    }
  }
</script>

{#if visible}
  <button
    type="button"
    class="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium disabled:opacity-60 {tone === 'dark' ? 'border-white/50 text-white hover:bg-white/10' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
    disabled={loading}
    aria-label={isFavorite ? $t('courses.management.unfavorite') : $t('courses.management.favorite')}
    on:click={toggle}
  >
    {#if isFavorite}<StarFilled size={18} />{:else}<Star size={18} />{/if}
    {isFavorite ? $t('courses.management.favorited') : $t('courses.management.favorite')}
  </button>
{/if}
