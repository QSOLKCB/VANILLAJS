// SPDX-License-Identifier: Apache-2.0
import {finiteVector, add, scale, dot, length} from '../math/index.js';
const SKIN = 1e-6;
export function aabb(min, max) {
  min = finiteVector(min,3,'min'); max = finiteVector(max,3,'max');
  if (min.some((x,i) => x >= max[i])) throw new RangeError('AABB must have positive volume');
  return {min, max};
}
// Sweeps the CENTER of an axis-aligned cube against a static AABB. Not a sphere sweep.
export function sweepBox(origin, displacement, halfSize, box) {
  return sweepExtents(origin,displacement,[halfSize,halfSize,halfSize],box);
}
function sweepExtents(origin, displacement, extents, box) {
  const min = box.min.map((x,i)=>x-extents[i]), max = box.max.map((x,i)=>x+extents[i]);
  let near = -Infinity, far = Infinity, normal = [0,0,0];
  for (let i=0;i<3;i++) {
    if (Math.abs(displacement[i]) < 1e-12) {
      if (origin[i] < min[i] || origin[i] > max[i]) return null;
      continue;
    }
    let a = (min[i]-origin[i])/displacement[i], b = (max[i]-origin[i])/displacement[i];
    const sign = displacement[i] > 0 ? -1 : 1;
    if (a>b) [a,b] = [b,a];
    if (a>near) { near=a; normal=[0,0,0]; normal[i]=sign; }
    far = Math.min(far,b);
    if (near>far) return null;
  }
  if (near < -1e-10 || near > 1 || far < 0 || dot(displacement,normal) >= 0) return null;
  return {time:Math.max(0,near), normal};
}
function penetration(position, extents, box) {
  const min = box.min.map((x,i)=>x-extents[i]), max = box.max.map((x,i)=>x+extents[i]);
  if (!position.every((x,i)=>x>min[i] && x<max[i])) return null;
  let distance = Infinity, normal = [0,0,0];
  for (let i=0;i<3;i++) for (const side of [-1,1]) {
    const d = side<0 ? position[i]-min[i] : max[i]-position[i];
    if (d<distance) { distance=d; normal=[0,0,0]; normal[i]=side; }
  }
  return {distance, normal};
}
function slide(velocity, normal) {
  const into = dot(velocity,normal);
  return into < 0 ? add(velocity,scale(normal,-into)) : velocity;
}
export function moveAndSlide(position, velocity, dt, halfSize, boxes, maxSlides = 6) {
  position = finiteVector(position,3,'position'); velocity = finiteVector(velocity,3,'velocity');
  if (!(Number.isFinite(dt) && dt>=0 && Number.isFinite(halfSize) && halfSize>0 && Number.isInteger(maxSlides) && maxSlides>0)) {
    throw new RangeError('invalid sweep parameters');
  }
  return solveMovement(position,velocity,dt,[halfSize,halfSize,halfSize],boxes,maxSlides);
}
function solveMovement(position,velocity,dt,extents,boxes,maxSlides) {
  const contacts=[];
  // Resolve spawn overlap before sweeping. Contradictory/enclosing solids have no valid solution.
  for (let pass=0;pass<maxSlides;pass++) {
    let moved=false;
    for (let index=0;index<boxes.length;index++) {
      const hit=penetration(position,extents,boxes[index]);
      if (hit) {
        position=add(position,scale(hit.normal,hit.distance+SKIN));
        velocity=slide(velocity,hit.normal); contacts.push({index,normal:hit.normal}); moved=true;
      }
    }
    if (!moved) break;
  }
  if (boxes.some(box=>penetration(position,extents,box))) {
    return {position, velocity:[0,0,0], contacts, truncated:true};
  }
  let remaining=dt;
  for (let pass=0;pass<maxSlides && remaining>1e-10;pass++) {
    const delta=scale(velocity,remaining);
    let nearest=null;
    for (let index=0;index<boxes.length;index++) {
      const hit=sweepExtents(position,delta,extents,boxes[index]);
      if (hit && (!nearest || hit.time<nearest.time)) nearest={...hit,index};
    }
    if (!nearest) { position=add(position,delta); remaining=0; break; }
    position=add(add(position,scale(delta,nearest.time)),scale(nearest.normal,SKIN));
    velocity=slide(velocity,nearest.normal);
    remaining*=1-nearest.time; contacts.push({index:nearest.index,normal:nearest.normal});
  }
  return {position,velocity,contacts,truncated:remaining>1e-10};
}

/** Rectangular axis-aligned body queries. Extents are positive xyz half-widths;
 * these are boxes, not capsules. Legacy cube APIs retain their old signatures. */
