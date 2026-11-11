// SPDX-License-Identifier: Apache-2.0
// WebGL1 editor presentation. Derived data only; never mutates authored scenes.
import {boxMeshBatch} from '../../modules/geometry/index.js';
import {perspective,multiplyMatrices,normalize,cross,dot} from '../../modules/math/index.js';
import {sceneWorld} from './model.js';
import {validateAssetLibrary} from './asset-foundry.js';

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
  // Framing can legitimately move beyond the old 300 m far plane. Scale the
  // clipping range with orbit distance while keeping small selections usable.
  const near=Math.max(.001,camera.distance/1000),
    far=Math.max(300,camera.distance*4);
  return multiplyMatrices(perspective(FOV,width/height,near,far),view);
}
// Presentation-only framing, using world transforms and actual imported mesh
// extents. Null selection frames visible objects; a selection includes its
// visible descendants. A hidden selection can still be located by its bounds.
export function frameCamera(camera,world,selected=null,width=1,height=1,library=null){
  if(!Array.isArray(world))throw new TypeError('world entities must be an array');
  if(!(Number.isFinite(width)&&width>0&&Number.isFinite(height)&&height>0))
    throw new RangeError('invalid viewport dimensions');
  const ids=new Set(selected===null?world.map(e=>e.id):[selected]);
  if(selected!==null){
    let changed=true;
    while(changed){changed=false;for(const e of world)if(ids.has(e.parent)&&!ids.has(e.id)){
      ids.add(e.id);changed=true;
    }}
  }
  const targets=world.filter(e=>ids.has(e.id)&&(e.visible||e.id===selected))
    .map(e=>e.visible?e:{...e,visible:true});
  if(!targets.length)return {...camera,target:[...camera.target]};
  const {boxes,models}=prepare(targets,library,false),
    lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  const include=(e,x,y,z,c,s)=>{
    const dx=x*e.scale[0],dz=z*e.scale[2],
      point=[e.position[0]+c*dx+s*dz,e.position[1]+y*e.scale[1],
        e.position[2]-s*dx+c*dz];
    for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],point[i]);hi[i]=Math.max(hi[i],point[i]);}
  };
  for(const e of boxes){
    const angle=e.rotationY*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
    for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5])include(e,x,y,z,c,s);
  }
  for(const {e,mesh} of models){
    const angle=e.rotationY*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
    for(let i=0;i<mesh.vertices.length;i+=5)
      include(e,mesh.vertices[i],mesh.vertices[i+1],mesh.vertices[i+2],c,s);
  }
  const target=lo.map((x,i)=>(x+hi[i])/2),
    radius=Math.max(.025,Math.hypot(...hi.map((x,i)=>(x-lo[i])/2))),
    halfAngle=Math.min(FOV/2,Math.atan(Math.tan(FOV/2)*width/height)),
    distance=radius/Math.sin(halfAngle)*1.15;
  return {...camera,target,distance};
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
  // Component Forge: an entity without MeshRenderer remains available to
  // physics, triggers and authored metadata, but is not drawn or pickable.
  const world=sceneWorld(scene).map(e=>e.components?
    {...e,visible:e.visible&&e.components.mesh.enabled}:e);
  if(!preview)return world;
  const byId=new Map(world.map(e=>[e.id,e]));
  return world.map(entity=>{
    const body=preview.bodies[entity.id];
    if(body)return {...entity,position:[...body.position]};
    let ancestor=entity;
    while(ancestor.parent!==null){
      ancestor=byId.get(ancestor.parent);
      const moving=preview.bodies[ancestor.id];
      if(moving)return {...entity,position:entity.position.map((x,i)=>
        x+moving.position[i]-ancestor.position[i])};
    }
    return entity;
  });
}
// Static resource model, not a measure of total process RSS or GPU driver VRAM.
export const MAX_EDITOR_GEOMETRY_BYTES=128*36*6*4;
export const MAX_FOUNDRY_GEOMETRY_BYTES=2*1024*1024;
const tint=(color,texture,u,v)=>{
  if(!texture)return color;
  const x=Math.min(texture.width-1,Math.max(0,Math.round(u*(texture.width-1)))),
    y=Math.min(texture.height-1,Math.max(0,Math.round((1-v)*(texture.height-1))));
  return color.map((value,i)=>value*texture.pixels[(y*texture.width+x)*4+i]/255);
};
function prepare(world,library,decodeTextures=true){
  const assets=library?validateAssetLibrary(library):null,
    map=new Map(assets?.assets.map(a=>[a.id,a])??[]),
    placement=new Map(assets?.placements.map(p=>[p.entityId,p])??[]);
  // Cache only within this preparation: callers may mutate/re-import a library
  // between frames, so no stale pixels or cross-project retained cache exists.
  const boxes=[],models=[],textures=decodeTextures&&library?new Map():null;
  for(const e of world)if(e.visible){
    const p=placement.get(e.id),mesh=p?.meshId?map.get(p.meshId):null;
    if(mesh&&mesh.kind==='mesh'){
      const mat=p.materialId?map.get(p.materialId):null,
        tex=mat?.textureId?map.get(mat.textureId):null;
      if(tex&&decodeTextures&&!textures.has(tex.id))textures.set(tex.id,
        {width:tex.width,height:tex.height,
          pixels:Uint8Array.from(atob(tex.rgba),x=>x.charCodeAt(0))});
      const texture=tex&&decodeTextures?textures.get(tex.id):null;
      models.push({e,mesh,material:mat,texture});
    }else{
      const material=p?.materialId?map.get(p.materialId):null;
      boxes.push(material?.kind==='material'?{...e,color:material.color}:e);
    }
  }
  return {boxes,models};
}
function budgetPrepared({boxes,models},hasLibrary){
  const visible=boxes.length+models.length;
  if(visible>128)throw new RangeError('editor geometry budget exceeded');
  const vertices=boxes.length*36+models.reduce((n,o)=>n+o.mesh.vertices.length/5,0),
    vertexBytes=vertices*6*4,limit=hasLibrary?MAX_FOUNDRY_GEOMETRY_BYTES:MAX_EDITOR_GEOMETRY_BYTES;
  if(vertexBytes>limit)throw new RangeError('mesh upload exceeds retained geometry budget');
  return Object.freeze({visibleBoxes:visible,vertexBytes,
    estimatedRetainedBytes:vertexBytes*3,geometryBudgetBytes:limit});
}
export function sceneResourceBudget(world,library=null){
  if(!Array.isArray(world))throw new TypeError('world entities must be an array');
  return budgetPrepared(prepare(world,library,false),Boolean(library));
}
export function createSceneVertices(world,selected=null,library=null){
  if(!Array.isArray(world))throw new TypeError('world entities must be an array');
  const {boxes,models}=prepare(world,library);
  budgetPrepared({boxes,models},Boolean(library));
  const packed=boxMeshBatch(boxes.map(e=>({
    center:e.position,size:e.scale,
    color:e.id===selected?e.color.map(x=>Math.min(1,x*.65+.35)):e.color
  })));
  // Geometry layer provides exact unrotated Float32 box bytes.
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
  if(!models.length)return packed;
  const output=new Float32Array(packed.length+
    models.reduce((n,o)=>n+o.mesh.vertices.length/5*6,0));
  output.set(packed);let offset=packed.length;
  for(const {e,mesh,material,texture} of models){
    const color=material?.color??e.color,a=e.rotationY*Math.PI/180,
      c=Math.cos(a),s=Math.sin(a),values=mesh.vertices;
    for(let i=0;i<values.length;i+=5){
      const dx=values[i]*e.scale[0],y=values[i+1]*e.scale[1],
        dz=values[i+2]*e.scale[2];
      const rgb=tint(color,texture,values[i+3],values[i+4])
        .map(x=>e.id===selected?Math.min(1,x*.65+.35):x);
      output[offset++]=e.position[0]+c*dx+s*dz;
      output[offset++]=e.position[1]+y;
      output[offset++]=e.position[2]-s*dx+c*dz;
      output[offset++]=rgb[0];
      output[offset++]=rgb[1];
      output[offset++]=rgb[2];
    }
  }
  return output;
}
