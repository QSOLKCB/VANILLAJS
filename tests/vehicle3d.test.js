// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {VEHICLE_FORMAT,VEHICLE_STEP,VEHICLE_BYTES,vehiclePreset,validateVehicle,parseVehicle,serializeVehicle,createVehicle,vehiclePose} from '../modules/vehicle3d/index.js';
import {rotate} from '../modules/math/index.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const flat={sampleSurface:(x,z,maxY)=>maxY>=0?{height:0,normal:[0,1,0],friction:1,surfaceId:'test-plane'}:null,barriers:[]};
const empty={sampleSurface:()=>null,barriers:[]};
const run=(car,state,input,steps,world=flat)=>{for(let i=0;i<steps;i++)state=car.step(state,input,world);return state;};
const magnitude=v=>Math.hypot(...v);

test('vehicle recipes are versioned, owned, stable and distinguish arcade/simulation response',()=>{
  const authored=vehiclePreset(),validated=validateVehicle(authored),original=serializeVehicle(validated);
  assert.equal(validated.format,VEHICLE_FORMAT);assert.equal(VEHICLE_STEP,1/120);
  authored.engine.torqueCurve[1][1]=999;authored.wheel.radius=.5;
  assert.equal(serializeVehicle(validated),original);assert.ok(Object.isFrozen(validated.engine.torqueCurve[1]));
  assert.deepEqual(parseVehicle(original),validated);assert.notDeepEqual(vehiclePreset('arcade'),vehiclePreset('simulation'));
  const car=createVehicle(validated);assert.ok(Object.isFrozen(car));assert.deepEqual(car.recipe,validated);
  assert.throws(()=>vehiclePreset('race'));assert.throws(()=>parseVehicle(' '.repeat(VEHICLE_BYTES+1)));
});

test('vehicle recipe admission rejects invalid envelopes, dimensions, ratios and untrusted executable fields',()=>{
  const invalid=[v=>{v.version=2;},v=>{v.format='legacy';},v=>{v.mass=NaN;},v=>{v.wheel.radius=0;},v=>{v.wheel.track=3;},v=>{v.chassis.length=2;},v=>{v.suspension.travel=.05;},v=>{v.suspension.spring=5000;v.mass=4000;},v=>{v.engine.torqueCurve[1][0]=850;},v=>{v.engine.torqueCurve.at(-1)[0]--;},v=>{v.engine.torqueCurve[1][1]=1001;},v=>{v.gearbox.ratios=[1,2];},v=>{v.gearbox.automatic='yes';},v=>{v.drive='rocket';},v=>{v.script='alert(1)';},v=>{v.name='bad\nname';},v=>{v.tyres.grip=Infinity;}];
  for(const mutate of invalid){const recipe=vehiclePreset();mutate(recipe);assert.throws(()=>validateVehicle(recipe));}
  assert.throws(()=>parseVehicle('{"__proto__":{"execute":true}}'));
  let accessed=0;const getter=vehiclePreset();Object.defineProperty(getter,'mass',{get(){accessed++;return 1200;}});assert.throws(()=>validateVehicle(getter));assert.equal(accessed,0);
  const arrayGetter=vehiclePreset();Object.defineProperty(arrayGetter.inertia,0,{get(){accessed++;return 1000;}});assert.throws(()=>validateVehicle(arrayGetter));assert.equal(accessed,0);
  const hole=vehiclePreset();delete hole.gearbox.ratios[0];assert.throws(()=>validateVehicle(hole));
  const strange=vehiclePreset();Object.setPrototypeOf(strange,{other:1});assert.throws(()=>validateVehicle(strange));
});

test('vehicle state/control validation rejects before changing accepted state',()=>{
  const car=createVehicle(),accepted=car.spawn(),before=clone(accepted);
  for(const input of [{steer:1.001},{throttle:-1},{brake:NaN},{gear:7},{throttle:null},{steer:undefined},{script:true}])assert.throws(()=>car.step(accepted,input,flat));
  for(const dt of [0,1/30,1/100,NaN,Infinity])assert.throws(()=>car.step(accepted,{},flat,dt));
  for(const change of [s=>{s.position[1]=Infinity;},s=>{s.orientation=[0,0,0,2];},s=>{s.velocity[2]=121;},s=>{s.wheels.pop();},s=>{s.wheels[0].load=-1;},s=>{s.tick=-1;},s=>{s.other=1;}]){const state=clone(accepted);change(state);assert.throws(()=>car.step(state,{},flat));}
  let read=0;const input={get throttle(){read++;return 1;}};assert.throws(()=>car.step(accepted,input,flat));assert.equal(read,0);
  assert.deepEqual(accepted,before);
});

