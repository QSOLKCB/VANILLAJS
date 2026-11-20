// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMissileRack,missileLock,launchMissile,stepMissiles,missileSummary,MISSILE_STEP,MISSILE_MAX_ACTIVE} from '../demos/cockpit-physics-lab/missiles.js';
const pose=(options={})=>({position:[0,160,40],velocity:[0,0,-55],orientation:[0,0,0,1],...options});
const goal=(at=-185)=>({center:[0,160,at],radius:4});
const advance=(rack,target,n)=>{let s=rack;const events=[];for(let i=0;i<n;i++){const next=stepMissiles(s,target);s=next.rack;events.push(...next.events);}return {rack:s,events};};
test('lock is physical boresight, rejects wrong heading and beyond bound',()=>{
  assert.equal(missileLock(pose(),goal()).locked,true);
  assert.equal(missileLock(pose({orientation:[0,1,0,0]}),goal()).reason,'off-boresight');
  assert.equal(missileLock(pose(),goal(-3000)).reason,'out-of-range');
});
test('launch alternates wing mounts; ammo and cooldown are bounded, launch does not change pose',()=>{
  const p=pose(),before=structuredClone(p),t=goal(),empty=createMissileRack(),first=launchMissile(empty,p,t);
  assert.equal(first.status,'launched');assert.equal(first.rack.ammo,3);
  assert.deepEqual(first.rack.active[0].position,[-2.4,159.3,38.4]);
  assert.deepEqual(p,before);assert.equal(launchMissile(first.rack,p,t).status,'cooldown');
  const waiting=advance(first.rack,t,96).rack;
  const second=launchMissile(waiting,p,t);assert.equal(second.status,'launched');
  assert.equal(second.rack.active.at(-1).position[0],2.4);
  assert.equal(MISSILE_MAX_ACTIVE,4);
});
test('homing projectile hits the target via actual swept sphere',()=>{
  const t=goal(),start=launchMissile(createMissileRack(),pose(),t);
  const run=advance(start.rack,t,800);
  assert.equal(run.events.filter(e=>e.type==='hit').length,1);
  assert.equal(run.rack.hits,1);assert.equal(run.rack.active.length,0);
  assert.ok(run.events[0].point.every(Number.isFinite));
});
test('split tick runs and repeated identical inputs produce identical full receipts',()=>{
  const t=goal(),base=launchMissile(createMissileRack(),pose(),t).rack;
  const a=advance(base,t,360).rack,b=advance(advance(base,t,120).rack,t,240).rack;
  assert.deepEqual(a,b);assert.deepEqual(missileSummary(a),missileSummary(b));
});
test('different target location misses physically and missiles expire after finite lifetime',()=>{
  const original=goal(),rack=launchMissile(createMissileRack(),pose(),original).rack;
  const displaced={center:[4000,160,-185],radius:3};
  const run=advance(rack,displaced,960);
  assert.equal(run.rack.hits,0);
  assert.equal(run.rack.expired,1);
  assert.equal(run.rack.active.length,0);
});
test('invalid launch cannot spend ammo or mutate state',()=>{
  const r=createMissileRack(),p=pose(),before=missileSummary(r);
  assert.equal(launchMissile(r,pose({orientation:[0,1,0,0]}),goal()).status,'off-boresight');
  assert.deepEqual(missileSummary(r),before);
  assert.throws(()=>stepMissiles(r,goal(),1/60));
  assert.throws(()=>missileLock(p,{center:[1,2,Infinity],radius:4}));
  assert.throws(()=>createMissileRack({mounts:[[1,0,0],,[0,0,0]]}));
  assert.throws(()=>createMissileRack({ammo:9}));
  assert.throws(()=>launchMissile({},p,goal()));
});
test('no runtime clocks, no browser, no mutable rendered geometry or foreign pointers',()=>{
  const s=createMissileRack();assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.mounts));
  const first=launchMissile(s,pose(),goal());
  assert.ok(Object.isFrozen(first.rack.active)&&Object.isFrozen(first.rack.active[0].position));
  const result=stepMissiles(first.rack,goal(),MISSILE_STEP);
  assert.equal(result.rack.tick,1);
  assert.deepEqual(missileSummary(s),{ammo:4,cooldownTicks:0,active:0,launched:0,hits:0,expired:0,tick:0});
});
