import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';

let vite, ai, vision, wrapper, policy;
const originalFetch = globalThis.fetch;
const env = { PRIVATE_KIMI_API_KEY: 'fixture-kimi-only', PRIVATE_KIMI_MODEL: 'kimi-k2.5', PRIVATE_AI_MAX_TOKENS: '700' };
globalThis.__kimiTestEnv = env;
before(async () => {
  vite = await createServer({ configFile: false, root: process.cwd(), cacheDir: resolve('node_modules/.cache/kimi-unit'),
    server: { middlewareMode: true, hmr: false }, optimizeDeps: { disabled: true }, plugins: [{ name: 'private-fixture-env',
      resolveId(id) { if (id === '$env/dynamic/private') return '\0kimi-env'; },
      load(id) { if (id === '\0kimi-env') return 'export const env=globalThis.__kimiTestEnv;'; }
    }] });
  ai = await vite.ssrLoadModule('/src/lib/utils/services/ai/provider.server.ts');
  vision = await vite.ssrLoadModule('/src/lib/utils/services/ai/vision.server.ts');
  wrapper = await vite.ssrLoadModule('/src/lib/utils/services/ai/kimi.server.ts');
  policy = await vite.ssrLoadModule('/src/lib/server/chat/responsePolicy.ts');
});
after(async () => { globalThis.fetch = originalFetch; await vite?.close(); delete globalThis.__kimiTestEnv; });
const messages = [{ role: 'user', content: 'Fixture question' }];
const response = content => Response.json({ choices: [{ message: { content } }] });

