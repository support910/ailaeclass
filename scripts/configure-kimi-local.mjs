import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

// Usage: node scripts/configure-kimi-local.mjs <private-key-file> [--international|--coding]
// Validates credentials first; does not deploy or access Supabase.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dashboard = resolve(root, 'apps/dashboard');
const require = createRequire(resolve(dashboard, 'package.json'));
const { parse } = require('dotenv');
const file = process.argv[2];
try {
  if (!file || file.startsWith('--')) throw new Error('Provide a private dotenv-format key file.');
  const raw = await readFile(resolve(file), 'utf8');
  const values = parse(raw);
  const firstLine = raw.replace(/^\uFEFF/, '').split(/\r?\n/)[0].trim();
  const key = values.PRIVATE_KIMI_API_KEY || values.KIMI_API_KEY || values.PRIVATE_MOONSHOT_API_KEY || (/^sk-[\w-]+$/.test(firstLine) ? firstLine : '');
  if (!key) throw new Error('No Kimi API key found in the file.');
  const coding = process.argv.includes('--coding');
  const baseUrl = coding ? 'https://api.kimi.com/coding/v1' : process.argv.includes('--international') ? 'https://api.moonshot.ai/v1' : 'https://api.moonshot.cn/v1';
  const response = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${key}`, 'User-Agent': 'AiLAEClass/local-configuration' }, redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Kimi credential validation failed: HTTP ${response.status}. Local configuration was not changed.`);
  const models = (await response.json()).data || [];
  const model = coding ? 'kimi-for-coding' : 'kimi-k2.5';
  if (!models.some(item => item.id === model)) throw new Error('Account does not expose the required model. Confirm an available vision model before configuring.');
  execFileSync('git', ['check-ignore', '--quiet', 'apps/dashboard/.env.local'], { cwd: root });
  const target = resolve(dashboard, '.env.local');
  const current = await readFile(target, 'utf8');
  const backup = resolve(root, '..', '.archive', `kimi-env-${Date.now()}`);
  await mkdir(backup, { recursive: true });
  if (process.platform === 'win32') execFileSync('icacls', [backup, '/inheritance:r', '/grant:r', `${process.env.USERDOMAIN}\\${process.env.USERNAME}:(OI)(CI)F`], { stdio: 'ignore' });
  await copyFile(target, resolve(backup, 'dashboard.env.local'));
  const kept = current.split(/\r?\n/).filter(line => !/^\s*(?:export\s+)?PRIVATE_(?:DEEPSEEK|KIMI|MOONSHOT|VISION)_[A-Z_]+\s*=/.test(line));
  const settings = { PRIVATE_KIMI_API_KEY: key, PRIVATE_KIMI_BASE_URL: baseUrl, PRIVATE_KIMI_MODEL: model, PRIVATE_KIMI_VISION_MODEL: model };
  await writeFile(target, kept.join('\n').trimEnd() + '\n' + Object.entries(settings).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join('\n') + '\n');
  console.log('Kimi local configuration validated and updated. Restart the local preview. No production changes made.');
} catch (error) {
  // Only our fixed messages are safe; never reflect network errors containing request details.
  console.error(/^(Provide|No Kimi|Kimi credential|Account does not)/.test(error.message) ? error.message : 'Kimi local configuration failed; no credentials printed.');
  process.exitCode = 1;
}
