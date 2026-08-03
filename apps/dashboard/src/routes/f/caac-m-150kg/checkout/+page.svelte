<script lang="ts">
  import { onMount } from 'svelte';
  import FunnelHeader from '$lib/components/Funnel/FunnelHeader.svelte';
  import { CAAC_FUNNEL, isFunnelLocale, type FunnelLocale } from '$lib/funnel/caac';

  let locale: FunnelLocale = 'zh-Hant';
  let name = '';
  let email = '';
  let phone = '';
  let paymentMethod: 'stripe' | 'fps' = 'stripe';
  let loading = false;
  let error = '';
  let fpsResult: null | { reference: string; fpsId: string; accountName: string; amount: number; demo: boolean } = null;
  let providers = { stripe: { configured: false, mode: 'test' }, fps: { configured: false } };
  const content = {
    'zh-Hant': { step: '步驟 4 / 5', title: '安全付款', subtitle: '請先確認課程及考試安排。付款不代表任何未經證實的「保證通過」承諾。', name: '付款人姓名', email: 'Email', phone: '電話／WhatsApp', methods: '選擇付款方式', stripe: 'Stripe 信用卡', fps: '轉數快 FPS', stripeNote: '前往 Stripe 安全結帳頁', fpsNote: '取得付款編號後，按指示完成轉帳', pay: '支付 HK$18,000', processing: '正在建立付款…', summary: '訂單摘要', course: 'CAAC-M 150Kg 課程和考試', bonus: '贈品：考試禁區考察團', original: '原價', offer: '優惠價', back: '返回課程頁', fpsReady: 'FPS 付款資料已建立', reference: '付款參考編號', demo: '目前是展示模式；正式 FPS ID 尚未設定。' },
    en: { step: 'Step 4 / 5', title: 'Secure payment', subtitle: 'Confirm course and examination arrangements first. Payment does not imply an unverified pass guarantee.', name: 'Payer name', email: 'Email', phone: 'Phone / WhatsApp', methods: 'Choose payment method', stripe: 'Stripe card', fps: 'FPS transfer', stripeNote: 'Continue to secure Stripe Checkout', fpsNote: 'Receive a payment reference and follow the transfer instructions', pay: 'Pay HK$18,000', processing: 'Creating payment…', summary: 'Order summary', course: 'CAAC-M 150Kg course and examination', bonus: 'Bonus: restricted-zone study tour', original: 'Original price', offer: 'Offer price', back: 'Back to course', fpsReady: 'FPS payment details created', reference: 'Payment reference', demo: 'Demo mode: the production FPS ID is not configured.' },
    'zh-Hans': { step: '步骤 4 / 5', title: '安全付款', subtitle: '请先确认课程及考试安排。付款不代表任何未经证实的“保证通过”承诺。', name: '付款人姓名', email: 'Email', phone: '电话／WhatsApp', methods: '选择付款方式', stripe: 'Stripe 信用卡', fps: '转数快 FPS', stripeNote: '前往 Stripe 安全结账页', fpsNote: '取得付款编号后，按指示完成转账', pay: '支付 HK$18,000', processing: '正在建立付款…', summary: '订单摘要', course: 'CAAC-M 150Kg 课程和考试', bonus: '赠品：考试禁区考察团', original: '原价', offer: '优惠价', back: '返回课程页', fpsReady: 'FPS 付款资料已建立', reference: '付款参考编号', demo: '目前是展示模式；正式 FPS ID 尚未设置。' }
  } as const;
  $: copy = content[locale];

  function setLocale(next: FunnelLocale) { locale = next; localStorage.setItem('ailae-funnel-locale', next); }

  async function checkout() {
    error = ''; fpsResult = null;
    if (!name.trim() || !email.includes('@')) { error = locale === 'en' ? 'Enter a valid name and email.' : '請輸入有效姓名和 Email。'; return; }
    loading = true;
    try {
      const response = await fetch(`/api/funnels/${CAAC_FUNNEL.slug}/checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, paymentMethod, locale })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Checkout failed');
      if (result.paymentMethod === 'fps') fpsResult = result;
      else if (result.redirectUrl) window.location.assign(result.redirectUrl);
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Checkout failed'; }
    finally { loading = false; }
  }

  onMount(async () => {
    const saved = localStorage.getItem('ailae-funnel-locale'); if (isFunnelLocale(saved)) locale = saved;
    try { const response = await fetch(`/api/funnels/${CAAC_FUNNEL.slug}/config`); if (response.ok) providers = await response.json(); } catch { /* demo */ }
    fetch(`/api/funnels/${CAAC_FUNNEL.slug}/events`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({eventType:'checkout_view',step:'payment',locale}) }).catch(()=>undefined);
  });
</script>

<svelte:head><title>{copy.title} | AiLAE Funnel</title></svelte:head>
<div class="checkout-page">
  <FunnelHeader {locale} compact on:locale={(event) => setLocale(event.detail)} />
  <main>
    <section class="checkout-form">
      <a href="/f/caac-m-150kg">← {copy.back}</a><p class="step">{copy.step}</p><h1>{copy.title}</h1><span class="subtitle">{copy.subtitle}</span>
      {#if fpsResult}
        <div class="fps-result" role="status"><p>FPS</p><h2>{copy.fpsReady}</h2><dl><div><dt>{copy.reference}</dt><dd>{fpsResult.reference}</dd></div><div><dt>FPS ID</dt><dd>{fpsResult.fpsId || '—'}</dd></div><div><dt>Account</dt><dd>{fpsResult.accountName}</dd></div><div><dt>Amount</dt><dd>HK${fpsResult.amount.toLocaleString()}</dd></div></dl>{#if fpsResult.demo}<small>{copy.demo}</small>{/if}<a class="button primary" href={`/f/caac-m-150kg/thanks?order=${fpsResult.reference}&method=fps`}>完成並查看下一步</a></div>
      {:else}
        <form on:submit|preventDefault={checkout}>
          <label><span>{copy.name}</span><input bind:value={name} autocomplete="name" required /></label>
          <label><span>{copy.email}</span><input bind:value={email} type="email" autocomplete="email" required /></label>
          <label><span>{copy.phone}</span><input bind:value={phone} autocomplete="tel" /></label>
          <fieldset><legend>{copy.methods}</legend>
            <label class:active={paymentMethod === 'stripe'} class="method"><input bind:group={paymentMethod} type="radio" value="stripe" /><span><b>{copy.stripe}</b><small>{copy.stripeNote}</small></span><em>{providers.stripe?.configured ? providers.stripe.mode : 'DEMO'}</em></label>
            <label class:active={paymentMethod === 'fps'} class="method"><input bind:group={paymentMethod} type="radio" value="fps" /><span><b>{copy.fps}</b><small>{copy.fpsNote}</small></span><em>{providers.fps?.configured ? 'READY' : 'DEMO'}</em></label>
          </fieldset>
          {#if error}<p class="error" role="alert">{error}</p>{/if}
          <button class="button primary" type="submit" disabled={loading}>{loading ? copy.processing : copy.pay}</button>
        </form>
      {/if}
    </section>
    <aside class="summary"><p>ORDER</p><h2>{copy.summary}</h2><div class="course-badge"><span>CAAC-M</span><strong>150Kg</strong></div><h3>{copy.course}</h3><ul><li>✓ {copy.bonus}</li><li>✓ PDF eBook</li><li>✓ Calendly consultation</li><li>✓ AiLAE follow-up</li></ul><dl><div><dt>{copy.original}</dt><dd><s>HK$23,400</s></dd></div><div class="total"><dt>{copy.offer}</dt><dd>HK$18,000</dd></div></dl></aside>
  </main>
</div>

<style>
  .checkout-page{width:100%}
  :global(body){margin:0;background:#edf2f6}.checkout-page{min-height:100vh;background:#edf2f6;color:#0a1524;font-family:Inter,system-ui,sans-serif}.checkout-page *{box-sizing:border-box}main{display:grid;grid-template-columns:minmax(0,670px) 390px;gap:44px;width:min(1140px,calc(100% - 40px));margin:0 auto;padding:58px 0}.checkout-form>a{color:#5a7083;font-size:13px;text-decoration:none}.step{margin:42px 0 10px;color:#0e8a89;font-size:11px;font-weight:900;letter-spacing:.16em}.checkout-form h1{margin:0;font-size:48px;letter-spacing:-.04em}.subtitle{display:block;max-width:620px;margin-top:14px;color:#5a6c7e;line-height:1.65}form{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:34px}form>label:first-child,fieldset,.error,form>.button{grid-column:1/-1}label>span{display:block;margin-bottom:7px;color:#42566a;font-size:12px;font-weight:800}input{width:100%;min-height:48px;border:1px solid #c9d3dc;border-radius:10px;background:white;padding:0 13px}input:focus{border-color:#0e8a89;outline:3px solid rgba(14,138,137,.12)}fieldset{display:grid;gap:10px;margin:12px 0 0;border:0;padding:0}legend{margin-bottom:10px;font-size:13px;font-weight:900}.method{display:grid;grid-template-columns:22px 1fr auto;gap:12px;align-items:center;border:1px solid #cad5de;border-radius:13px;background:white;padding:17px;cursor:pointer}.method.active{border-color:#0e8a89;box-shadow:0 0 0 3px rgba(14,138,137,.1)}.method input{min-height:auto}.method span{margin:0}.method b,.method small{display:block}.method small{margin-top:5px;color:#738496;font-weight:500}.method em{border-radius:99px;background:#edf2f6;padding:5px 8px;color:#647789;font-size:9px;font-style:normal;font-weight:900}.button{display:inline-flex;min-height:52px;align-items:center;justify-content:center;border:0;border-radius:11px;padding:0 22px;font-weight:900;text-decoration:none;cursor:pointer}.button.primary{background:#0a9a82;color:white}.button:disabled{opacity:.6}.error{color:#bd2525}.summary{position:sticky;top:88px;align-self:start;border-radius:24px;background:#0a1524;padding:32px;color:white;box-shadow:0 28px 60px rgba(7,16,31,.2)}.summary>p{color:#65dfc8;font-size:10px;font-weight:900;letter-spacing:.2em}.summary h2{font-size:28px}.course-badge{display:flex;align-items:baseline;justify-content:space-between;border-radius:16px;background:linear-gradient(135deg,#153044,#102335);padding:24px}.course-badge span{color:#69e5ce;font-size:13px;font-weight:900}.course-badge strong{font-size:46px}.summary h3{font-size:19px;line-height:1.4}.summary ul{padding:0;list-style:none;color:#aebdcc;font-size:13px;line-height:2}.summary dl{margin-top:24px;border-top:1px solid #283c50;padding-top:12px}.summary dl div{display:flex;justify-content:space-between;padding:8px 0;color:#aebdcc}.summary dl .total{color:white;font-size:22px;font-weight:900}.fps-result{margin-top:32px;border-radius:20px;background:white;padding:28px;box-shadow:0 20px 50px rgba(16,37,58,.1)}.fps-result>p{color:#0e8a89;font-size:11px;font-weight:900;letter-spacing:.18em}.fps-result dl{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fps-result dl div{border-radius:10px;background:#f3f6f8;padding:13px}.fps-result dt{color:#687b8d;font-size:10px}.fps-result dd{margin:6px 0 0;font-weight:900}.fps-result small{display:block;margin:16px 0;color:#9a6500}.fps-result .button{width:100%}@media(max-width:900px){main{grid-template-columns:1fr}.summary{position:static;grid-row:1}.checkout-form{grid-row:2}}@media(max-width:620px){main{width:calc(100% - 28px);padding:36px 0}.checkout-form h1{font-size:39px}form{grid-template-columns:1fr}form>label{grid-column:1/-1}.fps-result dl{grid-template-columns:1fr}}
</style>
