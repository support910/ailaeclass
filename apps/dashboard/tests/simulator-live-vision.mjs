import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, loadEnv } from 'vite';
import { parseResults, RESULT_TEMPLATE } from '../src/lib/server/simulator/data.js';

// Opt-in only: synthetic evidence, no user or database access.
if (process.env.SIMULATOR_LIVE_VISION !== '1') throw new Error('Set SIMULATOR_LIVE_VISION=1 to authorize the paid external test.');
globalThis.__simulatorPrivateEnv = loadEnv('development', process.cwd(), '');
const vite = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true, hmr: false },
  cacheDir: resolve('node_modules/.cache/simulator-live-vision'), optimizeDeps: { disabled: true },
  resolve: { alias: { '$lib': resolve('src/lib') } },
  plugins: [{ name: 'local-private-env', resolveId(id) { if (id === '$env/dynamic/private') return '\0simulator-private-env'; }, load(id) {
    if (id === '\0simulator-private-env') return 'export const env=globalThis.__simulatorPrivateEnv;';
  } }]
});
const originalFetch = globalThis.fetch;
const paired = process.env.SIMULATOR_LIVE_PAIRED === '1';
const numeric = process.env.SIMULATOR_LIVE_DATA === '1';
const kind = numeric ? 'data' : paired ? 'paired' : 'image';
const output = resolve('../../output/simulator-drive-20260917');
globalThis.fetch = async (...args) => {
  let response;
  try { response = await originalFetch(...args); }
  catch (error) { console.error('Transport error code: ' + (error.cause?.code || error.name)); throw error; }
  if (String(args[0]).endsWith('/chat/completions') && response.ok) {
    const data = await response.clone().json();
    // Only synthetic-test model text, never credentials, headers or reasoning traces.
    await writeFile(resolve(output, `live-synthetic-${kind}-raw.txt`), String(data?.choices?.[0]?.message?.content || ''));
  }
  return response;
};
try {
  const vision = await vite.ssrLoadModule('/src/lib/utils/services/ai/vision.server.ts');
  const provider = vision.describeVisionProvider();
  console.log('Vision provider: ' + provider.provider + '; configured: ' + provider.configured);
  if (!provider.configured) { console.log('SKIPPED: no vision provider configured. No external request made.'); }
  else {
    const { analyzeReview, frameInput } = await vite.ssrLoadModule('/src/lib/server/simulator/analysis.server.ts');
    const payload = frameInput.parse(numeric ? { locale: 'zh-TW' } : JSON.parse(await readFile(resolve(output, `fixture-${kind}-analysis-input.json`), 'utf8')));
    const report = await analyzeReview({ source_kind: numeric ? 'data' : paired ? 'image_video' : 'image', data_summary: numeric ? parseResults(RESULT_TEMPLATE) : undefined, scenario: 'hover', flight_type: paired ? 'real_flight' : 'simulator' }, payload);
    assert.equal(report.officialGrade, false);
    assert.ok(report.findings.length > 0);
    if (paired) assert.equal(report.crossCheck.status, 'unknown', 'Synthetic moving dot does not verify a flight');
    if (numeric) assert.ok(report.findings.every(item => item.frame === null));
    const text = JSON.stringify(report);
    assert.ok(text.includes('1.2'), 'Legible altitude deviation should be read');
    assert.ok(/1(?:\.0)?\s*(?:m|米|公尺)/.test(text), 'Legible practice target should be read');
    assert.equal(report.aiProvider, 'kimi');
    await writeFile(resolve(output, `live-synthetic-${kind}-report.json`), JSON.stringify(report, null, 2));
    console.log('LIVE VISION RESPONSE: ' + JSON.stringify(report));
  }
} catch (error) {
  console.error('LIVE VISION FAILED: ' + (error.code || error.name) + ' (no credentials printed)');
  process.exitCode = 1;
} finally { globalThis.fetch = originalFetch; await vite.close(); delete globalThis.__simulatorPrivateEnv; }
