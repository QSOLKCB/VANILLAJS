import test from 'node:test';
import assert from 'node:assert/strict';
import {createFpsLab,stepFpsLab,focusPlate} from '../demos/fps-lab/worlds.js';
import {characterView} from '../modules/character/index.js';
import {aabb} from '../modules/collision/index.js';
import {FixedClock} from '../modules/time/index.js';
const dt=1/120;
const advance=(s,n,input={})=>{for(let i=0;i<n;i++)stepFpsLab(s,input,dt);};
const lead=(s,target)=>{
  const eye=characterView(s.character).position,m=target.motion;let x=target.center[0];
  for(let i=0;i<8;i++){
    const time=Math.hypot(x-eye[0],target.center[2]-eye[2])/65;
    x=m.originX+m.amplitude*Math.sin((s.elapsed+time)*m.frequency)*m.direction;
  }
  return {yaw:-Math.atan2(x-eye[0],eye[2]-target.center[2])-s.character.yaw};
};
test('Low passage blocks standing entry and is completable through both real roofs and stance markers',()=>{
  const blocked=createFpsLab('lowpass');advance(blocked,300,{move:[0,-1]});assert.ok(blocked.character.position[2]>=1.35);assert.equal(blocked.nextCheckpoint,0);
  const s=createFpsLab('lowpass');let heldByRoof=false;
  for(let i=0;i<3000&&!s.complete;i++){
    // Release crouch beneath the roof once each duck checkpoint is collected.
    const crouch=s.nextCheckpoint===0 || s.nextCheckpoint===2;
    stepFpsLab(s,{move:[0,-1],crouch},dt);heldByRoof ||= s.lastMovement.standBlocked;
    assert.equal(s.truncated,false);assert.ok(Math.abs(s.character.position[1])<1e-5);
  }
  assert.equal(s.complete,true);assert.equal(s.nextCheckpoint,4);assert.equal(s.character.crouched,false);assert.equal(heldByRoof,true);
});
test('a moving plate evades an unled bolt; leading the shot yields one delayed hit',()=>{
  const miss=createFpsLab('tracking');stepFpsLab(miss,{fire:true},dt);advance(miss,65);assert.equal(miss.hits,0);
  const hit=createFpsLab('tracking');stepFpsLab(hit,{fire:true,look:lead(hit,hit.targets[0])},dt);assert.equal(hit.hits,0);
  advance(hit,65);assert.equal(hit.hits,1);assert.equal(hit.targets[0].health,75);assert.equal(hit.projectiles.size,0);
});
test('instant traces sample the target at fire time and static cover blocks both moving-range shot types',()=>{
  const s=createFpsLab('tracking');s.shotMode='trace';stepFpsLab(s,{fire:true},dt);assert.equal(s.hits,1);assert.ok(s.targets[0].center[0]>0);
  for(const mode of ['trace','bolt']){
    const blocked=createFpsLab('tracking');blocked.shotMode=mode;
    blocked.colliders.push({id:'test-cover',box:aabb([-3,0,-5.2],[3,3,-4.8])});
    stepFpsLab(blocked,{fire:true,look:lead(blocked,blocked.targets[0])},dt);advance(blocked,80);assert.equal(blocked.hits,0);assert.equal(blocked.history[0].status,'blocked');
  }
});
test('tracking range can clear every moving plate with leading bolts and finite reloading',()=>{
  const s=createFpsLab('tracking');
  for(const target of s.targets){
    focusPlate(s,target.id);
    for(let i=0;i<1800&&target.alive;i++)stepFpsLab(s,{fire:true,reload:s.weapon.snapshot().ammo===0,look:lead(s,target)},dt);
    assert.equal(target.alive,false,`${target.id} was not cleared`);
  }
  assert.equal(s.complete,true);assert.equal(s.hits,12);assert.ok(s.weapon.snapshot().reserve<32);assert.ok(s.shots<=24);
});
test('pause freezes moving targets and crouched state; focus/reset cancel flight without rewinding tracks',()=>{
  const s=createFpsLab('tracking');advance(s,10,{crouch:true});stepFpsLab(s,{fire:true,crouch:true},dt);
  const clock=new FixedClock();clock.setPaused(true);
  const snapshot=()=>({positions:s.targets.map(t=>t.center),body:s.character,shots:s.projectiles.snapshots(),time:s.elapsed});
  const before=structuredClone(snapshot());clock.advance(1,step=>stepFpsLab(s,{},step));stepFpsLab(s,{},0);assert.deepEqual(snapshot(),before);
  focusPlate(s,'plate-2');assert.equal(s.projectiles.size,0);assert.deepEqual(s.targets.map(t=>t.center),before.positions);assert.equal(s.character.crouched,false);
  const reset=createFpsLab('tracking');assert.equal(reset.elapsed,0);assert.deepEqual(reset.targets.map(t=>t.center[0]),[0,-5,5]);assert.equal(reset.shotMode,'bolt');
});
test('30/60/144 Hz frames compose identical target paths, crouch transitions and moving impacts',()=>{
  const states=[30,60,144].map(hz=>{
    const s=createFpsLab('tracking'),clock=new FixedClock();
    for(let frame=0;frame<hz*3;frame++)clock.advance(1/hz,step=>stepFpsLab(s,{fire:true,crouch:clock.ticks>=120&&clock.ticks<180,look:lead(s,s.targets[1])},step));
    return {targets:s.targets,body:s.character,shots:s.projectiles.snapshots(),hits:s.hits,history:s.history,time:s.elapsed};
  });
  assert.deepEqual(states[0],states[1]);assert.deepEqual(states[1],states[2]);
});
