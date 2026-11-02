// SPDX-License-Identifier: Apache-2.0
import {finiteVector, add, scale, dot} from '../math/index.js';
const SKIN = 1e-6;
export function aabb(min, max) {
  min = finiteVector(min,3,'min'); max = finiteVector(max,3,'max');
  if (min.some((x,i) => x >= max[i])) throw new RangeError('AABB must have positive volume');
  return {min, max};
}
// Sweeps the CENTER of an axis-aligned cube against a static AABB. Not a sphere sweep.
export function sweepBox(origin, displacement, halfSize, box) {
  const min = box.min.map(x=>x-halfSize), max = box.max.map(x=>x+halfSize);
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
function penetration(position, halfSize, box) {
  const min = box.min.map(x=>x-halfSize), max = box.max.map(x=>x+halfSize);
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
  const contacts=[];
  // Resolve spawn overlap before sweeping. Contradictory/enclosing solids have no valid solution.
  for (let pass=0;pass<maxSlides;pass++) {
    let moved=false;
    for (let index=0;index<boxes.length;index++) {
      const hit=penetration(position,halfSize,boxes[index]);
      if (hit) {
        position=add(position,scale(hit.normal,hit.distance+SKIN));
        velocity=slide(velocity,hit.normal); contacts.push({index,normal:hit.normal}); moved=true;
      }
    }
    if (!moved) break;
  }
  if (boxes.some(box=>penetration(position,halfSize,box))) {
    return {position, velocity:[0,0,0], contacts, truncated:true};
  }
  let remaining=dt;
  for (let pass=0;pass<maxSlides && remaining>1e-10;pass++) {
    const delta=scale(velocity,remaining);
    let nearest=null;
    for (let index=0;index<boxes.length;index++) {
      const hit=sweepBox(position,delta,halfSize,boxes[index]);
      if (hit && (!nearest || hit.time<nearest.time)) nearest={...hit,index};
    }
    if (!nearest) { position=add(position,delta); remaining=0; break; }
    position=add(add(position,scale(delta,nearest.time)),scale(nearest.normal,SKIN));
    velocity=slide(velocity,nearest.normal);
    remaining*=1-nearest.time; contacts.push({index:nearest.index,normal:nearest.normal});
  }
  return {position,velocity,contacts,truncated:remaining>1e-10};
}
