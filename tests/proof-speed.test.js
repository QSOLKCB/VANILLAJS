// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {collisionFixture,labFixture,frameFixture,parity,negativeControl,measure,
  runFixture,fixtureSet} from '../scripts/proof-speed-core.mjs';
import {createBulletLab,stepBulletLab,bulletReceipt} from '../demos/bullet-time-lab/world.js';
import {createArcadeLab,stepArcadeLab,arcadeReceipt} from '../demos/arcade-lab/world.js';
test('all fixture families have exact optimized/reference output parity',()=>{
  const kinds=new Set();
  for(const f of fixtureSet()){
    const p=parity(f);
    kinds.add(f.kind);
    assert.match(p.outputSha256,/^[0-9a-f]{64}$/);
    assert.equal(p.fixture,f.id);
  }
  assert.deepEqual([...kinds],['collision','lab','frame']);
});
test('negative control detects changed simulation and pixels',()=>{
  for(const f of [collisionFixture({side:4,rayCount:20,seed:13}),
    labFixture('bullet',20),labFixture('bank',20),frameFixture(20)]){
    assert.equal(negativeControl(f),true,f.id);
  }
});
test('timing is observational; identity and sample count are not optional',()=>{
  const r=measure(collisionFixture({side:5,rayCount:30}),{pairs:3,warmups:1});
  assert.equal(r.samplesMs.baseline.length,3);
  assert.equal(r.samplesMs.optimized.length,3);
  assert.match(r.outputSha256,/^[0-9a-f]{64}$/);
  assert.equal(typeof r.medianRatio,'number');
  assert.match(r.note,/not guaranteed/);
});
test('complete receipts exclude performance counters but include per-tick outcomes',()=>{
  const f=labFixture('brick',40);
  const a=runFixture(f,false,{audit:true}),b=runFixture(f,true,{audit:true});
  assert.equal(a.checksum,b.checksum);
  assert.ok(a.work.referenceChecks>=b.work.conservativeCandidates);
});
test('fixture validation and unknown modes fail closed',()=>{
  assert.throws(()=>collisionFixture({side:41}),{code:'ERR_ASSERTION'});
  assert.throws(()=>collisionFixture({rayCount:0}),{code:'ERR_ASSERTION'});
  assert.throws(()=>labFixture('unknown'),{code:'ERR_ASSERTION'});
  assert.throws(()=>frameFixture(0),{code:'ERR_ASSERTION'});
  assert.throws(()=>runFixture({kind:'surprise'},true),/unknown/);
  assert.throws(()=>measure(frameFixture(2),{pairs:1}),{code:'ERR_ASSERTION'});
});
test('timed steppers omit diagnostic candidate scans without changing physics',()=>{
  const b=createBulletLab(),input={fire:true,focus:true,move:1};
  const withWork=stepBulletLab(b,input,true,true);
  const withoutWork=stepBulletLab(b,input,true,false);
  assert.deepEqual(bulletReceipt(withoutWork),bulletReceipt(withWork));
  assert.equal(withoutWork.work.staticCandidates,0);
  const a=createArcadeLab('brick');
  const measured=stepArcadeLab(a,{launch:true,move:1},true,true);
  const timed=stepArcadeLab(a,{launch:true,move:1},true,false);
  assert.deepEqual(arcadeReceipt(timed),arcadeReceipt(measured));
  assert.equal(timed.work.candidates,0);
});
test('arcade event receipts count only actual lives lost',()=>{
  for(const [kind,expected] of [['brick',3],['bank',2]]){
    const result=runFixture(labFixture(kind,1200),false,{audit:true});
    assert.equal(result.events,expected,kind+' actual ball losses');
  }
});
