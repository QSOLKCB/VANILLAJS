// SPDX-License-Identifier: Apache-2.0
// Adapted from QSOLKCB/Ski-Shooter site/src/world.js at
// 9864a6cdd741a5cb9938d6de610711be7aaeedc9 (Apache-2.0).
// Pure, bounded triangular heightfield; no game map, generated noise or assets.
import {finiteVector} from '../math/index.js';

const LIMIT=128;
const finite=(value,name)=>{
  if(typeof value!=='number'||!Number.isFinite(value))throw new RangeError(name+' must be finite');
  return value;
};
const count=(value,name)=>{
  if(!Number.isSafeInteger(value)||value<1||value>LIMIT)
    throw new RangeError(name+' must be an integer from 1 to '+LIMIT);
  return value;
};
const within=(value,min,max,name)=>{
  finite(value,name);
  if(value<min||value>max)throw new RangeError(name+' is outside heightfield');
  return value;
};

/** Immutable-copy, cell-diagonal triangulated +Y heightfield in metres.
 * Cells have triangles (a,c,b) and (b,c,d), split on local u+v=1.
 * The owning game chooses height generation and keeps its own world rules. */
export class Heightfield {
  #heights;#cellsX;#cellsZ;#cell;#x0;#z0;#x1;#z1;
  constructor({cellsX,cellsZ,cellSize=1,originX=0,originZ=0,heights}={}){
    this.#cellsX=count(cellsX,'cellsX');
    this.#cellsZ=count(cellsZ,'cellsZ');
    const spacing=finite(cellSize,'cellSize');
    if(spacing<1e-6||spacing>1e6)throw new RangeError('cellSize out of bounds');
    this.#cell=spacing;
    this.#x0=finite(originX,'originX');this.#z0=finite(originZ,'originZ');
    this.#x1=this.#x0+this.#cellsX*spacing;
    this.#z1=this.#z0+this.#cellsZ*spacing;
    if([this.#x0,this.#x1,this.#z0,this.#z1].some(x=>!Number.isFinite(x)||Math.abs(x)>1e9))
      throw new RangeError('horizontal coordinates exceed bounded domain');
    const size=(this.#cellsX+1)*(this.#cellsZ+1);
    if(!(Array.isArray(heights)||heights instanceof Float32Array||heights instanceof Float64Array)
      ||heights.length!==size)throw new TypeError('heights must be a dense array or float array of grid vertices');
    for(let i=0;i<size;i++){
      if(!Object.hasOwn(heights,i)||!Number.isFinite(heights[i])||Math.abs(heights[i])>1e9)
        throw new RangeError('invalid height at index '+i);
    }
    this.#heights=Float64Array.from(heights);
  }
  get cellsX(){return this.#cellsX;}
  get cellsZ(){return this.#cellsZ;}
  get cellSize(){return this.#cell;}
  #height(x,z){return this.#heights[z*(this.#cellsX+1)+x];}
  #location(x,z){
    within(x,this.#x0,this.#x1,'x');within(z,this.#z0,this.#z1,'z');
    const gx=Math.min(this.#cellsX,Math.max(0,(x-this.#x0)/this.#cell));
    const gz=Math.min(this.#cellsZ,Math.max(0,(z-this.#z0)/this.#cell));
    const ix=Math.min(this.#cellsX-1,Math.floor(gx));
    const iz=Math.min(this.#cellsZ-1,Math.floor(gz));
    return {ix,iz,u:gx-ix,v:gz-iz};
  }
  /** Piecewise-affine height and the exact planar normal of its triangle. */
  sample(x,z){
    const {ix,iz,u,v}=this.#location(x,z);
    const a=this.#height(ix,iz),b=this.#height(ix+1,iz);
    const c=this.#height(ix,iz+1),d=this.#height(ix+1,iz+1);
    const lower=u+v<=1,divisor=this.#cell;
    const height=lower?a+(b-a)*u+(c-a)*v:
      d+(c-d)*(1-u)+(b-d)*(1-v);
    const dx=(lower?b-a:d-c)/divisor,dz=(lower?c-a:d-b)/divisor;
    const n=Math.hypot(dx,1,dz);
    return {height,normal:[-dx/n,1/n,-dz/n],cell:[ix,iz],triangle:lower?0:1};
  }
  /** Two +Y winding triangles, useful for mesh/picking parity checks. */
  triangleAt(ix,iz){
    if(!Number.isSafeInteger(ix)||ix<0||ix>=this.#cellsX||
       !Number.isSafeInteger(iz)||iz<0||iz>=this.#cellsZ)
      throw new RangeError('cell index outside heightfield');
    const x=this.#x0+ix*this.#cell,z=this.#z0+iz*this.#cell;
    const a=[x,this.#height(ix,iz),z],b=[x+this.#cell,this.#height(ix+1,iz),z];
    const c=[x,this.#height(ix,iz+1),z+this.#cell];
    const d=[x+this.#cell,this.#height(ix+1,iz+1),z+this.#cell];
    return [[a,c,b],[b,c,d]];
  }
  /** First downward or lateral crossing of the sampled terrain surface.
   * verticalOffset is a Y-only clearance, NOT a swept sphere.
   * Both horizontal endpoints must remain within the finite grid.
   * Grid and diagonal cuts make clearance affine on each subinterval. */
  castSegment(origin,displacement,{verticalOffset=0}={}){
    const from=finiteVector(origin,3,'origin'),delta=finiteVector(displacement,3,'displacement');
    if(!Number.isFinite(verticalOffset)||verticalOffset<0||verticalOffset>1e9)
      throw new RangeError('invalid verticalOffset');
    const end=from.map((x,i)=>x+delta[i]);
    if(!end.every(Number.isFinite))throw new RangeError('segment endpoint overflow');
    this.#location(from[0],from[2]);this.#location(end[0],end[2]);
    const u0=(from[0]-this.#x0)/this.#cell,v0=(from[2]-this.#z0)/this.#cell;
    const du=delta[0]/this.#cell,dv=delta[2]/this.#cell;
    const cuts=[0,1];
    const cut=(start,change,first,last)=>{
      if(change===0)return;
      for(let k=first;k<=last;k++){
        const t=(k-start)/change;
        if(t>0&&t<1)cuts.push(t);
      }
    };
    cut(u0,du,1,this.#cellsX-1);
    cut(v0,dv,1,this.#cellsZ-1);
    cut(u0+v0,du+dv,1,this.#cellsX+this.#cellsZ-1);
    cuts.sort((a,b)=>a-b);
    const at=t=>{
      const point=from.map((x,i)=>x+delta[i]*t);
      const x=Math.min(this.#x1,Math.max(this.#x0,point[0]));
      const z=Math.min(this.#z1,Math.max(this.#z0,point[2]));
      const surface=this.sample(x,z);
      return {point,surface,clearance:point[1]-verticalOffset-surface.height};
    };
    let t0=0,first=at(0),d0=first.clearance;
    if(d0<=0)return {time:0,point:first.point,normal:first.surface.normal,
      height:first.surface.height,startedInside:true};
    for(let i=1;i<cuts.length;i++){
      const t1=cuts[i],d1=at(t1).clearance;
      if(d1<=0){
        const t=t0+(t1-t0)*d0/(d0-d1);
        const impact=at(t);
        return {time:t,point:impact.point,normal:impact.surface.normal,
          height:impact.surface.height,startedInside:false};
      }
      t0=t1;d0=d1;
    }
    return null;
  }
}
