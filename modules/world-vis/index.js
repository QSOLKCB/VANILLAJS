// SPDX-License-Identifier: Apache-2.0
// WORLD-VIS-001 — optional, presentation-only retained static world.
// Reuses the authoritative conservative AABB/frustum classifier and the
// existing LitRenderer; does not truncate physics, SENSE, or replay worlds.
import {classifyAABBFrustum} from '../geometry/index.js';
import {perspective,viewMatrix,multiplyMatrices} from '../math/index.js';
import {validateLitMaterial} from '../render-lit/index.js';

export const WORLD_VIS_LIMITS=Object.freeze({
  batches:128,sourceBytes:12*1024*1024,residentBytes:8*1024*1024,
  meshes:128,vertices:250000,cameras:4
});
const worlds=new WeakMap(),plans=new WeakMap(),ID=/^[a-z][a-z0-9-]{0,47}$/;
const own=(v,k)=>Object.hasOwn(v,k);
function record(value,keys,label){
  if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))
    throw TypeError(label+' must be a plain data record');
  const ds=Object.getOwnPropertyDescriptors(value);
  for(const k of Reflect.ownKeys(ds))
    if(typeof k!=='string'||!keys.includes(k)||!ds[k].enumerable||!own(ds[k],'value'))
      throw TypeError(label+' contains unknown/accessor field');
  return ds;
}
function dense(value,min,max,label){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||
    value.length<min||value.length>max||Reflect.ownKeys(value).length!==value.length+1)
    throw TypeError(label+' requires a bounded dense ordinary array');
  const ds=Object.getOwnPropertyDescriptors(value);
  return Array.from({length:value.length},(_,i)=>{
    if(!ds[i]||!ds[i].enumerable||!own(ds[i],'value'))throw TypeError(label+' contains hole/accessor');
    return ds[i].value;
  });
}
function number(v,min,max,label){
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw RangeError(label+' outside finite domain');
  return v===0?0:v;
}
function vector(input,length,min,max,label){
  const out=dense(input,length,length,label);
  return Object.freeze(out.map(x=>number(x,min,max,label)));
}
function typed(source){
  if(!(source instanceof Float32Array)||Object.getPrototypeOf(source)!==Float32Array.prototype)
    throw TypeError('lit mesh requires native Float32Array');
  const len=Float32Array.prototype.subarray.call(source).length;
  if(len===0||len%33!==0||len/11>WORLD_VIS_LIMITS.vertices)
    throw RangeError('lit mesh must contain whole bounded XYZ/normal/RGB/UV triangles');
  const out=new Float32Array(source);
  for(let i=0;i<out.length;i+=11){
    for(let j=0;j<11;j++)number(out[i+j],j>=6&&j<=8?0:-10000,j>=6&&j<=8?1:10000,'lit vertex');
    const n=Math.hypot(out[i+3],out[i+4],out[i+5]);
    if(n<.5||n>1.5)throw RangeError('lit normal must be approximately unit length');
  }
  return out;
}
function bounds(data){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<data.length;i+=11)for(let j=0;j<3;j++){
    min[j]=Math.min(min[j],data[i+j]);max[j]=Math.max(max[j],data[i+j]);
  }
  // AABB classifier intentionally rejects zero-volume slabs. Widen by
  // 1 mm plus input-relative slack: touching bounds must never be culled.
  for(let i=0;i<3;i++){
    const pad=.001+32*Number.EPSILON*(Math.abs(min[i])+Math.abs(max[i]));
    min[i]-=pad;max[i]+=pad;
  }
  return Object.freeze({min:Object.freeze(min),max:Object.freeze(max),
    center:Object.freeze(min.map((v,i)=>(v+max[i])/2)),
    radius:Math.hypot(...max.map((v,i)=>(v-min[i])/2))});
}
function coarse(source){
  const triangles=source.length/33;
  if(triangles<8)return null;
  // Presentation-only coarse proxy: ordered subset of complete original
  // triangles, never synthetic vertices or collision geometry. The holes
  // are an explicit quality trade-off, not an assertion of visual parity.
  const chosen=Math.ceil(triangles/3),out=new Float32Array(chosen*33);
  for(let k=0;k<chosen;k++)out.set(source.subarray(k*3*33,k*3*33+33),k*33);
  return out;
}
/** Owns static HORIZON-compatible lit batches and their coarse meshes. */
export function createRetainedWorld(input){
  const source=dense(input,1,WORLD_VIS_LIMITS.batches,'world batches');
  const ids=new Set(),entries=[];let bytes=0,triangles=0;
  for(const item of source){
    const ds=record(item,['id','vertices','material'],'world batch');
    if(!ds.id||!ds.vertices||!ds.material)throw TypeError('world batch missing required fields');
    const id=ds.id.value;
    if(typeof id!=='string'||!ID.test(id)||ids.has(id))throw TypeError('unique bounded batch ID required');
    ids.add(id);
    const high=typed(ds.vertices.value),material=validateLitMaterial(ds.material.value),
      low=coarse(high),b=bounds(high);
    bytes+=high.byteLength+(low?.byteLength??0);triangles+=high.length/33;
    if(bytes>WORLD_VIS_LIMITS.sourceBytes)throw RangeError('owned world source byte budget exceeded');
    entries.push(Object.freeze({id,index:entries.length,high,low,material,bounds:b}));
  }
  const world=Object.freeze({batches:entries.length,highTriangles:triangles,sourceBytes:bytes});
  worlds.set(world,Object.freeze(entries));
  return world;
}
function cameraData(camera){
  const ds=record(camera,['position','orientation','fov','aspect','near','far'],'camera');
  if(['position','orientation','fov','aspect','near','far'].some(k=>!ds[k]))
    throw TypeError('camera missing required field');
  const position=vector(ds.position.value,3,-10000,10000,'camera position'),
    orientation=vector(ds.orientation.value,4,-1,1,'camera quaternion');
  if(Math.abs(Math.hypot(...orientation)-1)>1e-5)throw RangeError('camera quaternion must be unit length');
  const fov=number(ds.fov.value,.2,2.5,'fov'),
    aspect=number(ds.aspect.value,.25,4,'aspect'),
    near=number(ds.near.value,.01,100,'near'),
    far=number(ds.far.value,1,5000,'far');
  if(far<=near)throw RangeError('far must exceed near');
  const vp=multiplyMatrices(perspective(fov,aspect,near,far),viewMatrix(position,orientation));
  const plane=(i,sgn)=>[vp[3]+sgn*vp[i],vp[7]+sgn*vp[4+i],
    vp[11]+sgn*vp[8+i],vp[15]+sgn*vp[12+i]];
  const planes=Object.freeze([plane(0,1),plane(0,-1),plane(1,1),plane(1,-1),
    plane(2,1),plane(2,-1)].map(p=>Object.freeze(p)));
  return {position,orientation,fov,aspect,near,far,planes};
}
function options(opt){
  const ds=record(opt,['cull','lod','lodDistance'],'visibility options');
  const cull=own(ds,'cull')?ds.cull.value:true,lod=own(ds,'lod')?ds.lod.value:'auto',
    lodDistance=number(own(ds,'lodDistance')?ds.lodDistance.value:120,1,5000,'LOD distance');
  if(typeof cull!=='boolean'||!['auto','high','low'].includes(lod))
    throw TypeError('unsupported culling or LOD selection');
  return {cull,lod,lodDistance};
}
/** Stable opaque source order then transparent back-to-front with ID ties.
 * All camera selection is strictly presentation; no physics mutation.
 */
