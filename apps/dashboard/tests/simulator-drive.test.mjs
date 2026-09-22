import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseDriveLink, downloadDrive, readLimited } from '../src/lib/server/simulator/drive.js';
import { parseResults, RESULT_TEMPLATE } from '../src/lib/server/simulator/data.js';

const url = 'https://drive.google.com/file/d/abcdefghijk1234/view?usp=sharing&resourcekey=0-secret';
test('normalizes file links and preserves required resource keys', () => {
  const result = parseDriveLink(url);
  assert.equal(result.id, 'abcdefghijk1234');
  assert.equal(new URL(result.download).searchParams.get('resourcekey'), '0-secret');
  assert.equal(new URL(result.sourceUrl).searchParams.has('usp'), false);
});
test('exports the selected Google Sheets tab', () => {
  const result = parseDriveLink('https://docs.google.com/spreadsheets/d/abcdefghijk1234/edit#gid=321');
  assert.equal(new URL(result.download).searchParams.get('gid'), '321');
  assert.equal(result.sheet, true);
});
test('rejects SSRF, lookalike hosts, credentials, folders and bad IDs', () => {
  for (const value of ['http://drive.google.com/file/d/abcdefghijk1234/view', 'https://localhost/a',
    'https://drive.google.com.evil.example/file/d/abcdefghijk1234/view', 'https://user@drive.google.com/file/d/abcdefghijk1234/view',
    'https://drive.google.com/drive/folders/abcdefghijk1234', 'https://drive.google.com/open?id=../bad',
    'https://docs.google.com/spreadsheets/d/abcdefghijk1234/edit?gid=x']) {
    assert.throws(() => parseDriveLink(value), { code: 'invalid_link' });
  }
});
test('does not follow redirects outside approved Google download hosts', async () => {
  const calls = [];
  await assert.rejects(downloadDrive(parseDriveLink(url), async (target, options) => {
    calls.push(target);
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers, undefined);
    return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } });
  }), { code: 'share_unavailable' });
  assert.equal(calls.length, 1);
});
test('recognizes video and image shares and rejects login HTML', async () => {
  for (const [mime, kind] of [['video/mp4','video'], ['video/webm','video'], ['image/png','image'], ['application/json','data']]) {
    const result = await downloadDrive(parseDriveLink(url), async () => new Response('data', { headers: { 'content-type': mime } }));
    assert.equal(result.kind, kind);
  }
  await assert.rejects(downloadDrive(parseDriveLink(url), async () => new Response('<html>Sign in</html>', { headers: { 'content-type': 'text/html' } })), { code: 'share_unavailable' });
});
test('limits streamed bytes even when Content-Length is absent or false', async () => {
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(10)); c.enqueue(new Uint8Array(10)); c.close(); } });
  await assert.rejects(readLimited(stream, 15), { code: 'file_too_large' });
});
test('compares values deterministically and never turns missing targets into a pass', () => {
  const result = parseResults(RESULT_TEMPLATE);
  assert.equal(result.good, 1); assert.equal(result.improve, 2); assert.equal(result.unknown, 1);
  assert.equal(result.metrics[3].target, null); assert.equal(result.metrics[3].deviation, null);
  assert.equal(result.standardSource, 'learner_file_unverified');
});
test('keeps invalid rows visible and does not coerce blanks, booleans or Infinity to zero', () => {
  const result = parseResults(JSON.stringify({ metrics: [
    { metric: 'valid', value: 0, target: 0, direction: 'equal' },
    { metric: 'blank', value: '' }, { metric: 'boolean', value: false }, { metric: 'bad', value: 'Infinity' }
  ] }));
  assert.equal(result.good, 1); assert.equal(result.invalidRows, 3); assert.equal(result.issues.length, 3);
});
test('handles quoted metric labels, BOM and Chinese headers', () => {
  const result = parseResults('\uFEFF指標,數值,單位,目標,方向\n"左右,偏差",0.5,m,0.4,lower');
  assert.equal(result.metrics[0].name, '左右,偏差'); assert.equal(result.improve, 1);
});
test('rejects arbitrary documents and malformed tables', () => {
  for (const value of ['<html>login</html>', 'hello', '{"metrics":{}}', 'metric,value\na,2,extra']) {
    assert.throws(() => parseResults(value));
  }
});
test('downloadable sample matches the parser sample', () => {
  const csv = readFileSync(new URL('../static/downloads/simulator-results-template.csv', import.meta.url), 'utf8');
  assert.deepEqual(parseResults(csv), parseResults(RESULT_TEMPLATE));
});
