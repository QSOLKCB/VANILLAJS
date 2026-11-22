// SPDX-License-Identifier: Apache-2.0
// FX-PIPE-001: an original, bounded fixed-point graphics preparation pipeline.
// Inspired by the separation of work in cartridge graphics coprocessors;
// NOT a Super FX emulator, CPU, 3D rasteriser or gameplay authority.
import {SCALE} from '../integer-math/index.js';

export const FX_PIPE_MAX_VERTICES=65532;
export const FX_PIPE_DEFAULT_VERTICES=3072;
export const FX_PIPE_FORMAT='qsol.vanillajs.fx-pipe.v1';
const COORD_LIMIT=4096*SCALE,COEFF_LIMIT=8*SCALE,OUTPUT_LIMIT=10000*SCALE;
const IDENTITY=[SCALE,0,0,0, 0,SCALE,0,0, 0,0,SCALE,0];
const TRI=[0,1,2],QUAD=[0,1,2,0,2,3];

function raw(value,limit,label){
  if(typeof value!=='number'||!Number.isSafeInteger(value)||Math.abs(value)>limit)
    throw new RangeError(label+' requires bounded integer Q16.16 raw units');
  return value===0?0:value;
}
function byte(value){
  if(!Number.isInteger(value)||value<0||value>255)throw new RangeError('RGB must be 0..255 integer bytes');
  return value;
}
function matrixOf(value){
  const ordinary=Array.isArray(value)&&Object.getPrototypeOf(value)===Array.prototype;
  const typed=value instanceof Int32Array&&Object.getPrototypeOf(value)===Int32Array.prototype;
  if(!ordinary&&!typed)throw new TypeError('transform must be a dense Array or native Int32Array');
  if(value.length!==12||Reflect.ownKeys(value).length!==(ordinary?13:12))
    throw new RangeError('transform must have exactly 12 Q16.16 components');
  const result=new Int32Array(12);
  for(let i=0;i<12;i++){
    const d=Object.getOwnPropertyDescriptor(value,String(i));
    if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw new TypeError('transform has a hole or accessor');
    result[i]=raw(d.value,i%4===3?COORD_LIMIT:COEFF_LIMIT,'transform');
  }
  return result;
}

/** Fixed 3x4 row-major Q16 affine preparation into XYZ/RGB Float32 triangles.
 * Each operation is atomic w.r.t. published draw count and bytes.
 * The renderer owns GPU buffers; this writer owns only its fixed CPU storage.
 */
export class FxGraphicsPipe{
  #data;#scratch=new Float64Array(12);#matrix=Int32Array.from(IDENTITY);#count=0;
  constructor(capacityVertices=FX_PIPE_DEFAULT_VERTICES){
    if(!Number.isSafeInteger(capacityVertices)||capacityVertices<3||
       capacityVertices>FX_PIPE_MAX_VERTICES||capacityVertices%3!==0)
      throw new RangeError('vertex capacity must be 3..65532 in whole triangles');
    this.#data=new Float32Array(capacityVertices*6);
  }
  get capacityVertices(){return this.#data.length/6;}
  get vertexCount(){return this.#count;}
  get usedFloats(){return this.#count*6;}
  get retainedBytes(){return this.#data.byteLength;}
  /** GPU upload may consume this live subview immediately. Do not retain it
   * across reset/append: subsequent writes alias the same backing memory. */
  view(){return this.#data.subarray(0,this.usedFloats);}
  reset(){this.#count=0;return this;}
  setTransform(matrix){this.#matrix=matrixOf(matrix);return this;}
  resetTransform(){this.#matrix=Int32Array.from(IDENTITY);return this;}
  #need(vertices){
    if(this.#count>this.capacityVertices-vertices)throw new RangeError('FX graphics vertex budget exceeded');
  }
  #project(x,y,z,slot){
    x=raw(x,COORD_LIMIT,'x');y=raw(y,COORD_LIMIT,'y');z=raw(z,COORD_LIMIT,'z');
    const m=this.#matrix;
    for(let axis=0;axis<3;axis++){
      const i=axis*4;
      // Bound: 3*8*4096*SCALE^2 < 2^53. Integer products and
      // sums are exact as JS Numbers; division by SCALE precedes truncation.
      const numerator=m[i]*x+m[i+1]*y+m[i+2]*z;
      const output=Math.trunc(numerator/SCALE)+m[i+3];
      if(!Number.isSafeInteger(output)||Math.abs(output)>OUTPUT_LIMIT)
        throw new RangeError('transformed coordinate exceeds finite graphics domain');
      this.#scratch[slot*3+axis]=output/SCALE;
    }
  }
  #commit(indices,r,g,b){
    const red=byte(r)/255,green=byte(g)/255,blue=byte(b)/255;
    let at=this.#count*6;
    for(const idx of indices){
      const i=idx*3;
      this.#data[at++]=this.#scratch[i];
      this.#data[at++]=this.#scratch[i+1];
      this.#data[at++]=this.#scratch[i+2];
      this.#data[at++]=red;this.#data[at++]=green;this.#data[at++]=blue;
    }
    this.#count+=indices.length;return this;
  }
  /** Coordinates are signed integer Q16.16 raw values, colour is RGB bytes.
   * No allocation per triangle: scratch and backing storage are retained. */
  appendTriangleXYZRGB(x0,y0,z0,x1,y1,z1,x2,y2,z2,r,g,b){
    this.#need(3);byte(r);byte(g);byte(b);
    this.#project(x0,y0,z0,0);this.#project(x1,y1,z1,1);this.#project(x2,y2,z2,2);
    return this.#commit(TRI,r,g,b);
  }
  /** A coloured sprite card: two triangles on a local XY plane at Z.
   * A caller-authored affine matrix may translate, rotate, scale or shear it.
   * Textures, alpha blending and sprite atlases are intentionally out of scope. */
  appendQuadXY(x,y,z,width,height,r,g,b){
    this.#need(6);byte(r);byte(g);byte(b);
    x=raw(x,COORD_LIMIT,'x');y=raw(y,COORD_LIMIT,'y');z=raw(z,COORD_LIMIT,'z');
    width=raw(width,COORD_LIMIT,'width');height=raw(height,COORD_LIMIT,'height');
    if(width<0||height<0)throw new RangeError('sprite width and height must be nonnegative');
    const right=raw(x+width,COORD_LIMIT,'right edge');
    const top=raw(y+height,COORD_LIMIT,'top edge');
    this.#project(x,y,z,0);this.#project(right,y,z,1);
    this.#project(right,top,z,2);this.#project(x,top,z,3);
    return this.#commit(QUAD,r,g,b);
  }
}