export function selectRetainedView(world,camera,configuration={}){
  const entries=worlds.get(world);
  if(!entries)throw TypeError('createRetainedWorld identity required');
  const view=cameraData(camera),settings=options(configuration),opaque=[],transparent=[];
  let culled=0,lodVertices=0,fullVertices=0;
  for(const item of entries){
    const distance=Math.hypot(...item.bounds.center.map((x,i)=>x-view.position[i]));
    if(settings.cull&&classifyAABBFrustum(item.bounds,view.planes)===-1){culled++;continue;}
    const lod=settings.lod==='low'||settings.lod==='auto'&&item.low&&
      distance-item.bounds.radius>settings.lodDistance?'low':'high';
    const kind=lod==='low'&&item.low?'low':'high',data=item[kind];
    const row=Object.freeze({id:item.id,lod:kind,bytes:data.byteLength,
      vertices:data.length/11,distance,transparent:item.material.opacity<1||
        ['glass','shadow'].includes(item.material.pattern)});
    fullVertices+=item.high.length/11;lodVertices+=row.vertices;
    (row.transparent?transparent:opaque).push(row);
  }
  transparent.sort((a,b)=>b.distance-a.distance||(a.id<b.id?-1:a.id>b.id?1:0));
  const rows=Object.freeze([...opaque,...transparent]);
  const selectedBytes=rows.reduce((a,r)=>a+r.bytes,0);
  const result=Object.freeze({rows,selected:rows.length,culled,
    selectedBytes,fullVertices,lodVertices,draws:rows.length,
    culling:settings.cull,lod:settings.lod});
  plans.set(result,{world,entries});
  return result;
}
/** A retained GPU budget adapter for LitRenderer or equivalent strict meshes.
 * It owns ONLY renderer mesh handles; the source snapshot remains immutable.
 * Renderer.begin() is owned by the caller. Use rebind() after context loss.
 */
