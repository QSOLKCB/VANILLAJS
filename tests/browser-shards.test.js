// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {hash,identity} from '../scripts/browser-dependencies.mjs';
import {SUITES,CHECKS,SHARDS,selectedChecks,activeShards} from '../scripts/browser-shards.mjs';
import {PROFILE,verifiedShards} from '../scripts/browser-suite-cache.mjs';

test('all 51 original module scenarios and the complete home scenario have exactly one worker',()=>{
  // Independently collected (suite, module, export) inventory of 9d95d74 plus its inline home scenario.
  const inventory=CHECKS.map(c=>[c.suite,c.file,c.name].join('/')).sort().join('\n');
  assert.equal(hash(inventory),'9be4cae8393e321e3ea5b2bb0842d6918c823141b421cc9739c7e2b0973aa0c8');
  assert.equal(new Set(CHECKS.map(c=>c.id)).size,52);
  assert.equal(SHARDS.length,7);
  // Check every possible mixture of qualified and stale suites, including no browser work.
  for(let bits=0;bits<2**SUITES.length;bits++){
    const suites=SUITES.filter((_,i)=>bits&(1<<i));
    const serial=CHECKS.filter(c=>suites.includes(c.suite)).map(c=>c.id);
    const parallel=activeShards(suites).flatMap(shard=>selectedChecks(suites,shard).map(c=>c.id));
    assert.deepEqual(parallel,serial);
    assert.equal(new Set(parallel).size,parallel.length);
  }
  for(const bad of [[''],['new'],['editor','editor']])assert.throws(()=>selectedChecks(bad));
  assert.throws(()=>selectedChecks(SUITES,'unknown'));
});

const source={repository:'QSOLKCB/VANILLAJS',sha:'a'.repeat(40),run:'42',attempt:'2',event:'push',ref:'refs/heads/main'};
const digest='b'.repeat(64),environment={node:'test',chromium:'test'};
function fixture(stale=SUITES){
  const plan={},profiles={};
  for(const g of SUITES){
    plan[g]={reuse:!stale.includes(g),runs:stale.includes(g)?[]:['19']};
    profiles[g]={issues:[],inputs:{environment}};
  }
  const data={protocol:PROFILE,source:{...source,attempt:'1'},authority:{ok:true},plan,profiles};
  const reports=activeShards(stale).map(shard=>({shard,source:{...source},inputSHA256:digest,
    environment:identity(environment),passed:selectedChecks(stale,shard).map(c=>({id:c.id,ms:1}))}));
  return {data,reports};
}
test('only complete fresh executions in the measured environment can produce new suite witnesses',()=>{
  for(const stale of [[],['play'],['render','editor'],SUITES]){
    const {data,reports}=fixture(stale);
    assert.deepEqual(verifiedShards(data,reports,digest,source),SUITES.filter(g=>stale.includes(g)));
  }
  const {data,reports}=fixture();
  reports.find(r=>r.shard==='horizon-export').source.attempt='1';
  reports.find(r=>r.shard==='render').environment=hash('different runner');
  data.profiles.home.issues.push('unclassified dependency');
  assert.deepEqual(verifiedShards(data,reports,digest,source),['play','worlds','donor']);
});
test('aggregation rejects incomplete, duplicate, foreign, mismatched or replayed shard evidence',()=>{
  const mutations=[
    ({reports})=>reports.pop(),({reports})=>reports.push(reports[0]),
    ({reports})=>reports[0].passed.pop(),({reports})=>reports[0].passed.push(reports[0].passed[0]),
    ({reports})=>reports[0].passed[0].id=reports[1].passed[0].id,({reports})=>reports[0].passed[0].ms=-1,
    ({reports})=>reports[0].source.sha='c'.repeat(40),({reports})=>reports[0].source.run='41',
    ({reports})=>reports[0].source.attempt='3',({reports})=>reports[0].source.attempt='0',
    ({reports})=>reports[0].inputSHA256=hash('other plan'),({data})=>data.source.run='41',
    ({data})=>data.source.attempt='3',({data})=>data.plan.editor.reuse='false',
    ({data})=>data.plan.editor.reuse=true,({data})=>delete data.plan.play
  ];
  for(const mutate of mutations){
    const f=fixture();mutate(f);assert.throws(()=>verifiedShards(f.data,f.reports,digest,source));
  }
});

test('the workflow extracts the verified bytes including dotfiles and rejects altered inputs before extraction',async t=>{
  const action=await readFile(new URL('../.github/actions/flight-inputs/action.yml',import.meta.url),'utf8');
  const verify=action.split('    run: |\n')[1];
  const temp=await mkdtemp(join(tmpdir(),'flight-transfer-test-'));
  t.after(()=>rm(temp,{recursive:true,force:true}));
  const source=join(temp,'source'),worker=join(temp,'worker'),transfer=join(temp,'flight-transfer');
  await Promise.all([mkdir(join(source,'dist'),{recursive:true}),mkdir(worker),mkdir(transfer)]);
  await writeFile(join(source,'dist','.nojekyll'),'');
  await writeFile(join(source,'plan.json'),'fixture');
  const archive=join(transfer,'flight-inputs.tgz');
  execFileSync('tar',['-czf',archive,'dist','plan.json'],{cwd:source});
  const bytes=await readFile(archive);
  const env={...process.env,RUNNER_TEMP:temp,EXPECTED:hash(bytes)};
  const run=()=>spawnSync('bash',['-c',verify],{cwd:worker,env});
  await writeFile(archive,Buffer.concat([bytes,Buffer.from([0])]));
  assert.notEqual(run().status,0);
  await assert.rejects(stat(join(worker,'dist')),{code:'ENOENT'});
  await writeFile(archive,bytes);
  assert.equal(run().status,0);
  assert.equal(await readFile(join(worker,'plan.json'),'utf8'),'fixture');
  assert.equal((await stat(join(worker,'dist','.nojekyll'))).size,0);
});
