// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {starterDriveProject,validateDriveProject,parseDriveProject,serializeDriveProject,DRIVE_PROJECT_BYTES} from '../demos/horizon-lab/drive-project.js';
import {DriveInput} from '../demos/horizon-lab/drive-input.js';
import {createDriveWorld,createCourseScenery} from '../demos/horizon-lab/drive-world.js';
import {createVehicle,VEHICLE_STEP} from '../modules/vehicle3d/index.js';
import {FixedClock} from '../modules/time/index.js';
test('driving sidecar roundtrips owned vehicle, friction and authored scenery without changing visual-study format',()=>{
  const source=starterDriveProject(),accepted=parseDriveProject(serializeDriveProject(source));assert.deepEqual(accepted,source);assert.notEqual(accepted,source);assert.notEqual(accepted.vehicle,source.vehicle);assert.notEqual(accepted.scenery,source.scenery);
  const changed=structuredClone(source);changed.vehicle.mass=1400;changed.surfaces.gravel=.3;assert.equal(accepted.vehicle.mass,1200);assert.equal(accepted.surfaces.gravel,.65);assert.equal(accepted.format,'qsol.vanillajs.horizon-drive.v1');
});
test('driving sidecar rejects unknown, accessor, unsupported and oversized imports transactionally',()=>{
  const accepted=starterDriveProject(),before=serializeDriveProject(accepted);let reads=0;
  const accessor=structuredClone(accepted);Object.defineProperty(accessor,'vehicle',{get(){reads++;return accepted.vehicle;},enumerable:true});assert.throws(()=>validateDriveProject(accessor));assert.equal(reads,0);
  for(const patch of [{format:'qsol.vanillajs.horizon-lab.v1'},{version:2},{script:'alert(1)'},{course:'download'},{name:'\nBad'},{surfaces:{asphalt:1,gravel:.5,terrain:3}},{surfaces:{asphalt:1,gravel:.5,terrain:.4,url:'https://invalid'}}])assert.throws(()=>validateDriveProject({...accepted,...patch}));
  assert.throws(()=>parseDriveProject(' '.repeat(DRIVE_PROJECT_BYTES+1)));assert.throws(()=>parseDriveProject('{invalid'));assert.equal(serializeDriveProject(accepted),before);
});
test('driving input cancels held keys, ignores repeat-to-resume and combines independent touch controls',()=>{
  const input=new DriveInput();input.keyDown('KeyW',false,true);input.keyDown('KeyD',false,true);assert.deepEqual(input.read(),{throttle:1,brake:0,steer:1});input.cancel();assert.deepEqual(input.read(),{throttle:0,brake:0,steer:0});input.keyDown('KeyW',true,true);input.keyDown('KeyW',false,true);assert.equal(input.read().throttle,0);input.keyUp('KeyW');input.keyDown('KeyW',false,true);assert.equal(input.read().throttle,1);
  input.cancel();input.press(10,'left',true);input.press(11,'throttle',true);assert.deepEqual(input.read(),{throttle:1,brake:0,steer:-1});input.release(10);assert.deepEqual(input.read(),{throttle:1,brake:0,steer:0});input.cancel();assert.equal(input.snapshot().pointers,0);input.press(12,'throttle',false);assert.equal(input.read().throttle,0);assert.throws(()=>input.press(1,'remote',true));
});
test('driving input does not consume held controls while paused or interpret unrelated keys',()=>{
  const input=new DriveInput();assert.equal(input.keyDown('KeyP',false,true),false);input.keyDown('ArrowUp',false,false);input.cancel();input.keyDown('ArrowUp',true,true);assert.equal(input.read().throttle,0);input.keyUp('ArrowUp');input.keyDown('ArrowUp',false,true);assert.equal(input.read().throttle,1);input.keyDown('Space',false,true);assert.equal(input.read().brake,1);
});
test('the drive trial advances identical physics at 30, 60 and 144 Hz presentation cadences',()=>{
  const p=starterDriveProject(),world=createDriveWorld(p.scenery,p.surfaces,p.course),model=createVehicle(p.vehicle);
  const run=hz=>{const clock=new FixedClock({step:VEHICLE_STEP,maxFrame:.1,maxSteps:12});let state=model.spawn({position:[0,4.703441176470588,-8]});for(let i=0;i<hz*3;i++)clock.advance(1/hz,dt=>{state=model.step(state,{throttle:1,steer:clock.ticks>=180?.15:0},world.physics,dt);});return {state,ticks:clock.ticks};};
  const a=run(30),b=run(60),c=run(144);assert.equal(a.ticks,360);assert.deepEqual(a,b);assert.deepEqual(a,c);assert.ok(a.state.position[2]<-20);assert.ok(a.state.position[0]>.05);
});
test('the demo ramp produces actual airborne contacts and reacquires its exact landing pad',()=>{
  const p=starterDriveProject(),world=createDriveWorld(createCourseScenery('ramp'),p.surfaces,'ramp'),model=createVehicle(p.vehicle);let state=model.spawn({position:[0,4.703441176470588,-8]});let airborne=false,landed=false,maximumHeight=0;
  for(let i=0;i<1200;i++){state=model.step(state,{throttle:1},world.physics);maximumHeight=Math.max(maximumHeight,state.position[1]);if(state.position[2]<-56&&state.wheels.every(w=>!w.grounded))airborne=true;if(airborne&&state.position[2]<-65&&state.wheels.every(w=>w.grounded)){landed=true;break;}}
  assert.ok(airborne,'car leaves the raised ramp');assert.ok(landed,'four wheels reacquire the pad');assert.ok(maximumHeight>12);assert.equal(state.needsRecovery,false);
});
