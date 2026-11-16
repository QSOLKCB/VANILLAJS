// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyLiveProfile,LIVE_PROFILE} from '../scripts/browser-cache-profile.mjs';
import {hash,identity,closures} from '../scripts/browser-dependencies.mjs';
import {decide} from '../scripts/browser-receipt-authority.mjs';
import {executionPlan,REQUIRED_PASSES,SUITES} from '../scripts/browser-suite-cache.mjs';
const root=new URL('../',import.meta.url);
const baseBytes=await readFile(new URL('scripts/browser-reuse-policy.json',root),'utf8');
const live=JSON.parse(await readFile(new URL(LIVE_PROFILE,root),'utf8'));
test('live browser profile extends frozen policy without changing protection or whole-package boundaries',()=>{
  const base=JSON.parse(baseBytes),before=JSON.stringify(base),policy=applyLiveProfile(baseBytes,live);
  assert.equal(JSON.stringify(base),before);assert.equal(base.qualification,3);
  assert.equal(policy.qualification,1);assert.equal(REQUIRED_PASSES,policy.qualification);
  assert.equal(policy.repository,base.repository);assert.equal(policy.workflow,base.workflow);
  for(const [name,suite]of Object.entries(base.suites)){
    assert.equal(policy.suites[name].serviceWorker,true);
    assert.deepEqual(policy.suites[name].consumes,suite.consumes);
    for(const path of suite.roots)assert.ok(policy.suites[name].roots.includes(path));
    for(const path of suite.scripts)assert.ok(policy.suites[name].scripts.includes(path));
  }
  for(const path of base.shared)assert.ok(policy.shared.includes(path));
  assert.ok(policy.shared.includes(LIVE_PROFILE));
  assert.ok(policy.suites.editor.scripts.includes('scripts/browser-tutorial.js'));
});
test('live profile rejects invented fields, changed frozen identity, unsafe paths and mismatched opaque pins',()=>{
  const cases=[x=>x.unknown=true,x=>delete x.qualification,x=>x.qualification=0,x=>x.qualification=2,x=>x.qualification=3,x=>x.qualification='1',x=>x.schema='qsol.browser.live-profile.v1',x=>x.suites.editor.serviceWorker=false,x=>x.basePolicySHA256='0'.repeat(64),x=>x.shared.push('../outside.js'),x=>x.suites.unknown={roots:[],scripts:[]},x=>x.opaqueRuntime[Object.keys(x.opaqueRuntime)[0]].sha256='0'.repeat(64),x=>x.opaqueHarness[Object.keys(x.opaqueHarness)[0]].reason='ignore'];
  for(const mutate of cases){const changed=structuredClone(live);mutate(changed);assert.throws(()=>applyLiveProfile(baseBytes,changed));}
  const changedBase=JSON.parse(baseBytes);changedBase.suites.editor.serviceWorker=false;
  const changedBytes=JSON.stringify(changedBase),changed=structuredClone(live);changed.basePolicySHA256=hash(changedBytes);
  assert.throws(()=>applyLiveProfile(changedBytes,changed),/whole-package/);
  const changedQualification=JSON.parse(baseBytes);changedQualification.qualification=1;
  const changedQualificationBytes=JSON.stringify(changedQualification);
  assert.throws(()=>applyLiveProfile(changedQualificationBytes,{...live,basePolicySHA256:hash(changedQualificationBytes)}),/frozen qualification/);
});
test('one-run live qualification still requires an exact authenticated source and environment match',()=>{
  const qualification=applyLiveProfile(baseBytes,live).qualification;
  const profile={fingerprint:hash('reviewed package and browser environment'),issues:[]},authority={ok:true};
  const execution={run:42,fingerprint:profile.fingerprint};
  const input={profile,authority,qualification,executions:[execution]};
  assert.equal(decide({...input,executions:[]}).reuse,false);
  assert.equal(decide(input).reuse,true);
  assert.deepEqual(decide(input).runs,['42']);
  assert.match(decide(input).reason,/one authenticated main execution/);
  assert.equal(decide({...input,profile:{...profile,fingerprint:hash('changed source or environment')}}).reuse,false);
  assert.equal(decide({...input,authority:{ok:false,reason:'unprotected main'}}).reuse,false);
  assert.equal(decide({...input,forceFull:true}).reuse,false);
  assert.equal(decide({...input,profile:{...profile,issues:['unknown import']}}).reuse,false);
  for(const invalid of [0,2,4,-1,1.5,'1',null,NaN,Infinity]){
    const decision=decide({...input,qualification:invalid});
    assert.equal(decision.reuse,false);assert.match(decision.reason,/unsupported qualification/);
  }
  // Existing frozen-oracle callers retain the historical threshold by default.
  const {qualification:unused,...historical}=input;
  assert.equal(decide(historical).reuse,false);
  assert.equal(decide({...historical,executions:[1,2,3].map(run=>({...execution,run}))}).reuse,true);
});
test('live policy identity invalidates old qualification receipts and reaches all seven suite decisions',()=>{
  const policy=applyLiveProfile(baseBytes,live),historical={...policy,qualification:3};
  const liveClosures=closures({files:[],sources:{},policy,environment:{fixture:true}});
  const historicalClosures=closures({files:[],sources:{},policy:historical,environment:{fixture:true}});
  for(const group of SUITES)assert.notEqual(liveClosures[group].fingerprint,historicalClosures[group].fingerprint);
  const profilesFor=p=>Object.fromEntries(SUITES.map(group=>{
    const inputs={policy:identity(p),tests:[group],environment:{fixture:'browser'}};
    return [group,{inputs,fingerprint:identity(inputs),issues:[]}];
  }));
  const profiles=profilesFor(policy),previous=profilesFor(historical),authority={ok:true};
  const receipt=p=>({run:42,results:Object.fromEntries(SUITES.map(group=>[group,{fingerprint:p[group].fingerprint,inputs:p[group].inputs}]))});
  const plan=(receipts,force=false,qualification=policy.qualification)=>executionPlan(profiles,authority,receipts,force,qualification);
  assert.notEqual(profiles.editor.fingerprint,previous.editor.fingerprint);
  for(const decision of Object.values(plan([])))assert.equal(decision.reuse,false);
  for(const decision of Object.values(plan([receipt(previous)])))assert.equal(decision.reuse,false);
  for(const decision of Object.values(plan([receipt(profiles)])))assert.equal(decision.reuse,true);
  for(const decision of Object.values(plan([receipt(profiles)],true)))assert.equal(decision.reuse,false);
  for(const decision of Object.values(plan([receipt(profiles)],false,2)))assert.equal(decision.reuse,false);
  for(const decision of Object.values(executionPlan(profiles,authority,[receipt(profiles)])))assert.equal(decision.reuse,false);
});
test('exact opaque source pin can describe reviewed local resources; changed or unknown source still executes',()=>{
  const sources={'demos/example/app.js':"fetch('./data.json');",'demos/example/data.json':'{}','service-worker.js':'// generated','index.html':'','offline/register.js':'// local'};
  const policy={suites:{editor:{roots:['demos/example/'],scripts:[],consumes:['editor'],serviceWorker:true}},contracts:{},auditedRuntime:{'demos/example/app.js':hash(sources['demos/example/app.js']),'offline/register.js':hash(sources['offline/register.js'])},opaqueRuntime:{'demos/example/app.js':{sha256:hash(sources['demos/example/app.js']),roots:['demos/example/data.json']}},workerTemplateSHA256:hash('template')};
  const profile=()=>closures({files:Object.entries(sources).map(([path,s])=>({path,sha256:hash(s)})),sources,policy,extra:{'scripts/service-worker.template.js':'template'},environment:{fixture:true}}).editor;
  const first=profile();assert.deepEqual(first.issues,[]);
  assert.equal(decide({profile:first,authority:{ok:false,reason:'unprotected main'},executions:[1,2,3].map(run=>({run,fingerprint:first.fingerprint}))}).reuse,false);
  sources['demos/example/app.js']="fetch('./unknown.json');";
  assert.ok(profile().issues.some(x=>x.includes('unreviewed executable')));
  sources['new-runtime.js']='export const x=1;';assert.ok(profile().issues.some(x=>x.includes('unclassified package member')));
});
test('an active editor import of a dormant builder copy invalidates its reviewed executable pin',()=>{
  const start='demos/editor/start.js',original='demos/4x-game-lab/voidward/js/app.js',copy='demos/editor/runtime-'+('a'.repeat(64))+'/'+original;
  const sources={[start]:'export const ready=true;',[original]:'export const world=true;',[copy]:"import '../vendor/not-copied.js';",'service-worker.js':'// generated','index.html':'','offline/register.js':'// local'};
  const policy={suites:{editor:{roots:['demos/editor/','demos/4x-game-lab/'],consumes:['editor'],serviceWorker:true}},contracts:{},auditedRuntime:Object.fromEntries(Object.entries(sources).filter(([p])=>p.endsWith('.js')).map(([p,s])=>[p,hash(s)])),opaqueRuntime:{[copy]:{sha256:hash(sources[copy]),roots:[original]}},workerTemplateSHA256:hash('template')};
  const compute=()=>closures({files:Object.entries(sources).map(([path,s])=>({path,sha256:hash(s)})),sources,policy,extra:{'scripts/service-worker.template.js':'template'},environment:{fixture:true}}).editor;
  assert.deepEqual(compute().issues,[]);
  sources[start]="import './"+copy.slice('demos/editor/'.length)+"';";
  assert.ok(compute().issues.includes('unreviewed executable closure: '+start));
});
