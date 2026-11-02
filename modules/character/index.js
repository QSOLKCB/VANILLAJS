// SPDX-License-Identifier: Apache-2.0
import {finiteVector,clamp,quatMultiply,rotate,length} from '../math/index.js';
import {sweepAABB,moveAndSlideAABB} from '../collision/index.js';
const EPS=1e-5,PROBE=.002;
const wrap=angle=>((angle+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
export function characterConfig(options={}) {
  const config={walkSpeed:5,sprintSpeed:8,groundAcceleration:40,airAcceleration:8,gravity:22,jumpSpeed:7.2,stepHeight:.3,groundSnap:.12,...options};
  for(const key of ['walkSpeed','sprintSpeed','groundAcceleration','airAcceleration','gravity','jumpSpeed','stepHeight','groundSnap']) {
    if(!Number.isFinite(config[key]) || config[key]<0)throw new RangeError(`invalid ${key}`);
  }
  if(config.gravity===0)throw new RangeError('gravity must be positive');
  return config;
}
/** Position is the centre of the feet, in metres. The collider remains upright. */
export function createCharacter({position=[0,0,0],velocity=[0,0,0],halfExtents=[.35,.9,.35],eyeHeight=1.62,yaw=0,pitch=0}={}) {
  halfExtents=finiteVector(halfExtents,3,'halfExtents');
  if(halfExtents.some(x=>x<=0) || !Number.isFinite(eyeHeight) || eyeHeight<=0 || eyeHeight>=halfExtents[1]*2)throw new RangeError('invalid character dimensions');
  if(!Number.isFinite(yaw) || !Number.isFinite(pitch))throw new RangeError('invalid view angles');
  return {position:finiteVector(position,3,'position'),velocity:finiteVector(velocity,3,'velocity'),halfExtents,eyeHeight,
    yaw:wrap(yaw),pitch:clamp(pitch,-Math.PI/2+.01,Math.PI/2-.01),grounded:false};
}
export function lookCharacter(character,{yaw=0,pitch=0}={}) {
  if(!Number.isFinite(yaw) || !Number.isFinite(pitch))throw new RangeError('look angles must be finite');
  character.yaw=wrap(character.yaw+yaw%(Math.PI*2));
  character.pitch=clamp(character.pitch+pitch,-Math.PI/2+.01,Math.PI/2-.01);
}
export function characterView(character) {
  const y=character.yaw/2,p=character.pitch/2;
  return {position:character.position.map((v,i)=>v+(i===1?character.eyeHeight:0)),
    orientation:quatMultiply([0,Math.sin(y),0,Math.cos(y)],[Math.sin(p),0,0,Math.cos(p)])};
}
function ground(position,extents,boxes,distance) {
  let nearest=null;
  for(let index=0;index<boxes.length;index++) {
    const hit=sweepAABB(position,[0,-distance,0],extents,boxes[index]);
    if(hit && hit.normal[1]===1 && (!nearest || hit.time<nearest.time))nearest={...hit,index};
  }
  return nearest;
}
/** Local move=[x,z], -z forward. jump is a fresh-press request, not held state.
 * Static AABB steps only: no slopes, capsules, crouch or moving platforms. */
export function stepCharacter(character,input={},dt,config=characterConfig(),boxes=[]) {
  if(!Number.isFinite(dt) || dt<0 || dt>.05)throw new RangeError('character dt must be 0..0.05 seconds');
  if(dt===0)return {contacts:[],grounded:character.grounded,jumped:false,stepped:false,truncated:false};
  const move=finiteVector(input.move??[0,0],2,'move').map(v=>clamp(v,-1,1));
  const magnitude=length(move);if(magnitude>1)for(let i=0;i<2;i++)move[i]/=magnitude;
  const extents=character.halfExtents,start=character.position.map((v,i)=>v+(i===1?extents[1]:0));
  const velocity=[...character.velocity];
  const supported=velocity[1]<=0 && !!ground(start,extents,boxes,PROBE);
  const speed=input.sprint?config.sprintSpeed:config.walkSpeed;
  const desired=rotate([0,Math.sin(character.yaw/2),0,Math.cos(character.yaw/2)],[move[0]*speed,0,move[1]*speed]);
  const difference=[desired[0]-velocity[0],desired[2]-velocity[2]],distance=length(difference);
  const acceleration=supported?config.groundAcceleration:(magnitude>0?config.airAcceleration:0);
  if(distance>0){const factor=Math.min(1,acceleration*dt/distance);velocity[0]+=difference[0]*factor;velocity[2]+=difference[1]*factor;}
  const jumping=!!input.jump && supported;
  if(jumping)velocity[1]=config.jumpSpeed;
  velocity[1]-=config.gravity*dt;
  let result=moveAndSlideAABB(start,velocity,dt,extents,boxes),stepped=false;
  if(supported && !jumping && !result.truncated && config.stepHeight>0 &&
      result.contacts.some(c=>c.normal[1]===0) && Math.hypot(velocity[0],velocity[2])>EPS) {
    const up=moveAndSlideAABB(start,[0,config.stepHeight/dt,0],dt,extents,boxes);
    if(!up.truncated && up.position[1]-start[1]>=config.stepHeight-EPS) {
      const across=moveAndSlideAABB(up.position,[velocity[0],0,velocity[2]],dt,extents,boxes);
      const drop=config.stepHeight+config.groundSnap;
      const down=moveAndSlideAABB(across.position,[0,-drop/dt,0],dt,extents,boxes);
      const progress=r=>(r.position[0]-start[0])*velocity[0]+(r.position[2]-start[2])*velocity[2];
      if(!across.truncated && !down.truncated && down.contacts.some(c=>c.normal[1]===1) &&
         down.position[1]<=start[1]+config.stepHeight+EPS && progress(down)>progress(result)+EPS) {
        result={position:down.position,velocity:[across.velocity[0],0,across.velocity[2]],
          contacts:[...across.contacts,...down.contacts],truncated:false};stepped=true;
      }
    }
  }
  if(supported && !jumping && result.velocity[1]<=0 && config.groundSnap>0 && !result.truncated) {
    const hit=ground(result.position,extents,boxes,config.groundSnap);
    if(hit){result.position[1]-=Math.max(0,hit.time*config.groundSnap-EPS);result.velocity[1]=0;}
  }
  const grounded=result.velocity[1]<=0 && !!ground(result.position,extents,boxes,PROBE);
  if(grounded)result.velocity[1]=0;
  character.position=result.position.map((v,i)=>v-(i===1?extents[1]:0));character.velocity=result.velocity;character.grounded=grounded;
  return {contacts:result.contacts,grounded,jumped:jumping,stepped,truncated:result.truncated};
}
