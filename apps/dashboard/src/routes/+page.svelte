<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { isSingleOrgMode } from '$lib/utils/config/singleOrg';
  import { hasSession } from '$lib/utils/functions/supabase';
  import { BRAND } from '$lib/utils/config/brand';
  import AilaeDistrictMap from '$lib/components/Landing/AilaeDistrictMap.svelte';

  onMount(() => {
    if (isSingleOrgMode()) {
      goto(hasSession() ? '/lms' : '/login');
    }
  });
</script>

<svelte:head>
  <title>{BRAND.name} — 18 District School Center</title>
</svelte:head>

{#if !isSingleOrgMode()}
  <section class="landing-shell">
    <main class="landing-content">
      <div class="brand-lockup" aria-label="5GNU Multimedia Limited">
        <span class="brand-mark">5G</span>
        <span>
          <strong>5GNU</strong>
          <small>MULTIMEDIA LIMITED</small>
        </span>
      </div>

      <h1>
        <span class="district-number">18</span>
        <span class="district-title">District<br />School Center</span>
      </h1>

      <p class="promotion-label"><span></span>AiLAE Promotion</p>

      <div class="feature-list" aria-label="Promotion highlights">
        <div class="feature-item">
          <span class="feature-icon">◎</span>
          <p><strong>From HK to</strong><em>OBOR and European Market via UK</em></p>
        </div>
        <div class="feature-item">
          <span class="feature-icon">⌂</span>
          <p><strong>18 Districts</strong><em>School Center Network</em></p>
        </div>
        <div class="feature-item">
          <span class="feature-icon">▱</span>
          <p><strong>AiLAE Empowerment</strong><em>AI Learning · Aerial Tech · Education</em></p>
        </div>
      </div>

      <div class="cta-row" aria-label="Account actions">
        <a href="/login" class="primary-cta">Get Started</a>
        <a href="/login" class="secondary-cta">Login</a>
      </div>
    </main>

    <div class="map-visual" aria-hidden="true">
      <AilaeDistrictMap />
    </div>
  </section>
{/if}

<style>
  :global(body) {
    margin: 0;
  }

  .landing-shell {
    position: relative;
    display: grid;
    grid-template-columns: minmax(420px, 38vw) 1fr;
    width: 100vw;
    min-height: 100svh;
    overflow: hidden;
    background:
      radial-gradient(circle at 72% 48%, rgba(7, 68, 88, 0.3), transparent 34rem),
      radial-gradient(circle at 18% 78%, rgba(1, 166, 214, 0.12), transparent 28rem),
      linear-gradient(105deg, #030d18 0%, #020817 50%, #020716 100%);
    color: #fff;
  }

  .landing-shell::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(29, 218, 255, 0.15) 1px, transparent 1px);
    background-size: 28px 28px;
    opacity: 0.16;
    pointer-events: none;
  }

  .map-visual {
    grid-column: 2;
    position: relative;
    overflow: hidden;
    pointer-events: none;
  }

  .landing-content {
    grid-column: 1;
    position: relative;
    z-index: 2;
    display: flex;
    min-height: 100svh;
    flex-direction: column;
    justify-content: center;
    padding: clamp(2rem, 5vw, 5.5rem);
  }

  .brand-lockup {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    margin-bottom: clamp(2rem, 5vh, 4rem);
    color: #eafcff;
  }

  .brand-mark {
    display: grid;
    width: 3.3rem;
    height: 3.3rem;
    place-items: center;
    border-radius: 0.75rem;
    background: linear-gradient(135deg, #1dd7f5, #246dff);
    box-shadow: 0 0 24px rgba(29, 215, 245, 0.28);
    font-weight: 900;
  }

  .brand-lockup strong {
    display: block;
    font-size: 1.45rem;
    line-height: 1;
    letter-spacing: 0;
  }

  .brand-lockup small {
    display: block;
    margin-top: 0.45rem;
    color: #7f90aa;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.14em;
  }

  h1 {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: start;
    column-gap: clamp(1rem, 1.9vw, 2rem);
    margin: 0;
    line-height: 0.92;
  }

  .district-number {
    color: #22c7ee;
    font-size: clamp(6rem, 9vw, 10.5rem);
    font-weight: 900;
    letter-spacing: 0;
    text-shadow: 0 0 30px rgba(34, 199, 238, 0.18);
  }

  .district-title {
    padding-top: 0.45rem;
    color: #fff;
    font-size: clamp(3.2rem, 5.2vw, 6.3rem);
    font-weight: 900;
    letter-spacing: 0;
  }

  .promotion-label {
    display: flex;
    align-items: center;
    gap: 1.15rem;
    margin: clamp(1.8rem, 4vh, 3rem) 0 clamp(1.6rem, 3.5vh, 2.4rem);
    color: #58f2ff;
    font-size: clamp(1.65rem, 2.4vw, 2.65rem);
    font-weight: 800;
    letter-spacing: 0;
  }

  .promotion-label span {
    width: 3.5rem;
    height: 2px;
    background: #18d7ef;
    box-shadow: 0 0 16px rgba(24, 215, 239, 0.6);
  }

  .feature-list {
    display: grid;
    gap: 1rem;
    max-width: 36rem;
  }

  .feature-item {
    display: grid;
    grid-template-columns: 3.35rem 1fr;
    align-items: center;
    gap: 1rem;
  }

  .feature-icon {
    display: grid;
    width: 3.35rem;
    height: 3.35rem;
    place-items: center;
    border: 1px solid rgba(36, 215, 239, 0.35);
    border-radius: 999px;
    background: rgba(4, 48, 70, 0.58);
    color: #56edff;
    font-size: 1.45rem;
    box-shadow: inset 0 0 18px rgba(42, 211, 245, 0.12);
  }

  .feature-item p {
    margin: 0;
  }

  .feature-item strong,
  .feature-item em {
    display: block;
    font-style: normal;
  }

  .feature-item strong {
    color: #54edf9;
    font-size: clamp(1.05rem, 1.28vw, 1.45rem);
    line-height: 1.25;
  }

  .feature-item:first-child strong {
    color: #dceeff;
    font-size: 1.05rem;
    text-transform: uppercase;
  }

  .feature-item em {
    margin-top: 0.25rem;
    color: #a7b7c9;
    font-size: clamp(0.94rem, 1vw, 1.1rem);
    font-weight: 700;
  }

  .feature-item:first-child em {
    color: #ffc629;
    font-size: clamp(1.05rem, 1.18vw, 1.25rem);
  }

  .cta-row {
    display: flex;
    gap: 1rem;
    margin-top: clamp(2rem, 4vh, 3.2rem);
  }

  .primary-cta,
  .secondary-cta {
    display: inline-flex;
    min-width: 10.8rem;
    min-height: 3.5rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    font-size: 1rem;
    font-weight: 800;
    text-decoration: none;
    transition:
      transform 180ms ease,
      box-shadow 180ms ease,
      border-color 180ms ease;
  }

  .primary-cta {
    background: linear-gradient(135deg, #18d1ef, #2d6ef7);
    color: #fff;
    box-shadow: 0 16px 34px rgba(18, 176, 236, 0.3);
  }

  .secondary-cta {
    border: 1px solid rgba(44, 217, 242, 0.32);
    background: rgba(2, 13, 26, 0.62);
    color: #6ff4ff;
  }

  .primary-cta:hover,
  .secondary-cta:hover {
    transform: translateY(-1px);
  }

  .primary-cta:hover {
    box-shadow: 0 18px 42px rgba(18, 176, 236, 0.42);
  }

  .secondary-cta:hover {
    border-color: rgba(92, 238, 255, 0.62);
  }

  @media (max-width: 1180px) {
    .landing-content {
      padding: clamp(1.5rem, 4vw, 4rem);
    }
  }

  @media (max-width: 760px) {
    .landing-shell {
      display: block;
      min-height: 100svh;
    }

    .map-visual {
      position: absolute;
      inset: 25% -20% 0 -20%;
      opacity: 0.35;
      z-index: 0;
    }

    .landing-content {
      width: 100%;
      min-height: 100svh;
      justify-content: flex-start;
      padding: 2rem 1.25rem 7rem;
    }

    .brand-lockup {
      margin-bottom: 2.6rem;
    }

    h1 {
      grid-template-columns: 1fr;
      row-gap: 0.4rem;
    }

    .district-number {
      font-size: clamp(5.2rem, 24vw, 7rem);
    }

    .district-title {
      padding-top: 0;
      font-size: clamp(3.2rem, 15vw, 4.7rem);
    }

    .feature-list {
      gap: 0.85rem;
    }

    .feature-item {
      grid-template-columns: 2.8rem 1fr;
    }

    .feature-icon {
      width: 2.8rem;
      height: 2.8rem;
    }

    .cta-row {
      position: fixed;
      right: 1rem;
      bottom: 1rem;
      left: 1rem;
      z-index: 5;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin: 0;
    }

    .primary-cta,
    .secondary-cta {
      min-width: 0;
      min-height: 3.25rem;
    }
  }
</style>
