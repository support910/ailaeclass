import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {sharingHarness,ids} from './helpers/flight-sharing-harness.mjs';
const h=await sharingHarness();
let checks=0;
const pass=name=>{checks++;console.log('PASS '+name);};
const request=(role,method='GET',path='',body)=>h.dispatch(new Request(`http://localhost/api/simulator/submissions${path}`,{method,headers:{Authorization:`Bearer ${role}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}));
const form=()=>({courseId:ids.course,requestId:randomUUID(),title:'實飛成績與錄影',flightType:'real',scenario:'figure_eight',occurredAt:'2026-09-20T12:00:00Z',resultUrl:'https://drive.google.com/file/d/resultimage12345678/view',videoUrl:'https://drive.google.com/file/d/flightvideo12345678/view',note:'同一次飛行的兩份證據',consent:true});
try {
  const copy=await h.vite.ssrLoadModule('/src/lib/components/Simulator/sharingCopy.ts');
  assert.equal(copy.completeSharingLocales(),true);assert.equal(copy.sharingLocales.length,7);pass('all seven language dictionaries complete');
  assert.equal((await request('invalid')).status,401);pass('unauthenticated access rejected');
  const teacherResponse=await request('teacher','GET',`?orgId=${ids.org}&view=staff&options=1`);
  assert.equal(teacherResponse.status,200,await teacherResponse.clone().text());
  const teacherOptions=await teacherResponse.json();
  assert.deepEqual(teacherOptions.courses.map(c=>c.id),[ids.course]);pass('teacher only sees assigned courses');
  const adminOptions=await (await request('admin','GET',`?orgId=${ids.org}&view=staff&options=1`)).json();
  assert.equal(adminOptions.courses.length,2);pass('admin can inspect all courses in their organization');
  assert.equal((await request('student','GET',`?orgId=${ids.org}&view=staff`)).status,403);
  assert.equal((await request('outsider','GET',`?orgId=${ids.org}&view=staff`)).status,403);pass('students and external staff cannot use staff inbox');
  for(const change of [{consent:false},{user_id:ids.studentB},{resultUrl:'https://evil.invalid/a'},{resultUrl:'https://drive.google.com/drive/folders/abcdefghijk1234'},
    {videoUrl:'https://drive.google.com/file/d/resultimage12345678/view'},{occurredAt:'2099-01-01T00:00:00Z'},{resultUrl:'',videoUrl:''}]) {
    assert.equal((await request('student','POST','',{...form(),...change})).status,400);
  }pass('consent, links, identity spoofing, duplicate files and future dates validated');
  assert.equal((await request('student','POST','',{...form(),courseId:ids.otherCourse})).status,403);pass('cannot submit to a course not enrolled in');
  const first=form();const create=await request('student','POST','',first);assert.equal(create.status,201,await create.clone().text());const {id}=await create.json();
  assert.equal((await request('student','POST','',first)).status,201);
  assert.equal((await h.pg.query('select count(*)::int as n from flight_link_submissions')).rows[0].n,1);pass('retry-safe submission stores both links as one immutable record');
  assert.equal((await request('student','POST','',{...first,title:'changed'})).status,409);pass('idempotency key cannot silently change evidence');
  for(const role of ['teacher','admin']) {
    const response=await request(role,'GET',`?orgId=${ids.org}&view=staff`);const data=await response.json();
    assert.equal(data.submissions.length,1);assert.equal(data.submissions[0].student_name,'測試學員甲');
    assert.equal(data.submissions[0].video_url,first.videoUrl);assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal((await request(role,'GET',`/${id}`)).status,200);
  }pass('assigned teacher and administrator read links, student identity and flight details');
  for(const role of ['studentB','teacherB','outsider']) assert.equal((await request(role,'GET',`/${id}`)).status,404);
  assert.equal((await request('teacher','GET',`?orgId=${ids.org}&view=staff&courseId=${ids.otherCourse}`)).status,403);pass('detail and filter IDOR attempts are rejected');
  for(const [role,expected] of [['student',1],['studentB',0],['teacher',1],['teacherB',0],['admin',1],['outsider',0]]) {
    await h.pg.exec(`set role authenticated;set request.jwt.claim.sub='${ids[role]}';`);
    assert.equal((await h.pg.query('select count(*)::int as n from public.flight_link_submissions')).rows[0].n,expected,role);
    await h.pg.exec('reset role');
  }pass('real PostgreSQL RLS matches all six role/account boundaries');
  await h.pg.query('insert into groupmember(group_id,profile_id,role_id) values($1,$2,2)',[ids.course,ids.teacherB]);
  assert.equal((await request('teacherB','GET',`/${id}`)).status,200);pass('multiple assigned teachers can read the same flight');
  await h.pg.query('delete from groupmember where group_id=$1 and profile_id=$2',[ids.course,ids.teacherB]);
  assert.equal((await request('teacherB','GET',`/${id}`)).status,404);pass('removing a teacher immediately revokes detail access');
  assert.equal((await request('teacher','DELETE',`/${id}`)).status,403);
  assert.equal((await request('studentB','DELETE',`/${id}`)).status,404);
  assert.equal((await request('student','DELETE',`/${id}`)).status,200);
  assert.equal((await request('teacher','GET',`/${id}`)).status,404);
  assert.equal((await request('admin','GET',`/${id}`)).status,404);
  assert.equal((await request('student','GET',`/${id}`)).status,200);pass('only owner can withdraw; staff access stops, owner history remains');
  await h.pg.exec(`set role authenticated;set request.jwt.claim.sub='${ids.teacher}';`);
  assert.equal((await h.pg.query('select count(*)::int as n from public.flight_link_submissions')).rows[0].n,0);
  await assert.rejects(h.pg.exec('delete from public.flight_link_submissions'));
  await h.pg.exec('reset role');pass('withdrawal and write restrictions also enforced at database boundary');
  for(let i=0;i<4;i++)assert.equal((await request('student','POST','',form())).status,201);
  assert.equal((await request('student','POST','',form())).status,429);pass('withdrawing does not reset anti-spam quota');
  assert.equal((await request('studentB','POST','',{...form(),flightType:'simulator',videoUrl:''})).status,201);pass('simulator screenshot-only submission succeeds');
  await h.pg.query('update organizationmember set verified=false where profile_id=$1',[ids.teacher]);
  assert.equal((await request('teacher','GET',`?orgId=${ids.org}&view=staff`)).status,403);
  assert.equal((await request('teacher','GET',`/${id}`)).status,404);pass('unverified staff cannot retain access');
  console.log(`FLIGHT SHARING: ${checks} checks passed; isolated PostgreSQL only.`);
} finally {await h.close();}