export class RetainedLitWorld{
  #renderer;#world;#entries;#resident=new Map();#bytes=0;#uploads=0;#deletes=0;#disposed=false;#maxBytes;#maxMeshes;
  constructor(renderer,world,config={}){
    const entries=worlds.get(world);
    if(!entries)throw TypeError('retained world identity required');
    const ds=record(config,['maxResidentBytes','maxMeshes'],'retainer limits');
    const maxBytes=number(own(ds,'maxResidentBytes')?ds.maxResidentBytes.value:WORLD_VIS_LIMITS.residentBytes,
      1,WORLD_VIS_LIMITS.residentBytes,'resident bytes');
    const maxMeshes=number(own(ds,'maxMeshes')?ds.maxMeshes.value:WORLD_VIS_LIMITS.meshes,
      1,WORLD_VIS_LIMITS.meshes,'resident meshes');
    if(!Number.isSafeInteger(maxBytes)||!Number.isSafeInteger(maxMeshes))
      throw RangeError('resident caps must be integers');
    this.#checkRenderer(renderer);
    this.#renderer=renderer;this.#world=world;this.#entries=entries;
    this.#maxBytes=maxBytes;this.#maxMeshes=maxMeshes;
  }
  #checkRenderer(renderer){
    if(!renderer||!['mesh','draw','deleteMesh'].every(k=>typeof renderer[k]==='function')||
      typeof renderer.stats!=='function')throw TypeError('LitRenderer compatible adapter required');
  }
  #evict(key){
    const row=this.#resident.get(key);
    if(!row)return;
    this.#renderer.deleteMesh(row.handle);this.#bytes-=row.bytes;
    this.#resident.delete(key);this.#deletes++;
  }
  /** Preflight complete view before evict/upload. Invalid plans leave cache as is. */
  draw(plan){
    if(this.#disposed)throw Error('retainer disposed');
    if(plans.get(plan)?.world!==this.#world)throw TypeError('foreign or forged view plan');
    const want=plan.rows.map(r=>r.id+'@'+r.lod),
      unique=new Set(want);
    if(unique.size!==want.length||unique.size>this.#maxMeshes||
      plan.selectedBytes>this.#maxBytes)
      throw RangeError('visible retained scene exceeds resident budget');
    const byId=new Map(this.#entries.map(e=>[e.id,e]));
    for(const key of [...this.#resident.keys()])if(!unique.has(key))this.#evict(key);
    for(const row of plan.rows){
      const key=row.id+'@'+row.lod;
      if(!this.#resident.has(key)){
        const data=byId.get(row.id)[row.lod],
          handle=this.#renderer.mesh(data);
        this.#resident.set(key,{handle,bytes:data.byteLength});
        this.#bytes+=data.byteLength;this.#uploads++;
      }
    }
    for(const row of plan.rows)
      this.#renderer.draw(this.#resident.get(row.id+'@'+row.lod).handle,
        {material:byId.get(row.id).material});
    return this.stats();
  }
  stats(){return Object.freeze({residentBytes:this.#bytes,residentMeshes:this.#resident.size,
    uploads:this.#uploads,deletions:this.#deletes,maxResidentBytes:this.#maxBytes,
    maxMeshes:this.#maxMeshes,disposed:this.#disposed});}
  /** Explicit context replacement. Existing GPU handles belong to OLD canvas. */
  rebind(renderer){
    if(this.#disposed)throw Error('retainer disposed');
    this.#checkRenderer(renderer);
    for(const key of [...this.#resident.keys()])this.#evict(key);
    this.#renderer=renderer;
  }
  dispose(){
    if(this.#disposed)return;
    for(const key of [...this.#resident.keys()])this.#evict(key);
    this.#disposed=true;
  }
}