test('Kimi is used and chatbot/Agent retain independent output budgets', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, ...JSON.parse(options.body), headers: options.headers }); return response('ok'); };
  await wrapper.createKimiChatCompletion(messages, { maxTokens: policy.CHATBOT_LIMITS.maxTokens });
  await wrapper.createKimiChatCompletion(messages, { maxTokens: policy.AGENT_LIMITS.maxTokens });
  assert.deepEqual(calls.map(c => c.max_tokens), [256, 1400]);
  for (const call of calls) {
    assert.equal(call.url, 'https://api.moonshot.cn/v1/chat/completions');
    assert.equal(call.model, 'kimi-k2.5'); assert.equal(call.temperature, 0.6);
    assert.equal(call.thinking.type, 'disabled'); assert.equal(call.headers.Authorization, 'Bearer fixture-kimi-only');
  }
});
test('screenshots and video frames use Kimi multimodal JSON input', async () => {
  env.PRIVATE_KIMI_VISION_MODEL = 'kimi-k2.5';
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(url, 'https://api.moonshot.cn/v1/chat/completions');
    assert.equal(body.messages[1].content.filter(p => p.type === 'image_url').length, 13);
    assert.equal(body.max_tokens, 1800); assert.equal(body.response_format.type, 'json_object');
    return response('{"summary":"fixture"}');
  };
  await vision.createAiVisionCompletion('rules', 'evidence', Array.from({ length: 13 }, () => ({ dataUrl: 'data:image/jpeg;base64,/9j/' })));
  assert.equal(vision.describeVisionProvider().provider, 'kimi');
});
test('explicit Kimi Code endpoint preserves real application identity', async () => {
  env.PRIVATE_KIMI_BASE_URL = 'https://api.kimi.com/coding/v1';
  env.PRIVATE_KIMI_MODEL = 'kimi-for-coding';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.kimi.com/coding/v1/chat/completions');
    assert.equal(options.headers['User-Agent'], 'AiLAEClass/1.0');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'kimi-for-coding'); assert.equal(body.thinking.type, 'disabled');
    return response('ok');
  };
  await ai.createAiChatCompletion(messages);
  delete env.PRIVATE_KIMI_BASE_URL; env.PRIVATE_KIMI_MODEL = 'kimi-k2.5';
});
test('no obsolete vendor fallback even if its key still exists', async () => {
  delete env.PRIVATE_KIMI_API_KEY;
  env.PRIVATE_DEEPSEEK_API_KEY = 'must-not-use'; env.OPENAI_API_KEY = 'must-not-use';
  globalThis.fetch = () => { throw new Error('No external request allowed'); };
  await assert.rejects(ai.createAiChatCompletion(messages), { code: 'missing_api_key', status: 503 });
  await assert.rejects(wrapper.createKimiChatCompletion(messages), { code: 'missing_kimi_key', status: 503 });
  assert.equal(vision.describeVisionProvider().configured, false);
  env.PRIVATE_KIMI_API_KEY = 'fixture-kimi-only';
});
test('Moonshot account alias and international endpoint stay within Kimi', async () => {
  delete env.PRIVATE_KIMI_API_KEY; env.PRIVATE_MOONSHOT_API_KEY = 'fixture-alias';
  env.PRIVATE_KIMI_BASE_URL = 'https://api.moonshot.ai/v1/';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.moonshot.ai/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer fixture-alias'); return response('ok');
  };
  await ai.createAiChatCompletion(messages);
  delete env.PRIVATE_MOONSHOT_API_KEY; delete env.PRIVATE_KIMI_BASE_URL; env.PRIVATE_KIMI_API_KEY = 'fixture-kimi-only';
});
test('auth, rate-limit and server errors are not retried or reflected', async () => {
  for (const status of [401, 403, 429, 500]) {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ error: { message: 'private upstream content' } }, { status }); };
    await assert.rejects(ai.createAiChatCompletion(messages, { responseFormat: { type: 'json_object' } }), e => {
      assert.equal(e.status, status === 429 ? 429 : 502); assert.equal(e.details, undefined);
      assert.ok(!e.message.includes('private upstream content')); return true;
    });
    assert.equal(calls, 1);
  }
});
test('only unsupported response_format gets a single compatibility retry', async () => {
  let calls = 0;
  globalThis.fetch = async (_, options) => {
    calls++; const body = JSON.parse(options.body);
    if (calls === 1) return Response.json({ error: { message: 'response_format is not supported' } }, { status: 400 });
    assert.equal(body.response_format, undefined); return response('{}');
  };
  assert.equal(await ai.createAiChatCompletion(messages, { responseFormat: { type: 'json_object' } }), '{}');
  assert.equal(calls, 2);
  calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ error: { message: 'bad model' } }, { status: 400 }); };
  await assert.rejects(ai.createAiChatCompletion(messages, { responseFormat: { type: 'json_object' } }));
  assert.equal(calls, 1);
});
test('invalid upstream output is rejected', async () => {
  for (const value of [null, '', { tool: 'call' }]) {
    globalThis.fetch = async () => response(value);
    await assert.rejects(ai.createAiChatCompletion(messages), { code: 'unexpected_response' });
  }
  globalThis.fetch = async () => new Response('not-json');
  await assert.rejects(ai.createAiChatCompletion(messages), { code: 'unexpected_response' });
});
test('timeout and caller cancellation both stop requests', async () => {
  globalThis.fetch = (_, { signal }) => new Promise((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  await assert.rejects(ai.requestKimiCompletion(messages, { timeoutMs: 10 }), { status: 504 });
  await assert.rejects(ai.requestKimiCompletion(messages, { signal: AbortSignal.abort() }), { status: 504 });
});
test('knowledge corpus, reply limits and escalation rules remain unchanged', () => {
  const result = execFileSync('git', ['diff', '--name-only', '76441f3', '--',
    'apps/dashboard/src/lib/server/agent/knowledge', 'apps/dashboard/src/lib/server/agent/knowledgeLoader.server.ts', 'apps/dashboard/src/lib/server/chat/responsePolicy.ts'],
    { cwd: resolve('../..'), encoding: 'utf8' }).trim();
  assert.equal(result, '');
  assert.equal(policy.CHATBOT_LIMITS.chineseChars, 180); assert.equal(policy.AGENT_LIMITS.chineseChars, 1400);
});
