import test from 'node:test';
import assert from 'node:assert/strict';
import {createFpsLab,stepFpsLab,focusPlate} from '../demos/fps-lab/worlds.js';
import {FixedClock} from '../modules/time/index.js';
import {aabb} from '../modules/collision/index.js';
const dt=1/120;
const advance=(session,n,input={})=>{for(let i=0;i<n;i++)stepFpsLab(session,input,dt);};
test('footwork course is traversable through real stairs, a jump and the narrow door',()=>{
  const s=createFpsLab();let jumped=false;
  for(let i=0;i<2400&&!s.complete;i++){
    const jump=!jumped && s.character.position[2]<-9.8 && s.character.grounded;if(jump)jumped=true;
    stepFpsLab(s,{move:[0,-1],jump},dt);
    assert.equal(s.truncated,false);
  }
  assert.equal(s.complete,true);assert.equal(s.nextCheckpoint,4);assert.ok(s.steps>=4);assert.equal(s.jumps,1);
});
test('range composes trace damage, finite ammo, manual reload and three cleared targets',()=>{
  const s=createFpsLab('range');advance(s,90,{fire:true});assert.equal(s.targets[0].health,0);assert.equal(s.hits,4);
  focusPlate(s,'plate-2');advance(s,100,{fire:true});assert.equal(s.targets[1].health,0);assert.equal(s.weapon.snapshot().ammo,0);
  advance(s,100,{fire:true});assert.equal(s.shots,8,'empty fire requests cannot create shots');
  stepFpsLab(s,{reload:true},dt);advance(s,143);assert.equal(s.weapon.snapshot().ammo,8);assert.equal(s.weapon.snapshot().reserve,24);
  focusPlate(s,'plate-3');advance(s,100,{fire:true});assert.equal(s.complete,true);assert.equal(s.cleared,3);assert.equal(s.hits,12);
});
test('travelling bolts hit later and exactly once; static cover stops both shot types',()=>{
  const s=createFpsLab('range');s.shotMode='bolt';stepFpsLab(s,{fire:true},dt);assert.equal(s.hits,0);assert.equal(s.projectiles.size,1);
  advance(s,65);assert.equal(s.hits,1);assert.equal(s.targets[0].health,75);assert.equal(s.projectiles.size,0);
  for(const mode of ['trace','bolt']){
    const blocked=createFpsLab('range');blocked.shotMode=mode;blocked.colliders.push({id:'cover',box:aabb([-1,0,-5.2],[1,3,-4.8])});
    stepFpsLab(blocked,{fire:true},dt);advance(blocked,90);assert.equal(blocked.hits,0);assert.equal(blocked.history[0].status,'blocked');
  }
});
test('pausing freezes airborne motion, projectiles and reload; focus cancels shots but preserves ammunition',()=>{
  const s=createFpsLab('range');s.shotMode='bolt';stepFpsLab(s,{fire:true,jump:true},dt);stepFpsLab(s,{reload:true},dt);
  const clock=new FixedClock();clock.setPaused(true);const before={position:[...s.character.position],weapon:s.weapon.snapshot(),shots:s.projectiles.snapshots(),elapsed:s.elapsed};
  clock.advance(100,step=>stepFpsLab(s,{},step));assert.deepEqual({position:s.character.position,weapon:s.weapon.snapshot(),shots:s.projectiles.snapshots(),elapsed:s.elapsed},before);
  focusPlate(s,'plate-2');assert.equal(s.projectiles.size,0);assert.deepEqual(s.weapon.snapshot(),before.weapon);assert.deepEqual(s.character.velocity,[0,0,0]);
});
test('30/60/144 Hz frames compose identical character and weapon simulation',()=>{
  const results=[30,60,144].map(hz=>{
    const s=createFpsLab('range'),clock=new FixedClock();
    for(let frame=0;frame<hz*2;frame++)clock.advance(1/hz,step=>stepFpsLab(s,{move:[.3,0],fire:clock.ticks<60,jump:clock.ticks===1},step));
    return {position:s.character.position,velocity:s.character.velocity,ammo:s.weapon.snapshot(),shots:s.shots,hits:s.hits,elapsed:s.elapsed};
  });
  assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
});
test('reset restores goals, ammunition and pose; invalid steps reject before mutation',()=>{
  const s=createFpsLab('range');advance(s,30,{fire:true,move:[1,0]});const reset=createFpsLab('range');assert.equal(reset.shots,0);assert.equal(reset.weapon.snapshot().ammo,8);assert.deepEqual(reset.character.position,[0,0,7]);
  const before=reset.weapon.snapshot();assert.throws(()=>stepFpsLab(reset,{fire:true},.1));assert.deepEqual(reset.weapon.snapshot(),before);assert.throws(()=>createFpsLab('missing'));assert.throws(()=>focusPlate(reset,'missing'));
});
