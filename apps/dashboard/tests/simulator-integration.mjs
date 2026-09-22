import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

// Local Postgres WASM only. Never opens a production Supabase connection.
const pglitePath = process.env.SIMULATOR_QA_PGLITE;
if (!pglitePath) throw new Error('Set SIMULATOR_QA_PGLITE to the local QA pglite/dist/index.js');
const { PGlite } = await import(pglitePath);
const pg = new PGlite();
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
await pg.exec(`create role anon; create role authenticated; create role service_role;
  create schema auth; create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
  grant usage on schema auth to authenticated;
  insert into auth.users values ('${userA}'),('${userB}');`);
const migration = await readFile(resolve('../../supabase/migrations/20260917090000_simulator_drive_reviews.sql'), 'utf8');
await pg.exec(migration);

function queryBuilder(table) {
  assert.equal(table, 'simulator_drive_reviews');
  let op = 'select', fields = '*', values, filters = [], order = '', range = '';
  const chain = {
    select(value = '*') { fields = value; return chain; },
    update(value) { op = 'update'; values = value; return chain; },
    delete() { op = 'delete'; return chain; },
    eq(key, value) { assert.match(key, /^[a-z_]+$/); filters.push([key, value]); return chain; },
    order(key) { assert.equal(key, 'created_at'); order = ' order by created_at desc'; return chain; },
    range(start, end) { range = ` limit ${end-start+1} offset ${start}`; return chain; },
    maybeSingle() { return execute(true); },
    then(ok, bad) { return execute(false).then(ok, bad); }
  };
  async function execute(single) {
    try {
      const params = [];
      const param = (v) => { params.push(v); return `$${params.length}`; };
      const sets = op === 'update' ? Object.entries(values).map(([k,v]) => `${k}=${param(typeof v === 'object' && v !== null ? JSON.stringify(v) : v)}`).join(',') : '';
      const where = filters.length ? ` where ${filters.map(([k,v]) => `${k}=${param(v)}`).join(' and ')}` : '';
      const sql = op === 'select' ? `select ${fields} from ${table}${where}${order}${range}` :
        op === 'update' ? `update ${table} set ${sets}${where} returning ${fields}` : `delete from ${table}${where} returning id`;
      const result = await pg.query(sql, params);
      return { data: single ? result.rows[0] || null : result.rows, error: null };
    } catch (error) { return { data: null, error }; }
  }
  return chain;
}
globalThis.__simulatorDb = { from: queryBuilder, async rpc(name, args) {
  try {
    let result;
    if (name === 'reserve_simulator_review') result = await pg.query('select reserve_simulator_review($1::uuid,$2,$3,$4,$5,$6) as value', [args.p_user_id,args.p_title,args.p_source_url,args.p_scenario,args.p_flight_type || 'simulator',args.p_video_source_url || null]);
    else if (name === 'claim_simulator_analysis') result = await pg.query('select claim_simulator_analysis($1::uuid,$2::uuid) as value', [args.p_user_id,args.p_review_id]);
    else throw new Error(name);
    return { data: result.rows[0].value, error: null };
  } catch (error) { return { data: null, error }; }
} };

