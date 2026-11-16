// SPDX-License-Identifier: Apache-2.0
// Reproduce independent numerical observations. This is not a browser or hardware witness.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createVehicle,vehiclePreset,VEHICLE_STEP} from '../../../modules/vehicle3d/index.js';
const source=new URL('../../../modules/vehicle3d/index.js',import.meta.url);
const G=9.81,substep=1/240;
const makeRecipe=()=>{const r=vehiclePreset('simulation');r.drag=0;r.tyres.rollingResistance=0;r.engine.engineBrake=0;return r;};
const plane=friction=>({barriers:[],sampleSurface:(x,z,maxY)=>maxY>=0?{height:0,normal:[0,1,0],friction,surfaceId:'analytic-flat-plane'}:null});
const equilibrium=r=>r.wheel.radius+r.suspension.restLength-r.mass*G/(4*r.suspension.spring);
const horizontalSpeed=s=>Math.hypot(s.velocity[0],s.velocity[2]);
const advance=(car,state,input,world,seconds)=>{for(let i=0;i<Math.round(seconds/VEHICLE_STEP);i++)state=car.step(state,input,world);return state;};
function stopping(friction){
  const r=makeRecipe(),car=createVehicle(r),startSpeed=20,world=plane(friction);
  let state=car.spawn({position:[0,equilibrium(r),0],velocity:[0,0,-startSpeed]}),steps=0;
  for(;steps<2400&&horizontalSpeed(state)>.08;steps++)state=car.step(state,{gear:0,brake:1},world);
  if(steps===2400)throw Error('Stopping observation did not reach its near-zero threshold');
  const observed=-state.position[2],reference=startSpeed**2/(2*friction*r.tyres.grip*G);
  return {surfaceFriction:friction,tyreGrip:r.tyres.grip,startSpeedMps:startSpeed,stopThresholdMps:.08,residualSpeedMps:horizontalSpeed(state),durationSeconds:steps*VEHICLE_STEP,distanceMetres:observed,constantFrictionReferenceMetres:reference,relativeDifference:(observed-reference)/reference};
}
function turn(){
  const r=makeRecipe();r.steering.speedReduction=0;r.tyres.corneringStiffness=4000;
  const car=createVehicle(r),initial=car.spawn({position:[0,equilibrium(r),0],velocity:[0,0,-5]}),control=.25,duration=2;
  const state=advance(car,initial,{gear:0,steer:control},plane(1),duration);
  const observed=horizontalSpeed(state)/Math.abs(state.angularVelocity[1]),reference=r.wheel.wheelbase/Math.tan(r.steering.maxAngle*control);
  return {initialSpeedMps:5,durationSeconds:duration,steerControl:control,steerRadians:state.steering,endingSpeedMps:horizontalSpeed(state),yawRateRadiansPerSecond:state.angularVelocity[1],worldPositionMetres:state.position,dynamicRadiusMetres:observed,bicycleReferenceMetres:reference,relativeDifference:(observed-reference)/reference};
}
function support(){
  const r=makeRecipe(),car=createVehicle(r),reference=equilibrium(r),initial=car.spawn({position:[0,reference+.12,0]});
  const state=advance(car,initial,{gear:0},plane(1),5),sum=state.wheels.reduce((a,w)=>a+w.load,0),weight=r.mass*G;
  return {durationSeconds:5,massKg:r.mass,staticReferenceCOMMetres:reference,observedCOMMetres:state.position[1],heightErrorMetres:state.position[1]-reference,verticalVelocityMps:state.velocity[1],weightNewtons:weight,supportNewtons:sum,supportErrorNewtons:sum-weight,cornerLoadsNewtons:state.wheels.map(w=>w.load),cornerCompressionsMetres:state.wheels.map(w=>w.compression)};
}
function ballistic(){
  const r=makeRecipe(),car=createVehicle(r),duration=.5,y=20,vy=4;
  const state=advance(car,car.spawn({position:[0,y,0],velocity:[0,vy,-12]}),{throttle:1,steer:1},{barriers:[],sampleSurface:()=>null},duration);
  const reference=y+vy*duration-.5*G*duration**2;
  return {durationSeconds:duration,initialHeightMetres:y,initialVerticalVelocityMps:vy,analyticHeightMetres:reference,observedHeightMetres:state.position[1],heightErrorMetres:state.position[1]-reference,semiImplicitHeightErrorPredictionMetres:-G*duration*substep/2,analyticVelocityMps:vy-G*duration,observedVelocityMps:state.velocity[1],velocityErrorMps:state.velocity[1]-(vy-G*duration),horizontalDistanceMetres:state.position[2],groundedWheels:state.wheels.filter(w=>w.grounded).length};
}
console.log(JSON.stringify({format:'qsol.horizon-002.physics-observations.v1',runtime:{node:process.version,platform:process.platform,arch:process.arch},moduleSha256:createHash('sha256').update(await readFile(source)).digest('hex'),consumerStepSeconds:VEHICLE_STEP,internalStepSeconds:substep,boundary:'Same-runtime Float64 model observations against independent analytic references; no browser, GPU, physical vehicle or hardware performance claim.',stopping:[stopping(.35),stopping(1)],turn:turn(),support:support(),ballistic:ballistic()},null,2));