test('surface and collider data reject malformed results transactionally',()=>{
  const car=createVehicle(),state=car.spawn(),before=clone(state);
  const valid=flat.sampleSurface(0,0,2);
  for(const value of [undefined,{...valid,normal:[0,0,0]},{...valid,normal:[0,-1,0]},{...valid,friction:3},{...valid,height:100},{...valid,run:'javascript'},null]){
    if(value===null){assert.doesNotThrow(()=>car.step(state,{},empty));continue;}
    assert.throws(()=>car.step(state,{}, {sampleSurface:()=>value,barriers:[]}));
  }
  assert.throws(()=>car.step(state,{}, {sampleSurface:flat.sampleSurface,barriers:[{id:'wall',min:[0,0,0],max:[0,1,1]}]}));
  const barrier={id:'wall',min:[10,0,0],max:[11,1,1]};assert.throws(()=>car.step(state,{}, {sampleSurface:flat.sampleSurface,barriers:[barrier,barrier]}));
  assert.throws(()=>car.step(state,{}, {sampleSurface:flat.sampleSurface,barriers:[],source:'external'}));
  assert.deepEqual(state,before);
});

test('engine torque and selected driven wheels change traction while preserving pure inputs',()=>{
  const recipe=vehiclePreset('simulation'),car=createVehicle(recipe),state=car.spawn(),before=clone(state);
  const powered=run(car,state,{throttle:1},600),coast=run(car,state,{},600);
  assert.ok(-powered.position[2]>40);assert.ok(-powered.velocity[2]>15);assert.ok(Math.abs(coast.position[2])<1e-6);
  assert.ok(powered.rpm>recipe.engine.idleRPM);assert.ok(powered.gear>1);assert.deepEqual(state,before);
  const lower=clone(recipe);lower.engine.torqueCurve=lower.engine.torqueCurve.map(([rpm,nm])=>[rpm,nm*.3]);const lowCar=createVehicle(lower),slower=run(lowCar,lowCar.spawn(),{throttle:1},600);
  assert.ok(-slower.position[2]<-powered.position[2]*.65);
  const split={sampleSurface:(x,z,maxY)=>maxY>=0?{height:0,normal:[0,1,0],friction:z<0?1:.05,surfaceId:z<0?'front-grip':'rear-ice'}:null,barriers:[]};
  const rear=createVehicle({...recipe,drive:'rear'}),front=createVehicle({...recipe,drive:'front'});
  const rearState=run(rear,rear.spawn(),{throttle:1},30,split),frontState=run(front,front.spawn(),{throttle:1},30,split);assert.ok(-frontState.velocity[2]>-rearState.velocity[2]*2);
});

test('manual neutral, reverse safety, cooldown and automatic gear changes affect real movement',()=>{
  const recipe=vehiclePreset();recipe.gearbox.automatic=false;const car=createVehicle(recipe);
  const neutral=run(car,car.spawn(),{gear:0,throttle:1},240);assert.equal(neutral.gear,0);assert.ok(magnitude(neutral.velocity)<1e-8);
  const reverse=run(car,car.spawn(),{gear:-1,throttle:1},240);assert.equal(reverse.gear,-1);assert.ok(reverse.position[2]>2);
  const fast=car.spawn({velocity:[0,0,-15]}),rejected=car.step(fast,{gear:-1},flat);assert.equal(rejected.gear,1);
  const coasting=run(car,fast,{gear:0},30),reengaged=car.step(coasting,{gear:2},flat);assert.equal(reengaged.gear,2,'coasting in neutral can re-engage a forward gear');
  const shifted=car.step(car.spawn(),{gear:2,throttle:1},flat);assert.equal(shifted.gear,2);assert.ok(shifted.shiftRemaining>0);assert.ok(Math.abs(shifted.velocity[2])<1e-12);
  const held=car.step(shifted,{gear:3},flat);assert.equal(held.gear,2);
  const after=run(car,shifted,{gear:2,throttle:1},60);assert.equal(after.shiftRemaining,0);assert.ok(after.velocity[2]<-.1);
});

test('braking settles without reverse creep, and cancelling controls removes drive force',()=>{
  const car=createVehicle(),speed=run(car,car.spawn(),{throttle:1},360);
  const stopped=run(car,speed,{brake:1,throttle:1},720);assert.ok(magnitude(stopped.velocity)<1e-6);assert.ok(magnitude(stopped.angularVelocity)<1e-6);
  const released=car.step(speed,{},flat),continued=car.step(speed,{throttle:1},flat);assert.ok(-released.velocity[2]<-continued.velocity[2]);
});

