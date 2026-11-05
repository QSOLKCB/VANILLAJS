// SPDX-License-Identifier: Apache-2.0
// Optional, bounded geometry accelerators. Static source snapshots are immutable.
import {castSegment as narrowCastSegment} from '../collision/index.js';

const TRIANGLES=[0,1,2,0,2,3];
const FACES=[[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]];
const SHADES=[.7,.9,.58,1,.8,.65];
const BOX_FLOATS=36*6;
const MAX_BOXES=16384;
const MAX_INDEXED_BOXES=65536;
// The indexed narrowphase has a deliberately bounded arithmetic domain, so
// collider expansion, endpoint addition and relative differences remain finite.
const MAX_COORD=1e9;
function triple(v,name,limit=Infinity){
  if(!v||v.length!==3||!Array.from(v).every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=limit)){
    throw new TypeError(name+' must contain three finite coordinates within bounds');
  }
  return Array.from(v);
}

/** Pack N legacy box meshes into one owned interleaved Float32 XYZ/RGB array.
 * Valid scenes have exact GPU upload-byte parity with boxVertices() concatenation.
 * Invalid shape data are rejected before allocating the output buffer. */
export function boxMeshBatch(boxes){
  if(!Array.isArray(boxes)||boxes.length>MAX_BOXES)throw new RangeError('boxes must be a bounded array');
  const normalized=boxes.map((box,i)=>({
    center:triple(box?.center,'box '+i+' center'),
    size:triple(box?.size,'box '+i+' size'),
    color:triple(box?.color,'box '+i+' color')
  }));
  const result=new Float32Array(normalized.length*BOX_FLOATS);
  let offset=0;
  for(const {center,size,color} of normalized){
    const corners=[];
    for(let i=0;i<8;i++){
      corners.push(center.map((x,k)=>x+size[k]*((i>>k&1)-.5)));
    }
    for(let i=0;i<FACES.length;i++){
      const face=FACES[i],shade=color.map(x=>x*SHADES[i]);
      for(const k of TRIANGLES){
        const xyz=corners[face[k]];
        for(let j=0;j<3;j++)result[offset++]=xyz[j];
        for(let j=0;j<3;j++)result[offset++]=shade[j];
      }
    }
  }
  return result;
}

/** Classical three-way plane predicate: -1=outside, 0=crossing/uncertain,
 * +1=fully inside. Positive signed distance is the visible halfspace.
 * An error margin prevents borderline floating-point results from culling. */
export function classifyAABBPlane(box,plane){
  const min=triple(box?.min,'box.min'),max=triple(box?.max,'box.max');
  if(min.some((x,i)=>x>=max[i]))throw new RangeError('AABB must have positive volume');
  if(!plane||plane.length!==4||!Array.from(plane).every(Number.isFinite)){
    throw new TypeError('plane must be four finite coefficients');
  }
  // Positive rescaling must not change a plane's containment meaning.
  // Divide by the maximum coefficient before taking any dot products: this
  // keeps even all-subnormal planes representable. A component lost during
  // normalization is an uncertainty, never permission to cull.
  const scale=Math.max(...Array.from(plane,Math.abs));
  if(scale===0)return 0;
  const coefficients=Array.from(plane,x=>x/scale);
  // A nonzero subnormal quotient can have arbitrarily poor relative
  // precision. Large box coordinates can magnify its division-rounding error.
  // Do not assert outside/inside when this coefficient is uncertain.
  const MIN_NORMAL=2.2250738585072014e-308;
  if(coefficients.some((x,i)=>(x===0&&plane[i]!==0)||(x!==0&&Math.abs(x)<MIN_NORMAL)))return 0;
  let lo=coefficients[3],hi=coefficients[3],error=Math.abs(coefficients[3]);
  for(let i=0;i<3;i++){
    const a=coefficients[i]*min[i],b=coefficients[i]*max[i];
    lo+=Math.min(a,b);hi+=Math.max(a,b);
    error+=Math.abs(a)+Math.abs(b);
  }
  if(!Number.isFinite(lo)||!Number.isFinite(hi)||!Number.isFinite(error))return 0;
  // Also budget absolute subnormal rounding: a relative-only tolerance may
  // itself underflow to zero near the classification boundary.
  const margin=Math.max(16*Number.EPSILON*error,32*Number.MIN_VALUE);
  if(hi < -margin)return -1;
  if(lo > margin)return 1;
  return 0;
}

/** All planes must include the AABB. Any definitely-outside plane rejects it. */
export function classifyAABBFrustum(box,planes){
  if(!Array.isArray(planes)||planes.length<1||planes.length>32)throw new RangeError('planes must be 1..32');
  // Validate all constraints before an early outside result: malformed
  // later planes may not silently disappear behind the first rejection.
  for(const p of planes){
    if(!p||p.length!==4||!Array.from(p).every(Number.isFinite)){
      throw new TypeError('every frustum plane must have four finite coefficients');
    }
  }
  let inside=true;
  for(const p of planes){
    const c=classifyAABBPlane(box,p);
    if(c===-1)return -1;
    if(c!==1)inside=false;
  }
  return inside?1:0;
}

