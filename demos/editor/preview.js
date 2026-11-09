// SPDX-License-Identifier: Apache-2.0
// Minimal fixed-step "Play" mode. Does not mutate the editor scene.
// Y-axis gravity and axis-aligned static platform top faces only.
// Rotated static shapes are visual geometry, NOT physical colliders.
import {sceneWorld} from './model.js';
export const PREVIEW_DT=1/60;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function createPreview(scene){
  const world=sceneWorld(scene),bodies={};
  for(const e of world)if(e.visible&&e.body!=='static'){
    bodies[e.id]={position:[...e.position],vy:0,grounded:false};
  }
  return {tick:0,bodies};
}
export function stepPreview(scene,state,input={}){
  if(!state||!Number.isSafeInteger(state.tick)||state.tick<0||state.tick>=36000)
    throw new RangeError('invalid preview state');
  if(![-1,0,1].includes(input.x??0)||![-1,0,1].includes(input.z??0)||
    (input.jump!==undefined&&typeof input.jump!=='boolean'))
    throw new TypeError('invalid preview controls');
  const world=sceneWorld(scene);
  const floors=world.filter(e=>e.visible&&e.body==='static'&&e.parent===null&&e.rotationY%180===0);
  const bodies={};
  for(const e of world)if(e.visible&&e.body!=='static'){
    const old=state.bodies[e.id];
    if(!old)throw new TypeError('preview body missing');
    const speed=e.body==='player'?4:0;
    const moveX=(input.x??0)*speed*PREVIEW_DT,
      moveZ=(input.z??0)*speed*PREVIEW_DT;
    const position=[...old.position];
    const intersects=(pos,block)=>[0,1,2].every(i=>
      Math.abs(pos[i]-block.position[i])<(e.scale[i]+block.scale[i])/2-1e-9);
    const testMove=(axis,delta)=>{
      position[axis]=clamp(position[axis]+delta,-995,995);
      if(floors.some(f=>intersects(position,f)))position[axis]-=delta;
    };
    if(speed){testMove(0,moveX);testMove(2,moveZ);}
    let vy=old.vy,grounded=old.grounded;
    if(grounded&&input.jump&&e.body==='player'){vy=6.2;grounded=false;}
    if(!grounded)vy-=15*PREVIEW_DT;
    const before=position[1],next=before+vy*PREVIEW_DT;
    position[1]=next;
    if(vy<=0)for(const floor of floors){
      const top=floor.position[1]+floor.scale[1]/2,half=e.scale[1]/2;
      const beforeFeet=before-half,afterFeet=next-half;
      if(beforeFeet>=top-1e-8&&afterFeet<=top&&
        [0,2].every(i=>Math.abs(position[i]-floor.position[i])<
          (e.scale[i]+floor.scale[i])/2)){
        if(position[1]<top+half){position[1]=top+half;vy=0;grounded=true;}
      }
    }
    if(position[1]<-100){position[1]=e.position[1];vy=0;grounded=false;}
    bodies[e.id]={position,vy,grounded};
  }
  return {tick:state.tick+1,bodies};
}
