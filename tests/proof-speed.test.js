// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {collisionFixture,labFixture,frameFixture,parity,negativeControl,measure,
  runFixture,fixtureSet} from '../scripts/proof-speed-core.mjs';
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
  assert.throws(()=>collisionFixture({side:41}),/assert/);
  assert.throws(()=>collisionFixture({rayCount:0}),/assert/);
  assert.throws(()=>labFixture('unknown'),/assert/);
  assert.throws(()=>frameFixture(0),/assert/);
  assert.throws(()=>runFixture({kind:'surprise'},true),/unknown/);
  assert.throws(()=>measure(frameFixture(2),{pairs:1}),/assert/);
});