test('weight transfer loads the rear under acceleration and front under braking',()=>{
  const car=createVehicle(),accelerating=run(car,car.spawn(),{throttle:1},180);
  const pair=(state,start)=>state.wheels.slice(start,start+2).reduce((sum,w)=>sum+w.load,0);
  assert.ok(pair(accelerating,2)>pair(accelerating,0)*1.15);
  const braking=run(car,accelerating,{brake:1},40);assert.ok(pair(braking,0)>pair(braking,2)*1.15);
  for(const wheel of braking.wheels){assert.ok(wheel.compression>=0&&wheel.compression<=car.recipe.suspension.travel);assert.ok(wheel.load>=0);}
});

test('airborne spin and recover are explicit bounded state transitions with no hidden clock',()=>{
  const car=createVehicle(),start=car.spawn({position:[2,30,4],yaw:.3,velocity:[1,-20,-2]}),before=clone(start);
  const air=run(car,start,{throttle:1,steer:1},30,empty);assert.ok(air.position[1]<start.position[1]);assert.ok(air.wheels.every(w=>!w.grounded));assert.deepEqual(start,before);
  const reset=car.recover(air,{position:[0,1,0],yaw:Math.PI/2});assert.equal(reset.tick,air.tick);assert.deepEqual(reset.velocity,[0,0,0]);assert.equal(reset.steering,0);assert.equal(reset.shiftRemaining,0);assert.equal(reset.needsRecovery,false);
  const forward=rotate(reset.orientation,[0,0,-1]);assert.ok(Math.abs(forward[0]+1)<1e-12);
});

test('visual pose separates COM, steering convention and legacy compression limits',()=>{
  const car=createVehicle(),state=run(car,car.spawn(),{throttle:1,steer:.1},120),before=clone(state),visual=vehiclePose(state,car.recipe);
  assert.equal(visual.steer,-state.steering);assert.equal(visual.wheelSpin,state.wheelSpin);assert.ok(visual.compression.every(v=>v>=0&&v<=.25));
  const offset=rotate(state.orientation,[0,car.recipe.wheel.radius+car.recipe.suspension.restLength,0]);
  for(let i=0;i<3;i++)assert.ok(Math.abs(visual.position[i]+offset[i]-state.position[i])<1e-12);
  assert.deepEqual(state,before);assert.ok(visual.yaw<0,'positive right input produces negative right-handed yaw');
});

test('adversarial angular speed and input velocity are capped with an explicit recovery signal',()=>{
  const car=createVehicle(),state=car.spawn({position:[0,100,0]});state.velocity=[120,120,120];state.angularVelocity=[20,-20,20];
  const before=clone(state),next=car.step(state,{throttle:1,steer:1},empty);
  assert.ok(next.needsRecovery);assert.ok(magnitude(next.velocity)<=120+1e-12);assert.ok(magnitude(next.angularVelocity)<=12+1e-12);
  assert.ok(Math.abs(magnitude(next.orientation)-1)<1e-12);assert.deepEqual(state,before);
  const edge=car.spawn({position:[1990,100,0],velocity:[100,0,0]}),accepted=run(car,edge,{},11,empty),atBoundary=clone(accepted);
  assert.throws(()=>run(car,accepted,{},30,empty),/position/);assert.deepEqual(accepted,atBoundary);
});

test('a provider failure after an internal substep leaves caller state unchanged',()=>{
  const car=createVehicle(),state=car.spawn(),before=clone(state);let calls=0;
  const world={sampleSurface(x,z,maxY){calls++;if(calls>14)throw Error('provider failed');return flat.sampleSurface(x,z,maxY);},barriers:[]};
  assert.throws(()=>car.step(state,{throttle:1},world,1/60),/provider failed/);assert.ok(calls>14);assert.deepEqual(state,before);
});

test('wheel presentation rolls toward -Z with negative right-handed X rotation',()=>{
  const recipe=vehiclePreset();recipe.drag=0;recipe.tyres.rollingResistance=0;recipe.engine.engineBrake=0;
  const car=createVehicle(recipe),speed=5,dt=1/240,state=car.spawn({velocity:[0,0,-speed]}),next=car.step(state,{gear:0},flat,dt);
  const omega=(next.wheelSpin-state.wheelSpin)/dt;
  assert.ok(Math.abs(omega+speed/recipe.wheel.radius)<1e-10);
  // omega-X cross contact-arm [0,-radius,0] points +Z, cancelling -Z translation.
  assert.ok(Math.abs(next.velocity[2]-omega*recipe.wheel.radius)<1e-10);
  assert.equal(vehiclePose(next,recipe).wheelSpin,next.wheelSpin);
});
