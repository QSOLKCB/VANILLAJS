// SPDX-License-Identifier: Apache-2.0
// Adapted conceptually from QSOLKCB/CorpoWars3d src/renderer.js at
// 8e86066686a575402ee2818378f1ec9323fb9ee6 (Apache-2.0).
// No WebGL context, game or renderer dependency: this is packed CPU geometry.
const WIDTH=12, MAX_BOXES=16384, MAX_BYTES=MAX_BOXES*WIDTH*4;
const scalar=(v,name)=>{
  if(typeof v!=='number'||!Number.isFinite(v)||!Number.isFinite(Math.fround(v)))
    throw new RangeError(name+' must be finite and representable as float32');
  return v;
};
function rgb(value){
  if(!Array.isArray(value)||value.length!==3||
     ![0,1,2].every(i=>Object.hasOwn(value,i)))
    throw new TypeError('colour must be a dense RGB triple');
  return value.map((x,i)=>scalar(x,'colour['+i+']'));
}
const lerp=(a,b)=>a*a+b*b;

/** A render-agnostic, retained Float32 cuboid instance stream.
 * Wire format per cuboid: xyz, width/height/depth, RGB, cos(yaw), sin(yaw),
 * glow. Unlike XYZ/RGB triangle vertices, this 12-float format requires
 * explicit instanced GPU support or conversion before WebGLAPI.createMesh(). */
export class CuboidStream {
  #buffer;#count=0;#lastAngle=null;#cos=1;#sin=0;#trig=0;#growths=0;
  constructor({capacity=16}={}){
    if(!Number.isSafeInteger(capacity)||capacity<0||capacity>MAX_BOXES)
      throw new RangeError('capacity must be an integer 0..16384');
    this.#buffer=new Float32Array(capacity*WIDTH);
  }
  get count(){return this.#count;}
  get capacity(){return this.#buffer.length/WIDTH;}
  get rotationEvaluations(){return this.#trig;}
  get growths(){return this.#growths;}
  clear(){
    this.#count=0;this.#lastAngle=null;this.#cos=1;this.#sin=0;this.#trig=0;
    return this;
  }
  #reserve(){
    if(this.#count===MAX_BOXES)throw new RangeError('stream reached 16384-cuboid capacity');
    if(this.#count<this.capacity)return;
    const target=Math.min(MAX_BOXES,Math.max(1,this.capacity*2));
    const next=new Float32Array(target*WIDTH);
    next.set(this.#buffer);
    this.#buffer=next;this.#growths++;
  }
  /** Validate a complete cuboid before touching storage. Angle is radians.
   * Adjacent identical angles reuse sin/cos using Object.is (-0 distinct).
   * All packed bits are Float32; only the active prefix is returned. */
  box(x,y,z,width,height,depth,color,glow=0,angle=0){
    const coords=[x,y,z,width,height,depth];
    coords.forEach((v,i)=>scalar(v,'cuboid['+i+']'));
    if(coords.slice(3).some(v=>v<=0))throw new RangeError('cuboid dimensions must be positive');
    const c=rgb(color);
    scalar(glow,'glow');scalar(angle,'angle');
    const changed=!Object.is(angle,this.#lastAngle);
    const cs=changed?(angle===0?1:Math.cos(angle)):this.#cos;
    const sn=changed?(angle===0?angle:Math.sin(angle)):this.#sin;
    scalar(cs,'cosine');scalar(sn,'sine');
    this.#reserve();
    const i=this.#count++*WIDTH,b=this.#buffer;
    b.set(coords,i);b.set(c,i+6);
    b[i+9]=cs;b[i+10]=sn;b[i+11]=glow;
    if(changed){
      this.#lastAngle=angle;this.#cos=cs;this.#sin=sn;
      if(angle!==0)this.#trig+=2;
    }
    return this.#count-1;
  }
  /** Source-backed packed format without atan2/cos/sin reconstruction.
   * Rejects malformed lengths/dimensions before writing any bytes. */
  encoded(values){
    if(!values||values.length!==WIDTH||![...Array(WIDTH).keys()].every(i=>Object.hasOwn(values,i)))
      throw new TypeError('encoded cuboid must contain 12 defined values');
    const packed=Array.from(values,(x,i)=>scalar(x,'encoded['+i+']'));
    if(packed.slice(3,6).some(v=>v<=0))throw new RangeError('encoded dimensions must be positive');
    this.#reserve();
    this.#buffer.set(packed,this.#count*WIDTH);
    this.#lastAngle=null; // A pre-encoded rotation invalidates the angle cache.
    return this.#count++;
  }
  /** Aliased view: valid until the next resize or mutation. Never persist it. */
  view(){return this.#buffer.subarray(0,this.#count*WIDTH);}
  /** Independent owned bytes for receipts / immutable retained generations. */
  snapshot(){return this.view().slice();}
  /** Conservative, side-effect-free distance LOD selector; equality is near. */
  static detail(position,eye,{distance=38}={}){
    if(!Array.isArray(position)||position.length!==3||
       !Array.isArray(eye)||eye.length!==3||
       ![...position,...eye].every(Number.isFinite)||
       !Number.isFinite(distance)||distance<0)
      throw new RangeError('invalid LOD coordinates or threshold');
    const dx=position[0]-eye[0],dy=position[1]-eye[1],dz=position[2]-eye[2];
    const squared=dx*dx+dy*dy+dz*dz;
    if(!Number.isFinite(squared))throw new RangeError('LOD distance overflow');
    return squared>distance*distance?'low':'high';
  }
}
