// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {replayExamples,BASE_BUILD} from '../demos/replay-audit-lab/scenarios.js';
import {createReplayPlan,sealReplayReceipt,verifyReplayReceipt,exportReplayReceipt,
 importReplayReceipt,auditReplayPresentation,REPLAY_LIMITS} from '../modules/replay-audit/index.js';
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
test('30/60/144 Hz presentation does not alter accepted ticks',async()=>{
 for(const source of Object.values(samples())){
  const result=await auditReplayPresentation(source);
  assert.equal(result.checks.length,3);
  assert.ok(result.checks.every(x=>x.sameAuthoritativeTrace&&x.consumedTicks===result.ticks));
 }
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
 const p=samples().fps;let f=clone(p);f.frames.at(-1)=[{...f.frames[0][0],actor:'missing'}];
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
