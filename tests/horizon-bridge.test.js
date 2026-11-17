// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {ScenicRoad} from '../modules/scenic3d/index.js';
import {createVehicle} from '../modules/vehicle3d/index.js';
import {rotate} from '../modules/math/index.js';
import {createDriveWorld} from '../demos/horizon-lab/drive-world.js';
import {starterRaceProject} from '../demos/horizon-lab/race-project.js';
import {createRaceSession,raceDriverInput} from '../demos/horizon-lab/race-model.js';
import {bridgeGuardrails,bridgePhysics} from '../demos/horizon-lab/race-guardrails.js';
function spawnOnRoad(car,road,recipe,distance,lateral,speed){
  const s=road.sample(distance,lateral),h=recipe.wheel.radius+recipe.suspension.restLength-
    recipe.mass*9.81/(4*recipe.suspension.spring);
  const f=rotate([0,Math.sin(s.yaw/2),0,Math.cos(s.yaw/2)],[0,0,-1]);
  return car.spawn({position:[s.position[0],s.position[1]+h,s.position[2]],
    yaw:s.yaw,pitch:s.pitch,roll:s.roll,velocity:f.map(n=>n*speed)});
}
test('bridge collision follows visible edges and leaves the ordinary racing lanes clear',()=>{
  const p=starterRaceProject(),w=createDriveWorld(p.scenery,p.surfaces,'coast'),
    road=w.scenic.road,rails=bridgeGuardrails(road),car=createVehicle(p.vehicle);
  assert.equal(rails.length,32);assert.equal(w.physics.barriers.length,1,'legacy world is preserved');
  for(const lane of [-2,2]){
    let state=spawnOnRoad(car,road,p.vehicle,165,lane,24);
    for(let i=0;i<90;i++){
      state=car.step(state,{throttle:1},bridgePhysics(w.physics,rails,state.position));
      assert.equal(state.contacts.some(id=>id.startsWith('bridge-rail-')),false,'no phantom lane barrier');
      assert.equal(state.needsRecovery,false);
    }
  }
});
test('actual 24 m/s bridge edge contact is bounded and does not produce a rollover',()=>{
  const p=starterRaceProject(),w=createDriveWorld(p.scenery,p.surfaces,'coast'),
    road=w.scenic.road,rails=bridgeGuardrails(road),car=createVehicle(p.vehicle);
  for(const lane of [-5.8,5.8]){
    let state=spawnOnRoad(car,road,p.vehicle,165,lane,24),hit=false;
    for(let i=0;i<210;i++){
      state=car.step(state,{throttle:1},bridgePhysics(w.physics,rails,state.position));
      hit ||= state.contacts.some(id=>id.startsWith('bridge-rail-'));
      assert.equal(state.needsRecovery,false,'contact must not freeze chassis');
    }
    assert.ok(hit,'real visible bridge rail must be a collider');
  }
});
test('32-knot long bridges select only nearby collision barriers without changing the authored road',()=>{
  const p=starterRaceProject();p.scenery.road=Array.from({length:32},(_,i)=>({
    id:'long-'+i,x:0,y:4,z:-25*i,width:16,bank:0,structure:'bridge',surface:'asphalt'}));
  const road=new ScenicRoad(p.scenery),rails=bridgeGuardrails(road);
  assert.ok(rails.length>64);
  const w={sampleSurface:()=>null,barriers:[{id:'old',min:[0,0,0],max:[1,1,1]}]};
  const s=road.sample(300).position,got=bridgePhysics(w,rails,s);
  assert.ok(got.barriers.length>1&&got.barriers.length<=64);
  assert.equal(got.barriers[0],w.barriers[0]);
  assert.deepEqual(bridgePhysics(w,rails,s).barriers,got.barriers);
  assert.equal(w.barriers.length,1);
});
test('rival and guided player can still drive toward the bridge using unchanged native physics',()=>{
  const race=createRaceSession(starterRaceProject());race.start();
  for(let i=0;i<360;i++)race.step({});
  for(let i=0;i<1600;i++){
    race.step(raceDriverInput(race.road,race.player,race.project.vehicle,{speed:10,lateral:-2,rows:race.rows}));
    assert.equal(race.player.needsRecovery,false);
    assert.equal(race.rival.needsRecovery,false);
  }
  assert.ok(race.progress.distance>100);
  assert.ok(race.rivalProgress.distance>100);
});
