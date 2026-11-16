// SPDX-License-Identifier: Apache-2.0
// Original authored world and race rules. Neither is a public engine contract.
import {SCENIC_FORMAT,validateScenery} from '../../modules/scenic3d/index.js';
export function createRaceScenery(){
  const xyz=[[0,4,0],[0,4,-45],[8,7,-90],[24,12,-140],[32,17,-190],[20,20,-240],[-1,18,-290],[-17,12,-340],[-10,8,-390],[8,8,-440],[20,10,-490]];
  const banks=[0,0,-.035,-.055,0,.06,.055,0,-.045,-.025,0];
  return validateScenery({format:SCENIC_FORMAT,version:1,name:'Cape Aster — Sunward Run',seed:7337,profile:'high',environment:'coast',road:xyz.map(([x,y,z],i)=>({id:'sunward-'+i,x,y,z,width:16,bank:banks[i],structure:i===3||i===4?'bridge':i===7?'tunnel':'ground',surface:'asphalt'}))});
}
const sub=(a,b)=>a.map((n,i)=>n-b[i]);
const dot=(a,b)=>a.reduce((s,n,i)=>s+n*b[i],0);
/** Nearest authored centreline point; diagnostic/controller guidance, never motion. */
export function locateOnRoad(road,position,rows=road.stations()){
  let best=null;
  for(let i=0;i<rows.length-1;i++){
    const a=rows[i],b=rows[i+1],dx=b.center[0]-a.center[0],dz=b.center[2]-a.center[2],t=Math.max(0,Math.min(1,((position[0]-a.center[0])*dx+(position[2]-a.center[2])*dz)/(dx*dx+dz*dz))),center=a.center.map((n,k)=>n+(b.center[k]-n)*t),delta=sub(position,center),distance2=delta[0]**2+delta[2]**2;
    if(!best||distance2<best.distance2){const length=Math.hypot(dx,dz),right=[-dz/length,0,dx/length];best={distance:a.distance+(b.distance-a.distance)*t,lateral:dot(delta,right),height:delta[1],width:a.width+(b.width-a.width)*t,distance2,center};}
  }
  return best;
}
/** Diagnose support relative to the actual banked face, not centreline altitude. */
export function raceRoadStatus(road,position,rows=road.stations()){
  const location=locateOnRoad(road,position,rows),surface=road.sampleAt(position[0],position[2],{maxY:Math.min(2000,position[1]+.3)}),height=surface?dot(sub(position,surface.position),surface.normal):null;
  return {...location,height,offRoad:!surface||height<-.3||height>3};
}
export function createRaceCheckpoints(road,count=8){
  const rows=road.stations(),start=12,finish=road.length-12;
  return Array.from({length:count},(_,i)=>{
    const distance=start+(finish-start)*(i+1)/count,p=road.sample(distance),before=road.sample(Math.max(0,distance-.5)),after=road.sample(Math.min(road.length,distance+.5)),delta=sub(after.position,before.position),length=Math.hypot(delta[0],delta[2]),direction=[delta[0]/length,0,delta[2]/length],right=[-direction[2],0,direction[0]],location=locateOnRoad(road,p.position,rows);
    return {id:i===count-1?'finish':'checkpoint-'+(i+1),index:i,distance,position:p.position,direction,right,normal:p.normal,halfWidth:location.width/2-.7,altitudeMin:-.3,altitudeMax:2.8,finish:i===count-1};
  });
}
/** A bounded forward swept COM crossing of the actual road gate. */
export function crossesRaceCheckpoint(gate,before,after,maxTravel=2){
  if(![before,after].every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)))throw TypeError('Checkpoint positions must be finite xyz');
  if(typeof maxTravel!=='number'||!Number.isFinite(maxTravel)||maxTravel<=0||maxTravel>4)throw RangeError('Checkpoint sweep bound');
  const movement=sub(after,before);if(Math.hypot(...movement)>maxTravel+1e-8)return false;
  const a=dot(sub(before,gate.position),gate.direction),b=dot(sub(after,gate.position),gate.direction);if(a>=0||b<0||b-a<1e-8)return false;
  const t=-a/(b-a),point=before.map((n,i)=>n+movement[i]*t),relative=sub(point,gate.position),lateral=dot(relative,gate.right),altitude=dot(relative,gate.normal);
  return Math.abs(lateral)<=gate.halfWidth&&altitude>=gate.altitudeMin&&altitude<=gate.altitudeMax;
}
