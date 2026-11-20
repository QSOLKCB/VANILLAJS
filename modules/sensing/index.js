// SPDX-License-Identifier: Apache-2.0
// SENSE-001: bounded, immutable world-space perception. No renderer, clocks or AI.
// SI metres; right-handed +Y up, -Z forward. Independent of camera presentation.
import {castSegment} from '../collision/index.js';
import {StaticAABBIndex} from '../geometry/index.js';

export const SIGHT_LIMITS=Object.freeze({blockers:256,targets:64,coordinate:10000,range:2000});
const data=new WeakMap(),ID=/^[a-z][a-z0-9-]{0,31}$/;
const EPSILON=16*Number.EPSILON;
function record(v,keys,label,optional=false){
  if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v)))
    throw TypeError(label+' must be a plain data record');
  const descriptors=Object.getOwnPropertyDescriptors(v),all=Reflect.ownKeys(descriptors);
  if(all.some(k=>typeof k!=='string'||!keys.includes(k)||!descriptors[k].enumerable||
      !Object.hasOwn(descriptors[k],'value'))||
    (!optional&&(all.length!==keys.length||keys.some(k=>!Object.hasOwn(descriptors,k)))))
    throw TypeError(label+' contains missing, unknown or executable fields');
}
function countArray(a,limit,label){
  if(!Array.isArray(a)||Object.getPrototypeOf(a)!==Array.prototype||a.length>limit||
    Reflect.ownKeys(a).length!==a.length+1)throw TypeError(label+' must be a bounded dense array');
  const d=Object.getOwnPropertyDescriptors(a);
  return Array.from({length:a.length},(_,i)=>{
    if(!d[i]||!d[i].enumerable||!Object.hasOwn(d[i],'value'))
      throw TypeError(label+' contains holes or accessors');
    return d[i].value;
  });
}
function number(v,lo,hi,label){
  if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw RangeError(label+' outside bounded range');
  return v;
}
function vector(v,label){
  const a=countArray(v,3,label);
  if(a.length!==3)throw TypeError(label+' must have three coordinates');
  return Object.freeze(a.map(n=>number(n,-SIGHT_LIMITS.coordinate,SIGHT_LIMITS.coordinate,label)));
}
function identifier(v,ids,label){
  if(typeof v!=='string'||!ID.test(v)||ids.has(v))
    throw TypeError(label+' must have unique lowercase slug ID');
  ids.add(v);return v;
}
function obstruction(v,ids){
  record(v,['id','box'],'blocker');
  record(v.box,['min','max'],'blocker.box');
  const id=identifier(v.id,ids,'blocker.id'),min=vector(v.box.min,'blocker.min'),max=vector(v.box.max,'blocker.max');
  if(min.some((n,i)=>n>=max[i]))throw RangeError('blocker box must have positive volume');
  return Object.freeze({id,box:Object.freeze({min,max})});
}
function sightTarget(v,ids){
  record(v,['id','position'],'target');
  return Object.freeze({id:identifier(v.id,ids,'target.id'),position:vector(v.position,'target.position')});
}
/** Validated, owned, static snapshot. No consumer can modify its private source. */
export function createSightWorld(source){
  record(source,['blockers','targets'],'sight world');
  const bs=countArray(source.blockers,SIGHT_LIMITS.blockers,'blockers'),
    ts=countArray(source.targets,SIGHT_LIMITS.targets,'targets'),ids=new Set();
  const blockers=Object.freeze(bs.map(b=>obstruction(b,ids))),
    targets=Object.freeze(ts.map(t=>sightTarget(t,ids)).sort((a,b)=>a.id.localeCompare(b.id,'en')));
  const index=new StaticAABBIndex(blockers);
  const world=Object.freeze({blockerCount:blockers.length,targetCount:targets.length});
  data.set(world,{blockers,targets,index});
  return world;
}
function context(world,observer,options){
  const owned=data.get(world);
  if(!owned)throw TypeError('createSightWorld result required');
  record(observer,['position','direction'],'observer');
  record(options,['range','fov','backend'],'sight options',true);
  const origin=vector(observer.position,'observer.position'),
    direction=vector(observer.direction,'observer.direction');
  const norm=Math.hypot(...direction);
  if(!(norm>0))throw RangeError('observer direction must be nonzero');
  const range=number(options.range??SIGHT_LIMITS.range,0,SIGHT_LIMITS.range,'range'),
    fov=number(options.fov??Math.PI*2/3,0,Math.PI*2,'fov');
  const backend=options.backend??'indexed';
  if(!['indexed','serial'].includes(backend))throw TypeError('unknown sight backend');
  return {owned,origin,direction:direction.map(n=>n/norm),range,fov,backend};
}
/**
 * Query ALL admitted targets. Result order is distance ascending, then ID
 * ascending. Geometry uses the canonical AABB cast: blocker touch, including
 * an endpoint, obstructs the target; origin inside/on a blocker hits at t=0.
 * Inclusive cone boundary receives a 16-epsilon rounding allowance.
 * Out-of-range precedes out-of-cone, which precedes AABB occlusion.
 * backend:'serial' is an explicit reference path using the same narrowphase.
 * Neither backend mutates the world, caller input, or camera.
 */
export function querySight(world,observer,options={}){
  const {owned,origin,direction,range,fov,backend}=context(world,observer,options);
  const cosLimit=Math.cos(fov/2),answer=[];
  for(const target of owned.targets){
    const delta=target.position.map((n,i)=>n-origin[i]),distance=Math.hypot(...delta);
    let reason='visible',occluderId=null;
    if(distance>range)reason='out-of-range';
    else if(distance>0&&(delta.reduce((s,n,i)=>s+n*direction[i],0)/distance)<cosLimit-EPSILON)
      reason='out-of-cone';
    else {
      const hit=backend==='indexed'?
        owned.index.castSegment(origin,delta):
        castSegment(origin,delta,owned.blockers);
      if(hit){reason='occluded';occluderId=hit.id;}
    }
    answer.push(Object.freeze({id:target.id,position:Object.freeze([...target.position]),
      distance,visible:reason==='visible',reason,occluderId}));
  }
  answer.sort((a,b)=>a.distance-b.distance||(a.id<b.id?-1:a.id>b.id?1:0));
  return Object.freeze(answer);
}
