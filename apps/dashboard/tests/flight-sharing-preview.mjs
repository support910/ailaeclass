import {createServer} from 'vite';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {sharingHarness,ids} from './helpers/flight-sharing-harness.mjs';

export async function createSharingPreview({port=5190,seed=false}={}) {
  const h=await sharingHarness();
  const require=createRequire(import.meta.url);
  const kitRequire=createRequire(require.resolve('@sveltejs/kit/package.json'));
  const {svelte,vitePreprocess}=await import(pathToFileURL(resolve(dirname(kitRequire.resolve('@sveltejs/vite-plugin-svelte/package.json')),'src/index.js')).href);
  const server=await createServer({configFile:false,root:resolve('tests/fixtures/flight-sharing'),cacheDir:resolve('node_modules/.cache/flight-sharing-ui'),
    plugins:[svelte({configFile:false,preprocess:vitePreprocess()}),{
      name:'sharing-isolated-api',resolveId(id){if(['sharing-ui-auth','sharing-ui-locale'].includes(id))return '\0'+id;},
      load(id){
        if(id==='\0sharing-ui-auth')return "export const getAccessToken=async()=>window.__flightSharingRole;";
        if(id==='\0sharing-ui-locale')return "import {writable,derived} from 'svelte/store';export const locale=writable('zh-TW');export const t=derived(locale,l=>k=>({figure_eight:l==='en'?'Figure eight':'八字飛行',hover:l==='en'?'Hover':'定點懸停',route:l==='en'?'Route':'矩形航線',landing:l==='en'?'Landing':'返航降落'}[k.split('.')[2]]||k));";
      },
      configureServer(vite){vite.middlewares.use(async(req,res,next)=>{
        if(!req.url?.startsWith('/api/simulator/submissions'))return next();
        try{
          const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>12_000){res.statusCode=413;res.end();return;}chunks.push(chunk);}
          const request=new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers:req.headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})});
          const response=await h.dispatch(request);res.statusCode=response.status;
          response.headers.forEach((value,name)=>res.setHeader(name,value));res.end(Buffer.from(await response.arrayBuffer()));
        }catch{res.statusCode=500;res.setHeader('Content-Type','application/json');res.end('{"code":"error"}');}
      });}
    }],resolve:{alias:[{find:'$lib/utils/functions/supabase',replacement:'sharing-ui-auth'},{find:'$lib/utils/functions/translations',replacement:'sharing-ui-locale'},{find:'$lib',replacement:resolve('src/lib')}]},
    css:{postcss:resolve('postcss.config.js')},server:{host:'127.0.0.1',port,strictPort:true,fs:{allow:[resolve('.')]}}});
  try {await server.listen();} catch(error){await h.close();throw error;}
  if(seed) for(const role of ['student','studentB']) await h.dispatch(new Request(`http://localhost/api/simulator/submissions`,{method:'POST',headers:{Authorization:`Bearer ${role}`,'Content-Type':'application/json'},body:JSON.stringify({
    courseId:ids.course,requestId:randomUUID(),title:role==='student'?'八字實飛：截圖與錄影（本地示例）':'模擬器成績（本地示例）',flightType:role==='student'?'real':'simulator',scenario:'figure_eight',occurredAt:'2026-09-20T12:00:00Z',resultUrl:'https://drive.google.com/file/d/fixtureimage12345678/view',videoUrl:role==='student'?'https://drive.google.com/file/d/fixturevideo12345678/view':'',note:'隔離測試資料；連結是示例，不是真實飛行檔案。',consent:true})}));
  return {server,h,url:`http://127.0.0.1:${port}`,async close(){await server.close();await h.close();}};
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const preview=await createSharingPreview({seed:true});
  console.log(`Isolated flight-sharing preview: ${preview.url}. Fixture accounts; actual new routes and PostgreSQL; no production writes. Restart resets test records.`);
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await preview.close();process.exit(0);});
}
