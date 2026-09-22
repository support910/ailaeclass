import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { parseResults, RESULT_TEMPLATE } from '../src/lib/server/simulator/data.js';

const require = createRequire(import.meta.url);
const kitRequire = createRequire(require.resolve('@sveltejs/kit/package.json'));
const { svelte, vitePreprocess } = await import(pathToFileURL(resolve(dirname(kitRequire.resolve('@sveltejs/vite-plugin-svelte/package.json')), 'src/index.js')).href);

const evidenceOutput = resolve('../../output/simulator-drive-20260917');
const useLiveReports = process.env.SIMULATOR_UI_LIVE_REPORTS === '1';
const output = useLiveReports ? resolve(evidenceOutput, 'kimi-live-ui') : evidenceOutput;
const liveReports = {};
if (useLiveReports) for (const kind of ['image', 'paired', 'data']) liveReports[kind] = JSON.parse(await readFile(resolve(evidenceOutput, `live-synthetic-${kind}-report.json`), 'utf8'));
await mkdir(output, { recursive: true });
const root = resolve('tests/fixtures/simulator');
const server = await createServer({ configFile: false, root,
  cacheDir: resolve('node_modules/.cache/simulator-ui'),
  plugins: [{ name: 'qa-auth', resolveId(id) { if (['qa-auth','qa-translations'].includes(id)) return '\0'+id; }, load(id) {
    if (id === '\0qa-auth') return "export const getAccessToken=async()=> 'fixture-user';";
    if (id === '\0qa-translations') return `import {writable,derived} from 'svelte/store'; export const locale=writable('zh-TW'); export const t=derived(locale,l=>key=>({'figure_eight':l==='en'?'Figure eight':'八字飛行','hover':l==='en'?'Hover':'懸停','route':l==='en'?'Route':'航線','landing':l==='en'?'Landing':'降落'}[key.split('.')[2]] || key));`;
  }}, svelte({ configFile: false, preprocess: vitePreprocess() })],
  resolve: { alias: [
    { find: '$lib/utils/functions/supabase', replacement: 'qa-auth' },
    { find: '$lib/utils/functions/translations', replacement: 'qa-translations' },
    { find: '$lib', replacement: resolve('src/lib') }
  ] },
  css: { postcss: resolve('postcss.config.js') },
  server: { host:'127.0.0.1', port:5187, strictPort:true, fs:{allow:[resolve('.')] } }
});
await server.listen();
const browser = await chromium.launch({ channel:'chrome', headless:true });
const page = await browser.newPage({ viewport:{ width:1440,height:1080 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let records=[]; let seq=0; let videoBytes; let pngBytes;
const report={summary:'高度控制需要改善，側向偏差符合檔案中的練習目標。',findings:[{status:'improve',observation:'高度偏差超過目標',evidence:'實測 1.2m，檔案目標 1m。',advice:'下次練習先保持懸停高度，再加入橫向移動。',frame:null}],limitations:['測試用 AI 回應；評分目標未經教師核實。']};
await page.route('**/api/simulator/reviews**', async route => {
  const req=route.request(), url=new URL(req.url()), parts=url.pathname.split('/').filter(Boolean), id=parts[3];
  if(req.method()==='GET') return route.fulfill({json:id?{review:records.find(r=>r.id===id)}:{reviews:records}});
  if(req.method()==='DELETE'){records=records.filter(r=>r.id!==id); return route.fulfill({json:{success:true}});}
  if(url.pathname.endsWith('/analyze')){
    const body=req.postDataJSON();const record=records.find(r=>r.id===id);
    if(['video','image_video'].includes(record.source_kind)){
      assert.equal(body.frames.length,record.source_kind==='image_video'?13:12); assert.ok(body.duration>0);
      assert.equal(new Set(body.frames.map(f=>f.dataUrl)).size>1,true,'video frames must move');
      assert.ok(body.frames.every(f=>f.dataUrl.startsWith('data:image/jpeg;base64,')));
    }
    if(record.source_kind==='image'){
      assert.equal(body.frames.length,1);
      await writeFile(resolve(output,'fixture-image-analysis-input.json'),JSON.stringify(body));
    }
    if(record.source_kind==='image_video') await writeFile(resolve(output,'fixture-paired-analysis-input.json'),JSON.stringify(body));
    record.report=record.source_kind==='data'?report:{summary:'測試畫面顯示移動標記，沒有可核實的飛行高度或速度。',findings:[{status:'unknown',observation:'無法判定真實飛行表現',evidence:'取樣畫面是測試動畫，並非飛行成績。',advice:'請提交包含清晰飛行儀表或成績頁的記錄。',frame:1}],limitations:['測試用 AI 回應，非真實模型判讀。影片僅取樣 12 張畫面，不分析音訊。']};record.status='completed';
    if(record.source_kind==='image_video')record.report={...record.report,crossCheck:{status:'unknown',detail:'兩份資料已合併提交，但測試錄影沒有對應的飛行儀表，無法核對截圖上的高度偏差。不可據此判定合格。'}};
    if(useLiveReports && record.source_kind !== 'video') record.report = liveReports[record.source_kind === 'image_video' ? 'paired' : record.source_kind];
    return route.fulfill({json:{review:record}});
  }
  const body=req.postDataJSON();
  if(body.url.includes('privatefile'))return route.fulfill({status:422,json:{code:'share_unavailable'}});
  const kind=body.videoUrl?'image_video':body.url.includes('videofile')?'video':body.url.includes('imagefile')?'image':'data';
  const record={id:`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`,title:body.title,scenario:body.scenario,flight_type:body.flightType,source_kind:kind,source_url:body.url,video_source_url:body.videoUrl,status:'imported',created_at:new Date().toISOString(),data_summary:kind==='data'?parseResults(RESULT_TEMPLATE):null};
  records.unshift(record);
  if(kind==='image_video'){
    const form=new FormData();form.append('image',new Blob([pngBytes],{type:'image/png'}),'result.png');form.append('video',new Blob([videoBytes],{type:'video/webm'}),'flight.webm');
    const response=new Response(form);
    return route.fulfill({body:Buffer.from(await response.arrayBuffer()),headers:{'content-type':response.headers.get('content-type'),'x-review-id':record.id,'x-review-kind':kind}});
  }
  if(kind!=='data')return route.fulfill({contentType:kind==='video'?'video/webm':'image/png',body:kind==='video'?videoBytes:pngBytes,headers:{'x-review-id':record.id,'x-review-kind':kind}});
  return route.fulfill({json:{id:record.id,kind,summary:record.data_summary}});
});
try {
  await page.goto('http://127.0.0.1:5187');
  await page.getByRole('heading',{name:'飛行訓練成績',exact:true}).waitFor();
  // Generate an actual moving WebM in Chrome to exercise seeking and frame capture.
  const assets=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d');
    const stream=canvas.captureStream(12), recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];
    recorder.ondataavailable=e=>chunks.push(e.data);
    const finish=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
    for(let i=0;i<30;i++){ctx.fillStyle='#ecfdf5';ctx.fillRect(0,0,640,360);ctx.fillStyle='#0f766e';ctx.beginPath();ctx.arc(40+i*18,180+60*Math.sin(i/3),18,0,7);ctx.fill();ctx.fillStyle='#111827';ctx.font='24px sans-serif';ctx.fillText('SIMULATOR TEST '+i,24,36);await new Promise(r=>setTimeout(r,85));}
    recorder.stop();await finish;stream.getTracks().forEach(t=>t.stop());
    const b64=blob=>new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(blob);});
    ctx.fillStyle='#f8fafc';ctx.fillRect(0,0,640,360);ctx.fillStyle='#111827';ctx.font='26px sans-serif';
    ['SIMULATOR RESULTS - TEST FIXTURE','Flight: QA-20260917','Altitude deviation: 1.2 m','Practice target: 1.0 m','Score: not an official assessment'].forEach((line,i)=>ctx.fillText(line,24,48+i*58));
    return {video:await b64(new Blob(chunks,{type:'video/webm'})),image:canvas.toDataURL('image/png').split(',')[1]};
  });
  videoBytes=Buffer.from(assets.video,'base64');pngBytes=Buffer.from(assets.image,'base64');
  await writeFile(resolve(output,'fixture-flight.webm'),videoBytes);
  await page.getByRole('button',{name:'提交指引',exact:true}).click();
  await page.screenshot({path:resolve(output,'01-desktop-guide.png'),fullPage:true});
  const fill=async(name,kind)=>{
    await page.getByLabel('訓練名稱',{exact:true}).fill(name);
    await page.getByLabel('Google Drive 分享連結',{exact:true}).fill(`https://drive.google.com/file/d/${kind}12345678/view`);
    await page.getByRole('checkbox').check();
    await page.getByRole('button',{name:'讀取檔案',exact:true}).click();
  };
  await fill('八字飛行數據驗收','csvfile');
  await page.getByRole('heading',{name:'實測數據',exact:true}).waitFor();
  assert.equal(await page.locator('tbody tr').count(),4);
  await page.getByRole('button',{name:'開始 AI 分析',exact:true}).click();
  await page.getByText('報告已儲存',{exact:true}).waitFor();
  await page.screenshot({path:resolve(output,'02-desktop-data-report.png'),fullPage:true});
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'下載報告',exact:true}).click();await (await download).saveAs(resolve(output,'fixture-report.json'));
  await page.reload();await page.getByRole('button',{name:'查看',exact:true}).first().click();await page.getByText('報告已儲存',{exact:true}).waitFor();
  await fill('飛行影片驗收','videofile');await page.locator('video').waitFor();
  await page.getByRole('button',{name:'開始 AI 分析',exact:true}).click();
  await page.getByText('報告已儲存',{exact:true}).waitFor({timeout:60000});
  assert.equal(await page.locator('figure img').count(),12);
  await page.locator('video').evaluate(async video=>{await video.play();video.pause();});
  await page.screenshot({path:resolve(output,'03-desktop-video-report.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(output,'04-mobile-video-report.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile page overflow');
  await fill('成績截圖驗收','imagefile');await page.locator('img[alt="提交內容預覽"]').waitFor();
  await page.getByRole('button',{name:'開始 AI 分析',exact:true}).click();await page.getByText('報告已儲存',{exact:true}).waitFor();
  await page.screenshot({path:resolve(output,'05-mobile-image-report.png'),fullPage:true});
  await page.getByRole('button',{name:'實飛',exact:true}).click();
  await page.getByLabel('同一飛行的錄影 Drive 連結（選填）',{exact:true}).fill('https://drive.google.com/file/d/videofile12345678/view');
  await fill('實飛：成績截圖及錄影聯合驗收','imagefile');
  await page.getByRole('button',{name:'開始 AI 分析',exact:true}).click();await page.getByText('報告已儲存',{exact:true}).waitFor({timeout:60000});
  assert.equal(await page.locator('figure img').count(),13);await page.getByRole('heading',{name:'成績截圖與錄影核對 · 資料不足',exact:true}).waitFor();
  await page.locator('video').evaluate(async video=>{await video.play();video.pause();});
  await page.screenshot({path:resolve(output,'08-mobile-paired-flight.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1080});await page.screenshot({path:resolve(output,'09-desktop-paired-flight.png'),fullPage:true});
  await page.reload();await page.getByRole('button',{name:'查看',exact:true}).first().click();
  await page.getByRole('heading',{name:'成績截圖與錄影核對 · 資料不足',exact:true}).waitFor();
  assert.equal(await page.getByLabel('同一飛行的錄影 Drive 連結（選填）',{exact:true}).inputValue(),'https://drive.google.com/file/d/videofile12345678/view');
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'模擬器',exact:true}).click();
  await fill('未分享檔案','privatefile');await page.getByRole('alert').filter({hasText:'無法下載檔案'}).waitFor();
  await page.screenshot({path:resolve(output,'06-mobile-permission-error.png'),fullPage:true});
  await page.evaluate(()=>window.setTestLocale('en'));await page.getByRole('heading',{name:'Flight training results',exact:true}).waitFor();
  await page.screenshot({path:resolve(output,'07-mobile-english.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('UI PASS: CSV + persistent history + download + actual 12-frame video extraction + image + paired image/video (13 frames, one report) + private link error + responsive layout + English');
} finally {await browser.close();await server.close();}
