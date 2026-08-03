<script lang="ts">
  import { onMount } from 'svelte';
  import FunnelPageEditor from '$lib/components/Funnel/FunnelPageEditor.svelte';
  import { getAccessToken } from '$lib/utils/functions/supabase';
  import { currentOrg } from '$lib/utils/store/org';

  type Tab = 'overview' | 'page' | 'contacts' | 'automation' | 'settings';
  let tab: Tab = 'overview';
  let loading = true;
  let saving = false;
  let toast = '';
  let pageData: { html: string; css: string; updatedAt?: string } | null = null;
  let leads: any[] = [];
  let automations: any[] = [];
  let metrics = { visitors: 1284, leads: 186, bookings: 42, paid: 18 };
  let config: any = { stripe: { configured: false, mode: 'test' }, fps: { configured: false }, calendlyUrl: '' };

  const tabs: Array<{ id: Tab; label: string; eyebrow: string }> = [
    { id: 'overview', label: '总览', eyebrow: 'OVERVIEW' },
    { id: 'page', label: '页面编辑', eyebrow: 'BUILDER' },
    { id: 'contacts', label: '客户资料', eyebrow: 'CRM' },
    { id: 'automation', label: '自动跟进', eyebrow: 'CAMPAIGN' },
    { id: 'settings', label: '整合设置', eyebrow: 'INTEGRATIONS' }
  ];

  $: conversion = ((metrics.leads / metrics.visitors) * 100).toFixed(1);
  $: bookingRate = ((metrics.bookings / metrics.leads) * 100).toFixed(1);
  $: salesRate = ((metrics.paid / metrics.leads) * 100).toFixed(1);

  async function authHeaders() {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function loadStudio() {
    loading = true;
    try {
      const headers = await authHeaders();
      const url = `/api/funnels/caac-m-150kg/studio?organizationId=${encodeURIComponent($currentOrg.id || '')}`;
      const [studioResponse, configResponse] = await Promise.all([
        fetch(url, { headers }),
        fetch('/api/funnels/caac-m-150kg/config')
      ]);
      if (studioResponse.ok) {
        const result = await studioResponse.json();
        pageData = result.page;
        leads = result.leads || [];
        automations = result.automations || [];
        metrics = result.metrics || metrics;
      }
      if (configResponse.ok) config = await configResponse.json();
    } catch (error) {
      console.warn('Funnel studio is using preview data.', error);
    } finally {
      loading = false;
    }
  }

  async function savePage(event: CustomEvent<{ html: string; css: string }>) {
    saving = true;
    toast = '';
    try {
      const response = await fetch('/api/funnels/caac-m-150kg/studio', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ organizationId: $currentOrg.id || '', ...event.detail })
      });
      if (!response.ok) throw new Error((await response.json()).message || 'Save failed');
      pageData = (await response.json()).page;
      toast = '页面已保存。发布前仍需确认课程资料与外部服务配置。';
    } catch (error) {
      toast = error instanceof Error ? error.message : '页面保存失败';
    } finally {
      saving = false;
      setTimeout(() => (toast = ''), 4500);
    }
  }

  onMount(loadStudio);
</script>

<svelte:head><title>CAAC-M Funnel Studio | AiLAE</title></svelte:head>

