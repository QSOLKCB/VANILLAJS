// SPDX-License-Identifier: Apache-2.0
// AIRFRAME-001: bounded game-oriented aerodynamics over the existing 6DOF flight core.
// Not a validated Spitfire flight model, CFD solver, ground/landing physics or stall-spin certification.
import {rotate,quatConjugate,length,normalize,scale,add,dot} from '../math/index.js';
import {integrateBody} from '../flight/index.js';
export const AIRFRAME_STEP=1/120;
const G=9.81;
const owned=new WeakSet();
const defaults=Object.freeze({
  airDensity:1.225,wingArea:22,liftAtZero:.59,liftSlope:4.5,maxLift:1.45,
  stallAngle:.30,dragAtZero:.028,inducedDrag:.06,stallDrag:.23,
  thrust:4500,pitchRate:1.1,yawRate:.38,rollRate:1.8,
  pitchResponse:3.5,yawResponse:2,rollResponse:3.5
});
function plain(v,allowed,label){
  if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw TypeError(label+' must be a plain record');
  const d=Object.getOwnPropertyDescriptors(v);
  if(Reflect.ownKeys(d).some(k=>typeof k!=='string'||!allowed.includes(k)||!Object.hasOwn(d[k],'value')))throw TypeError(label+' contains unknown or accessor fields');
}
const finite=(v,a,b,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b)throw RangeError(label+' outside finite range');return v;};
export function createAirframeConfig(options={}){
  plain(options,Object.keys(defaults),'airframe parameters');
  const bounds={
    airDensity:[.05,2],wingArea:[1,200],liftAtZero:[-.5,1.5],liftSlope:[0,10],maxLift:[.2,3],
    stallAngle:[.1,.7],dragAtZero:[.001,.3],inducedDrag:[0,1],stallDrag:[0,1],
    thrust:[0,100000],pitchRate:[.05,4],yawRate:[.05,4],rollRate:[.05,6],
    pitchResponse:[.1,20],yawResponse:[.1,20],rollResponse:[.1,20]
  };
  const out={};
  for(const k of Object.keys(defaults)){const [a,b]=bounds[k];out[k]=finite(options[k]??defaults[k],a,b,k);}
  const result=Object.freeze(out);owned.add(result);return result;
}
function config(v){if(!owned.has(v))throw TypeError('createAirframeConfig result required');return v;}
function bodyState(body){
  if(!body||typeof body!=='object')throw TypeError('flight body required');
  if(!Array.isArray(body.position)||!Array.isArray(body.velocity)||!Array.isArray(body.orientation)||!Array.isArray(body.angularVelocity)||
    body.position.length!==3||body.velocity.length!==3||body.orientation.length!==4||body.angularVelocity.length!==3||
    ![...body.position,...body.velocity,...body.orientation,...body.angularVelocity,body.mass,...body.inertia].every(Number.isFinite)||
    !Number.isFinite(body.mass)||body.mass<=0||!Array.isArray(body.inertia)||body.inertia.length!==3||
    body.inertia.some(n=>n<=0)||Math.abs(length(body.orientation)-1)>1e-6)throw TypeError('valid 6DOF body required');
  return body;
}
function command(v){
  plain(v,['throttle','pitch','yaw','roll'],'aircraft input');
  return {throttle:finite(v.throttle??0,0,1,'throttle'),pitch:finite(v.pitch??0,-1,1,'pitch'),
    yaw:finite(v.yaw??0,-1,1,'yaw'),roll:finite(v.roll??0,-1,1,'roll')};
}
function aerodynamicState(body,profile){
  const v=body.velocity,airSpeed=length(v),local=rotate(quatConjugate(body.orientation),v);
  const forwardSpeed=-local[2],alpha=forwardSpeed>1e-8?Math.atan2(-local[1],forwardSpeed):0;
  const dynamicPressure=.5*profile.airDensity*airSpeed*airSpeed;
  const stalled=forwardSpeed>1&&Math.abs(alpha)>=profile.stallAngle;
  // The post-stall reduction is deliberate, finite, symmetric and observable.
  const baseCl=Math.max(-profile.maxLift,Math.min(profile.maxLift,profile.liftAtZero+profile.liftSlope*alpha));
  const cl=stalled?baseCl*Math.max(.18,profile.stallAngle/Math.abs(alpha)*.45):baseCl;
  const lift=forwardSpeed>0?dynamicPressure*profile.wingArea*cl:0;
  const cd=profile.dragAtZero+profile.inducedDrag*cl*cl+(stalled?profile.stallDrag:0);
  const drag=dynamicPressure*profile.wingArea*cd;
  return {airSpeed,forwardSpeed,angleOfAttack:alpha,stalled,lift,drag,cl,cd};
}
/** Derived diagnostics only. SI units; vertical airspeed is not indicated airspeed. */
export function sampleAirframe(body,profile){
  bodyState(body);config(profile);
  const x=aerodynamicState(body,profile);
  return Object.freeze({...x,altitude:body.position[1],verticalSpeed:body.velocity[1],
    loadFactor:x.lift/(body.mass*G)});
}
/** One authoritative rigid-body tick. Input and dt checked before any mutation.
 * Forces: gravity, local forward thrust, local wing-up lift, world velocity drag.
 * Body-local PD angular-rate control is an approximation for arcade air combat.
 */
export function stepAirframe(body,input,dt,profile){
  bodyState(body);config(profile);
  const u=command(input??{});
  finite(dt,0,.05,'dt');
  const aero=aerodynamicState(body,profile);
  if(dt===0)return Object.freeze({contacts:[],truncated:false,telemetry:sampleAirframe(body,profile)});
  const forward=rotate(body.orientation,[0,0,-1]),up=rotate(body.orientation,[0,1,0]);
  const force=add(add(scale(forward,u.throttle*profile.thrust),scale(up,aero.lift)),
    add(aero.airSpeed>1e-10?scale(normalize(body.velocity),-aero.drag):[0,0,0],[0,-body.mass*G,0]));
  const controls=[u.pitch,u.yaw,u.roll],rates=[profile.pitchRate,profile.yawRate,profile.rollRate],
    gains=[profile.pitchResponse,profile.yawResponse,profile.rollResponse];
  const torque=controls.map((n,i)=>body.inertia[i]*(n*rates[i]-body.angularVelocity[i])*gains[i]);
  const movement=integrateBody(body,{force,torque},dt,[]);
  return Object.freeze({...movement,telemetry:sampleAirframe(body,profile)});
}
