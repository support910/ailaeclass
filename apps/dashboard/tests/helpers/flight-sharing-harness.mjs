import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

export const ids = {
  student:'11111111-1111-4111-8111-111111111111', studentB:'22222222-2222-4222-8222-222222222222',
  teacher:'33333333-3333-4333-8333-333333333333', teacherB:'44444444-4444-4444-8444-444444444444',
  admin:'55555555-5555-4555-8555-555555555555', outsider:'66666666-6666-4666-8666-666666666666',
  org:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', otherOrg:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  course:'cccccccc-cccc-4ccc-8ccc-cccccccccccc', otherCourse:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  foreignCourse:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
};
export async function sharingHarness(options = {}) {
  const path = process.env.SIMULATOR_QA_PGLITE;
  if(!path) throw new Error('SIMULATOR_QA_PGLITE must point to the isolated QA runtime');
  const {PGlite} = await import(path);
  const pg = new PGlite();
  await pg.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated;
    create table public.organization(id uuid primary key);
    create table public."group"(id uuid primary key,organization_id uuid);
    create table public.course(id uuid primary key,title text,group_id uuid,status text);
    create table public.profile(id uuid primary key,fullname text,email text);
    create table public.organizationmember(id uuid default gen_random_uuid(),organization_id uuid,profile_id uuid,role_id int,verified bool,email text);
    create table public.groupmember(id uuid default gen_random_uuid(),group_id uuid,profile_id uuid,role_id int,email text,created_at timestamptz default now(),assigned_student_id text);
    insert into public.organization values('${ids.org}'),('${ids.otherOrg}');
    insert into public."group" values('${ids.course}','${ids.org}'),('${ids.otherCourse}','${ids.org}'),('${ids.foreignCourse}','${ids.otherOrg}');
    insert into public.course values('${ids.course}','八字飛行訓練','${ids.course}','ACTIVE'),('${ids.otherCourse}','航線訓練','${ids.otherCourse}','ACTIVE'),('${ids.foreignCourse}','其他機構課程','${ids.foreignCourse}','ACTIVE');`);
  for(const [role,name,roleId,course,org] of [
    ['student','測試學員甲',3,ids.course,ids.org],['studentB','測試學員乙',3,ids.course,ids.org],
    ['teacher','測試教師甲',2,ids.course,ids.org],['teacherB','測試教師乙',2,ids.otherCourse,ids.org],
    ['admin','測試管理員',1,null,ids.org],['outsider','其他機構教師',2,ids.foreignCourse,ids.otherOrg]]) {
    const email=role === 'admin' ? 'admin@5gnu.com' : `${role}@example.invalid`;
    await pg.query('insert into auth.users values($1,$2)',[ids[role],email]);
    await pg.query('insert into public.profile values($1,$2,$3)',[ids[role],name,email]);
    await pg.query('insert into public.organizationmember(organization_id,profile_id,role_id,verified,email) values($1,$2,$3,true,$4)',[org,ids[role],roleId,email]);
    if(course) await pg.query('insert into public.groupmember(group_id,profile_id,role_id,email) values($1,$2,$3,$4)',[course,ids[role],roleId,email]);
  }
  await pg.exec(await readFile(resolve('../../supabase/migrations/20260922090000_flight_link_submissions.sql'),'utf8'));
  function from(table) {
    assert.match(table,/^[a-z_]+$/);
    let fields='*',values=null,filters=[],orders=[],paging='';
    const builder={
      select(value='*'){assert.match(value,/^[a-z_,* ]+$/); fields=value;return builder;},
      eq(key,value){filters.push([key,value,false]);return builder;},
      in(key,value){filters.push([key,value,true]);return builder;},
      update(value){values=value;return builder;},
      order(key,opts={}){assert.match(key,/^[a-z_]+$/);orders.push(`"${key}" ${opts.ascending===false?'desc':'asc'}`);return builder;},
      range(start,end){paging=` limit ${end-start+1} offset ${start}`;return builder;},
      maybeSingle(){return execute(true);},then(ok,bad){return execute().then(ok,bad);}
    };
    async function execute(single=false) {
      try {
        const params=[],param=value=>{params.push(value);return `$${params.length}`;};
        const set=values?Object.entries(values).map(([key,value])=>{assert.match(key,/^[a-z_]+$/);return `"${key}"=${param(value)}`;}).join(','):'';
        const where=filters.map(([key,value,multiple])=>{assert.match(key,/^[a-z_]+$/);return multiple ? value.length?`"${key}" in (${value.map(param).join(',')})`:'false':`"${key}"=${param(value)}`;}).join(' and ');
        const suffix=where?` where ${where}`:'';
        const sql=values?`update "${table}" set ${set}${suffix} returning ${fields}`:`select ${fields} from "${table}"${suffix}${orders.length?' order by '+orders.join(','):''}${paging}`;
        const data=(await pg.query(sql,params)).rows;
        return {data:single?data[0]||null:data,error:null};
      }catch(error){return {data:null,error};}
    }
    return builder;
  }
  const db={from,auth:{admin:{async getUserById(id){return {data:{user:(await pg.query('select * from auth.users where id=$1',[id])).rows[0]}};}}},
    async rpc(name,args){assert.equal(name,'submit_flight_link');try{
      const keys=['p_user_id','p_course_id','p_request_id','p_title','p_flight_type','p_scenario','p_occurred_at','p_result_url','p_video_url','p_note'];
      const result=await pg.query('select public.submit_flight_link($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as id',keys.map(k=>args[k]));
      return {data:result.rows[0].id,error:null};
    }catch(error){return {data:null,error};}}};
  globalThis.__flightSharingDb=db;
  const plugin={name:'isolated-sharing-auth',resolveId(id){if(id==='sharing-auth')return '\0sharing-auth';},load(id){if(id==='\0sharing-auth')return `export const getServerSupabase=()=>globalThis.__flightSharingDb;export const getUserIdFromRequest=async r=>(${JSON.stringify(ids)})[r.headers.get('authorization')?.replace('Bearer ','')]||null;`;}};
  const vite=await createServer({configFile:false,root:process.cwd(),cacheDir:resolve('node_modules/.cache/flight-sharing-server'),optimizeDeps:{disabled:true},
    server:{middlewareMode:true,hmr:false},resolve:{alias:[{find:'$lib/utils/functions/supabase.server',replacement:'sharing-auth'},{find:'$lib',replacement:resolve('src/lib')}]},plugins:[plugin]});
  const list=await vite.ssrLoadModule('/src/routes/api/simulator/submissions/+server.ts');
  const detail=await vite.ssrLoadModule('/src/routes/api/simulator/submissions/[id]/+server.ts');
  async function dispatch(request) {
    const url=new URL(request.url),id=url.pathname.split('/')[4];
    const handler=(id?detail:list)[request.method];
    return handler?handler({request,url,params:{id}}):new Response(null,{status:405});
  }
  return {pg,db,vite,dispatch,async close(){await vite.close();await pg.close();delete globalThis.__flightSharingDb;}};
}
