// SPDX-License-Identifier: Apache-2.0
// TRAJECTORY-001. Inert world data, fixed 120 Hz guidance and swept AABB contact.
// No weapon damage, camera authority, ambient clock or side effects.
import {createSightWorld,querySight} from '../sensing/index.js';
import {leadIntercept} from '../lead-solver/index.js';
import {castSegment,castMovingSegment} from '../collision/index.js';

export const TRAJECTORY_TICK=1/120;
export const TRAJECTORY_LIMITS=Object.freeze({actors:16,walls:128,coordinate:2000,velocity:100,shotsPerCall:256,ttlTicks:2400});
const ID=/^[a-z][a-z0-9-]{0,31}$/,worlds=new WeakMap(),states=new WeakMap();
const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){for(const x of Object.values(o))freeze(x);Object.freeze(o);}return o;};
function record(v,keys,label){
  if(!v||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw TypeError(label+' must be plain data');
  const d=Object.getOwnPropertyDescriptors(v),found=Reflect.ownKeys(d);
  if(found.length!==keys.length||found.some(k=>typeof k!=='string'||!keys.includes(k)||!d[k].enumerable||!Object.hasOwn(d[k],'value')))
    throw TypeError(label+' requires exact, enumerable data fields');
  return Object.fromEntries(keys.map(k=>[k,d[k].value]));
}
function list(v,min,max,label){
  if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length<min||v.length>max||
    Reflect.ownKeys(v).length!==v.length+1)throw TypeError(label+' requires dense bounded array');
  return Array.from({length:v.length},(_,i)=>{
    const d=Object.getOwnPropertyDescriptor(v,String(i));
    if(!d||!d.enumerable||!Object.hasOwn(d,'value'))throw TypeError(label+' contains accessor/hole');
    return d.value;
  });
}
function num(v,lo,hi,label){if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw RangeError(label+' outside finite bounds');return v===0?0:v;}
function vec(v,bound,label){return list(v,3,3,label).map(x=>num(x,-bound,bound,label));}
function id(v,set,label){if(typeof v!=='string'||!ID.test(v)||(set&&set.has(v)))throw TypeError(label+' must be unique slug');if(set)set.add(v);return v;}
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const mag=a=>Math.hypot(...a);
function unit(v){const n=mag(v);if(!(n>1e-12))throw RangeError('direction must be nonzero');return v.map(x=>x/n);}
const add=(a,b)=>a.map((x,i)=>x+b[i]),scale=(a,s)=>a.map(x=>x*s),sub=(a,b)=>a.map((x,i)=>x-b[i]);
const at=(a,t)=>add(a.position,scale(a.velocity,t));
const boxAt=(a,t)=>{const p=at(a,t);return {min:sub(p,a.halfExtents),max:add(p,a.halfExtents)};};
function turn(from,to,angle){
  const d=Math.max(-1,Math.min(1,dot(from,to))),theta=Math.acos(d);
  if(theta<=angle)return [...to];
  if(theta<1e-10)return [...from];
  let tangent=sub(to,scale(from,d)),m=mag(tangent);
  if(m<1e-12){const basis=Math.abs(from[0])<.9?[1,0,0]:[0,1,0];tangent=sub(basis,scale(from,dot(basis,from)));m=mag(tangent);}
  return unit(add(scale(from,Math.cos(angle)),scale(tangent,Math.sin(angle)/m)));
}
/** World actors and walls are independently owned. IDs are globally unique. */
export function createTrajectoryWorld(input){
  const r=record(input,['actors','walls'],'trajectory world'),ids=new Set();
  const actors=list(r.actors,2,TRAJECTORY_LIMITS.actors,'actors').map(v=>{
    const a=record(v,['id','position','velocity','halfExtents'],'actor');
    const actor={id:id(a.id,ids,'actor id'),position:vec(a.position,2000,'actor position'),
      velocity:vec(a.velocity,TRAJECTORY_LIMITS.velocity,'actor velocity'),
      halfExtents:list(a.halfExtents,3,3,'halfExtents').map(x=>num(x,.05,20,'halfExtents'))};
    return actor;
  });
  const walls=list(r.walls,0,TRAJECTORY_LIMITS.walls,'walls').map(v=>{
    const w=record(v,['id','box'],'wall'),b=record(w.box,['min','max'],'wall box');
    const min=vec(b.min,2000,'min'),max=vec(b.max,2000,'max');
    if(min.some((x,i)=>x>=max[i]))throw RangeError('wall requires positive volume');
    return {id:id(w.id,ids,'wall id'),box:{min,max}};
  });
  const world=freeze({actorCount:actors.length,wallCount:walls.length});
  worlds.set(world,freeze({actors,walls}));
  return world;
}
function authority(world){const w=worlds.get(world);if(!w)throw TypeError('createTrajectoryWorld required');return w;}
function launchFields(request){
  const r=record(request,['ownerId','targetId','position','direction','speed','turnRate','ttlTicks','halfSize'],'launch');
  return {ownerId:id(r.ownerId,null,'ownerId'),targetId:id(r.targetId,null,'targetId'),
    position:vec(r.position,2000,'muzzle'),direction:unit(vec(r.direction,1,'direction')),
    speed:num(r.speed,.1,600,'speed'),turnRate:num(r.turnRate,0,12,'turn rate'),
    ttlTicks:num(r.ttlTicks,1,TRAJECTORY_LIMITS.ttlTicks,'ttl ticks'),
    halfSize:num(r.halfSize,0,3,'shot halfSize')};
}
function lockInternal(w,r){
  const owner=w.actors.find(a=>a.id===r.ownerId),target=w.actors.find(a=>a.id===r.targetId);
  if(!owner||!target||owner===target)throw RangeError('owner and distinct target must exist');
  if(mag(sub(r.position,owner.position))>12)throw RangeError('muzzle must belong to owner (<12m)');
  const sense=createSightWorld({blockers:w.walls,targets:[{id:target.id,position:target.position}]});
  const report=querySight(sense,{position:r.position,direction:r.direction},
    {range:1500,fov:Math.PI/2})[0];
  return freeze({locked:report.visible,reason:report.reason,targetId:target.id,
    distance:report.distance,occluderId:report.occluderId});
}
/** Physical lock only; no hidden on-screen target selection. */
export function queryTrajectoryLock(world,request){
  const w=authority(world),r=launchFields(request);
  if(!Number.isSafeInteger(r.ttlTicks))throw RangeError('ttlTicks must be integer');
  return lockInternal(w,r);
}
/** Rejected lock has no shot and no ammunition side effects. */
export function launchTrajectory(world,request){
  const w=authority(world),r=launchFields(request);
  if(!Number.isSafeInteger(r.ttlTicks))throw RangeError('ttlTicks must be integer');
  const lock=lockInternal(w,r);
  if(!lock.locked)return freeze({accepted:false,reason:lock.reason,state:null});
  const state=freeze({status:'flying',position:[...r.position],direction:[...r.direction],
    tick:0,ownerId:r.ownerId,targetId:r.targetId,speed:r.speed,
    turnRate:r.turnRate,ttlTicks:r.ttlTicks,halfSize:r.halfSize,event:null});
  states.set(state,world);
  return freeze({accepted:true,reason:null,state});
}
/** One fixed tick at a time; ticks N then M equals N+M on the same runtime. */
export function stepTrajectory(world,source,ticks=1){
  const w=authority(world);
  if(states.get(source)!==world)throw TypeError('foreign or forged shot state');
  if(!Number.isSafeInteger(ticks)||ticks<0||ticks>TRAJECTORY_LIMITS.shotsPerCall)
    throw RangeError('bounded integer tick count required');
  if(source.status!=='flying'||ticks===0)return source;
  let s=source;
  for(let i=0;i<ticks&&s.status==='flying';i++){
    const t=s.tick*TRAJECTORY_TICK,target=w.actors.find(a=>a.id===s.targetId);
    const targetPosition=at(target,t);
    const lead=leadIntercept({shooterPosition:s.position,targetPosition,
      targetVelocity:target.velocity,projectileSpeed:s.speed,maxTime:20});
    const desiredVector=sub(lead?lead.interceptPoint:targetPosition,s.position);
    const desired=mag(desiredVector)>1e-12?unit(desiredVector):s.direction;
    const heading=turn(s.direction,desired,s.turnRate*TRAJECTORY_TICK);
    const delta=scale(heading,s.speed*TRAJECTORY_TICK);
    const wall=castSegment(s.position,delta,w.walls,{halfSize:s.halfSize});
    const moving=w.actors.filter(a=>a.id!==s.ownerId).map(a=>({
      id:a.id,box:boxAt(a,t),displacement:scale(a.velocity,TRAJECTORY_TICK)
    }));
    const actor=castMovingSegment(s.position,delta,moving,{halfSize:s.halfSize});
    const hit=wall&&(!actor||wall.time<=actor.time)?{...wall,kind:'wall'}:
      actor?{...actor,kind:'actor'}:null;
    const tick=s.tick+1,position=hit?hit.point:add(s.position,delta);
    if(!position.every(Number.isFinite))throw RangeError('trajectory overflow');
    let status='flying',event=null;
    if(hit){status='hit';event={type:'contact',kind:hit.kind,id:hit.id,
      tick,fraction:hit.time,point:[...position]};}
    else if(tick===s.ttlTicks){status='expired';event={type:'expired',tick,point:[...position]};}
    s=freeze({...s,status,position,direction:heading,tick,event});
    states.set(s,world);
  }
  return s;
}
