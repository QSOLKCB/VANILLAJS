// SPDX-License-Identifier: Apache-2.0
// RENDER-PACKING-001: bounded reusable XYZ/RGB box assembly for trusted render data.
// No browser APIs or engine state; output matches Float32(boxVertices(...)).
export const BOX_STREAM_FLOATS = 216;
export const BOX_STREAM_MAX_BOXES = 4096;
const FACES = [[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]];
const SHADES = [.7,.9,.58,1,.8,.65];
const TRIANGLE = [0,1,2,0,2,3];

/** Own one bounded Float32Array and reuse it across geometry frames.
 * Consumers must not retain a view after reset/append: views alias storage.
 * Renderer.update accepts the view without an additional CPU Float32 copy.
 */
export class BoxVertexStream {
  #data;
  #boxes = 0;
  constructor(capacityBoxes=256) {
    if (!Number.isSafeInteger(capacityBoxes)||capacityBoxes<1||capacityBoxes>BOX_STREAM_MAX_BOXES)
      throw new RangeError('box stream capacity must be 1..4096');
    this.#data=new Float32Array(capacityBoxes*BOX_STREAM_FLOATS);
  }
  get capacityBoxes(){return this.#data.length/BOX_STREAM_FLOATS;}
  get boxCount(){return this.#boxes;}
  get vertexCount(){return this.#boxes*36;}
  get usedFloats(){return this.#boxes*BOX_STREAM_FLOATS;}
  /** This creates one small typed view, not a copy of the vertex bytes. */
  view(){return this.#data.subarray(0,this.usedFloats);}
  reset(){this.#boxes=0;return this;}
  append(center,size,color){
    if(!center||!size||!color||center.length!==3||size.length!==3||color.length!==3)
      throw new TypeError('box requires three XYZ, size and RGB components');
    return this.appendXYZRGB(center[0],center[1],center[2],size[0],size[1],size[2],color[0],color[1],color[2]);
  }
  /** Scalar entry avoids allocating center/size/color arrays per bullet. */
  appendXYZRGB(cx,cy,cz,sx,sy,sz,r,g,b){
    // Validate before mutating output; RGB up to 4 permits deliberate overbright art.
    if(!Number.isFinite(cx)||!Number.isFinite(cy)||!Number.isFinite(cz)||
      Math.abs(cx)>1e6||Math.abs(cy)>1e6||Math.abs(cz)>1e6||
      !Number.isFinite(sx)||!Number.isFinite(sy)||!Number.isFinite(sz)||
      sx<0||sy<0||sz<0||sx>1e6||sy>1e6||sz>1e6||
      !Number.isFinite(r)||!Number.isFinite(g)||!Number.isFinite(b)||
      r<0||r>4||g<0||g>4||b<0||b>4)
      throw new RangeError('bounded finite box geometry and RGB required');
    if(this.#boxes>=this.capacityBoxes)throw new RangeError('box stream is full');
    let cursor=this.usedFloats;
    for(let face=0;face<6;face++){
      const corners=FACES[face],shade=SHADES[face];
      const cr=r*shade,cg=g*shade,cb=b*shade;
      for(let i=0;i<6;i++){
        const corner=corners[TRIANGLE[i]];
        this.#data[cursor++]=cx+sx*((corner>>0&1)-.5);
        this.#data[cursor++]=cy+sy*((corner>>1&1)-.5);
        this.#data[cursor++]=cz+sz*((corner>>2&1)-.5);
        this.#data[cursor++]=cr;
        this.#data[cursor++]=cg;
        this.#data[cursor++]=cb;
      }
    }
    this.#boxes++;
    return this;
  }
}
