import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import { chromium } from '@playwright/test';

// Opt-in release smoke: existing test accounts only, one clearly labelled retained record.
assert.equal(process.env.FLIGHT_LIVE_SMOKE, '1', 'Live smoke requires explicit opt-in');
const base = process.env.FLIGHT_SMOKE_BASE_URL || 'http://127.0.0.1:5173';
assert.ok(['http://127.0.0.1:5173', 'https://ailaeclass.5gnumultimedia.com'].includes(base));
const env = loadEnv('development', process.cwd(), '');
assert.equal(new URL(env.PUBLIC_SUPABASE_URL).hostname, 'kiqzanfkpivkuvlvxqsp.supabase.co');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const db = createClient(env.PUBLIC_SUPABASE_URL, env.PRIVATE_SUPABASE_SERVICE_ROLE, options);
const sessions = [];
let browser;
const checked = (result) => { if (result.error) throw new Error(`Supabase request failed: ${result.error.code || result.error.status}`); return result.data; };
async function session(email) {
  const link = checked(await db.auth.admin.generateLink({ type: 'magiclink', email }));
  const client = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, options);
  const data = checked(await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' }));
  assert.ok(data.session?.access_token);
  sessions.push(client);
  return data.session;
}
async function api(path, auth, init = {}) {
  const response = await fetch(`${base}/api/simulator/submissions${path}`, {
    ...init, headers: { ...(auth ? { Authorization: `Bearer ${auth.access_token}` } : {}), 'Content-Type': 'application/json' }
  });
  const data = await response.json();
  return { status: response.status, data, cache: response.headers.get('cache-control') };
}
try {
  const admin = checked(await db.from('profile').select('id,email').eq('email', 'admin@5gnu.com').single());
  const student = checked(await db.from('profile').select('id,email').eq('email', '2939875118@qq.com').single());
  const orgMembership = checked(await db.from('organizationmember').select('organization_id').eq('profile_id', admin.id).eq('role_id', 1).eq('verified', true).limit(1).single());
  const orgId = orgMembership.organization_id;
  const org = checked(await db.from('organization').select('siteName').eq('id', orgId).single());
  const teachers = checked(await db.from('organizationmember').select('profile_id').eq('organization_id', orgId).eq('role_id', 2).eq('verified', true));
  const studentSession = await session(student.email);
  const adminSession = await session(admin.email);
  const available = await api(`?orgId=${orgId}&options=1`, studentSession);
  assert.equal(available.status, 200);
  let course, teacher;
  for (const candidate of available.data.courses) {
    const row = checked(await db.from('course').select('group_id').eq('id', candidate.id).single());
    const members = checked(await db.from('groupmember').select('profile_id').eq('group_id', row.group_id).in('role_id', [1, 2]));
    const tutor = members.find(member => teachers.some(value => value.profile_id === member.profile_id));
    if (tutor) { course = candidate; teacher = checked(await db.auth.admin.getUserById(tutor.profile_id)).user; break; }
  }
  assert.ok(course && teacher?.email, 'No shared student/assigned-teacher course: do not alter memberships to make a test pass');
  const teacherSession = await session(teacher.email);
  const title = '發布驗收示例 20260922（非真實飛行）';
  const payload = {
    requestId: '20260922-7500-4000-8000-000000000001', courseId: course.id, title,
    flightType: 'real', scenario: 'figure_eight', occurredAt: '2026-09-22T00:00:00.000Z',
    resultUrl: 'https://drive.google.com/file/d/AiLAEClass_QA_20260922_IMAGE0001/view',
    videoUrl: 'https://drive.google.com/file/d/AiLAEClass_QA_20260922_VIDEO0001/view',
    note: '系統發佈驗收紀錄，非真實學生成績。兩個網址是格式示例，沒有對應真實 Drive 檔案；保留供管理員檢查連結展示。', consent: true
  };
  assert.equal((await api('', null)).status, 401);
  assert.equal((await api(`?orgId=${orgId}&view=staff`, studentSession)).status, 403);
  const submitted = await api('', studentSession, { method: 'POST', body: JSON.stringify(payload) });
  assert.equal(submitted.status, 201, `Submit failed: ${submitted.data.code}`);
  const id = submitted.data.id;
  assert.equal((await api('', studentSession, { method: 'POST', body: JSON.stringify(payload) })).data.id, id);
  for (const [role, auth] of [['student', studentSession], ['teacher', teacherSession], ['admin', adminSession]]) {
    const row = await api(`/${id}`, auth);
    assert.equal(row.status, 200, `${role} detail`);
    const record = row.data.submission || row.data;
    assert.equal(record.result_url, payload.resultUrl);
    assert.equal(record.video_url, payload.videoUrl);
    assert.equal(row.cache, 'no-store');
    const list = await api(`?orgId=${orgId}${role === 'student' ? '' : '&view=staff'}`, auth);
    assert.equal(list.status, 200);
    assert.ok(list.data.submissions.some(item => item.id === id));
  }
  console.log('LIVE API PASS: existing student submitted; assigned teacher and admin read both links; unauthorized access rejected; retry deduplicated.');
  const output = resolve('../../output/flight-sharing-20260922', new URL(base).hostname === '127.0.0.1' ? 'full-local' : 'production');
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'smoke.json'), JSON.stringify({ base, submissionId: id, testRecord: true, retained: true, courseTitle: course.title, api: 'passed', checkedAt: new Date().toISOString() }, null, 2));
  if (process.env.FLIGHT_LIVE_UI === '1') {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    for (const [role, auth] of [['student', studentSession], ['teacher', teacherSession], ['admin', adminSession]]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await context.addInitScript(({ auth }) => {
        localStorage.setItem('sb-kiqzanfkpivkuvlvxqsp-auth-token', JSON.stringify(auth));
        localStorage.setItem('ailaeclass_locale', 'zh-TW');
      }, { auth });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}${role === 'student' ? '/lms/simulator' : `/org/${org.siteName}/simulator`}`, { waitUntil: 'domcontentloaded' });
      const tab = page.getByRole('button', { name: role === 'student' ? /分享給教師|分享给教师|Share with teachers/ : /學生提交|学生提交|Student submissions/, exact: true });
      try {
        await tab.waitFor({ timeout: 60000 });
        await tab.click();
        const item = page.locator('li').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
        await item.getByRole('button', { name: /查看|View/, exact: true }).click({ timeout: 30000 });
        await page.getByRole('link', { name: payload.resultUrl, exact: true }).waitFor();
        await page.getByRole('link', { name: payload.videoUrl, exact: true }).waitFor();
        await page.screenshot({ path: resolve(output, `${role}-links.png`), fullPage: true });
        assert.deepEqual(errors, [], `${role} page errors`);
        console.log(`LIVE UI PASS: ${role} sees retained submission and both links.`);
      } catch (error) {
        await page.screenshot({ path: resolve(output, `${role}-failure.png`), fullPage: true });
        // Do not print browser console or authentication material.
        throw new Error(`UI ${role} failed: ${error.name}; screenshot saved`);
      } finally { await context.close(); }
    }
  }
} finally {
  await browser?.close();
  for (const client of sessions) await client.auth.signOut({ scope: 'local' });
}
