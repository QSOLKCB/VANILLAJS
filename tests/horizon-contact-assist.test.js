// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createVehicle} from '../modules/vehicle3d/index.js';
import {starterRaceProject} from '../demos/horizon-lab/race-project.js';
import {createRaceSession} from '../demos/horizon-lab/race-model.js';
import {raceAssistInput,ASSIST_TARGET_SPEED} from '../demos/horizon-lab/race-assist.js';
import {resolveRaceContact} from '../demos/horizon-lab/race-contact.js';

test('independent lanes retain physical clearance and preserve accepted states',()=>{
  const p=starterRaceProject(),car=createVehicle(p.vehicle);
  const a=car.spawn({position:[-2,4,0]}),b=car.spawn({position:[2,4,0]});
  const before=structuredClone([a,b]),result=resolveRaceContact(a,b,p.vehicle);
  assert.equal(result.hit,false);assert.equal(result.player,a);assert.equal(result.rival,b);
  assert.deepEqual([a,b],before);
});

test('overlapping same-level chassis exchange physical impulse and separate',()=>{
  const p=starterRaceProject(),car=createVehicle(p.vehicle);
  const player=car.spawn({position:[0,4,0],velocity:[0,0,-12]});
  const rival=car.spawn({position:[0,4,-3.5],velocity:[0,0,0]});
  const accepted=structuredClone([player,rival]);
  const result=resolveRaceContact(player,rival,p.vehicle);
  assert.equal(result.hit,true);assert.ok(result.penetration>0);
  assert.deepEqual([player,rival],accepted,'the accepted input states remain immutable');
  assert.ok(result.player.position[2]>player.position[2]);
  assert.ok(result.rival.position[2]<rival.position[2]);
  assert.ok(result.player.velocity[2]>player.velocity[2]);
  assert.ok(result.rival.velocity[2]<rival.velocity[2]);
  assert.ok(result.player.contacts.includes('rival-vehicle'));
  assert.ok(result.rival.contacts.includes('player-vehicle'));
  assert.equal(resolveRaceContact(result.player,result.rival,p.vehicle).hit,false,'no residual overlap');
  for(const state of [result.player,result.rival]){
    assert.ok(state.position.every(Number.isFinite));
    assert.ok(state.velocity.every(Number.isFinite));
    for(const w of state.wheels)assert.ok(w.position.every(Number.isFinite));
  }
});

test('different-level cars do not phantom-collide over an elevated bridge',()=>{
  const p=starterRaceProject(),car=createVehicle(p.vehicle);
  const below=car.spawn({position:[0,4,0]}),above=car.spawn({position:[0,9,0]});
  assert.equal(resolveRaceContact(below,above,p.vehicle).hit,false);
  assert.throws(()=>resolveRaceContact({},above,p.vehicle),/Finite vehicle states/);
});

test('optional course assist maps to bounded controls without mutating vehicle or reverse',()=>{
  const p=starterRaceProject(),s=createRaceSession(p),state=s.player,before=structuredClone(state);
  const out=raceAssistInput(s.road,state,p.vehicle,{throttle:1,brake:0,steer:0},s.rows);
  assert.ok(out.throttle>=0&&out.throttle<=1);
  assert.ok(out.brake>=0&&out.brake<=1);
  assert.ok(out.steer>=-1&&out.steer<=1);
  assert.equal(ASSIST_TARGET_SPEED,18);
  assert.deepEqual(raceAssistInput(s.road,state,p.vehicle,{throttle:0,brake:0,reverse:1},s.rows),{throttle:0,brake:0,reverse:1});
  assert.deepEqual(raceAssistInput(s.road,state,p.vehicle,{throttle:0,brake:1,steer:0},s.rows),{throttle:0,brake:1,steer:0});
  assert.deepEqual(state,before);
});

test('full-throttle assisted Cape Aster drive completes all eight gates without unsafe slide',()=>{
  const p=starterRaceProject(),s=createRaceSession(p);s.start();
  for(let i=0;i<360;i++)s.step({});
  let peak=0;
  for(let i=0;i<6000&&s.phase!=='finished';i++){
    const input=raceAssistInput(s.road,s.player,p.vehicle,{throttle:1,brake:0,steer:0},s.rows);
    s.step(input);peak=Math.max(peak,Math.hypot(...s.player.velocity)*3.6);
    assert.equal(s.player.needsRecovery,false);
    assert.equal(s.progress.offRoad,false);
  }
  assert.equal(s.phase,'finished');
  assert.equal(s.progress.checkpointIndex,8);
  assert.equal(s.progress.recoveries,0);
  assert.ok(peak>45&&peak<80);
});

test('digital corrections remain bounded under course assist and the rival drives independently',()=>{
  const p=starterRaceProject(),s=createRaceSession(p);s.start();
  for(let i=0;i<360;i++)s.step({});
  let maxSlip=0;
  for(let i=0;i<5500&&s.phase!=='finished';i++){
    const steer=i%130<20?.5:i%130<40?-.5:0;
    const input=raceAssistInput(s.road,s.player,p.vehicle,{throttle:1,brake:0,steer},s.rows);
    s.step(input);maxSlip=Math.max(maxSlip,...s.player.wheels.map(w=>w.slip));
    assert.equal(s.player.needsRecovery,false);
    assert.equal(s.rival.needsRecovery,false);
  }
  assert.equal(s.progress.checkpointIndex,8);
  assert.equal(s.phase,'finished');
  assert.ok(s.rivalProgress.distance>200);
  assert.ok(Number.isFinite(maxSlip));
});