<div class="studio">
  <header class="topbar">
    <div class="product"><span class="product-mark">F</span><div><small>AiLAE FUNNEL</small><strong>CAAC-M 150Kg 课程</strong></div></div>
    <div class="top-actions"><span class="status"><i></i>草稿预览</span><a href="/f/caac-m-150kg" target="_blank" rel="noreferrer">打开销售页 ↗</a></div>
  </header>

  <nav class="tabs" aria-label="Funnel studio sections">
    {#each tabs as item}
      <button type="button" class:active={tab === item.id} on:click={() => (tab = item.id)}><small>{item.eyebrow}</small><b>{item.label}</b></button>
    {/each}
  </nav>

  <main>
    {#if toast}<div class="toast" role="status">{toast}</div>{/if}
    {#if tab === 'overview'}
      <section class="page-heading"><div><p>FUNNEL PERFORMANCE</p><h1>销售漏斗总览</h1><span>从免费电子书到付款完成，逐步查看客户转化情况。</span></div><div class="period">最近 30 天⌄</div></section>
      <section class="metric-grid">
        <article><small>访客</small><strong>{metrics.visitors.toLocaleString()}</strong><span>销售页浏览</span></article>
        <article><small>客户资料</small><strong>{metrics.leads.toLocaleString()}</strong><span>{conversion}% 访客转化</span></article>
        <article><small>预约咨询</small><strong>{metrics.bookings.toLocaleString()}</strong><span>{bookingRate}% 客户预约</span></article>
        <article class="accent"><small>完成付款</small><strong>{metrics.paid.toLocaleString()}</strong><span>{salesRate}% 客户成交</span></article>
      </section>
      <section class="overview-grid">
        <article class="pipeline"><div class="card-head"><div><small>CONVERSION PIPELINE</small><h2>五步课程漏斗</h2></div><a href="/f/caac-m-150kg" target="_blank">查看页面</a></div><ol>
          <li><span>01</span><div><b>免费电子书</b><small>访客提交姓名与 Email</small></div><em>186</em></li>
          <li><span>02</span><div><b>Calendly 预约</b><small>资格与课程咨询</small></div><em>42</em></li>
          <li><span>03</span><div><b>资格确认</b><small>课程及考试安排</small></div><em>31</em></li>
          <li><span>04</span><div><b>Stripe / FPS</b><small>HK$18,000</small></div><em>22</em></li>
          <li><span>05</span><div><b>入学指引</b><small>付款确认及客户支持</small></div><em>18</em></li>
        </ol></article>
        <article class="health"><div class="card-head"><div><small>SYSTEM STATUS</small><h2>上线准备度</h2></div><span>5 / 8</span></div>
          <ul><li class="done"><i>✓</i><div><b>销售页与三语内容</b><small>已完成</small></div></li><li class="done"><i>✓</i><div><b>客户资料及事件 API</b><small>已完成</small></div></li><li class:done={config.stripe?.configured}><i>{config.stripe?.configured?'✓':'!'}</i><div><b>Stripe</b><small>{config.stripe?.configured?`${config.stripe.mode} 模式已配置`:'等待正式密钥'}</small></div></li><li class:done={config.fps?.configured}><i>{config.fps?.configured?'✓':'!'}</i><div><b>FPS</b><small>{config.fps?.configured?'已配置':'等待 FPS ID'}</small></div></li><li class:done={Boolean(config.calendlyUrl)}><i>{config.calendlyUrl?'✓':'!'}</i><div><b>Calendly</b><small>{config.calendlyUrl?'已配置':'等待预约链接'}</small></div></li></ul>
        </article>
      </section>
    {:else if tab === 'page'}
      <section class="page-heading"><div><p>OPEN-SOURCE PAGE BUILDER</p><h1>页面编辑器</h1><span>拖放区块、修改文字与样式，然后保存为 AiLAE 漏斗页面。</span></div></section>
      <FunnelPageEditor initialHtml={pageData?.html || ''} initialCss={pageData?.css || ''} {saving} on:save={savePage}/>
    {:else if tab === 'contacts'}
      <section class="page-heading"><div><p>CONTACTS & LEAD SCORING</p><h1>客户资料</h1><span>代替 ActiveCampaign 的第一步：集中查看客户来源、阶段和分数。</span></div><button class="outline">导出 CSV</button></section>
      <section class="table-card"><div class="filters"><input placeholder="搜索姓名或 Email"/><select><option>所有状态</option><option>新客户</option><option>已预约</option><option>已付款</option></select><span>{leads.length || 186} contacts</span></div><div class="table-wrap"><table><thead><tr><th>客户</th><th>联络方式</th><th>来源</th><th>状态</th><th>分数</th><th>最后活动</th></tr></thead><tbody>
        {#if leads.length}{#each leads as lead}<tr><td><b>{lead.name}</b><small>{lead.locale}</small></td><td>{lead.email}<small>{lead.phone || '—'}</small></td><td>{lead.source || 'website'}</td><td><span class="tag">{lead.status || 'new'}</span></td><td><strong>{lead.score || 10}</strong></td><td>{new Date(lead.updatedAt || lead.last_activity_at || Date.now()).toLocaleDateString()}</td></tr>{/each}
        {:else}{#each [{name:'陈同学',email:'student@example.com',source:'ebook-form',status:'new',score:20},{name:'Lee Wai',email:'lee@example.com',source:'calendly',status:'booked',score:45},{name:'黄先生',email:'wong@example.com',source:'checkout',status:'qualified',score:70}] as lead}<tr><td><b>{lead.name}</b><small>zh-Hant</small></td><td>{lead.email}<small>WhatsApp</small></td><td>{lead.source}</td><td><span class="tag">{lead.status}</span></td><td><strong>{lead.score}</strong></td><td>今天</td></tr>{/each}{/if}
      </tbody></table></div></section>
    {:else if tab === 'automation'}
      <section class="page-heading"><div><p>MAUTIC-INSPIRED AUTOMATION</p><h1>自动跟进流程</h1><span>用“触发条件—等待—判断—动作”组织客户跟进。</span></div><button class="primary-button">＋ 新建流程</button></section>
      <section class="automation-list">{#each automations.length ? automations : [{name:'电子书下载后跟进',trigger:'lead_captured',status:'active',contacts:186},{name:'Calendly 预约提醒',trigger:'booking_created',status:'active',contacts:42},{name:'未完成付款提醒',trigger:'checkout_abandoned',status:'draft',contacts:11}] as automation}<article><div class="automation-head"><div><span class:active={automation.status==='active'}></span><h2>{automation.name}</h2><small>{automation.status}</small></div><b>{automation.contacts} contacts</b></div><div class="workflow"><div class="node trigger"><small>触发</small><b>{automation.trigger}</b></div><i>→</i><div class="node"><small>等待</small><b>{automation.trigger==='booking_created'?'24 小时':'5 分钟'}</b></div><i>→</i><div class="node condition"><small>判断</small><b>{automation.trigger==='checkout_abandoned'?'仍未付款？':'Email 有效？'}</b></div><i>→</i><div class="node action"><small>动作</small><b>发送 Email</b></div></div></article>{/each}</section>
    {:else}
      <section class="page-heading"><div><p>INTEGRATIONS</p><h1>整合与发布设置</h1><span>正式上线前把服务账号连接到 AiLAE Funnel。</span></div></section>
      <section class="integration-grid">
        <article><div class="integration-logo stripe">S</div><div><h2>Stripe Checkout</h2><p>信用卡付款及 webhook 确认。</p></div><span class:ready={config.stripe?.configured}>{config.stripe?.configured?'已连接':'等待配置'}</span><code>STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET</code></article>
        <article><div class="integration-logo fps">F</div><div><h2>转数快 FPS</h2><p>产生订单编号，等待收据核对。</p></div><span class:ready={config.fps?.configured}>{config.fps?.configured?'已连接':'等待配置'}</span><code>FUNNEL_FPS_ID / FUNNEL_FPS_ACCOUNT_NAME</code></article>
        <article><div class="integration-logo calendly">C</div><div><h2>Calendly</h2><p>在网站内显示预约时间。</p></div><span class:ready={Boolean(config.calendlyUrl)}>{config.calendlyUrl?'已连接':'等待配置'}</span><code>FUNNEL_CALENDLY_URL</code></article>
        <article><div class="integration-logo mail">M</div><div><h2>AiLAE Campaign</h2><p>客户分组、标签和自动跟进。</p></div><span class="ready">MVP 已启用</span><code>SMTP / ZeptoMail settings</code></article>
      </section>
      <section class="launch-check"><h2>发布前负责人必须提供</h2><div><label><input type="checkbox"/> 正式课程时数、地点和考试日期</label><label><input type="checkbox"/> 报名资格、退款和改期政策</label><label><input type="checkbox"/> 考试机构及牌照陈述依据</label><label><input type="checkbox"/> PDF 电子书正式文件</label><label><input type="checkbox"/> 禁区考察团日期、名额和安全说明</label></div></section>
    {/if}
  </main>
</div>

<style>
  .studio{min-height:100%;background:#f3f6f8;color:#0a1524;font-family:Inter,system-ui,sans-serif}.studio *{box-sizing:border-box}.topbar{display:flex;min-height:68px;align-items:center;justify-content:space-between;border-bottom:1px solid #dce4ea;background:#fff;padding:0 28px}.product{display:flex;align-items:center;gap:11px}.product-mark{display:grid;width:38px;height:38px;place-items:center;border-radius:11px;background:#0a1524;color:#55e1c6;font-weight:900}.product small,.product strong{display:block}.product small{color:#0e8a89;font-size:9px;font-weight:900;letter-spacing:.16em}.product strong{margin-top:3px;font-size:15px}.top-actions{display:flex;align-items:center;gap:12px}.top-actions>a,.period,.outline,.primary-button{min-height:38px;border:1px solid #cbd5dd;border-radius:9px;background:white;padding:0 13px;color:#31475a;font-size:12px;font-weight:800;text-decoration:none}.top-actions>a{display:inline-flex;align-items:center}.status{font-size:11px}.status i{display:inline-block;width:7px;height:7px;margin-right:6px;border-radius:50%;background:#e4a11b}.tabs{display:flex;overflow-x:auto;border-bottom:1px solid #dce4ea;background:#fff;padding:0 28px}.tabs button{min-width:118px;border:0;border-bottom:3px solid transparent;background:transparent;padding:14px 18px;text-align:left;cursor:pointer}.tabs button small,.tabs button b{display:block}.tabs button small{color:#8b9aa8;font-size:8px;font-weight:900;letter-spacing:.13em}.tabs button b{margin-top:4px;font-size:13px}.tabs button.active{border-bottom-color:#0e8a89}.tabs button.active small{color:#0e8a89}main{width:min(1320px,calc(100% - 42px));margin:0 auto;padding:34px 0 60px}.toast{position:fixed;right:24px;bottom:24px;z-index:100;border-radius:12px;background:#0a1524;padding:14px 18px;color:white;box-shadow:0 15px 40px rgba(0,0,0,.25)}.page-heading{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:26px}.page-heading p{margin:0 0 7px;color:#0e8a89;font-size:9px;font-weight:900;letter-spacing:.16em}.page-heading h1{margin:0;font-size:34px;letter-spacing:-.03em}.page-heading span{display:block;margin-top:8px;color:#687a8b;font-size:13px}.period,.outline,.primary-button{display:flex;align-items:center}.primary-button{border-color:#0e8a89;background:#0e8a89;color:white}.metric-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metric-grid article{border:1px solid #dce4ea;border-radius:15px;background:white;padding:20px}.metric-grid small,.metric-grid span{display:block;color:#778897;font-size:10px}.metric-grid strong{display:block;margin:12px 0 7px;font-size:34px}.metric-grid article.accent{border-color:#0e8a89;background:#0b292e;color:white}.metric-grid article.accent span,.metric-grid article.accent small{color:#9ddbd0}.overview-grid{display:grid;grid-template-columns:1.25fr .75fr;gap:14px;margin-top:14px}.overview-grid>article,.table-card,.automation-list article,.integration-grid article,.launch-check{border:1px solid #dce4ea;border-radius:15px;background:white;padding:22px}.card-head{display:flex;align-items:center;justify-content:space-between}.card-head small{color:#0e8a89;font-size:8px;font-weight:900;letter-spacing:.15em}.card-head h2{margin:5px 0 0;font-size:20px}.card-head>a{color:#0e8a89;font-size:11px;font-weight:800}.pipeline ol{margin:22px 0 0;padding:0;list-style:none}.pipeline li{display:grid;grid-template-columns:38px 1fr auto;gap:12px;align-items:center;border-top:1px solid #e7ecef;padding:15px 0}.pipeline li>span{display:grid;width:32px;height:32px;place-items:center;border-radius:50%;background:#e8f8f5;color:#0e8a89;font-size:10px;font-weight:900}.pipeline li b,.pipeline li small{display:block}.pipeline li small{margin-top:3px;color:#83919e}.pipeline li em{color:#0e8a89;font-style:normal;font-weight:900}.health .card-head>span{font-size:23px;font-weight:900}.health ul{padding:0;list-style:none}.health li{display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:center;border-top:1px solid #e7ecef;padding:13px 0}.health li i{display:grid;width:24px;height:24px;place-items:center;border-radius:50%;background:#fff2d8;color:#a96800;font-size:11px;font-style:normal}.health li.done i{background:#e4f8f3;color:#0e8a89}.health li b,.health li small{display:block}.health li small{color:#8594a1}.filters{display:grid;grid-template-columns:minmax(240px,1fr) 180px auto;gap:10px;align-items:center;margin-bottom:16px}.filters input,.filters select{min-height:40px;border:1px solid #ccd7df;border-radius:9px;padding:0 12px}.filters span{color:#798a98;font-size:11px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;text-align:left}th{border-bottom:1px solid #dce4ea;padding:12px;color:#7f8e9a;font-size:9px;text-transform:uppercase;letter-spacing:.1em}td{border-bottom:1px solid #edf0f3;padding:13px 12px;font-size:12px}td b,td small{display:block}td small{margin-top:4px;color:#8796a3}.tag{display:inline-flex!important;border-radius:99px;background:#e9f8f5;padding:5px 8px;color:#0e8a89!important;font-size:9px!important;font-weight:900}.automation-list{display:grid;gap:13px}.automation-head{display:flex;align-items:center;justify-content:space-between}.automation-head>div{display:flex;align-items:center;gap:9px}.automation-head span{width:9px;height:9px;border-radius:50%;background:#c1cbd3}.automation-head span.active{background:#18b18f;box-shadow:0 0 0 4px rgba(24,177,143,.12)}.automation-head h2{margin:0;font-size:18px}.automation-head small{border-radius:99px;background:#f0f3f5;padding:4px 7px;font-size:9px}.automation-head>b{color:#728391;font-size:11px}.workflow{display:flex;align-items:center;gap:9px;overflow-x:auto;margin-top:18px;border-top:1px solid #e6ebef;padding-top:18px}.node{min-width:150px;border:1px solid #d5dfe6;border-radius:11px;background:#f8fafb;padding:13px}.node small,.node b{display:block}.node small{color:#7f909e;font-size:9px;text-transform:uppercase}.node b{margin-top:5px;font-size:12px}.node.trigger{border-color:#8ed5c8;background:#ebfaf7}.node.condition{border-color:#e9c377;background:#fff8e8}.node.action{border-color:#94c6e3;background:#eef8fd}.workflow i{color:#94a3af;font-style:normal}.integration-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.integration-grid article{display:grid;grid-template-columns:52px 1fr auto;gap:14px;align-items:center}.integration-logo{display:grid;width:48px;height:48px;place-items:center;border-radius:13px;color:white;font-size:19px;font-weight:900}.integration-logo.stripe{background:#635bff}.integration-logo.fps{background:#00a894}.integration-logo.calendly{background:#006bff}.integration-logo.mail{background:#0a1524;color:#61e0c8}.integration-grid h2{margin:0;font-size:17px}.integration-grid p{margin:5px 0 0;color:#738492;font-size:11px}.integration-grid article>span{border-radius:99px;background:#fff1d8;padding:5px 8px;color:#a66a00;font-size:9px;font-weight:900}.integration-grid article>span.ready{background:#e4f8f3;color:#0e8a89}.integration-grid code{grid-column:2/-1;border-radius:7px;background:#f2f5f7;padding:9px;color:#627686;font-size:10px}.launch-check{margin-top:14px}.launch-check h2{font-size:19px}.launch-check>div{display:grid;grid-template-columns:1fr 1fr;gap:10px}.launch-check label{border:1px solid #dfe6eb;border-radius:9px;padding:12px;color:#506476;font-size:12px}.launch-check input{margin-right:8px}@media(max-width:980px){.metric-grid{grid-template-columns:1fr 1fr}.overview-grid,.integration-grid{grid-template-columns:1fr}}@media(max-width:620px){.topbar{padding:0 14px}.top-actions .status{display:none}.tabs{padding:0 8px}.tabs button{min-width:100px;padding:12px}main{width:calc(100% - 24px)}.page-heading{align-items:flex-start;flex-direction:column}.metric-grid{grid-template-columns:1fr}.filters{grid-template-columns:1fr}.launch-check>div{grid-template-columns:1fr}.integration-grid article{grid-template-columns:48px 1fr}.integration-grid article>span{grid-column:2}.integration-grid code{grid-column:1/-1}}
</style>
