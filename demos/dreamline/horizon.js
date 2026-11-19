// SPDX-License-Identifier: Apache-2.0
import {starterRaceProject} from '../horizon-lab/race-project.js';
import {createRaceSession,raceDriverInput} from '../horizon-lab/race-model.js';
import {raceRig,raceCamera} from '../horizon-lab/race-view.js';
import {buildVehicleVisual,vehicleDraws} from '../../modules/scenic3d/index.js';
import {partitionRaceWorld,raceTileVisible} from '../horizon-lab/race-visibility.js';
import {createRaceRoadDetails} from '../horizon-lab/race-road-details.js';
import {FilmRaster} from './raster.js';
// Build the fixed-duration physical take once at setup. Every seek is an O(1) pose lookup.
export function physicalTake() {
  const project=starterRaceProject(),session=createRaceSession(project),poses=[];
  session.start();
  while(session.phase==='countdown') session.step({},1/60);
  for(let i=0;i<=600;i++){
    poses.push({player:session.player,rival:session.rival,progress:session.progress});
    if(i===600)break;
    for(let j=0;j<2;j++)session.step(raceDriverInput(session.road,session.player,project.vehicle,
      {speed:17,lateral:-2,rows:session.rows}),1/60);
  }
  return {project,world:session.world,checkpoints:session.checkpoints,poses};
}
export const poseIndex=localSample=>Math.min(600,Math.floor(localSample/1600));
export function horizonRenderer(canvas,take) {
  const raster=new FilmRaster(canvas),p=take.project;
  const visual=buildVehicleVisual(p.appearance.classId,{profile:p.scenery.profile,paint:p.appearance.paint});
  const details=createRaceRoadDetails(take.world.scenic.road,p.scenery.profile,p.scenery.environment);
  const batches=partitionRaceWorld(take.world.batches);
  const cars=vehicleDraws(visual);

  return {draw(localSample,reduced){
    const t=localSample/48000;
    const pose=take.poses[poseIndex(localSample)];
    // Directed crane movement samples the unbiased chase camera. The vehicle body,
    // orientation and individual wheel transforms all come from the physics take.
    const camera=raceCamera(pose.player,take.project.camera);
    const crane=reduced?0:Math.sin(Math.PI*t/20)**2;
    camera.position[0]+=crane*11;camera.position[1]+=crane*7;
    raster.begin(camera,p.camera.fov);
    for(const row of batches){
      if(row.visibilityBounds&&!raceTileVisible(row.visibilityBounds,camera,p.camera.fov,canvas.width/canvas.height))continue;
      raster.draw(row);
    }
    if(!reduced)for(const row of details.batches)raster.draw(row);
    for(const state of [pose.rival,pose.player]){
      const rig=raceRig(state,p.vehicle,visual.dimensions);
      for(const {part,material} of cars){
        const paint=state===pose.rival&&part.id==='body'?{...material,color:[.08,.72,.77]}:material;
        raster.draw(part,part.wheel===null?rig.body:rig.wheels[part.wheel],paint);
      }
    }
    raster.finish();
  },dispose(){}};

}
