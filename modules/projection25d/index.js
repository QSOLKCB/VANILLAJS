// SPDX-License-Identifier: Apache-2.0
// PROJECTION25D-001 — presentation-only X/Z footprints with +Y height.
// No simulation, collision, game rule, DOM, device or render clock is owned here.
export const PROJECTION25D_FORMAT='qsol.vanillajs.projection25d.v1';
export const PROJECTION25D_MAX_BOXES=128;
const CAMERA_KEYS=['viewport','origin','pixelsPerUnit','heightRise','heightShear','shadowDirection'];
const BOX_KEYS=['id','x','z','width','depth','height'];
const accepted=new WeakSet();
function object(v,keys,label){
  if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw TypeError(label+' requires plain data');
  const descriptors=Object.getOwnPropertyDescriptors(v),own=Reflect.ownKeys(descriptors);
  if(own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k)||!Object.hasOwn(descriptors[k],'value')||!descriptors[k].enumerable))throw TypeError(label+' fields must be exact plain data');
}
function number(v,min,max,label){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw RangeError(label+' out of bounds');return v;}
function pair(v,lo,hi,label,integer=false){
  if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length!==2||Reflect.ownKeys(v).length!==3||
     [0,1].some(i=>!Object.hasOwn(Object.getOwnPropertyDescriptor(v,i),'value')))throw TypeError(label+' must be a dense plain pair');
  return Object.freeze(v.map((n,i)=>{number(n,lo,hi,label+'['+i+']');if(integer&&!Number.isSafeInteger(n))throw RangeError(label+' requires integers');return n;}));
}
function coordinates(v){
  if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length!==3||Reflect.ownKeys(v).length!==4||
    [0,1,2].some(i=>!Object.hasOwn(Object.getOwnPropertyDescriptor(v,i),'value')))throw TypeError('point must be a dense XYZ triple');
  return v.map((n,i)=>number(n,-10000,10000,'point '+i));
}
function box(v){
  object(v,BOX_KEYS,'box');
  if(typeof v.id!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(v.id))throw TypeError('box id invalid');
  return Object.freeze({id:v.id,x:number(v.x,-8192,8192,'x'),z:number(v.z,-8192,8192,'z'),
    width:number(v.width,.01,512,'width'),depth:number(v.depth,.01,512,'depth'),height:number(v.height,0,256,'height')});
}
/** Own and freeze a finite orthographic/oblique presentation camera. */
export function createProjection25D(options){
  object(options,CAMERA_KEYS,'camera');
  const camera=Object.freeze({format:PROJECTION25D_FORMAT,version:1,
    viewport:pair(options.viewport,1,8192,'viewport',true),origin:pair(options.origin,-8192,8192,'origin'),
    pixelsPerUnit:number(options.pixelsPerUnit,.01,256,'pixelsPerUnit'),
    heightRise:number(options.heightRise,0,2,'heightRise'),
    heightShear:number(options.heightShear,-2,2,'heightShear'),
    shadowDirection:pair(options.shadowDirection,-2,2,'shadowDirection')});
  accepted.add(camera);return camera;
}
function camera(v){if(!accepted.has(v))throw TypeError('createProjection25D camera required');return v;}
/** Projection is visual only: ground +X is right; +Z is down; +Y is raised. */
export function projectPoint25D(projection,point){
  camera(projection);const [x,y,z]=coordinates(point),c=projection,s=c.pixelsPerUnit;
  return Object.freeze([
    c.viewport[0]/2+((x-c.origin[0])-y*c.heightShear)*s,
    c.viewport[1]/2+((z-c.origin[1])-y*c.heightRise)*s
  ]);
}
/** Inverse only on the authoritative Y=0 ground plane. */
export function unprojectGround25D(projection,screen){
  camera(projection);const [x,y]=pair(screen,-1e9,1e9,'screen');
  return Object.freeze([cround(projection.origin[0]+(x-projection.viewport[0]/2)/projection.pixelsPerUnit),
    cround(projection.origin[1]+(y-projection.viewport[1]/2)/projection.pixelsPerUnit)]);
}
const cround=v=>v===0?0:v;
const polygon=points=>Object.freeze(points.map(p=>Object.freeze([...p])));
/** A separately owned visual extrusion. Original collision X/Z footprint is unchanged. */
export function extrudeRect25D(projection,rect){
  camera(projection);const b=box(rect),{x,z,width:w,depth:d,height:h}=b;
  const corners=[[x,z],[x+w,z],[x+w,z+d],[x,z+d]];
  const ground=corners.map(([px,pz])=>projectPoint25D(projection,[px,0,pz]));
  const top=corners.map(([px,pz])=>projectPoint25D(projection,[px,h,pz]));
  const [sx,sz]=projection.shadowDirection;
  const shadow=corners.map(([px,pz])=>projectPoint25D(projection,[px+h*sx,0,pz+h*sz]));
  const sideIndex=projection.heightShear>=0?[1,2]:[3,0];
  const sideX=polygon([ground[sideIndex[0]],ground[sideIndex[1]],top[sideIndex[1]],top[sideIndex[0]]]);
  const sideZ=polygon([ground[3],ground[2],top[2],top[3]]);
  return Object.freeze({id:b.id,footprint:Object.freeze([x,z,w,d]),height:h,
    depthKey:z+d,shadow:polygon(shadow),sideX,sideZ,roof:polygon(top)});
}
/** Bounded deterministic painter order; not a general intersecting-mesh z-buffer. */
export function projectScene25D(projection,rects){
  camera(projection);
  if(!Array.isArray(rects)||Object.getPrototypeOf(rects)!==Array.prototype||rects.length>PROJECTION25D_MAX_BOXES||
    Reflect.ownKeys(rects).length!==rects.length+1)throw RangeError('scene must be a bounded dense array');
  const seen=new Set(),solids=[];
  for(let i=0;i<rects.length;i++){
    if(!Object.hasOwn(Object.getOwnPropertyDescriptor(rects,i),'value'))throw TypeError('scene contains accessor or hole');
    const item=extrudeRect25D(projection,rects[i]);
    if(seen.has(item.id))throw TypeError('duplicate box id');seen.add(item.id);solids.push(item);
  }
  solids.sort((a,b)=>a.depthKey-b.depthKey||(a.footprint[0]+a.footprint[2])-(b.footprint[0]+b.footprint[2])||
    (a.id<b.id?-1:a.id>b.id?1:0));
  return Object.freeze({shadows:Object.freeze(solids.map(b=>Object.freeze({id:b.id,points:b.shadow}))),
    solids:Object.freeze(solids)});
}
