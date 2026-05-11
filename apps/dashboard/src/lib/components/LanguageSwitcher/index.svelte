<script lang="ts">
  import { locale, handleLocaleChange, t, initialized } from '$lib/utils/functions/translations';
  import { LOCALE } from '$lib/utils/types';
  import { profile } from '$lib/utils/store/user';
  import { supabase } from '$lib/utils/functions/supabase';
  import { onMount } from 'svelte';

  let isOpen = false;

  const SUPPORTED_LOCALES = [
    { id: LOCALE.ZH_TW, label: '繁中' },
    { id: LOCALE.EN, label: 'EN' }
  ];

  $: currentLabel = SUPPORTED_LOCALES.find((l) => l.id === $locale)?.label || '繁中';

  function toggleDropdown() {
    isOpen = !isOpen;
  }

  function closeDropdown() {
    isOpen = false;
  }

  async function switchLocale(newLocale: string) {
    if (newLocale === $locale) {
      closeDropdown();
      return;
    }

    await handleLocaleChange(newLocale);

    if ($profile.id) {
      try {
        await supabase.from('profile').update({ locale: newLocale }).match({ id: $profile.id });
        profile.update((p) => ({ ...p, locale: newLocale }));
      } catch (e) {
        console.error('Failed to save locale to profile:', e);
      }
    }

    closeDropdown();
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.language-switcher')) {
      closeDropdown();
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });
</script>

{#if $initialized}
  <div class="language-switcher relative">
    <button
      class="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-700
             hover:bg-gray-100 dark:text-white dark:hover:bg-neutral-700 transition-colors duration-150"
      on:click|stopPropagation={toggleDropdown}
      title={$t('navigation.language_switcher') || 'Switch language'}
    >
      <span>{currentLabel}</span>
      <svg class="h-3 w-3 fill-current" viewBox="0 0 20 20">
        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
      </svg>
    </button>

    {#if isOpen}
      <div
        class="absolute right-0 top-full z-50 mt-1 min-w-[100px] rounded-md border
               border-gray-200 bg-white py-1 shadow-lg dark:border-neutral-600 dark:bg-neutral-800"
      >
        {#each SUPPORTED_LOCALES as localeOption}
          <button
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm
                   text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-neutral-700
                   {$locale === localeOption.id ? 'font-semibold bg-primary-50 dark:bg-neutral-700' : ''}"
            on:click={() => switchLocale(localeOption.id)}
          >
            <span>{localeOption.label}</span>
            {#if $locale === localeOption.id}
              <svg class="ml-auto h-4 w-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}