const vite = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true, hmr: false }, optimizeDeps: { disabled: true },
  cacheDir: resolve('node_modules/.cache/simulator-integration'),
  resolve: { alias: [{ find: '$lib/utils/functions/supabase.server', replacement: 'simulator-test-auth' }, { find: '$lib', replacement: resolve('src/lib') }] },
  plugins: [{ name: 'isolated-simulator-test', resolveId(id) { if (['simulator-test-auth','$env/dynamic/private'].includes(id)) return `\0${id}`; }, load(id) {
    if (id === '\0simulator-test-auth') return `export const getServerSupabase=()=>globalThis.__simulatorDb; export const getUserIdFromRequest=async r=>{const t=r.headers.get('authorization');return t==='Bearer student-a'?'${userA}':t==='Bearer student-b'?'${userB}':null;};`;
    if (id === '\0$env/dynamic/private') return `export const env={PRIVATE_KIMI_API_KEY:'fixture-only',PRIVATE_KIMI_BASE_URL:'https://kimi-fixture.invalid/v1',PRIVATE_KIMI_MODEL:'kimi-k2.5',PRIVATE_AI_MAX_TOKENS:'1200'};`;
  }}]
});
const originalFetch = globalThis.fetch;
let modelCalls = 0;
let visualFrame = 1;
const report = { summary: '測試報告：高度偏差需改善。', findings: [{ status: 'improve', observation: '偏差超過檔案目標', evidence: '1.2 > 1', advice: '練習保持高度', frame: null }], limitations: ['目標由學員提供，未經教師核實。'] };
globalThis.fetch = async (url, options) => {
  const target = String(url);
  if (target.includes('drive.google.com')) {
    if(target.includes('resultimage')) return new Response(new Uint8Array([137,80,78,71]),{headers:{'content-type':'image/png'}});
    if(target.includes('flightvideo')) return new Response(new Uint8Array([0,0,0,24]),{headers:{'content-type':'video/mp4'}});
    return new Response('metric,value,unit,target,direction\nAltitude deviation,1.2,m,1,lower\n', { headers: { 'content-type': 'text/csv' } });
  }
  if (target === 'https://kimi-fixture.invalid/v1/chat/completions') {
    const payload=JSON.parse(options.body);
    assert.equal(payload.model,'kimi-k2.5');
    assert.equal(payload.thinking.type,'disabled');
    if (typeof payload.messages[1].content === 'string') { modelCalls++; return Response.json({ choices: [{ message: { content: JSON.stringify(report) } }] }); }
    assert.ok(payload.messages[1].content.some(item=>item.type==='image_url'));
    assert.ok(payload.messages[0].content.includes('NEVER null'));
    assert.ok(payload.messages[0].content.includes('"frame":1'));
    return Response.json({choices:[{message:{content:JSON.stringify({...report,crossCheck:{status:'unknown',detail:'Fixture evidence does not verify same-flight identity.'},findings:report.findings.map(f=>({...f,frame:visualFrame}))})}}]});
  }
  throw new Error('Unexpected external request: ' + new URL(target).hostname);
};
const request = (method, body, token='student-a') => new Request('http://localhost/api/simulator/reviews', {
  method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {})
});
let checks = 0;
const pass = (name) => { checks++; console.log('PASS ' + name); };
try {
  const list = await vite.ssrLoadModule('/src/routes/api/simulator/reviews/+server.ts');
  const detail = await vite.ssrLoadModule('/src/routes/api/simulator/reviews/[id]/+server.ts');
  const analysis = await vite.ssrLoadModule('/src/routes/api/simulator/reviews/[id]/analyze/+server.ts');
  const form = { title: '測試八字飛行', url:'https://drive.google.com/file/d/abcdefghijk1234/view', scenario:'figure_eight', consent:true };
  assert.equal((await list.POST({ request: request('POST',form,'invalid') })).status,401); pass('unauthenticated submission rejected');
  assert.equal((await list.POST({ request: request('POST',{...form,consent:false}) })).status,400); pass('consent required');
  const imported = await list.POST({ request: request('POST',form) });
  assert.equal(imported.status,200,await imported.clone().text());
  const { id, summary } = await imported.json(); assert.equal(summary.improve,1); pass('Drive import parses and persists numeric evidence');
  assert.equal((await detail.GET({request:request('GET',null,'student-b'),params:{id}})).status,404);
  assert.equal((await detail.DELETE({request:request('DELETE',null,'student-b'),params:{id}})).status,404);
  assert.equal((await analysis.POST({request:request('POST',{locale:'zh-TW'},'student-b'),params:{id}})).status,404); pass('other student cannot read, delete or analyze report');
  const analyzed = await analysis.POST({request:request('POST',{locale:'zh-TW'}),params:{id}});
  assert.equal(analyzed.status,200,await analyzed.clone().text());
  assert.equal((await analyzed.json()).review.report.officialGrade,false); pass('AI feedback persisted and explicitly non-official');
  await analysis.POST({request:request('POST',{locale:'zh-TW'}),params:{id}});
  assert.equal(modelCalls,1); pass('completed result reused without another AI charge');
  const listed = await list.GET({request:request('GET'),url:new URL('http://localhost')});
  assert.equal((await listed.json()).reviews.length,1); pass('history survives independent requests');

  await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${userB}',false);`);
  assert.equal((await pg.query('select * from simulator_drive_reviews')).rows.length,0);
  assert.equal((await pg.query('delete from simulator_drive_reviews returning id')).rows.length,0);
  await assert.rejects(pg.query('select reserve_simulator_review($1::uuid,$2,$3,$4)',[userA,'X',form.url,'hover']));
  await pg.exec('reset role'); pass('real Postgres RLS and RPC grants reject cross-account access');

  await detail.DELETE({request:request('DELETE'),params:{id}});
  for(let i=0;i<4;i++) assert.equal((await list.POST({request:request('POST',form)})).status,200);
  assert.equal((await list.POST({request:request('POST',form)})).status,429); pass('deleting reports does not reset submission rate limit');

  const rows = (await pg.query('select id from simulator_drive_reviews where status=$1',['imported'])).rows;
  const claims = await Promise.all([1,2].map(()=>globalThis.__simulatorDb.rpc('claim_simulator_analysis',{p_user_id:userA,p_review_id:rows[0].id})));
  assert.equal(claims.filter((r)=>r.data===true).length,1); pass('concurrent analysis has only one successful claim');

  const visualId=(await pg.query(`insert into simulator_drive_reviews(user_id,title,source_url,scenario,source_kind,status) values ($1,'Visual test',$2,'hover','video','imported') returning id`,[userB,form.url])).rows[0].id;
  const frames=Array.from({length:12},(_,i)=>({at:i+0.5,dataUrl:'data:image/jpeg;base64,/9j/2Q=='}));
  const badFrames=await analysis.POST({request:request('POST',{frames:frames.slice(0,1),duration:12},'student-b'),params:{id:visualId}});
  assert.equal(badFrames.status,400);assert.equal((await badFrames.json()).code,'invalid_frames');pass('incomplete video evidence rejected');
  visualFrame=12;
  const visualResult=await analysis.POST({request:request('POST',{frames,duration:12,locale:'zh-TW'},'student-b'),params:{id:visualId}});
  assert.equal(visualResult.status,200,await visualResult.clone().text());
  const visualReport=(await visualResult.json()).review.report;
  assert.equal(visualReport.frameTimes.length,12);assert.equal(visualReport.evidenceType,'client_extracted_frames');pass('vision request includes frames and saves cited timestamps');
  const imageId=(await pg.query(`insert into simulator_drive_reviews(user_id,title,source_url,scenario,source_kind,status) values ($1,'Image test',$2,'hover','image','imported') returning id`,[userB,form.url])).rows[0].id;
  visualFrame=12;
  const badCitation=await analysis.POST({request:request('POST',{frames:[{...frames[0],at:0}]},'student-b'),params:{id:imageId}});
  assert.equal(badCitation.status,502);pass('AI references to nonexistent image frames rejected');
  visualFrame=1;
  assert.equal((await analysis.POST({request:request('POST',{frames:[{...frames[0],at:0}]},'student-b'),params:{id:imageId}})).status,200);pass('image analysis retry succeeds and persists');

  const pairedForm={...form,flightType:'real',url:'https://drive.google.com/file/d/resultimage12345/view',videoUrl:'https://drive.google.com/file/d/flightvideo12345/view'};
  const pairedImport=await list.POST({request:request('POST',pairedForm,'student-b')});
  assert.equal(pairedImport.status,200,await pairedImport.clone().text());assert.equal(pairedImport.headers.get('x-review-kind'),'image_video');
  const pairedId=pairedImport.headers.get('x-review-id');const files=await pairedImport.formData();
  assert.equal(files.get('image').type,'image/png');assert.equal(files.get('video').type,'video/mp4');pass('same-flight screenshot and video imported as one record');
  const pairedPayload={frames:[{at:0,dataUrl:frames[0].dataUrl},...frames],duration:12};
  const pairedResult=await analysis.POST({request:request('POST',pairedPayload,'student-b'),params:{id:pairedId}});
  assert.equal(pairedResult.status,200,await pairedResult.clone().text());const pairedReview=(await pairedResult.json()).review;
  assert.equal(pairedReview.flight_type,'real');assert.equal(pairedReview.report.frameTimes.length,13);
  assert.equal(pairedReview.report.crossCheck.status,'unknown');assert.deepEqual(pairedReview.report.evidenceSources,['result_screenshot','flight_video']);pass('paired evidence analyzed and saved in a single comparison report');
  const wrongPair=await list.POST({request:request('POST',{...pairedForm,url:form.url},'student-b')});
  assert.equal((await wrongPair.json()).code,'pair_requires_image');pass('numeric file cannot masquerade as paired screenshot');
  assert.equal((await detail.GET({request:request('GET'),params:{id:pairedId}})).status,404);pass('paired report remains private to its owner');
  console.log(`INTEGRATION: ${checks} checks passed`);
} finally { globalThis.fetch = originalFetch; await vite.close(); await pg.close(); }
