// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {replayExamples,BASE_BUILD} from '../demos/replay-audit-lab/scenarios.js';
import {createReplayPlan,sealReplayReceipt,verifyReplayReceipt,exportReplayReceipt,
 importReplayReceipt,auditReplayPresentation,sampleReplayPresentation,REPLAY_LIMITS} from '../modules/replay-audit/index.js';
const samples=()=>replayExamples(),clone=structuredClone;
test('actual FPS authoritative damage and independent replay receipt',async()=>{
 const source=samples().fps,before=clone(source),r=await sealReplayReceipt(source);
 assert.equal(r.mode,'float-same-runtime');assert.equal(r.ticks,5);
 assert.ok(r.trace.flatMap(f=>f.events).some(e=>e.type==='damage'));
 assert.deepEqual(source,before);
 assert.deepEqual(await sealReplayReceipt(source),r);
 assert.equal((await verifyReplayReceipt(r,{expectedBuild:BASE_BUILD})).match,true);
 assert.deepEqual(await importReplayReceipt(exportReplayReceipt(r),{expectedBuild:BASE_BUILD}),r);
});
test('real guided contact and full terminal-tape gate',async()=>{
 const p=samples().air,r=await sealReplayReceipt(p);
 assert.equal(r.tickRate,120);assert.equal(r.ticks,17);
 const contact=r.trace.flatMap(f=>f.events).find(e=>e.type==='contact');
 assert.equal(contact?.kind,'actor');assert.equal(contact?.id,'target');
 await assert.rejects(sealReplayReceipt({...p,frames:[...p.frames,[]]}),/unconsumed ticks/);
});
test('real vehicle and integer engines produce distinct correct authority modes',async()=>{
 for(const kind of ['racing','integer']){
  const p=samples()[kind],r=await sealReplayReceipt(p);
  assert.equal(r.mode,kind==='integer'?'integer-exact':'float-same-runtime');
  assert.equal((await verifyReplayReceipt(r,{expectedBuild:BASE_BUILD})).match,true);
  assert.deepEqual(r,await sealReplayReceipt(p));
 }
});
test('real 30/60/144 Hz interleaved tick/sample schedules preserve authoritative results',async()=>{
 for(const source of Object.values(samples())){
  const rendered=[];
  const result=await auditReplayPresentation(source,[30,60,144],{
   present:sample=>{assert.equal(Object.isFrozen(sample),true);rendered.push(sample);}
  });
  assert.equal(result.checks.length,3);
  assert.ok(result.checks.every(x=>x.sameAuthoritativeTrace&&x.consumedTicks===result.ticks));
  for(const check of result.checks){
   const rate=check.renderHz,observed=rendered.filter(s=>s.renderHz===rate);
   const simHz=source.kind==='integer'?60:source.kind==='fps'?60:120;
   assert.equal(check.displaySamples,Math.ceil(result.ticks*rate/simHz));
   assert.equal(observed.length,check.displaySamples,'presenter executed every display sample');
   assert.equal(observed.at(-1).acceptedTicks,result.ticks);
   assert.equal(observed.filter(s=>s.advancedTicks===0).length,check.nonAdvancingFrames);
   assert.ok(observed.every((s,i)=>i===0||s.acceptedTicks>=observed[i-1].acceptedTicks));
  }
  assert.notEqual(result.checks[0].sampleSha256,result.checks[2].sampleSha256);
  if(source.kind==='air'||source.kind==='racing')
   assert.ok(result.checks[2].nonAdvancingFrames>0);
 }
});
test('sampling callbacks are read-only and rendering failure cannot forge a parity PASS',async()=>{
 const source=samples().racing,before=clone(source),seen=[];
 const result=await sampleReplayPresentation(source,144,{present:async sample=>{
  seen.push(sample);
  assert.ok(Object.isFrozen(sample));
 }});
 assert.deepEqual(source,before);
 assert.equal(seen.length,result.displaySamples);
 assert.equal(result.lastPresentedTick,source.frames.length);
 await assert.rejects(auditReplayPresentation(source,[30,60,144],{
  present:()=>{throw Error('presentation renderer failed');}
 }),/presentation renderer failed/);
 await assert.rejects(sampleReplayPresentation(source,100),/presentation rate/);
 await assert.rejects(sampleReplayPresentation(source,30,{present:'execute'}),/trusted host/);
});
test('stale, forged, truncated and altered receipts never pass',async()=>{
 const r=await sealReplayReceipt(samples().fps);
 await assert.rejects(verifyReplayReceipt(r,{expectedBuild:'f'.repeat(40)}),/build/);
 await assert.rejects(verifyReplayReceipt({...r,truncated:true},{expectedBuild:BASE_BUILD}),/completeness/);
 await assert.rejects(verifyReplayReceipt({...r,ticks:0},{expectedBuild:BASE_BUILD}),/count/);
 await assert.rejects(verifyReplayReceipt({...r,status:'PASS'},{expectedBuild:BASE_BUILD}),/exact/);
 const forged=clone(r);forged.trace[0].stateSha256='0'.repeat(64);
 assert.equal((await verifyReplayReceipt(forged,{expectedBuild:BASE_BUILD})).match,false);
 await assert.rejects(importReplayReceipt(JSON.stringify(forged),{expectedBuild:BASE_BUILD}),/mismatch/);
 assert.throws(()=>exportReplayReceipt(forged),/locally executed/);
 const different=clone(samples().fps);different.model.actors[0].position[0]=3;
 const updated=await sealReplayReceipt(different);
 assert.notEqual(updated.sourceSha256,r.sourceSha256);
});
test('reject invalid late commands, executable inputs, sparse tape and cross-model data',async()=>{
 const p=samples().fps;let f=clone(p);f.frames[f.frames.length-1]=[{...f.frames[0][0],actor:'missing'}];
 assert.throws(()=>createReplayPlan(f),/unknown/);
 f=clone(p);f.frames[0]=Array(2);assert.throws(()=>createReplayPlan(f),/dense/);
 f=clone(p);Object.defineProperty(f.model,'actors',{enumerable:true,get(){throw Error('BAD');}});
 assert.throws(()=>createReplayPlan(f),/executable/);
 f=clone(p);f.frames[0][0].fire='bad';await assert.rejects(sealReplayReceipt(f),/trigger/);
 f=clone(p);f.kind='air';assert.throws(()=>createReplayPlan(f),/exact/);
 f=clone(p);f.frames=[];assert.throws(()=>createReplayPlan(f),/budget/);
 f=clone(p);f.frames=Array.from({length:REPLAY_LIMITS.frames+1},()=>[]);
 assert.throws(()=>createReplayPlan(f),/budget/);
 await assert.rejects(auditReplayPresentation(p,[30,100,144]),/rates/);
});
