// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {rotate} from '../modules/math/index.js';
import {createVehicle,vehiclePreset,vehiclePose,VEHICLE_STEP} from '../modules/vehicle3d/index.js';
import {FixedClock} from '../modules/time/index.js';
import {DriveInput,directionalDriveControls,DIRECTION_CHANGE_SPEED} from '../demos/horizon-lab/drive-input.js';
import {vehicleSoundControls} from '../demos/horizon-lab/race-audio.js';
import {starterRaceProject} from '../demos/horizon-lab/race-project.js';
import {createRaceSession} from '../demos/horizon-lab/race-model.js';
const world={sampleSurface:()=>({height:0,normal:[0,1,0],friction:1,surfaceId:'reference-plane'}),barriers:[]};
const magnitude=s=>Math.hypot(...s.velocity);
const signedSpeed=s=>rotate(s.orientation,[0,0,-1]).reduce((sum,n,i)=>sum+n*s.velocity[i],0);
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
function drive(model,state,intent,steps){for(let i=0;i<steps;i++)state=model.step(state,directionalDriveControls(state,intent),world);return state;}

test('directional keyboard and independent touch controls cancel reverse and require a fresh press',()=>{
  for(const code of ['KeyS','ArrowDown']){
    const input=new DriveInput({directional:true});input.keyDown(code,false,true);
    assert.deepEqual(input.read(),{throttle:0,brake:0,steer:0,reverse:1});input.keyDown('Space',false,true);assert.equal(input.read().brake,1);
    input.cancel();assert.deepEqual(input.read(),{throttle:0,brake:0,steer:0,reverse:0});input.keyDown(code,true,true);input.keyDown(code,false,true);assert.equal(input.read().reverse,0);
    input.keyUp(code);input.keyDown(code,false,true);assert.equal(input.read().reverse,1);input.cancel();input.keyUp(code);
    input.press(1,'reverse',true);input.press(2,'left',true);assert.deepEqual(input.read(),{throttle:0,brake:0,steer:-1,reverse:1});input.release(1);assert.equal(input.read().reverse,0);input.cancel();assert.equal(input.snapshot().pointers,0);input.press(1,'reverse',false);assert.equal(input.read().reverse,0);
  }
  const legacy=new DriveInput();legacy.keyDown('KeyS',false,true);assert.deepEqual(legacy.read(),{throttle:0,brake:1,steer:0});assert.throws(()=>legacy.press(1,'reverse',true));
});

test('reverse uses the native gearbox delay and ratio, then physically moves backwards',()=>{
  const recipe=vehiclePreset(),model=createVehicle(recipe);let state=model.spawn(),elapsed=0;
  const initial=state.position.slice(),request=directionalDriveControls(state,{reverse:1});assert.deepEqual(request,{throttle:0,brake:1,steer:0,gear:-1});
  state=model.step(state,request,world);assert.equal(state.gear,-1);assert.ok(state.shiftRemaining>0);elapsed+=VEHICLE_STEP;
  while(state.shiftRemaining>0){const control=directionalDriveControls(state,{reverse:1});assert.equal(control.throttle,1);assert.equal(control.brake,0,'native gearbox suspends torque without artificial service braking');state=model.step(state,control,world);elapsed+=VEHICLE_STEP;}
  assert.ok(elapsed>=recipe.gearbox.shiftTime&&elapsed<=recipe.gearbox.shiftTime+2*VEHICLE_STEP);
  let spinAdvance=0;
  for(let i=0;i<360;i++){const previous=state,control=directionalDriveControls(state,{reverse:1});assert.equal(control.throttle,1);state=model.step(state,control,world);spinAdvance+=wrap(state.wheelSpin-previous.wheelSpin);}
  assert.equal(state.gear,-1,'automatic gearing retains reverse');assert.ok(state.position[2]>initial[2]+10);assert.ok(signedSpeed(state)<-5);assert.ok(spinAdvance>20,'wheel telemetry rolls backwards');
  assert.equal(vehiclePose(state,recipe).wheelSpin,state.wheelSpin);assert.equal(state.needsRecovery,false);
  const sound=vehicleSoundControls(state,directionalDriveControls(state,{reverse:1}),recipe.mass);assert.equal(sound.gear,-1);assert.equal(sound.throttle,1);assert.equal(sound.rpm,state.rpm);assert.equal(sound.speed,magnitude(state));
  const reduced=structuredClone(recipe);reduced.gearbox.reverseRatio=1;const slow=createVehicle(reduced),slowState=drive(slow,slow.spawn(),{reverse:1},360);assert.ok(magnitude(state)>magnitude(slowState)*1.5,'actual reverseRatio changes force and speed');
});

test('automatic upshifts keep native forward acceleration without spurious braking',()=>{
  const model=createVehicle(),raw={throttle:1};let player=model.spawn(),native=model.spawn(),upshifts=0,shiftTicks=0;
  for(let tick=0;tick<2400;tick++){
    const adapted=directionalDriveControls(player,raw);
    assert.deepEqual(adapted,{throttle:1,brake:0,steer:0},'forward shift never applies service brakes');
    if(player.shiftRemaining>0)shiftTicks++;
    const previousGear=player.gear;
    player=model.step(player,adapted,world);
    native=model.step(native,raw,world);
    if(player.gear>previousGear)upshifts++;
  }
  assert.ok(upshifts>0,'exercise at least one automatic forward upshift');
  assert.ok(shiftTicks>0,'exercise nonzero shift delay');
  assert.deepEqual(player,native,'full-throttle forward drive must match the same native vehicle model');
  assert.ok(Math.hypot(...player.velocity)>1);
});

