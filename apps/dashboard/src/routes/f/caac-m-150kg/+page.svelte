<script lang="ts">
  import { onMount } from 'svelte';
  import FunnelHeader from '$lib/components/Funnel/FunnelHeader.svelte';
  import { CAAC_FUNNEL, funnelCopy, isFunnelLocale, type FunnelLocale } from '$lib/funnel/caac';

  let locale: FunnelLocale = 'zh-Hant';
  let name = '';
  let email = '';
  let phone = '';
  let role = '';
  let website = '';
  let consent = false;
  let submitting = false;
  let formError = '';
  let leadId = '';
  let config = { calendlyUrl: '', ebookUrl: '', supportWhatsApp: '' };

  $: copy = funnelCopy[locale];

  function setLocale(next: FunnelLocale) {
    locale = next;
    localStorage.setItem('ailae-funnel-locale', next);
    document.documentElement.lang = next === 'zh-Hant' ? 'zh-HK' : next === 'zh-Hans' ? 'zh-CN' : 'en';
  }

  async function track(eventType: string, step = 'landing') {
    fetch(`/api/funnels/${CAAC_FUNNEL.slug}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, step, locale, leadId })
    }).catch(() => undefined);
  }

  async function submitLead() {
    formError = '';
    if (!name.trim() || !email.trim() || !consent) {
      formError = locale === 'en' ? 'Please complete the required fields.' : locale === 'zh-Hans' ? '请填写必填资料并同意隐私政策。' : '請填寫必填資料並同意私隱政策。';
      return;
    }
    submitting = true;
    try {
      const response = await fetch(`/api/funnels/${CAAC_FUNNEL.slug}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, role, website, consent, locale, source: 'ebook-form' })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Unable to submit');
      leadId = result.leadId;
      localStorage.setItem('ailae-funnel-lead', leadId);
      document.getElementById('ebook-success')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
      formError = error instanceof Error ? error.message : 'Unable to submit';
    } finally {
      submitting = false;
    }
  }

  onMount(async () => {
    const savedLocale = localStorage.getItem('ailae-funnel-locale');
    if (isFunnelLocale(savedLocale)) setLocale(savedLocale);
    leadId = localStorage.getItem('ailae-funnel-lead') || '';
    track('page_view');
    try {
      const response = await fetch(`/api/funnels/${CAAC_FUNNEL.slug}/config`);
      if (response.ok) config = await response.json();
    } catch {
      // The page remains fully usable in local demo mode.
    }
  });
</script>

<svelte:head>
  <title>{copy.eyebrow} | AiLAE Funnel</title>
  <meta name="description" content={copy.heroBody} />
</svelte:head>

