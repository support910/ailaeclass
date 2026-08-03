<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import 'grapesjs/dist/css/grapes.min.css';

  export let initialHtml = '';
  export let initialCss = '';
  export let saving = false;
  let container: HTMLDivElement;
  let editor: any;
  let ready = false;
  const dispatch = createEventDispatcher<{ save: { html: string; css: string } }>();

  const starterHtml = `
    <section class="hero-block">
      <div class="eyebrow">CAAC-M 150Kg 無人機牌照課程和考試</div>
      <h1>從了解要求，到完成報名與考試安排</h1>
      <p>先取得免費電子書，再預約課程諮詢，確認適合後才付款。</p>
      <a class="cta" href="#ebook">免費取得課程電子書</a>
    </section>
    <section class="offer-block">
      <div><small>原價</small><s>HK$23,400</s></div>
      <div><small>優惠價</small><strong>HK$18,000</strong></div>
      <div><small>贈品</small><b>考試禁區考察團 · 價值 HK$1,800</b></div>
    </section>`;
  const starterCss = `
    body{margin:0;font-family:Inter,Arial,sans-serif;color:#fff;background:#07101f}
    .hero-block{min-height:520px;padding:80px 8%;background:radial-gradient(circle at 80% 20%,#123e4b,transparent 32%),#07101f}
    .eyebrow{color:#69e5ce;font-size:14px;font-weight:800;letter-spacing:.08em}
    h1{max-width:780px;margin:26px 0;font-size:64px;line-height:1.02;letter-spacing:-.04em}
    p{max-width:640px;color:#b5c4d2;font-size:20px;line-height:1.65}
    .cta{display:inline-block;margin-top:24px;border-radius:12px;background:#34d399;padding:16px 22px;color:#06131d;font-weight:800;text-decoration:none}
    .offer-block{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#dce5ea;color:#0b1728}
    .offer-block>div{background:#fff;padding:30px}.offer-block small{display:block;color:#718394}.offer-block strong{font-size:34px}.offer-block b{color:#9a6700}`;

  function save() {
    if (!editor) return;
    dispatch('save', { html: editor.getHtml(), css: editor.getCss() });
  }

  onMount(async () => {
    const grapesjs = (await import('grapesjs')).default;
    editor = grapesjs.init({
      container,
      height: '620px',
      fromElement: false,
      storageManager: false,
      noticeOnUnload: false,
      components: initialHtml || starterHtml,
      style: initialCss || starterCss,
      canvas: { styles: ['https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800;900&display=swap'] },
      blockManager: { appendTo: '#funnel-blocks' },
      layerManager: { appendTo: '#funnel-layers' },
      selectorManager: { appendTo: '#funnel-styles' },
      styleManager: {
        appendTo: '#funnel-styles',
        sectors: [
          { name: 'Layout', open: true, buildProps: ['display','position','width','height','margin','padding'] },
          { name: 'Typography', open: false, buildProps: ['font-family','font-size','font-weight','color','line-height','text-align'] },
          { name: 'Decoration', open: false, buildProps: ['background-color','border','border-radius','box-shadow'] }
        ]
      },
      panels: { defaults: [] }
    });

    const blocks = editor.BlockManager;
    blocks.add('funnel-hero', { label: '主视觉 Hero', category: '课程漏斗', content: starterHtml.split('<section class="offer-block">')[0] });
    blocks.add('funnel-offer', { label: '价格与赠品', category: '课程漏斗', content: `<section class="offer-block"><div><small>原价</small><s>HK$23,400</s></div><div><small>优惠价</small><strong>HK$18,000</strong></div><div><small>赠品</small><b>考試禁區考察團 · HK$1,800</b></div></section>` });
    blocks.add('funnel-form', { label: '客户表单', category: '转换组件', content: `<section style="padding:50px;background:#f1f5f7;color:#0b1728"><h2>免费取得课程电子书</h2><form><input placeholder="姓名"/><input placeholder="Email"/><button>取得电子书</button></form></section>` });
    blocks.add('funnel-calendly', { label: 'Calendly 预约', category: '转换组件', content: `<section style="padding:50px;text-align:center"><h2>预约免费课程咨询</h2><a class="cta" href="/f/caac-m-150kg/booking">选择日期和时间</a></section>` });
    blocks.add('funnel-faq', { label: '常见问题', category: '内容组件', content: `<section style="padding:50px"><h2>常见问题</h2><details><summary>我是否符合报名资格？</summary><p>先预约咨询，由课程顾问确认。</p></details></section>` });
    blocks.add('text', { label: '文字', category: '基础', content: '<p>在这里输入文字</p>' });
    blocks.add('button', { label: '按钮', category: '基础', content: '<a class="cta" href="#">行动按钮</a>' });
    ready = true;
    return () => editor?.destroy();
  });
</script>

<div class="editor-shell">
  <div class="editor-toolbar">
    <div><span class="status-dot"></span><b>{ready ? '编辑器已就绪' : '正在加载编辑器…'}</b><small>GrapesJS Open Source</small></div>
    <button type="button" on:click={save} disabled={!ready || saving}>{saving ? '正在保存…' : '保存页面'}</button>
  </div>
  <div class="editor-workspace">
    <aside><h3>页面区块</h3><div id="funnel-blocks"></div><h3>页面图层</h3><div id="funnel-layers"></div></aside>
    <div class="canvas" bind:this={container}></div>
    <aside class="styles"><h3>样式设置</h3><div id="funnel-styles"></div></aside>
  </div>
</div>

<style>
  .editor-shell{overflow:hidden;border:1px solid #d7e0e7;border-radius:16px;background:#fff}.editor-toolbar{display:flex;min-height:58px;align-items:center;justify-content:space-between;border-bottom:1px solid #dfe6eb;padding:0 16px}.editor-toolbar>div{display:flex;align-items:center;gap:9px}.editor-toolbar small{color:#758695}.status-dot{width:8px;height:8px;border-radius:50%;background:#21b894;box-shadow:0 0 0 4px rgba(33,184,148,.12)}.editor-toolbar button{min-height:38px;border:0;border-radius:9px;background:#0e8a89;padding:0 16px;color:#fff;font-weight:800;cursor:pointer}.editor-toolbar button:disabled{opacity:.55}.editor-workspace{display:grid;grid-template-columns:190px minmax(420px,1fr) 220px;min-height:620px}.editor-workspace aside{overflow:auto;max-height:620px;border-right:1px solid #dfe6eb;background:#f7f9fa}.editor-workspace aside.styles{border-right:0;border-left:1px solid #dfe6eb}.editor-workspace h3{margin:0;border-bottom:1px solid #e2e8ed;padding:13px 12px;color:#536676;font-size:11px;text-transform:uppercase;letter-spacing:.1em}.canvas{min-width:0}:global(.gjs-one-bg){background-color:#162335}:global(.gjs-two-color){color:#dce7ef}:global(.gjs-three-bg){background-color:#0e8a89}:global(.gjs-four-color),:global(.gjs-four-color-h:hover){color:#32cdb3}:global(.gjs-block){width:calc(50% - 8px);min-height:74px;margin:4px;padding:8px;font-size:11px}:global(.gjs-blocks-c){padding:6px}:global(.gjs-sm-sector-title),:global(.gjs-layer-title){font-size:11px}@media(max-width:1050px){.editor-workspace{grid-template-columns:170px minmax(420px,1fr)}.editor-workspace aside.styles{display:none}}@media(max-width:760px){.editor-workspace{grid-template-columns:1fr}.editor-workspace>aside{display:none}.editor-toolbar small{display:none}}
</style>
