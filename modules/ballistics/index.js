// SPDX-License-Identifier: Apache-2.0
// Generalised from QSOLKCB/CorpoWars3d src/physics.js at
// 2bdc0e12d7f0e3f691a2efbc2ab612e871b5d534 (Apache-2.0).
// Pure closed-form vertical motion, independent of fixed-clock implementation.
const finite=(v,name)=>{
  if(typeof v!=='number'||!Number.isFinite(v))throw new RangeError(name+' must be finite');
  return v;
};
/** Constant-gravity vertical motion. height/groundHeight in metres,
 * velocity in m/s, dt in seconds. On landing clamp height and velocity.
 * No collision with walls, slopes, moving ground or between bodies. */
export function ballisticStep({height,velocity,dt,gravity=9.81,groundHeight=0}={}){
  height=finite(height,'height');velocity=finite(velocity,'velocity');
  dt=finite(dt,'dt');gravity=finite(gravity,'gravity');
  groundHeight=finite(groundHeight,'groundHeight');
  if(height<groundHeight)throw new RangeError('height is below groundHeight');
  if(dt<0||dt>.1)throw new RangeError('dt must be within [0, 0.1]');
  if(gravity<=0)throw new RangeError('gravity must be positive');
  if(dt===0)return {height,velocity};
  if(height===groundHeight&&velocity<=0)return {height:groundHeight,velocity:0};
  const next=height+velocity*dt-.5*gravity*dt*dt;
  const nextVelocity=velocity-gravity*dt;
  if(!Number.isFinite(next)||!Number.isFinite(nextVelocity))
    throw new RangeError('ballistic integration overflow');
  return next<=groundHeight?{height:groundHeight,velocity:0}:
    {height:next,velocity:nextVelocity};
}
