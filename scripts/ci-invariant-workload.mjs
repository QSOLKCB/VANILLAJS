// SPDX-License-Identifier: Apache-2.0
// Measured suite decisions on real packaged inputs, not claimed wall-time savings.
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digestClosures} from '../tests/fixtures/ci-invariant-001-baseline.mjs';
import {profileInputs,SUITES,executionPlan} from './browser-suite-cache.mjs';
import {closures,hash,gitBlob} from './browser-dependencies.mjs';
const old=s=>digestClosures(s.files,s.extra.shared,s.extra.tests,s.environment);
// These objects are test fixtures passed to the same decision function as CI.
// They are neither authenticated receipts nor output from a browser execution.
const fixtureAuthority={ok:true,reason:'synthetic qualification fixture, NOT GitHub authority'};
const fixtureReceipts=profiles=>[1,2,3].map(run=>({run,
  results:Object.fromEntries(SUITES.map(g=>[g,{fingerprint:profiles[g].fingerprint,inputs:profiles[g].inputs}]))}));

export function runInvariantWorkload(inputs){
  const before=closures(inputs),baseline=old(inputs),scenarios=[],
    forcedExecution=SUITES.filter(g=>before[g].issues.length),receipts=fixtureReceipts(before);
  function run(name,mutate,expectedBaseline,expectedChanged){
    const next=structuredClone(inputs);mutate(next);const after=closures(next);
    const prior=old(next),baselineExecuted=SUITES.filter(g=>prior[g]!==baseline[g]).length;
    if(expectedBaseline!==null)assert.equal(baselineExecuted,expectedBaseline,name);
    const changed=SUITES.filter(g=>after[g].fingerprint!==before[g].fingerprint);
    assert.deepEqual(changed,expectedChanged,name+': fingerprint invalidations');
    const plan=executionPlan(after,fixtureAuthority,receipts),
      executed=SUITES.filter(g=>!plan[g].reuse),
      expectedExecuted=SUITES.filter(g=>forcedExecution.includes(g)||expectedChanged.includes(g));
    assert.deepEqual(executed,expectedExecuted,name+': changed and already-unreviewed suites execute');
    // Unknown syntax/source/harness issues must win even if a matching set of
    // synthetic passes is supplied for the changed fingerprint itself.
    const matching=executionPlan(after,fixtureAuthority,fixtureReceipts(after));
    for(const g of SUITES)if(after[g].issues.length)assert.equal(matching[g].reuse,false,
      name+': unsupported '+g+' must execute despite matching fixture passes');
    scenarios.push({name,baselineExecuted,resultExecuted:executed.length,
      resultReused:SUITES.length-executed.length,executed,changed,
      why:'Synthetic qualification only; changed fingerprints and all dependency-analysis issues require real execution.'});
  }
  run('identical inputs with synthetic qualification',()=>{},0,[]);
  run('unrelated documentation',s=>{s.extra['unrelated-guide.md']='changed';},0,[]);
  run('new unreachable standalone authoring module',s=>{
    const path='modules/standalone-new/index.js',content='export const standalone=1n;';
    s.sources[path]=content;s.files.push({path,sha256:hash(content)});s.extra.gitBlobs[path]=gitBlob(content);
    s.extra.catalogue.modules['standalone-new']={entry:path,depends:[],environment:'pure-js'};
  },7,SUITES.filter(g=>inputs.policy.suites[g].serviceWorker));
  run('reachable navigation source',s=>{
    const path='modules/navigation/index.js';s.sources[path]+='\n// changed\n';s.files.find(f=>f.path===path).sha256=hash(s.sources[path]);s.extra.gitBlobs[path]=gitBlob(s.sources[path]);
  },7,SUITES.filter(g=>before[g].inputs.runtime.some(f=>f.path==='modules/navigation/index.js')));
  run('changed independent oracle',s=>{s.extra['scripts/alien_math_001_oracle.py']+='\n# changed verification domain\n';},null,
    SUITES.filter(g=>before[g].inputs.requirements.some(f=>f.path==='scripts/alien_math_001_oracle.py')));
  run('changed worlds browser requirement',s=>{s.extra.tests.worlds[0].sha256=hash('changed');s.extra.suiteIssues.worlds.push('unreviewed browser harness closure');},1,['worlds']);
  return {kind:'CI-INVARIANT-001-workload',authority:'synthetic qualified registry; NOT GitHub receipts',
    baseline:'source-pinned b9e9b19 partitionPackage/digestClosures executed; old oracle requirement changes were not bound, so its unchanged count is a safety gap, not a benefit',
    forcedExecution,initialIssues:Object.fromEntries(SUITES.map(g=>[g,before[g].issues])),
    runtimeMembers:Object.fromEntries(SUITES.map(g=>[g,before[g].inputs.runtime.length])),scenarios};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const inputs=await profileInputs({environment:{node:process.version,platform:process.platform,arch:process.arch,playwright:'qualification-fixture'}});
  console.log(JSON.stringify(runInvariantWorkload(inputs),null,2));
}
