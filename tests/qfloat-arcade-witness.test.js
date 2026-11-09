// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {ARCADE_COMMIT,ASSETS,parseOptions,allowedRequest,
  checkDispatch,finalize} from '../scripts/qfloat-arcade-witness.mjs';

const root=resolve(import.meta.dirname,'..'),head='a'.repeat(40);
test('ARCADE executable assets are restricted to immutable merged PR #16',()=>{
  assert.equal(ARCADE_COMMIT,'f29b780734a50171d55ae2f770930db8a487b31c');
  assert.deepEqual(ASSETS,[
    'arcade3/qfloat-lab.html','arcade3/qfloat-lab.css',
    'arcade3/qfloat-lab.js','arcade3/qfloat-sim.js',
    'arcade2/qfloat.js','arcade2/engine.js'
  ]);
  for(const name of ASSETS){
    const url='https://qsolkcb.github.io/ARCADE/'+name;
    assert.equal(allowedRequest(url),name);
  }
  assert.equal(allowedRequest('https://qsolkcb.github.io/ARCADE/arcade2/engine.js?v=0.8.0'),
    'arcade2/engine.js');
});
test('untrusted URL forms and arbitrary remote content never pass allowlist',()=>{
  for(const url of [
    'https://qsolkcb.github.io/ARCADE/arcade2/engine.js?v=untrusted',
    'https://evil.test/ARCADE/arcade3/qfloat-lab.js',
    'https://qsolkcb.github.io/ARCADE/arcade3/qfloat-lab.js?x=1',
    'https://qsolkcb.github.io/ARCADE/arcade3/qfloat-lab.js#fragment',
    'http://qsolkcb.github.io/ARCADE/arcade3/qfloat-lab.js',
    'file:///tmp/arcade3/qfloat-lab.js',
    'https://qsolkcb.github.io/ARCADE/arcade3/fake.js'
  ])assert.equal(allowedRequest(url),null,url);
});
test('CLI refuses arbitrary branch identities and writes inside checkout',()=>{
  assert.deepEqual(parseOptions(['--head',head,'--out','/tmp/qfloat-run']),
    {head,out:'/tmp/qfloat-run'});
  for(const args of [
    [],['--head','bad','--out','/tmp/qfloat'],
    ['--head',head,'--out','relative'],
    ['--head',head,'--out','/tmp/../escape'],
    ['--head',head,'--out',root+'/artifacts'],
    ['--head',head,'--out','/tmp/qfloat','--execute','evil']
  ])assert.throws(()=>parseOptions(args));
});
test('a bare Node process cannot execute the physical owner workstation',()=>{
  assert.throws(()=>checkDispatch(head,{}),/Owner-approved dispatch/);
  assert.throws(()=>checkDispatch(head,{
    GITHUB_REPOSITORY:'QSOLKCB/ARCADE',GITHUB_EVENT_NAME:'workflow_dispatch',
    GITHUB_ACTOR:'EmergentMonk',GITHUB_REF:'refs/heads/main',GITHUB_SHA:head
  }),/Owner-approved dispatch/);
});
test('a cleanup failure cannot leave a PASS result or success exit code',async()=>{
  const pass={status:'PASS',failures:[]};
  assert.equal(await finalize(pass,{close:async()=>{}}),0);
  assert.equal(pass.status,'PASS');
  const failed={status:'PASS',failures:[]};
  assert.equal(await finalize(failed,{close:async()=>{throw new Error('synthetic browser failure');}}),1);
  assert.equal(failed.status,'FAIL');
  assert.deepEqual(failed.failures,['browser close: synthetic browser failure']);
  assert.equal(await finalize({status:'FAIL',failures:['preexisting']},null),1);
});
test('dedicated local workflow is manual owner-only and never launches PR code',()=>{
  const y=readFileSync(resolve(root,'.github/workflows/rtx5060ti-qfloat.yml'),'utf8');
  assert.match(y,/^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(y,/^\s{2}(?:push|pull_request|schedule):/m);
  assert.match(y,/github\.repository == 'QSOLKCB\/VANILLAJS'/);
  assert.match(y,/github\.ref == 'refs\/heads\/main'/);
  assert.match(y,/github\.actor == 'EmergentMonk'/);
  assert.match(y,/acknowledge_local_execution == true/);
  assert.match(y,/runs-on: \[self-hosted, linux, x64, qsol-rtx5060ti\]/);
  assert.match(y,/node scripts\/rtx-playwright\.mjs/);
  assert.match(y,/node scripts\/qfloat-arcade-witness\.mjs/);
  assert.doesNotMatch(y,/\bnpm (?:ci|install)|\bapt(?:-get)? install/);
  assert.match(y,/SHA256SUMS/);
  assert.match(y,/publish_evidence/);
});