test('both direction changes brake to near zero without overriding automatic forward ratios',()=>{
  const model=createVehicle();let state=drive(model,model.spawn(),{throttle:1},480);assert.ok(magnitude(state)>10);assert.ok(state.gear>1);
  const request=directionalDriveControls(state,{reverse:1});assert.deepEqual(request,{throttle:0,brake:1,steer:0});
  let reverseShift=false;
  for(let i=0;i<720;i++){const previous=state;state=model.step(state,directionalDriveControls(state,{reverse:1}),world);if(previous.gear>0&&state.gear<0){assert.ok(magnitude(previous)<=DIRECTION_CHANGE_SPEED);reverseShift=true;}if(reverseShift&&signedSpeed(state)<-6)break;}
  assert.ok(reverseShift);assert.ok(signedSpeed(state)<-6);assert.equal(state.gear,-1);
  assert.deepEqual(directionalDriveControls(state,{throttle:1}),{throttle:0,brake:1,steer:0});let forwardShift=false;
  for(let i=0;i<960;i++){const previous=state;state=model.step(state,directionalDriveControls(state,{throttle:1}),world);if(previous.gear<0&&state.gear>0){assert.ok(magnitude(previous)<=DIRECTION_CHANGE_SPEED);forwardShift=true;}if(forwardShift&&state.gear>1&&signedSpeed(state)>10)break;}
  assert.ok(forwardShift);assert.ok(signedSpeed(state)>10);assert.ok(state.gear>1,'forward automatic shifts are not pinned to first');
  assert.deepEqual(directionalDriveControls(state,{throttle:1,reverse:1}),{throttle:0,brake:1,steer:0});
  assert.deepEqual(directionalDriveControls(model.spawn(),{reverse:1,brake:1}),{throttle:0,brake:1,steer:0});
  const sideways=model.spawn({velocity:[3,0,0]});assert.equal(directionalDriveControls(sideways,{reverse:1}).gear,undefined,'sideways speed also prevents a direction change');
});

test('reverse steering follows native dynamics and wheel/sound state while cadence stays deterministic',()=>{
  const recipe=vehiclePreset(),model=createVehicle(recipe);
  const run=hz=>{const clock=new FixedClock({step:VEHICLE_STEP,maxFrame:.1,maxSteps:12});let state=model.spawn();for(let i=0;i<hz*4;i++)clock.advance(1/hz,dt=>{state=model.step(state,directionalDriveControls(state,{reverse:1,steer:.35}),world,dt);});return state;};
  const state=run(30);assert.deepEqual(run(60),state);assert.deepEqual(run(144),state);assert.ok(Math.abs(state.position[0])>5);assert.ok(state.position[2]>10);
  const forward=drive(model,model.spawn(),{throttle:1,steer:.35},480);assert.ok(state.orientation[1]*forward.orientation[1]<0,'yaw response reverses with direction of travel');
  // Explicit engine requests independently reproduce the adapter's reverse case.
  let reference=model.spawn();for(let i=0;i<480;i++){const directionRequest=i===0;reference=model.step(reference,{throttle:directionRequest?0:1,brake:directionRequest?1:0,steer:.35,...(directionRequest?{gear:-1}:{})},world);}
  assert.deepEqual(state,reference);
});

test('physical reverse cannot award checkpoints and recovery/restart restore forward gear',()=>{
  const p=structuredClone(starterRaceProject());p.scenery.road=p.scenery.road.slice(0,4).map((k,i)=>({...k,x:0,y:4,z:-50*i,width:16,bank:0,structure:'ground'}));p.race.countdownSeconds=0;p.race.checkpointCount=4;
  const race=createRaceSession(p);race.start();const initial=race.player.position.slice();
  for(let i=0;i<160;i++)race.step(directionalDriveControls(race.player,{reverse:1}));assert.equal(race.player.gear,-1);assert.ok(race.player.position[2]>initial[2]+1);assert.equal(race.progress.checkpointIndex,0);assert.equal(race.progress.fraction,0);assert.ok(race.rivalProgress.distance>12,'rival continues normal forward driving');
  race.recover();assert.equal(race.player.gear,1);assert.equal(race.player.shiftRemaining,0);assert.equal(race.progress.checkpointIndex,0);
  for(let i=0;i<120;i++)race.step(directionalDriveControls(race.player,{reverse:1}));assert.equal(race.player.gear,-1);race.reset();assert.equal(race.player.gear,1);assert.equal(race.player.shiftRemaining,0);assert.equal(race.progress.recoveries,0);
});

test('directional intent rejects nonfinite or out-of-range inputs rather than leaking an invalid gearbox command',()=>{
  const state=createVehicle().spawn();for(const input of [{reverse:NaN},{throttle:2},{brake:-1},{steer:Infinity}])assert.throws(()=>directionalDriveControls(state,input));
  assert.throws(()=>directionalDriveControls({...state,velocity:[0,NaN,0]},{reverse:1}));assert.throws(()=>directionalDriveControls({...state,gear:1.5},{reverse:1}));
});
