// SPDX-License-Identifier: Apache-2.0
import {ScenicRoad} from '../../modules/scenic3d/index.js';
import {add,cross,dot,length,normalize,rotate,scale,subtract} from '../../modules/math/index.js';
import {moveAndSlideAABB} from '../../modules/collision/index.js';

// Bound each visible rail strip in its own frame. A world-axis bounding box
// is useful for rejecting distant cars but fills part of a diagonal lane.
export function bridgeGuardrails(road){
  if(!(road instanceof ScenicRoad))throw TypeError('ScenicRoad required');
  const rows=road.stations(),rails=[];
  for(let i=0;i<rows.length-1;i++){
    if(rows[i].structure!=='bridge')continue;
    for(const side of ['left','right']){
      const a=rows[i][side],b=rows[i+1][side],edge=subtract(b,a);
      const along=Math.hypot(edge[0],edge[2])>1e-9?normalize(edge):[0,0,-1];
      const across=normalize(cross(along,[0,1,0])),up=cross(across,along);
      const axes=[across,up,along];
      const addBox=(id,center,half,frame=axes)=>{
        const bounds=half.map((_,k)=>frame.reduce((sum,axis,j)=>sum+Math.abs(axis[k])*half[j],0));
        rails.push({id,center,axes:frame,box:{min:scale(half,-1),max:half},
          min:subtract(center,bounds),max:add(center,bounds)});
      };
      // Scenic3d renders two open horizontal bars (.42m and .92m high),
      // not a solid ~1m wall. The old continuous collision slab blocked
      // empty space beneath and between those visible bars.
      for(const [band,height] of [['low',.42],['high',.92]])
        addBox('bridge-rail-'+i+'-'+side+'-'+band,
          add(scale(add(a,b),.5),[0,height,0]),[.05,.045,length(edge)/2+.075]);
      // Only alternate authored stations contain a visible vertical post;
      // match the world-axis post mesh rather than filling every gap.
      if(i%2===0)addBox('bridge-post-'+i+'-'+side,add(a,[0,.44,0]),
        [.06,.475,.06],[[1,0,0],[0,1,0],[0,0,1]]);
    }
  }
  return rails;
}

function halfAxes(chassis,orientation){
  return [[chassis.width/2,0,0],[0,chassis.height/2,0],[0,0,chassis.length/2]]
    .map(axis=>rotate(orientation,axis));
}
const extent=(body,axis)=>body.reduce((sum,v)=>sum+Math.abs(dot(v,axis)),0);

// The native vehicle step owns suspension, propulsion and workshop barriers.
// Sweep its proposed displacement in the local frame of nearby bridge strips.
// The moving box conservatively encloses the chassis at both tick endpoints.
export function stepBridgeVehicle(car,before,input,world,rails,dt){
  const next=car.step(before,input,world,dt),chassis=car.recipe.chassis;
  const radius=Math.hypot(chassis.width,chassis.height,chassis.length)/2;
  let startBody,endBody;
  for(const rail of rails){
    if(rail.min.some((min,k)=>Math.max(before.position[k],next.position[k])+radius<min ||
      Math.min(before.position[k],next.position[k])-radius>rail.max[k]))continue;
    startBody??=halfAxes(chassis,before.orientation);
    endBody??=halfAxes(chassis,next.orientation);
    const start=subtract(before.position,rail.center),travel=subtract(next.position,before.position);
    const local=rail.axes.map(axis=>dot(start,axis)),delta=rail.axes.map(axis=>dot(travel,axis));
    const half=rail.axes.map(axis=>Math.max(extent(startBody,axis),extent(endBody,axis)));
    const moved=moveAndSlideAABB(local,delta,1,half,[rail.box]);
    if(!moved.contacts.length)continue;
    const correction=subtract(moved.position,add(local,delta));
    const offset=rail.axes.reduce((sum,axis,j)=>add(sum,scale(axis,correction[j])),[0,0,0]);
    next.position=add(next.position,offset);
    for(const wheel of next.wheels){
      wheel.position=add(wheel.position,offset);
      wheel.contactPoint=add(wheel.contactPoint,offset);
    }
    for(const {normal} of moved.contacts){
      const j=normal.findIndex(component=>component!==0),axis=scale(rail.axes[j],normal[j]);
      next.velocity=subtract(next.velocity,scale(axis,Math.min(0,dot(next.velocity,axis))));
    }
    if(next.contacts.length<64)next.contacts.push(rail.id);
  }
  return next;
}
