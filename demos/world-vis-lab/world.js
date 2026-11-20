// SPDX-License-Identifier: Apache-2.0
// WORLD-VIS-001: reuses the ORIGINAL HORIZON scenic static triangle sources.
// This adapter is deliberately separate from race physics and official labs.
import {createCapeAsterScenery} from '../horizon-lab/scenery.js';
import {buildScenicWorld} from '../../modules/scenic3d/index.js';
import {partitionRaceWorld} from '../horizon-lab/race-visibility.js';
import {createRetainedWorld} from '../../modules/world-vis/index.js';
import {quatMultiply} from '../../modules/math/index.js';

export function cameraOrientation(position,target){
  const d=target.map((x,i)=>x-position[i]),n=Math.hypot(...d);
  if(!(n>1e-9))throw RangeError('camera target must differ from origin');
  const yaw=Math.atan2(-d[0],-d[2]),
    pitch=Math.asin(Math.max(-1,Math.min(1,d[1]/n)));
  return quatMultiply([0,Math.sin(yaw/2),0,Math.cos(yaw/2)],
    [Math.sin(pitch/2),0,0,Math.cos(pitch/2)]);
}
export const WORLD_CAMERAS=Object.freeze({
  overlook:Object.freeze({label:'01 / Coast Overlook',
    position:Object.freeze([110,110,-185]),target:Object.freeze([0,18,-230])}),
  road:Object.freeze({label:'02 / Roadside',
    position:Object.freeze([-8,9,12]),target:Object.freeze([-28,14,-110])}),
  ridge:Object.freeze({label:'03 / Ridge',
    position:Object.freeze([-120,85,-360]),target:Object.freeze([0,22,-350])})
});
export function viewCamera(id,aspect){
  const preset=WORLD_CAMERAS[id];
  if(!preset)throw RangeError('unknown camera');
  return {position:[...preset.position],orientation:cameraOrientation(preset.position,preset.target),
    fov:.85,aspect,near:.1,far:2400};
}
export function createWorldVisStudy(){
  // Create an independent low-detail recipe; never mutate a validated
  // HORIZON project or its world/suspension source.
  const project={...createCapeAsterScenery(),profile:'low'};
  // Use the actual upstream Scenic3D mesh and the existing HORIZON-009 tile
  // partitioner. Physics and the scenic project are not modified or shadowed.
  const scenic=buildScenicWorld(project);
  const source=scenic.batches,tiles=partitionRaceWorld(source,3);
  const world=createRetainedWorld(tiles.map(row=>({
    id:row.id,vertices:row.vertices,material:row.material
  })));
  const fixedSample=scenic.road.sample(40);
  return {world,source,tiles,physicsSource:scenic.road,
    sourceStats:scenic.stats,fixedSample};
}
