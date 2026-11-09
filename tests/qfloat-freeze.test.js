// SPDX-License-Identifier: Apache-2.0
// Audits the original QFLOAT-001 receipt without rewriting any evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const ev=resolve(root,'evidence/QFLOAT-001');
const SHA=x=>createHash('sha256').update(x).digest('hex');

test('original QFloat browser report and summary match their immutable hashes',()=>{
  const manifest=readFileSync(resolve(ev,'SHA256SUMS'),'utf8');
  const entries=Object.fromEntries(manifest.trimEnd().split('\n').map(line=>{
    const match=line.match(/^([a-f0-9]{64})  ([A-Za-z0-9_.-]+)$/);
    assert.ok(match,'malformed manifest line');
    return [match[2],match[1]];
  }));
  assert.deepEqual(Object.keys(entries),[
    'QFLOAT_ARCADE_REPORT.json','SUMMARY.md',
    'qfloat-desktop.png','qfloat-mobile.png'
  ]);
  for(const name of ['QFLOAT_ARCADE_REPORT.json','SUMMARY.md']){
    assert.equal(SHA(readFileSync(resolve(ev,name))),entries[name],name);
  }
  for(const name of ['qfloat-desktop.png','qfloat-mobile.png']){
    assert.match(entries[name],/^[a-f0-9]{64}$/);
    // These byte assets are separately in the original artifact ZIP, not
    // silently included as binary git blobs in this metadata-only PR.
    assert.equal(existsSync(resolve(ev,name)),false,
      'binary screenshot unexpectedly added; update preservation scope');
  }
});
test('Python stdlib receipt verifier reports only the scope actually checked',()=>{
  const run=spawnSync('python3',['scripts/verify-qfloat-freeze.py'],
    {cwd:root,encoding:'utf8',timeout:30000});
  assert.equal(run.status,0,run.stderr);
  const parsed=JSON.parse(run.stdout);
  assert.deepEqual({
    result:parsed.result,scope:parsed.scope,archive:parsed.archiveVerified,
    screens:parsed.screenshotsVerified,text:parsed.textReceiptsVerified
  },{
    result:'PASS',scope:'text-receipts-only',archive:false,
    screens:0,text:2
  });
  assert.equal(parsed.originalRun,42626854784);
  assert.equal(parsed.sourceHead,'16f252aaea93b8956d2055e49689372164b2b356');
  assert.equal(parsed.arcadeCommit,'f29b780734a50171d55ae2f770930db8a487b31c');
});
test('the original executable Q16 kernel is unchanged by research freeze',()=>{
  const run=spawnSync('git',['hash-object','modules/integer-math/index.js'],
    {cwd:root,encoding:'utf8',timeout:10000});
  assert.equal(run.status,0,run.stderr);
  assert.equal(run.stdout.trim(),
    'd457b0154d9dfc8b50fd593b5e9dff75e1ea66b9',
    'integer-math Git blob changed in evidence-only PR');
});

test('five-member ZIP inventory and adversarial manifest mutations pass Python stdlib regressions',()=>{
  const run=spawnSync('python3',['-m','unittest','discover','-s','tests',
    '-p','test_qfloat_freeze_archive.py','-v'],
    {cwd:root,encoding:'utf8',timeout:30000});
  assert.equal(run.status,0,run.stderr+'\n'+run.stdout);
  assert.match(run.stderr,/Ran 7 tests/);
  assert.match(run.stderr,/OK/);
});
