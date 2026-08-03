<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { FunnelLocale } from '$lib/funnel/caac';

  export let locale: FunnelLocale = 'zh-Hant';
  export let compact = false;
  const dispatch = createEventDispatcher<{ locale: FunnelLocale }>();

  const languages: Array<{ value: FunnelLocale; label: string }> = [
    { value: 'zh-Hant', label: '繁中' },
    { value: 'en', label: 'EN' },
    { value: 'zh-Hans', label: '简中' }
  ];
</script>

<header class:compact class="funnel-header">
  <a class="brand" href="/f/caac-m-150kg" aria-label="AiLAE Funnel home">
    <span class="brand-mark">A</span>
    <span>
      <strong>AiLAE</strong>
      <small>Funnel</small>
    </span>
  </a>
  <nav aria-label="Language switcher">
    {#each languages as language}
      <button
        type="button"
        class:active={locale === language.value}
        aria-pressed={locale === language.value}
        on:click={() => dispatch('locale', language.value)}
      >
        {language.label}
      </button>
    {/each}
  </nav>
</header>

<style>
  .funnel-header {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    min-height: 72px;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(7, 16, 31, 0.86);
    padding: 0 5vw;
    color: white;
    backdrop-filter: blur(18px);
  }
  .funnel-header.compact { min-height: 60px; }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: inherit;
    text-decoration: none;
  }
  .brand:hover { text-decoration: none; }
  .brand-mark {
    display: grid;
    width: 38px;
    height: 38px;
    place-items: center;
    border-radius: 12px;
    background: linear-gradient(135deg, #34d399, #22d3ee);
    color: #06131d;
    font-weight: 900;
  }
  .brand strong { display: block; font-size: 17px; letter-spacing: 0.04em; }
  .brand small { display: block; color: #91a4b7; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; }
  nav { display: flex; gap: 5px; padding: 4px; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 999px; }
  nav button {
    min-height: 32px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    padding: 0 12px;
    color: #9fb0c2;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
  }
  nav button.active { background: white; color: #07101f; }
  nav button:focus-visible { outline: 3px solid #22d3ee; outline-offset: 2px; }
  @media (max-width: 520px) {
    .funnel-header { padding: 0 16px; }
    nav button { padding: 0 9px; }
  }
</style>