function unionBounds(indices,entries){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const i of indices)for(let k=0;k<3;k++){
    min[k]=Math.min(min[k],entries[i].box.min[k]);
    max[k]=Math.max(max[k],entries[i].box.max[k]);
  }
  return {min,max};
}
function midpoint(b,axis){return b.min[axis]*.5+b.max[axis]*.5;}
function makeNode(indices,entries){
  const bounds=unionBounds(indices,entries);
  if(indices.length<=8)return {...bounds,items:indices};
  const spans=[0,1,2].map(k=>bounds.max[k]-bounds.min[k]);
  const axis=spans.indexOf(Math.max(...spans));
  indices.sort((a,b)=>midpoint(entries[a].box,axis)-midpoint(entries[b].box,axis)||a-b);
  const cut=Math.floor(indices.length/2);
  return {...bounds,left:makeNode(indices.slice(0,cut),entries),right:makeNode(indices.slice(cut),entries)};
}
// Conservative swept segment against a padded bounding box, for broad phase only.
// Widen each axis by an input-relative rounding margin; uncertain math is a hit.
function overlapsSegment(min,max,origin,delta,halfSize){
  let near=0,far=1;
  for(let k=0;k<3;k++){
    let lo=min[k]-halfSize,hi=max[k]+halfSize;
    const margin=16*Number.EPSILON*(Math.abs(lo)+Math.abs(hi)+Math.abs(origin[k])+Math.abs(delta[k]));
    lo-=margin;hi+=margin;
    if(!Number.isFinite(lo)||!Number.isFinite(hi))return true;
    if(delta[k]===0){if(origin[k]<lo||origin[k]>hi)return false;continue;}
    let a=(lo-origin[k])/delta[k],b=(hi-origin[k])/delta[k];
    if(!Number.isFinite(a)||!Number.isFinite(b))return true;
    if(a>b)[a,b]=[b,a];
    near=Math.max(near,a);far=Math.min(far,b);
    if(near>far)return false;
  }
  return far>=0&&near<=1;
}

/** Deterministic immutable median-split index for STATIC axis-aligned colliders.
 * Moving/rotating objects must NOT use this snapshot until rebuilt.
 * Indexed casting delegates narrowphase to the canonical collision module. */
export class StaticAABBIndex{
  #entries;#root;
  constructor(colliders){
    if(!Array.isArray(colliders)||colliders.length>MAX_INDEXED_BOXES)throw new RangeError('bounded collider list required');
    const ids=new Set();
    this.#entries=Object.freeze(colliders.map((item,i)=>{
      if(typeof item?.id!=='string'||!item.id||ids.has(item.id))throw new TypeError('unique nonempty collider ids required');
      ids.add(item.id);
      const min=triple(item.box?.min,'collider '+i+' min',MAX_COORD);
      const max=triple(item.box?.max,'collider '+i+' max',MAX_COORD);
      if(min.some((x,j)=>x>=max[j]))throw new RangeError('AABB must have positive volume');
      return Object.freeze({id:item.id,box:Object.freeze({min:Object.freeze(min),max:Object.freeze(max)})});
    }));
    this.#root=this.#entries.length?makeNode(this.#entries.map((_,i)=>i),this.#entries):null;
  }
  get size(){return this.#entries.length;}
  /** Sorted original indices; false positives allowed, false negatives forbidden. */
  candidates(origin,displacement,{halfSize=0}={}){
    origin=triple(origin,'origin',MAX_COORD);
    displacement=triple(displacement,'displacement',MAX_COORD);
    if(origin.some((x,i)=>Math.abs(x+displacement[i])>MAX_COORD))throw new RangeError('segment endpoint exceeds indexed coordinate domain');
    if(!Number.isFinite(halfSize)||halfSize<0||halfSize>MAX_COORD)throw new RangeError('invalid halfSize');
    if(!this.#root)return [];
    const hits=[],stack=[this.#root];
    while(stack.length){
      const node=stack.pop();
      if(!overlapsSegment(node.min,node.max,origin,displacement,halfSize))continue;
      if(node.items){
        for(const index of node.items){
          const box=this.#entries[index].box;
          if(overlapsSegment(box.min,box.max,origin,displacement,halfSize))hits.push(index);
        }
      }else{stack.push(node.right,node.left);}
    }
    return hits.sort((a,b)=>a-b);
  }
  /** Exact reference narrowphase, preserving original input index/tie order. */
  castSegment(origin,displacement,options={}){
    if(!options||typeof options!=='object')throw new TypeError('options must be an object');
    const {halfSize=0,ignoreIds=[]}=options;
    if(!Array.isArray(ignoreIds)||!ignoreIds.every(x=>typeof x==='string'))throw new TypeError('ignoreIds must be strings');
    const indices=this.candidates(origin,displacement,{halfSize});
    const colliders=indices.map(i=>this.#entries[i]);
    const hit=narrowCastSegment(origin,displacement,colliders,{halfSize,ignoreIds});
    return hit?{...hit,index:indices[hit.index]}:null;
  }
}
