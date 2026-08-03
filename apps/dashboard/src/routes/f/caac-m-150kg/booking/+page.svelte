<script lang="ts">
  import { onMount } from 'svelte';
  import FunnelHeader from '$lib/components/Funnel/FunnelHeader.svelte';
  import { CAAC_FUNNEL, isFunnelLocale, type FunnelLocale } from '$lib/funnel/caac';

  let locale: FunnelLocale = 'zh-Hant';
  let calendlyUrl = '';
  let loading = true;
  const content = {
    'zh-Hant': { step: '步驟 2 / 5', title: '預約免費課程諮詢', body: '選擇合適的日期和時間，課程顧問會說明資格、上課安排、考試及付款方式。', note: 'Calendly 連結尚未配置', config: '正式上線前，請在伺服器設定 FUNNEL_CALENDLY_URL。', back: '返回課程頁', checkout: '直接前往付款' },
    en: { step: 'Step 2 / 5', title: 'Book a free course consultation', body: 'Choose a suitable date and time to discuss eligibility, course arrangements, the examination and payment.', note: 'Calendly link is not configured', config: 'Set FUNNEL_CALENDLY_URL on the server before launch.', back: 'Back to course', checkout: 'Continue to payment' },
    'zh-Hans': { step: '步骤 2 / 5', title: '预约免费课程咨询', body: '选择合适的日期和时间，课程顾问会说明资格、上课安排、考试及付款方式。', note: 'Calendly 链接尚未配置', config: '正式上线前，请在服务器设置 FUNNEL_CALENDLY_URL。', back: '返回课程页', checkout: '直接前往付款' }
  } as const;
  $: copy = content[locale];

  function setLocale(next: FunnelLocale) {
    locale = next;
    localStorage.setItem('ailae-funnel-locale', next);
  }

  onMount(async () => {
    const saved = localStorage.getItem('ailae-funnel-locale');
    if (isFunnelLocale(saved)) locale = saved;
    try {
      const response = await fetch(`/api/funnels/${CAAC_FUNNEL.slug}/config`);
      if (response.ok) calendlyUrl = (await response.json()).calendlyUrl || '';
      fetch(`/api/funnels/${CAAC_FUNNEL.slug}/events`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'booking_click', step: 'booking', locale })
      }).catch(() => undefined);
    } finally { loading = false; }
  });
</script>

<svelte:head><title>{copy.title} | AiLAE Funnel</title></svelte:head>

<div class="booking-page">
  <FunnelHeader {locale} compact on:locale={(event) => setLocale(event.detail)} />
  <main>
    <section class="intro">
      <a href="/f/caac-m-150kg">← {copy.back}</a>
      <p>{copy.step}</p><h1>{copy.title}</h1><span>{copy.body}</span>
      <div class="chips"><b>30 min</b><b>Calendly</b><b>繁中 / EN</b></div>
    </section>
    <section class="calendar-card">
      {#if loading}
        <div class="loading">Loading Calendly…</div>
      {:else if calendlyUrl}
        <iframe title="Calendly booking" src={`${calendlyUrl}?hide_gdpr_banner=1&background_color=ffffff&text_color=0a1524&primary_color=0e8a89`}></iframe>
      {:else}
        <div class="empty-calendar">
          <div class="calendar-icon"><span>JUL</span><strong>28</strong></div>
          <div><h2>{copy.note}</h2><p>{copy.config}</p><code>FUNNEL_CALENDLY_URL=https://calendly.com/your-team/caac-consultation</code></div>
        </div>
      {/if}
    </section>
    <div class="actions"><a class="button ghost" href="/f/caac-m-150kg">{copy.back}</a><a class="button primary" href="/f/caac-m-150kg/checkout">{copy.checkout} →</a></div>
  </main>
</div>

<style>
  .booking-page{width:100%}
  :global(body){margin:0;background:#edf2f6}.booking-page{min-height:100vh;background:radial-gradient(circle at 10% 10%,rgba(52,211,153,.12),transparent 23%),#edf2f6;color:#0a1524;font-family:Inter,system-ui,sans-serif}.booking-page *{box-sizing:border-box}main{display:grid;grid-template-columns:330px minmax(0,820px);gap:34px;width:min(1220px,calc(100% - 40px));margin:0 auto;padding:64px 0}.intro>a{color:#567081;font-size:13px;text-decoration:none}.intro>p{margin:52px 0 12px;color:#0e8a89;font-size:11px;font-weight:900;letter-spacing:.14em}.intro h1{margin:0;font-size:43px;line-height:1.08;letter-spacing:-.04em}.intro>span{display:block;margin-top:20px;color:#536678;line-height:1.7}.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:26px}.chips b{border:1px solid #cdd7df;border-radius:99px;background:white;padding:8px 11px;font-size:11px}.calendar-card{overflow:hidden;min-height:680px;border:1px solid #d4dde5;border-radius:24px;background:white;box-shadow:0 24px 70px rgba(16,37,58,.12)}iframe{width:100%;height:680px;border:0}.loading,.empty-calendar{display:grid;min-height:680px;place-items:center}.empty-calendar{grid-template-columns:150px minmax(0,440px);gap:32px;padding:60px}.calendar-icon{display:grid;width:130px;height:150px;place-items:center;border:1px solid #bdd1ce;border-radius:22px;background:#e8fbf7}.calendar-icon span{align-self:end;color:#0e8a89;font-size:12px;font-weight:900;letter-spacing:.2em}.calendar-icon strong{align-self:start;font-size:58px}.empty-calendar h2{font-size:29px}.empty-calendar p{color:#607284;line-height:1.6}.empty-calendar code{display:block;overflow-wrap:anywhere;border-radius:8px;background:#f2f5f7;padding:12px;color:#315669;font-size:12px}.actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:10px}.button{display:inline-flex;min-height:48px;align-items:center;border-radius:11px;padding:0 20px;font-weight:800;text-decoration:none}.button.primary{background:#0a9a82;color:white}.button.ghost{border:1px solid #c8d2dc;background:white;color:#31475a}@media(max-width:900px){main{grid-template-columns:1fr}.intro>p{margin-top:26px}.calendar-card,.loading,.empty-calendar{min-height:590px}iframe{height:590px}}@media(max-width:620px){main{width:calc(100% - 28px);padding:38px 0}.intro h1{font-size:36px}.empty-calendar{grid-template-columns:1fr;padding:30px}.calendar-icon{width:100px;height:112px}.calendar-icon strong{font-size:44px}.actions{flex-direction:column}.button{justify-content:center}}
</style>
