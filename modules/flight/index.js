// SPDX-License-Identifier: Apache-2.0
import {finiteVector, quatNormalize, rotate, quatConjugate, integrateOrientation, length, scale, cross, clamp} from '../math/index.js';
import {moveAndSlide} from '../collision/index.js';
export function createBody({position=[0,0,0], velocity=[0,0,0], orientation=[0,0,0,1], angularVelocity=[0,0,0], mass=1, halfSize=0.45, inertia} = {}) {
  if (!(Number.isFinite(mass) && mass>0 && Number.isFinite(halfSize) && halfSize>0)) throw new RangeError('mass and halfSize must be positive');
  inertia=finiteVector(inertia ?? Array(3).fill(2/3*mass*halfSize**2),3,'inertia');
  if (inertia.some(x=>x<=0)) throw new RangeError('inertia must be positive');
  return {position:finiteVector(position,3),velocity:finiteVector(velocity,3),orientation:quatNormalize(finiteVector(orientation,4)),
    angularVelocity:finiteVector(angularVelocity,3),mass,halfSize,inertia};
}
export function flightConfig(options={}) {
  const result={assisted:false,acceleration:22,maxSpeed:32,response:3,angularAcceleration:3,turnSpeed:1.5,angularResponse:5,brake:4,...options};
  for (const key of ['acceleration','maxSpeed','response','angularAcceleration','turnSpeed','angularResponse','brake']) {
    if (!Number.isFinite(result[key]) || result[key]<0) throw new RangeError(`invalid ${key}`);
  }
  result.assisted=Boolean(result.assisted);
  return result;
}
export function snapshot(body) {
  return {position:[...body.position],orientation:[...body.orientation]};
}
/** Semi-implicit Euler translation; body-space Euler rotation. Force is world-space,
 * torque is body-space. Caller supplies finite SI quantities. */
export function integrateBody(body, {force=[0,0,0], torque=[0,0,0]}={}, dt, boxes=[]) {
  if (!Number.isFinite(dt) || dt<0 || dt>0.05) throw new RangeError('body dt must be 0..0.05 seconds');
  force=finiteVector(force,3,'force'); torque=finiteVector(torque,3,'torque');
  if (dt===0) return {contacts:[],truncated:false};
  body.velocity=body.velocity.map((v,i)=>v+force[i]/body.mass*dt);
  const w=body.angularVelocity, gyro=cross(w,w.map((v,i)=>v*body.inertia[i]));
  body.angularVelocity=w.map((v,i)=>v+(torque[i]-gyro[i])/body.inertia[i]*dt);
  body.orientation=integrateOrientation(body.orientation,body.angularVelocity,dt);
  const movement=moveAndSlide(body.position,body.velocity,dt,body.halfSize,boxes);
  body.position=movement.position; body.velocity=movement.velocity;
  return movement;
}
function command(vector) {
  const v=finiteVector(vector,3,'input').map(x=>clamp(x,-1,1)), n=length(v);
  return n>1 ? scale(v,1/n) : v;
}
/** Mutates body. Inputs: local thrust xyz; local pitch/yaw/roll; brake boolean.
 * velocity is world-space; angularVelocity and diagonal inertia are body-space.
 * dt must be <= 50 ms. Collision response removes inward velocity, with no bounce.
 */
export function stepFlight(body, input, dt, config, boxes=[]) {
  if (!Number.isFinite(dt) || dt<0 || dt>0.05) throw new RangeError('flight dt must be 0..0.05 seconds');
  if (dt===0) return {contacts:[],truncated:false};
  const thrust=command(input.thrust ?? [0,0,0]), turn=command(input.turn ?? [0,0,0]);
  const localVelocity=rotate(quatConjugate(body.orientation),body.velocity);
  let acceleration=scale(thrust,config.acceleration);
  if (config.assisted) {
    acceleration=localVelocity.map((v,i)=>(thrust[i]*config.maxSpeed-v)*config.response);
    const n=length(acceleration);
    if (n>config.acceleration) acceleration=scale(acceleration,config.acceleration/n);
  }
  const force=scale(rotate(body.orientation,acceleration),body.mass);
  const w=body.angularVelocity;
  const torque=turn.map((v,i)=>body.inertia[i]*(config.assisted
    ? clamp((v*config.turnSpeed-w[i])*config.angularResponse,-config.angularAcceleration,config.angularAcceleration)
    : v*config.angularAcceleration));
  const movement=integrateBody(body,{force,torque},dt,boxes);
  if (input.brake) {
    const factor=Math.exp(-config.brake*dt);
    body.velocity=scale(body.velocity,factor); body.angularVelocity=scale(body.angularVelocity,factor);
  }
  movement.velocity=body.velocity;
  return movement;
}
