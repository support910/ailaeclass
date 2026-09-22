import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve,dirname } from 'node:path';
import test from 'node:test';
const manifest=resolve(process.env.FLIGHT_FREEZE_MANIFEST || '../../../.archive/frozen-flight-kimi-20260922/manifest.json');
test('frozen pre-sharing files only change at simulator entries, release notes and the scope-test allowlist',{skip:!existsSync(manifest)},()=>{
  const allowed=new Set(['apps/dashboard/src/routes/lms/simulator/+page.svelte','apps/dashboard/src/routes/org/[slug]/simulator/+page.svelte','apps/dashboard/tests/flight-clean-base.test.mjs','apps/dashboard/src/lib/utils/constants/releases.ts','CHANGELOG.md']);
  const files=JSON.parse(readFileSync(manifest,'utf8').replace(/^\uFEFF/,''));
  const changed=[];
  for(const file of files) {
    const frozen=resolve(dirname(manifest),'workspace',file.path);
    assert.equal(createHash('sha256').update(readFileSync(frozen)).digest('hex').toUpperCase(),file.sha256,`Frozen backup changed: ${file.path}`);
    if(allowed.has(file.path)||file.path.startsWith('output/'))continue;
    const path=resolve('../..',file.path);
    if(!existsSync(path)||createHash('sha256').update(readFileSync(path)).digest('hex').toUpperCase()!==file.sha256)changed.push(file.path);
  }
  assert.deepEqual(changed,[]);
});
