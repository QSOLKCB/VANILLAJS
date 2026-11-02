// SPDX-License-Identifier: Apache-2.0
import {finiteVector,clamp,quatMultiply,rotate,length} from '../math/index.js';
import {aabb,sweepAABB,moveAndSlideAABB,moveAndSlideMovingAABB} from '../collision/index.js';
const EPS=1e-5,PROBE=.002;
const wrap=angle=>((angle+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
export function characterConfig(options={}) {
  const config={walkSpeed:5,sprintSpeed:8,crouchSpeed:2.5,groundAcceleration:40,airAcceleration:8,gravity:22,jumpSpeed:7.2,stepHeight:.3,groundSnap:.12,...options};
  for(const key of ['walkSpeed','sprintSpeed','crouchSpeed','groundAcceleration','airAcceleration','gravity','jumpSpeed','stepHeight','groundSnap']) {
    if(!Number.isFinite(config[key]) || config[key]<0)throw new RangeError(`invalid ${key}`);
  }
  if(config.gravity===0)throw new RangeError('gravity must be positive');
  return config;
}
/** Position is the centre of the feet, in metres. The collider remains upright. */
export function createCharacter({position=[0,0,0],velocity=[0,0,0],halfExtents=[.35,.9,.35],eyeHeight=1.62,
  crouchHalfHeight=halfExtents[1]*.6,crouchEyeHeight=eyeHeight*.6,yaw=0,pitch=0}={}) {
  halfExtents=finiteVector(halfExtents,3,'halfExtents');
  if(halfExtents.some(x=>x<=0) || !Number.isFinite(eyeHeight) || eyeHeight<=0 || eyeHeight>=halfExtents[1]*2)throw new RangeError('invalid character dimensions');
  if(!Number.isFinite(yaw) || !Number.isFinite(pitch))throw new RangeError('invalid view angles');
  if(!Number.isFinite(crouchHalfHeight) || crouchHalfHeight<=0 || crouchHalfHeight>=halfExtents[1] ||
     !Number.isFinite(crouchEyeHeight) || crouchEyeHeight<=0 || crouchEyeHeight>=2*crouchHalfHeight || crouchEyeHeight>=eyeHeight) {
    throw new RangeError('invalid crouch dimensions');
  }
  return {position:finiteVector(position,3,'position'),velocity:finiteVector(velocity,3,'velocity'),halfExtents,eyeHeight,
    standingHalfHeight:halfExtents[1],standingEyeHeight:eyeHeight,crouchHalfHeight,crouchEyeHeight,crouched:false,supportId:null,supportVelocity:[0,0,0],
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
function stance(character,requested,boxes) {
  let crouched=!!requested,standBlocked=false;
  // Check the full candidate standing volume before growing. Touching faces
  // are legal; positive-volume overlap keeps the smaller stance for this tick.
  if(character.crouched && !crouched) {
    const p=character.position,e=character.halfExtents;
    const min=[p[0]-e[0],p[1],p[2]-e[2]],max=[p[0]+e[0],p[1]+character.standingHalfHeight*2,p[2]+e[2]];
    const checked=boxes.map(box=>aabb(box?.min,box?.max));
    standBlocked=checked.some(box=>min.every((v,i)=>v<box.max[i] && max[i]>box.min[i]));
    crouched=standBlocked;
  }
  const extents=[character.halfExtents[0],crouched?character.crouchHalfHeight:character.standingHalfHeight,character.halfExtents[2]];
  const eyeHeight=crouched?character.crouchEyeHeight:character.standingEyeHeight;
  return {extents,eyeHeight,crouched,standBlocked};
}
/** Local move=[x,z], -z forward. jump is a fresh-press request, not held state.
 * crouch is held state; release requests standing when headroom permits.
 * Static AABB steps only: no slopes, capsules or moving platforms. */
export function stepCharacter(character,input={},dt,config=characterConfig(),boxes=[]) {
  if(!Number.isFinite(dt) || dt<0 || dt>.05)throw new RangeError('character dt must be 0..0.05 seconds');
  if(dt===0)return {contacts:[],grounded:character.grounded,crouched:character.crouched,standBlocked:false,jumped:false,stepped:false,truncated:false};
  const move=finiteVector(input.move??[0,0],2,'move').map(v=>clamp(v,-1,1));
  const magnitude=length(move);if(magnitude>1)for(let i=0;i<2;i++)move[i]/=magnitude;
  const {extents,eyeHeight,crouched,standBlocked}=stance(character,input.crouch,boxes);
  const start=character.position.map((v,i)=>v+(i===1?extents[1]:0));
  const velocity=[...character.velocity];
  const supported=velocity[1]<=0 && !!ground(start,extents,boxes,PROBE);
  const speed=crouched?config.crouchSpeed:input.sprint?config.sprintSpeed:config.walkSpeed;
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
  character.halfExtents=extents;character.eyeHeight=eyeHeight;character.crouched=crouched;
  character.supportId=null;character.supportVelocity=[0,0,0];
  return {contacts:result.contacts,grounded,crouched,standBlocked,jumped:jumping,stepped,truncated:result.truncated};
}

/** Platform controller: world-space velocity, linear translating colliders with
 * stable ids and tick-start boxes. Walk/sprint/crouch/jump; no stair/snap pass.
 * On blocked movement the character is unchanged: do NOT commit world motion. */
export function stepCharacterPlatforms(character,input={},dt,config=characterConfig(),colliders=[]) {
  if(!Number.isFinite(dt) || dt<0 || dt>.05)throw new RangeError('character dt must be 0..0.05 seconds');
  const unchanged=(contacts=[],blocked=false)=>({contacts,grounded:character.grounded,crouched:character.crouched,
    standBlocked:false,jumped:false,stepped:false,truncated:blocked,blocked,supportId:character.supportId});
  if(dt===0)return unchanged();
  const move=finiteVector(input.move??[0,0],2,'move').map(v=>clamp(v,-1,1));
  const magnitude=length(move);if(magnitude>1)for(let i=0;i<2;i++)move[i]/=magnitude;
  if(!Array.isArray(colliders))throw new TypeError('colliders must be an array');
  const ids=new Set(),world=colliders.map(c=>{
    if(typeof c?.id!=='string' || !c.id || ids.has(c.id))throw new TypeError('collider ids must be unique nonempty strings');
    ids.add(c.id);const box=aabb(c.box?.min,c.box?.max),displacement=finiteVector(c.displacement??[0,0,0],3,'collider displacement');
    const velocity=displacement.map(v=>v/dt);
    if(!velocity.every(Number.isFinite))throw new RangeError('platform velocity overflow');
    const end=aabb(box.min.map((v,i)=>v+displacement[i]),box.max.map((v,i)=>v+displacement[i]));
    return {id:c.id,box,displacement,velocity,end};
  });
  const {extents,eyeHeight,crouched,standBlocked}=stance(character,input.crouch,world.map(c=>c.box));
  const start=character.position.map((v,i)=>v+(i===1?extents[1]:0));
  const support=(position,velocity,end=false)=>{
    let nearest=null;
    for(const c of world){
      const hit=sweepAABB(position,[0,-PROBE,0],extents,end?c.end:c.box);
      const attached=!end && character.grounded && character.supportId===c.id;
      if(hit?.normal[1]===1 && (velocity[1]-c.velocity[1]<=EPS || attached || (!end && velocity[1]===0)) &&
        (!nearest || hit.time<nearest.time || (hit.time===nearest.time && c.id<nearest.id)))nearest={...c,time:hit.time};
    }return nearest;
  };
  const base=support(start,character.velocity),velocity=[...character.velocity];
  if(base){
    const previous=character.grounded?character.supportVelocity:[0,0,0];
    for(const i of [0,2])velocity[i]+=base.velocity[i]-previous[i];
    velocity[1]=base.velocity[1];
  }
  const speed=crouched?config.crouchSpeed:input.sprint?config.sprintSpeed:config.walkSpeed;
  const desired=rotate([0,Math.sin(character.yaw/2),0,Math.cos(character.yaw/2)],[move[0]*speed,0,move[1]*speed]);
  const difference=[0,2].map(i=>desired[i]+(base?.velocity[i]??0)-velocity[i]),distance=length(difference);
  const acceleration=base?config.groundAcceleration:(magnitude>0?config.airAcceleration:0);
  if(distance>0){const factor=Math.min(1,acceleration*dt/distance);velocity[0]+=difference[0]*factor;velocity[2]+=difference[1]*factor;}
  const jumped=!!input.jump && !!base;if(jumped)velocity[1]+=config.jumpSpeed;
  velocity[1]-=config.gravity*dt;
  const result=moveAndSlideMovingAABB(start,velocity,dt,extents,world);
  if(result.truncated)return unchanged(result.contacts,true);
  const landed=support(result.position,result.velocity,true);
  if(landed)result.velocity[1]=landed.velocity[1];
  character.position=result.position.map((v,i)=>v-(i===1?extents[1]:0));character.velocity=result.velocity;
  character.halfExtents=extents;character.eyeHeight=eyeHeight;character.crouched=crouched;character.grounded=!!landed;
  character.supportId=landed?.id??null;character.supportVelocity=landed?[...landed.velocity]:[0,0,0];
  return {contacts:result.contacts,grounded:!!landed,crouched,standBlocked,jumped,stepped:false,truncated:false,blocked:false,supportId:character.supportId};
}
