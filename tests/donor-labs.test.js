// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBulletLab,stepBulletLab,bulletReceipt} from '../demos/bullet-time-lab/world.js';
import {createArcadeLab,stepArcadeLab,arcadeReceipt} from '../demos/arcade-lab/world.js';
test('bullet-time reference and OPT index have identical full gameplay receipts',()=>{
  let ref=createBulletLab(),opt=createBulletLab(),strictReduction=false,seenShot=false;
  for(let i=0;i<2600;i++){
    const input={move:i%140<40?1:i%140<90?-1:0,fire:i%3===0,
      focus:i%330<170,dodge:i%179===0};
    ref=stepBulletLab(ref,input,false);opt=stepBulletLab(opt,input,true);
    assert.deepEqual(bulletReceipt(opt),bulletReceipt(ref),'bullet frame '+i);
    assert.ok(opt.work.staticCandidates<=ref.work.staticFull);
    strictReduction ||= opt.work.staticCandidates<ref.work.staticFull;
    seenShot ||= ref.stats.fired>0;
  }
  assert.ok(strictReduction&&seenShot);
});
test('bullet time has independently slower world and authentic swept collision',()=>{
  let s=createBulletLab();
  for(let i=0;i<800;i++)s=stepBulletLab(s,{focus:true,fire:true,move:i%100<50?1:-1});
  assert.ok(s.domains.world<s.domains.player&&s.domains.player<s.domains.weapon);
  assert.ok(s.shots.length<96&&s.health>=0);
  assert.throws(()=>stepBulletLab(s,{move:2}));
});
test('simultaneous lethal rounds cannot underflow target health or prevent respawn',()=>{
  const start=createBulletLab();
  const state={...start,targetHealth:1,nextId:3,
    shots:[{id:1,team:'player',x:0,z:19,vz:31},
      {id:2,team:'player',x:0,z:19,vz:31}]};
  const after=stepBulletLab(state,{},true);
  assert.equal(after.targetHealth,0);
  assert.equal(after.stats.kills,1);
  assert.ok(after.respawn>0);
  assert.equal(state.targetHealth,1,'caller state not mutated');
  let current=after;
  for(let i=0;i<1200&&current.respawn>0;i++)
    current=stepBulletLab(current,{});
  assert.equal(current.targetHealth,3);
});
for(const kind of ['brick','bank'])test('arcade '+kind+' exact replay vs full scan and no input mutation',()=>{
  let ref=createArcadeLab(kind),opt=createArcadeLab(kind),less=false;
  for(let i=0;i<2600;i++){
    const input={move:i%160<80?1:-1,launch:i%10===0};
    const original=structuredClone(opt);
    ref=stepArcadeLab(ref,input,false);
    opt=stepArcadeLab(opt,input,true);
    assert.deepEqual(arcadeReceipt(opt),arcadeReceipt(ref),kind+' frame '+i);
    assert.ok(opt.work.candidates<=ref.work.full);
    less ||=opt.work.candidates<ref.work.full;
    assert.ok(original.tick===i,'previous step snapshot retained');
  }
  assert.ok(less,'static index pruned at least one candidate');
});
test('arcade contracts reject invalid controls and modes',()=>{
  assert.throws(()=>createArcadeLab('shmup'),RangeError);
  assert.throws(()=>stepArcadeLab(createArcadeLab(),{launch:1}),TypeError);
  assert.throws(()=>stepArcadeLab(createArcadeLab(),{move:2}),TypeError);
});
