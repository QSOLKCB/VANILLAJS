// SPDX-License-Identifier: Apache-2.0
// Race-owned guardrails: never modify vehicle3d or ScenicRoad's physical surface.
import {ScenicRoad} from '../../modules/scenic3d/index.js';
const THICKNESS=.12,RANGE=10,NATIVE_LIMIT=64;
/** Author rails from the exact road-edge stations used to draw bridge guardrails. */
export function bridgeGuardrails(road){
  if(!(road instanceof ScenicRoad))throw TypeError('ScenicRoad required');
  const rows=road.stations(),result=[];
  for(let i=0;i<rows.length-1;i++){
    const a=rows[i],b=rows[i+1];if(a.structure!=='bridge')continue;
    for(const side of ['left','right']){
      const p=a[side],q=b[side];
      result.push({id:'bridge-rail-'+i+'-'+side,
        min:[Math.min(p[0],q[0])-THICKNESS,Math.min(p[1],q[1])+.25,Math.min(p[2],q[2])-THICKNESS],
        max:[Math.max(p[0],q[0])+THICKNESS,Math.max(p[1],q[1])+1.30,Math.max(p[2],q[2])+THICKNESS]});
    }
  }
  return result;
}
/** Bind a bounded, nearest-first subset of rails to one vehicle's next step.
 * Prevents >64-AABB overload on long courses. Explicit vehicle3d sweeps,
 * no ghost lane motion, no mutation of canonical surface geometry or state. */
export function bridgePhysics(physics,rails,position){
  if(!physics||typeof physics.sampleSurface!=='function'||!Array.isArray(physics.barriers)||
     !Array.isArray(rails)||!Array.isArray(position)||position.length!==3||
     !position.every(Number.isFinite)||physics.barriers.length>NATIVE_LIMIT)
    throw TypeError('Valid physics, guardrails and position required');
  const near=[];
  for(let i=0;i<rails.length;i++){
    const box=rails[i],dx=Math.max(box.min[0]-position[0],0,position[0]-box.max[0]),
          dz=Math.max(box.min[2]-position[2],0,position[2]-box.max[2]),distance=Math.hypot(dx,dz);
    if(distance<=RANGE)near.push({box,i,distance});
  }
  near.sort((a,b)=>a.distance-b.distance||a.i-b.i);
  return {sampleSurface:physics.sampleSurface,barriers:physics.barriers.concat(
    near.slice(0,NATIVE_LIMIT-physics.barriers.length).map(x=>x.box))};
}
