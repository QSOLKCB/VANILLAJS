// SPDX-License-Identifier: Apache-2.0
// WebGL1 editor presentation. Derived data only; never mutates authored scenes.
import {boxMeshBatch} from '../../modules/geometry/index.js';
import {perspective,multiplyMatrices,normalize,cross,dot} from '../../modules/math/index.js';
import {sceneWorld} from './model.js';

const FOV=Math.PI/2.6;
export function cameraBasis(camera){
  const yaw=camera.yaw*Math.PI/180,pitch=camera.pitch*Math.PI/180;
  const radius=camera.distance;
  const back=[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),
    Math.cos(yaw)*Math.cos(pitch)];
  const eye=camera.target.map((x,i)=>x+back[i]*radius);
  const right=normalize(cross([0,1,0],back)),up=normalize(cross(back,right));
  return {eye,right,up,back};
}
export function cameraMatrix(camera,width,height){
  if(!(Number.isFinite(width)&&width>0&&Number.isFinite(height)&&height>0))
    throw new RangeError('invalid viewport dimensions');
  const {eye,right,up,back}=cameraBasis(camera);
  const view=new Float32Array([
    right[0],up[0],back[0],0,
    right[1],up[1],back[1],0,
    right[2],up[2],back[2],0,
    -dot(right,eye),-dot(up,eye),-dot(back,eye),1
  ]);
  return multiplyMatrices(perspective(FOV,width/height,.1,300),view);
}
export function cameraRay(camera,px,py,width,height){
  if(!Number.isFinite(px)||!Number.isFinite(py)||
    !Number.isFinite(width)||width<=0||!Number.isFinite(height)||height<=0)
    throw new RangeError('invalid screen ray');
  const {eye,right,up,back}=cameraBasis(camera);
  const x=(2*px/width-1)*Math.tan(FOV/2)*width/height;
  const y=(1-2*py/height)*Math.tan(FOV/2);
  return {origin:eye,dir:normalize(right.map((n,i)=>n*x+up[i]*y-back[i]))};
}
export function hitWorldBox(box,ray){
  const a=box.rotationY*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const dx=ray.origin[0]-box.position[0],dz=ray.origin[2]-box.position[2];
  const origin=[c*dx-s*dz,ray.origin[1]-box.position[1],s*dx+c*dz];
  const v=ray.dir,dir=[c*v[0]-s*v[2],v[1],s*v[0]+c*v[2]];
  let near=-Infinity,far=Infinity;
  for(let i=0;i<3;i++){
    const lo=-box.scale[i]*.5,hi=box.scale[i]*.5;
    if(Math.abs(dir[i])<1e-12){
      if(origin[i]<lo||origin[i]>hi)return null;
      continue;
    }
    let t1=(lo-origin[i])/dir[i],t2=(hi-origin[i])/dir[i];
    if(t1>t2)[t1,t2]=[t2,t1];
    near=Math.max(near,t1);far=Math.min(far,t2);
    if(near>far)return null;
  }
  return far>=0?Math.max(0,near):null;
}
export function pickObject(world,ray){
  let best=null;
  for(const box of world){
    if(!box.visible)continue;
    const t=hitWorldBox(box,ray);
    if(t!==null&&(!best||t<best.t||(t===best.t&&box.id<best.id)))
      best={id:box.id,t};
  }
  return best?.id??null;
}
export function createGridVertices(size=10){
  const data=[];
  const line=(x,y,z,X,Y,Z,r,g,b)=>{
    data.push(x,y,z,r,g,b,X,Y,Z,r,g,b);
  };
  for(let i=-size;i<=size;i++){
    const c=i===0?.25:.11;
    line(i,0,-size,i,0,size,c,c+.11,c+.15);
    line(-size,0,i,size,0,i,c,c+.11,c+.15);
  }
  line(-size,0,0,size,0,0,.83,.30,.35);
  line(0,0,-size,0,0,size,.30,.53,.91);
  return new Float32Array(data);
}
export function displayWorld(scene,preview=null){
  const world=sceneWorld(scene);
  if(!preview)return world;
  return world.map(entity=>{
    const body=preview.bodies[entity.id];
    return body?{...entity,position:[...body.position]}:entity;
  });
}
export function createSceneVertices(world,selected=null){
  const boxes=world.filter(e=>e.visible);
  const packed=boxMeshBatch(boxes.map(e=>({
    center:e.position,size:e.scale,
    color:e.id===selected?e.color.map(x=>Math.min(1,x*.65+.35)):e.color
  })));
  // Geometry layer provides exact unrotated Float32 upload bytes. Rotation
  // is an explicit editor extension applied once per dirty scene revision.
  const perBox=36*6;
  for(let j=0;j<boxes.length;j++){
    const box=boxes[j],a=box.rotationY*Math.PI/180,
      c=Math.cos(a),s=Math.sin(a),o=j*perBox;
    if(a===0)continue;
    for(let i=o;i<o+perBox;i+=6){
      const dx=packed[i]-box.position[0],dz=packed[i+2]-box.position[2];
      packed[i]=box.position[0]+c*dx+s*dz;
      packed[i+2]=box.position[2]-s*dx+c*dz;
    }
  }
  return packed;
}
