// SPDX-License-Identifier: Apache-2.0
// Measured suite decisions on real packaged inputs, not claimed wall-time savings.
import assert from 'node:assert/strict';
import {digestClosures} from '../tests/fixtures/ci-invariant-001-baseline.mjs';
import {profileInputs,SUITES} from './browser-suite-cache.mjs';
import {closures,hash,gitBlob} from './browser-dependencies.mjs';
const inputs=await profileInputs({environment:{node:process.version,platform:process.platform,arch:process.arch,playwright:'qualification-fixture'}});
const before=closures(inputs);for(const g of SUITES)assert.deepEqual(before[g].issues,[],g);
const scenarios=[];
const old=s=>digestClosures(s.files,s.extra.shared,s.extra.tests,s.environment);
const baseline=old(inputs);
function run(name,mutate,expectedBaseline){
  const next=structuredClone(inputs);mutate(next);const after=closures(next);
  const prior=old(next),baselineExecuted=SUITES.filter(g=>prior[g]!==baseline[g]).length;
  if(expectedBaseline!==null)assert.equal(baselineExecuted,expectedBaseline,name);
  const executed=SUITES.filter(g=>after[g].issues.length||after[g].fingerprint!==before[g].fingerprint);
  scenarios.push({name,baselineExecuted,resultExecuted:executed.length,resultReused:7-executed.length,executed,
    why:'Three distinct qualifying authority-fixture executions exist for each original fingerprint; only changed/unknown identities execute.'});
}
run('identical qualified inputs',()=>{},0);
run('unrelated documentation',s=>{s.extra['unrelated-guide.md']='changed';},0);
run('new unreachable standalone authoring module',s=>{
  const path='modules/standalone-new/index.js',content='export const standalone=1n;';
  s.sources[path]=content;s.files.push({path,sha256:hash(content)});s.extra.gitBlobs[path]=gitBlob(content);
  s.extra.catalogue.modules['standalone-new']={entry:path,depends:[],environment:'pure-js'};
},7);
run('reachable navigation source',s=>{
  const path='modules/navigation/index.js';s.sources[path]+='\n// changed\n';s.files.find(f=>f.path===path).sha256=hash(s.sources[path]);s.extra.gitBlobs[path]=gitBlob(s.sources[path]);
},7);
run('changed independent oracle',s=>{s.extra['scripts/alien_math_001_oracle.py']+='\n# changed verification domain\n';},null);
run('changed worlds browser requirement',s=>{s.extra.tests.worlds[0].sha256=hash('changed');s.extra.suiteIssues.worlds.push('unreviewed browser harness closure');},1);
assert.equal(scenarios[2].resultExecuted,6);assert.equal(scenarios[2].resultReused,1);
assert.equal(scenarios[3].resultExecuted,7);assert.equal(scenarios[4].resultExecuted,6);
console.log(JSON.stringify({kind:'CI-INVARIANT-001-workload',authority:'synthetic qualified registry; NOT GitHub receipts',
  baseline:'source-pinned b9e9b19 partitionPackage/digestClosures executed; old oracle requirement changes were not bound, so its unchanged count is a safety gap, not a benefit',
  runtimeMembers:Object.fromEntries(SUITES.map(g=>[g,before[g].inputs.runtime.length])),scenarios},null,2));
