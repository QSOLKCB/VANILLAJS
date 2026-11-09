// SPDX-License-Identifier: Apache-2.0
// Component Forge v1.5 editor gizmos: real projected XYZ axis handles,
// atomic local/world transforms, bounded grid/angle/scale snapping.
// No DOM or persistent GPU resources in this module.
import {sceneWorld,updateEntity} from './model.js';
import {cameraMatrix} from './viewport.js';
const AXES=['x','y','z'],COLORS=[[.96,.32,.34],[.35,.95,.54],[.34,.55,1]];
const basis=[[1,0,0],[0,1,0],[0,0,1]];
function axisIndex(axis){
  const i=AXES.indexOf(axis);
  if(i<0)throw new TypeError('unknown gizmo axis');
  return i;
}
function rotateY(v,deg){
  const t=deg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
  return [c*v[0]+s*v[2],v[1],-s*v[0]+c*v[2]];
}
function checked(scene,id){
  const entity=scene.objects.find(e=>e.id===id);
  if(!entity)throw new TypeError('unknown gizmo entity');
  const world=sceneWorld(scene).find(e=>e.id===id);
  const parent=entity.parent===null?null:sceneWorld(scene).find(e=>e.id===entity.parent);
  return {entity,world,parent};
}
export function axisDirection(world,axis,space='world'){
  const i=axisIndex(axis);
  if(!['world','local'].includes(space))throw new TypeError('unknown transform space');
  return space==='local'?rotateY(basis[i],world.rotationY):[...basis[i]];
}
export function gizmoLines(world,selected,space='world',tool='move'){
  const object=world.find(e=>e.id===selected);
  if(!object)return new Float32Array();
  const data=[],size=2.15;
  for(let i=0;i<3;i++){
    if(tool==='rotate'&&i!==1)continue; // only yaw is supported
    const unit=axisDirection(object,AXES[i],space),color=COLORS[i];
    const from=object.position,to=from.map((v,k)=>v+unit[k]*size);
    data.push(...from,...color,...to,...color);
    // Short tip bars ensure handles remain recognizable against the grid.
    const end1=to.map((v,k)=>v+((k+1)%3===i?0:.11));
    data.push(...end1,...color,...to,...color);
  }
  return new Float32Array(data);
}
export function projectPoint(camera,point,width,height){
  if(!(Number.isFinite(width)&&width>0&&Number.isFinite(height)&&height>0))
    throw new RangeError('invalid projection viewport');
  const m=cameraMatrix(camera,width,height),p=[...point,1];
  const clip=Array.from({length:4},(_,i)=>m[i]*p[0]+m[4+i]*p[1]+m[8+i]*p[2]+m[12+i]);
  if(clip[3]<=0||!clip.every(Number.isFinite))return null;
  return {x:(clip[0]/clip[3]+1)*width*.5,
    y:(1-clip[1]/clip[3])*height*.5,
    depth:clip[3]};
}
function distSegment(px,py,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;
  if(d<16)return Infinity;
  const u=((px-a.x)*dx+(py-a.y)*dy)/d;
  if(u<.18||u>1.22)return Infinity;
  const t=Math.max(0,Math.min(1,u));
  return Math.hypot(px-a.x-dx*t,py-a.y-dy*t);
}
export function pickGizmo(camera,object,px,py,width,height,space='world',tool='move'){
  if(!object)return null;
  const from=projectPoint(camera,object.position,width,height);
  if(!from)return null;
  let nearest=null;
  for(const axis of AXES){
    if(tool==='rotate'&&axis!=='y')continue;
    const dir=axisDirection(object,axis,space);
    const end=projectPoint(camera,object.position.map((v,i)=>v+dir[i]*2.15),width,height);
    if(!end)continue;
    const distance=distSegment(px,py,from,end);
    if(distance<=11&&(!nearest||distance<nearest.distance))
      nearest={axis,distance};
  }
  return nearest?.axis??null;
}
export function axisDragAmount(camera,object,axis,start,end,width,height,space='world'){
  const origin=projectPoint(camera,object.position,width,height),
    unit=axisDirection(object,axis,space),
    target=projectPoint(camera,object.position.map((v,i)=>v+unit[i]*2.15),width,height);
  if(!origin||!target)return 0;
  const dx=target.x-origin.x,dy=target.y-origin.y,len=Math.hypot(dx,dy);
  if(len<4)return 0;
  return ((end.x-start.x)*dx+(end.y-start.y)*dy)/(len*len)*2.15;
}
const snap=(value,step,enabled)=>enabled?Math.round(value/step)*step:value;
export function applyGizmo(scene,id,tool,axis,amount,{space='world',snapping=false}={}){
  if(!['move','rotate','scale'].includes(tool))throw new TypeError('invalid gizmo tool');
  if(typeof amount!=='number'||!Number.isFinite(amount)||Math.abs(amount)>10000)
    throw new RangeError('invalid gizmo movement');
  if(typeof snapping!=='boolean')throw new TypeError('invalid snap state');
  const i=axisIndex(axis),{entity,world,parent}=checked(scene,id);
  if(!['world','local'].includes(space))throw new TypeError('invalid transform space');
  if(tool==='rotate'){
    if(axis!=='y')throw new TypeError('yaw-only editor: rotation uses Y axis');
    return updateEntity(scene,id,{rotationY:entity.rotationY+snap(amount,15,snapping)});
  }
  if(tool==='scale'){
    const size=[...entity.scale];
    size[i]=Math.round((size[i]+snap(amount,.1,snapping))*1e6)/1e6;
    return updateEntity(scene,id,{scale:size});
  }
  // Convert a WORLD-space displacement into the selected object's PARENT
  // space, respecting its orientation and (possibly non-uniform) scale.
  // Local axis motion uses the complete inherited object yaw.
  const worldAxis=axisDirection(world,axis,space),distance=snap(amount,.25,snapping);
  let offset=worldAxis.map(x=>x*distance);
  if(parent){
    offset=rotateY(offset,-parent.rotationY).map((x,k)=>x/parent.scale[k]);
  }
  const position=entity.position.map((v,k)=>Math.round((v+offset[k])*1e6)/1e6);
  return updateEntity(scene,id,{position});
}