<div class="funnel-page">
  <FunnelHeader {locale} on:locale={(event) => setLocale(event.detail)} />

  <main>
    <section class="hero section-shell">
      <div class="hero-copy">
        <div class="eyebrow"><span></span>{copy.eyebrow}</div>
        <h1>{copy.heroTitle}</h1>
        <p class="hero-lead">{copy.heroBody}</p>
        <div class="hero-actions">
          <a class="button primary" href="#ebook" on:click={() => track('ebook_click', 'ebook')}>{copy.ebookCta}</a>
          <a class="button secondary" href="/f/caac-m-150kg/booking" on:click={() => track('booking_click', 'booking')}>{copy.consultCta}</a>
        </div>
        <div class="trust-row">
          <span>✓ Stripe</span><span>✓ FPS</span><span>✓ Calendly</span><span>✓ 繁中 / EN / 简中</span>
        </div>
      </div>

      <aside class="offer-card" aria-label="Course offer">
        <div class="offer-topline"><span>COURSE OFFER</span><span>CAAC-M</span></div>
        <div class="drone-orbit" aria-hidden="true">
          <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
          <div class="drone-core">150<span>Kg</span></div>
        </div>
        <div class="price-block">
          <small>{copy.originalLabel} <s>HK${CAAC_FUNNEL.originalPrice.toLocaleString()}</s></small>
          <strong>HK${CAAC_FUNNEL.salePrice.toLocaleString()}</strong>
          <span>{copy.priceLabel}</span>
        </div>
        <div class="bonus-strip"><small>{copy.bonusLabel}</small><b>{copy.bonusTitle}</b><span>{copy.bonusValue}</span></div>
      </aside>
    </section>

    <section class="journey section-shell" aria-labelledby="journey-title">
      <div class="section-heading"><span>01</span><div><p>AUTOMATED JOURNEY</p><h2 id="journey-title">{copy.journeyTitle}</h2></div></div>
      <ol>
        {#each copy.journey as step, index}
          <li><span>{String(index + 1).padStart(2, '0')}</span><b>{step}</b>{#if index < copy.journey.length - 1}<i aria-hidden="true">→</i>{/if}</li>
        {/each}
      </ol>
    </section>

    <section id="ebook" class="lead-section section-shell">
      <div class="ebook-preview">
        <div class="book">
          <div class="book-label">FREE PDF</div>
          <small>AiLAE • CAAC-M</small>
          <h2>150Kg<br />無人機牌照<br />課程電子書</h2>
          <p>COURSE & EXAMINATION GUIDE</p>
        </div>
        <div class="preview-copy"><span>免費內容包括</span><b>報讀流程 · 資格確認 · 考試安排 · 付款步驟</b></div>
      </div>

      <div class="lead-form-wrap">
        <p class="kicker">FREE LEAD MAGNET</p>
        <h2>{copy.ebookTitle}</h2>
        <p>{copy.ebookBody}</p>
        {#if leadId}
          <div id="ebook-success" class="success-card" role="status">
            <strong>{copy.success}</strong>
            {#if config.ebookUrl}
              <a class="button primary" href={config.ebookUrl} target="_blank" rel="noreferrer">{copy.download}</a>
            {:else}
              <a class="button primary" href="/funnel-assets/CAAC-M-150Kg-course-ebook-preview.pdf" target="_blank">{copy.download}</a>
            {/if}
          </div>
        {:else}
          <form on:submit|preventDefault={submitLead} novalidate>
            <div class="form-grid">
              <label><span>{copy.name} *</span><input bind:value={name} autocomplete="name" required /></label>
              <label><span>{copy.email} *</span><input bind:value={email} type="email" autocomplete="email" required /></label>
              <label><span>{copy.phone}</span><input bind:value={phone} autocomplete="tel" /></label>
              <label><span>{copy.role}</span><input bind:value={role} /></label>
            </div>
            <label class="honeypot" aria-hidden="true">Website<input bind:value={website} tabindex="-1" autocomplete="off" /></label>
            <label class="consent"><input bind:checked={consent} type="checkbox" required /><span>{copy.consent}</span></label>
            {#if formError}<p class="form-error" role="alert">{formError}</p>{/if}
            <button class="button primary full" type="submit" disabled={submitting}>{submitting ? copy.submitting : copy.submit}</button>
          </form>
        {/if}
      </div>
    </section>

    <section class="value section-shell">
      <div class="value-main">
        <div class="section-heading light"><span>02</span><div><p>WHAT YOU RECEIVE</p><h2>{copy.includedTitle}</h2></div></div>
        <ul>{#each copy.included as item}<li><span>✓</span>{item}</li>{/each}</ul>
      </div>
      <aside class="verification">
        <p>TRANSPARENCY FIRST</p>
        <h3>{copy.verifyTitle}</h3>
        <ul>{#each copy.verify as item}<li>{item}</li>{/each}</ul>
        <small>AiLAE 不會顯示未經證實的「保證通過」或牌照承諾。</small>
      </aside>
    </section>

    <section class="faq section-shell">
      <div class="section-heading"><span>03</span><div><p>FAQ</p><h2>{copy.faqTitle}</h2></div></div>
      <div class="faq-grid">
        {#each copy.faqs as faq, index}
          <details open={index === 0}><summary>{faq[0]}<span>+</span></summary><p>{faq[1]}</p></details>
        {/each}
      </div>
    </section>

    <section class="final-cta section-shell">
      <div><p>START WITH CLARITY</p><h2>{copy.finalTitle}</h2><span>{copy.finalBody}</span></div>
      <div class="hero-actions"><a class="button primary" href="#ebook">{copy.ebookCta}</a><a class="button secondary dark" href="/f/caac-m-150kg/checkout">HK$18,000</a></div>
    </section>
  </main>

  <footer class="section-shell"><span>© 2026 AiLAE Funnel</span><nav><a href="/privacy">{copy.privacy}</a><a href="/terms">{copy.terms}</a></nav></footer>
</div>

<style>
  :global(body) { margin: 0; background: #07101f; }
  :global(.funnel-page *) { box-sizing: border-box; }
  .funnel-page { width: 100%; min-height: 100vh; background: #f5f7fa; color: #0a1524; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
  .section-shell { width: min(1180px, calc(100% - 40px)); margin: 0 auto; }
  .hero { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(340px, .85fr); gap: clamp(32px, 5vw, 64px); align-items: center; min-height: 700px; padding: 88px 0; }
  .funnel-page main { overflow: hidden; background: radial-gradient(circle at 80% 6%, rgba(34,211,238,.13), transparent 24%), linear-gradient(#07101f 0 700px, #f5f7fa 700px); }
  .hero-copy { min-width: 0; color: white; }
  .eyebrow { display: flex; align-items: center; gap: 10px; color: #69e5ce; font-size: 13px; font-weight: 800; letter-spacing: .08em; }
  .eyebrow span { width: 32px; height: 2px; background: #34d399; }
  h1 { max-width: 720px; margin: 24px 0; overflow-wrap: anywhere; font-size: clamp(43px, 5.5vw, 72px); line-height: 1.02; letter-spacing: -.045em; }
  .hero-lead { max-width: 650px; color: #b7c5d4; font-size: clamp(17px, 2vw, 21px); line-height: 1.7; }
  .hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
  .button { display: inline-flex; min-height: 50px; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 12px; padding: 0 22px; font-weight: 800; text-decoration: none; transition: transform .2s, box-shadow .2s; cursor: pointer; }
  .button:hover { transform: translateY(-2px); text-decoration: none; }
  .button.primary { background: linear-gradient(135deg, #34d399, #22d3ee); color: #06131d; box-shadow: 0 14px 32px rgba(34,211,238,.18); }
  .button.secondary { border-color: #34465a; background: transparent; color: white; }
  .button.secondary.dark { border-color: #cdd5df; color: #0a1524; }
  .button.full { width: 100%; }
  button:disabled { cursor: wait; opacity: .65; }
  .trust-row { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 26px; color: #8296aa; font-size: 12px; }
  .offer-card { position: relative; overflow: hidden; min-width: 0; min-height: 530px; border: 1px solid rgba(255,255,255,.13); border-radius: 28px; background: linear-gradient(145deg, rgba(255,255,255,.1), rgba(255,255,255,.025)); padding: 24px; color: white; box-shadow: 0 30px 80px rgba(0,0,0,.35); }
  .offer-topline { display: flex; justify-content: space-between; color: #8da0b3; font-size: 11px; font-weight: 800; letter-spacing: .16em; }
  .drone-orbit { position: relative; display: grid; height: 270px; place-items: center; }
  .orbit { position: absolute; border: 1px solid rgba(52,211,153,.28); border-radius: 50%; }
  .orbit-one { width: 250px; height: 250px; animation: orbit 12s linear infinite; }
  .orbit-two { width: 178px; height: 178px; border-color: rgba(34,211,238,.4); animation: orbit 8s linear reverse infinite; }
  .orbit::before,.orbit::after { position: absolute; width: 10px; height: 10px; border-radius: 50%; background: #34d399; content: ''; }
  .orbit::before { left: 18px; top: 42px; }.orbit::after { right: 12px; bottom: 48px; background: #22d3ee; }
  .drone-core { z-index: 2; display: flex; align-items: baseline; font-size: 74px; font-weight: 900; letter-spacing: -.08em; }
  .drone-core span { margin-left: 6px; color: #69e5ce; font-size: 18px; letter-spacing: 0; }
  @keyframes orbit { to { transform: rotate(360deg); } }
  .price-block { display: grid; grid-template-columns: 1fr auto; align-items: end; border-top: 1px solid rgba(255,255,255,.14); padding-top: 20px; }
  .price-block small { grid-column: 1 / -1; color: #90a3b6; }.price-block strong { font-size: 43px; letter-spacing: -.04em; }.price-block span { color: #69e5ce; font-size: 12px; font-weight: 800; }
  .bonus-strip { display: grid; grid-template-columns: 1fr auto; margin-top: 22px; border-radius: 16px; background: #10253a; padding: 15px 16px; }
  .bonus-strip small { grid-column: 1 / -1; color: #7e93a7; }.bonus-strip b { font-size: 14px; }.bonus-strip span { color: #fbbf24; font-size: 12px; font-weight: 800; }
  .journey { padding: 100px 0 70px; }
  .section-heading { display: flex; align-items: center; gap: 16px; margin-bottom: 34px; }
  .section-heading > span { color: #10a58a; font-size: 12px; font-weight: 900; }
  .section-heading p,.kicker,.final-cta p,.verification > p { margin: 0 0 6px; color: #0e8a89; font-size: 11px; font-weight: 900; letter-spacing: .16em; }
  .section-heading h2,.lead-form-wrap h2,.final-cta h2 { margin: 0; font-size: clamp(30px, 4vw, 48px); line-height: 1.1; letter-spacing: -.035em; }
  .journey ol { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin: 0; padding: 0; list-style: none; }
  .journey li { position: relative; min-height: 130px; border: 1px solid #dce2e9; border-radius: 18px; background: white; padding: 20px; }
  .journey li > span { color: #0e8a89; font-size: 11px; font-weight: 900; }.journey li b { display: block; margin-top: 28px; font-size: 15px; }.journey li i { position: absolute; right: -11px; top: 54px; z-index: 2; color: #0e8a89; font-style: normal; }
  .lead-section { display: grid; grid-template-columns: .9fr 1.1fr; overflow: hidden; border-radius: 30px; background: #0b1728; box-shadow: 0 26px 80px rgba(7,16,31,.18); }
  .ebook-preview { display: grid; place-items: center; min-height: 650px; background: radial-gradient(circle at 20% 20%, rgba(52,211,153,.2), transparent 26%), #0a1524; padding: 60px; }
  .book { width: min(330px, 90%); min-height: 430px; border-left: 10px solid #1a3346; background: linear-gradient(145deg, #f8fffe, #d9f7f2); padding: 40px; box-shadow: 24px 28px 0 #07101f, 30px 36px 60px rgba(0,0,0,.3); transform: rotate(-3deg); }
  .book-label { display: inline-flex; background: #0a1524; padding: 7px 10px; color: #6ee7d1; font-size: 11px; font-weight: 900; letter-spacing: .12em; }.book small { display: block; margin-top: 40px; color: #577080; }.book h2 { margin: 20px 0; font-size: 39px; line-height: 1.12; letter-spacing: -.04em; }.book p { border-top: 1px solid #9bc7c1; padding-top: 18px; color: #52716d; font-size: 10px; letter-spacing: .12em; }
  .preview-copy { margin-top: 45px; color: #cbd7e3; text-align: center; }.preview-copy span { display: block; color: #6ee7d1; font-size: 12px; }.preview-copy b { display: block; margin-top: 8px; font-size: 13px; }
  .lead-form-wrap { display: flex; flex-direction: column; justify-content: center; padding: clamp(38px, 6vw, 74px); color: white; }.lead-form-wrap > p:not(.kicker) { color: #a9b8c7; line-height: 1.7; }
  form { margin-top: 20px; }.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }label span { display: block; margin-bottom: 7px; color: #b8c7d5; font-size: 12px; font-weight: 700; }input { width: 100%; min-height: 47px; border: 1px solid #2b4156; border-radius: 10px; background: #101f31; padding: 0 13px; color: white; }input:focus { border-color: #34d399; outline: 3px solid rgba(52,211,153,.13); }.consent { display: grid; grid-template-columns: 18px 1fr; gap: 10px; margin: 17px 0; }.consent input { min-height: auto; }.consent span { margin: 0; line-height: 1.5; }.honeypot { position: absolute; left: -9999px; }.form-error { color: #fca5a5 !important; font-size: 13px; }.success-card { display: grid; gap: 18px; margin-top: 24px; border: 1px solid rgba(52,211,153,.35); border-radius: 16px; background: rgba(52,211,153,.08); padding: 24px; }
  .value { display: grid; grid-template-columns: 1.2fr .8fr; gap: 0; padding: 110px 0; }.value-main { border-radius: 28px 0 0 28px; background: #0a1524; padding: 54px; color: white; }.section-heading.light p { color: #69e5ce; }.value-main ul,.verification ul { margin: 30px 0 0; padding: 0; list-style: none; }.value-main li { display: flex; gap: 12px; border-top: 1px solid #203348; padding: 17px 0; }.value-main li span { color: #34d399; }.verification { border: 1px solid #dce2e9; border-radius: 0 28px 28px 0; background: white; padding: 54px; }.verification h3 { font-size: 25px; line-height: 1.25; }.verification li { position: relative; margin-bottom: 14px; padding-left: 18px; color: #46576a; line-height: 1.5; }.verification li::before { position: absolute; left: 0; color: #e5a20c; content: '•'; }.verification small { display: block; margin-top: 26px; border-radius: 10px; background: #fff8df; padding: 14px; color: #7b5a0a; line-height: 1.5; }
  .faq { padding: 20px 0 110px; }.faq-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }.faq details { border: 1px solid #dce2e9; border-radius: 16px; background: white; padding: 22px; }.faq summary { display: flex; justify-content: space-between; cursor: pointer; font-weight: 800; list-style: none; }.faq summary span { color: #0e8a89; }.faq details p { color: #526274; line-height: 1.65; }
  .final-cta { display: flex; align-items: center; justify-content: space-between; gap: 40px; border-radius: 28px; background: linear-gradient(120deg,#d9fbf4,#dff6ff); padding: 54px; }.final-cta > div > span { display: block; margin-top: 12px; color: #46576a; }.final-cta .hero-actions { flex-shrink: 0; margin: 0; }
  footer { display: flex; justify-content: space-between; padding: 44px 0; color: #718096; font-size: 12px; }footer nav { display: flex; gap: 20px; }footer a { color: inherit; }
  @media (max-width: 900px) {
    .hero,.lead-section,.value { grid-template-columns: 1fr; }.hero { min-height: auto; }.funnel-page main { background: linear-gradient(#07101f 0 1120px, #f5f7fa 1120px); }.offer-card { min-height: 480px; }.journey ol { grid-template-columns: 1fr 1fr; }.journey li i { display: none; }.value-main,.verification { border-radius: 24px; }.faq-grid { grid-template-columns: 1fr; }.final-cta { align-items: flex-start; flex-direction: column; }
  }
  @media (max-width: 620px) {
    .section-shell { width: min(100% - 28px, 1180px); }.hero { padding: 60px 0; }.funnel-page main { background: linear-gradient(#07101f 0 1060px, #f5f7fa 1060px); }.offer-card { min-height: 440px; }.journey { padding-top: 72px; }.journey ol,.form-grid { grid-template-columns: 1fr; }.ebook-preview,.lead-form-wrap,.value-main,.verification,.final-cta { padding: 34px 24px; }.ebook-preview { min-height: 570px; }.book { min-height: 400px; padding: 30px; }.book h2 { font-size: 33px; }.price-block strong { font-size: 36px; }.final-cta .hero-actions { width: 100%; }.final-cta .button { width: 100%; }footer { flex-direction: column; gap: 12px; }
  }
  @media (prefers-reduced-motion: reduce) { .orbit { animation: none; } .button { transition: none; } }
</style>