function rectangularInput(origin,delta,halfExtents,boxes) {
  origin=finiteVector(origin,3,'origin');delta=finiteVector(delta,3,'displacement');
  const extents=finiteVector(halfExtents,3,'halfExtents');
  if(extents.some(x=>x<=0) || !add(origin,delta).every(Number.isFinite))throw new RangeError('invalid body extent');
  if(!Array.isArray(boxes))throw new TypeError('boxes must be an array');
  boxes=boxes.map(box=>{
    const checked=aabb(box?.min,box?.max);
    if(!checked.min.every((x,i)=>Number.isFinite(x-extents[i]-origin[i])) ||
       !checked.max.every((x,i)=>Number.isFinite(x+extents[i]-origin[i])))throw new RangeError('body extent overflow');
    return checked;
  });
  return {origin,delta,extents,boxes};
}
export function sweepAABB(origin,displacement,halfExtents,box) {
  const v=rectangularInput(origin,displacement,halfExtents,[box]);
  return sweepExtents(v.origin,v.delta,v.extents,v.boxes[0]);
}
export function moveAndSlideAABB(position,velocity,dt,halfExtents,boxes,maxSlides=6) {
  velocity=finiteVector(velocity,3,'velocity');
  if(!Number.isFinite(dt) || dt<0 || !Number.isInteger(maxSlides) || maxSlides<1)throw new RangeError('invalid sweep parameters');
  const v=rectangularInput(position,scale(velocity,dt),halfExtents,boxes);
  return solveMovement(v.origin,velocity,dt,v.extents,v.boxes,maxSlides);
}

/** Closed finite segment versus static AABBs. halfSize expands each box by an
 * axis-aligned cube, NOT a sphere. Starts inside/on a box hit at t=0, normal=0.
 * Equal-time hits use ascending string id, independent of collider array order.
 */
export function castSegment(origin, displacement, colliders, {halfSize=0, ignoreIds=[]}={}) {
  origin=finiteVector(origin,3,'origin');
  displacement=finiteVector(displacement,3,'displacement');
  const distance=length(displacement);
  if (!Number.isFinite(distance) || !add(origin,displacement).every(Number.isFinite)
      || !Number.isFinite(halfSize) || halfSize<0) throw new RangeError('invalid segment extent');
  if (!Array.isArray(colliders) || !Array.isArray(ignoreIds) || !ignoreIds.every(id=>typeof id==='string')) {
    throw new TypeError('colliders and ignoreIds must be arrays');
  }
  const ignored=new Set(ignoreIds), ids=new Set();
  let nearest=null;
  for (let index=0;index<colliders.length;index++) {
    const collider=colliders[index];
    if (!collider || typeof collider.id!=='string' || !collider.id || ids.has(collider.id)) {
      throw new TypeError('collider ids must be unique nonempty strings');
    }
    ids.add(collider.id);
    const box=aabb(collider.box?.min,collider.box?.max);
    const min=box.min.map(x=>x-halfSize), max=box.max.map(x=>x+halfSize);
    if (![...min,...max,...min.map((x,i)=>x-origin[i]),...max.map((x,i)=>x-origin[i])].every(Number.isFinite)) {
      throw new RangeError('collider extent overflow');
    }
    if (ignored.has(collider.id)) continue;
    const startedInside=origin.every((x,i)=>x>=min[i] && x<=max[i]);
    let near=0, far=1, normal=[0,0,0], missed=false;
    if (!startedInside) for (let i=0;i<3;i++) {
      if (displacement[i]===0) {
        if (origin[i]<min[i] || origin[i]>max[i]) {missed=true;break;}
        continue;
      }
      let entry=(min[i]-origin[i])/displacement[i], exit=(max[i]-origin[i])/displacement[i];
      if (entry>exit) [entry,exit]=[exit,entry];
      if (entry>near) {near=entry;normal=[0,0,0];normal[i]=displacement[i]>0?-1:1;}
      far=Math.min(far,exit);
      if (near>far) {missed=true;break;}
    }
    if (missed || near>1 || far<0) continue;
    if (!nearest || near<nearest.time || (near===nearest.time && collider.id<nearest.id)) {
      nearest={id:collider.id,index,time:near,distance:distance*near,
        point:add(origin,scale(displacement,near)),normal,startedInside};
    }
  }
  return nearest;
}

/** Direction may be unnormalized; maxDistance is a finite distance in metres. */
export function raycast(origin,direction,maxDistance,colliders,options) {
  direction=finiteVector(direction,3,'direction');
  const magnitude=length(direction);
  if (!Number.isFinite(magnitude) || magnitude===0 || !Number.isFinite(maxDistance) || maxDistance<0) {
    throw new RangeError('invalid ray direction or range');
  }
  return castSegment(origin,direction.map(x=>x/magnitude*maxDistance),colliders,options);
}
