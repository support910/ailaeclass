import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve('../..');
const base = '76441f3f2297fa7a89d19fb54d0b6143a3df2364';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

test('clean branch descends from the verified Railway release', () => {
  git('merge-base', '--is-ancestor', base, 'HEAD');
  assert.equal(git('rev-parse', `${base}^{tree}`), '2cfbc38a6a4ad83adca8dc6a52beb2ee92ad1a33');
});

test('existing files changed only within flight-results and requested Kimi migration', () => {
  const allowed = new Set([
    'CHANGELOG.md',
    'apps/dashboard/src/lib/utils/constants/releases.ts',
    'apps/dashboard/.env.example',
    'apps/dashboard/src/lib/utils/services/ai/provider.server.ts',
    'apps/dashboard/src/routes/lms/simulator/+page.svelte',
    'apps/dashboard/src/routes/org/[slug]/simulator/+page.svelte',
    'apps/dashboard/svelte.config.js',
    'docker/Dockerfile.dashboard',
    'docker/docker-compose.yaml',
    'apps/dashboard/src/lib/utils/services/ai/deepseek.server.ts',
    'apps/dashboard/src/lib/components/Agent/AgentChat.svelte',
    'apps/dashboard/src/lib/components/Chatbot/ChatbotWidget.svelte',
    'apps/dashboard/src/lib/components/AITools/ToolHub.svelte',
    'apps/dashboard/src/routes/api/chat/+server.ts',
    'apps/dashboard/src/routes/api/agent/chat/+server.ts',
    'apps/dashboard/src/routes/api/ai-tools/socratic/+server.ts',
    'apps/dashboard/src/lib/server/chat/manual.ts',
    'apps/dashboard/src/lib/server/ai/language.ts'
  ]);
  const baseFiles = new Set(git('ls-tree', '-r', '--name-only', base).split('\n'));
  const changed = git('diff', '--name-only', base, '--').split('\n').filter(Boolean);
  assert.deepEqual(changed.filter(path => baseFiles.has(path) && !allowed.has(path)), []);
});

test('mobile-optimization and old flight-review routes were not imported', () => {
  const untouched = [
    'apps/dashboard/src/app.postcss',
    'apps/dashboard/src/lib/components/Exam',
    'apps/dashboard/src/lib/components/UploadImage',
    'apps/dashboard/src/lib/components/Org/SideBar.svelte',
    'apps/dashboard/src/lib/components/LMS/SideBar.svelte',
    'apps/dashboard/src/lib/utils/translations',
    'apps/dashboard/src/routes/org/[slug]/exams',
    'apps/dashboard/src/routes/courses'
  ];
  assert.equal(git('diff', '--name-only', base, '--', ...untouched), '');
  for (const path of [
    'apps/dashboard/src/lib/components/FlightReview',
    'apps/dashboard/src/lib/utils/services/flight-review',
    'apps/dashboard/src/routes/api/flight-review',
    'apps/dashboard/src/routes/lms/flight-review'
  ]) assert.equal(existsSync(resolve(root, path)), false, path);
});
