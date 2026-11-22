// SPDX-License-Identifier: Apache-2.0
// BLIT-001 — original, bounded, packed-16-bit bitplane graphics preparation.
// Presentation only. Not an Amiga, ST, Williams or Atari hardware emulator.
export const BLIT_FORMAT='qsol.vanillajs.blit.v1';
export const BLIT_LIMITS=Object.freeze({width:512,height:384,planes:4,pixels:512*384});
export const BLIT_COPY=0xcc; // B across both values of A
export const BLIT_COOKIE_CUT=0xca; // A ? B : C

const owned=new WeakSet();
function int(v,min,max,name){
  if(!Number.isSafeInteger(v)||v<min||v>max)throw new RangeError(name+' outside integer range');
  return v;
}
function source(v,name){
  if(!owned.has(v))throw new TypeError(name+' requires BitplaneSurface');
  return v;
}
function pixelColor(v,planes){return int(v,0,(1<<planes)-1,'palette index');}
function rect(x,y,w,h,maxW,maxH,name){
  int(x,0,maxW-1,name+'.x');int(y,0,maxH-1,name+'.y');
  int(w,1,maxW,name+'.width');int(h,1,maxH,name+'.height');
  if(x+w>maxW||y+h>maxH)throw new RangeError(name+' outside source/surface bounds');
}
function rgbaPalette(colors,count){
  if(!Array.isArray(colors)||Object.getPrototypeOf(colors)!==Array.prototype||
    colors.length!==count||Reflect.ownKeys(colors).length!==count+1)
    throw new TypeError('palette requires exact dense RGBA entries');
  const out=new Uint8Array(count*4);
  for(let i=0;i<count;i++){
    const entry=Object.getOwnPropertyDescriptor(colors,String(i));
    if(!entry||!Object.hasOwn(entry,'value'))throw new TypeError('palette has accessor/hole');
    const color=entry.value;
    if(!Array.isArray(color)||Object.getPrototypeOf(color)!==Array.prototype||
      color.length!==4||Reflect.ownKeys(color).length!==5)
      throw new TypeError('palette RGBA must be a dense four-element array');
    for(let k=0;k<4;k++){
      const c=Object.getOwnPropertyDescriptor(color,String(k));
      if(!c||!Object.hasOwn(c,'value'))throw new TypeError('palette RGBA accessor/hole');
      out[i*4+k]=int(c.value,0,255,'RGBA byte');
    }
  }
  return out;
}
/** Packed planar bitmap: planes × height × (width / 16) big-endian bits.
 * x=0 is bit 15 of first word; colour index is formed from each plane bit.
 * Internal words never escape; returned words()/indices() are owned copies.
 */
export class BitplaneSurface{
  #width;#height;#planes;#rowWords;#planeWords;#bits;
  constructor(width,height,planes=4){
    int(width,16,BLIT_LIMITS.width,'width');
    if(width%16)throw new RangeError('width must be divisible by 16');
    int(height,1,BLIT_LIMITS.height,'height');int(planes,1,BLIT_LIMITS.planes,'planes');
    if(width*height>BLIT_LIMITS.pixels)throw new RangeError('pixel budget exceeded');
    this.#width=width;this.#height=height;this.#planes=planes;
    this.#rowWords=width/16;this.#planeWords=this.#rowWords*height;
    this.#bits=new Uint16Array(this.#planeWords*planes);owned.add(this);
  }
  get width(){return this.#width;}
  get height(){return this.#height;}
  get planes(){return this.#planes;}
  get retainedBytes(){return this.#bits.byteLength;}
  words(){return new Uint16Array(this.#bits);}
  #word(x,y,plane){return plane*this.#planeWords+y*this.#rowWords+(x>>4);}
  #pixelUnchecked(x,y){
    const bit=0x8000>>>(x&15);let index=0;
    for(let p=0;p<this.#planes;p++)if(this.#bits[this.#word(x,y,p)]&bit)index|=1<<p;
    return index;
  }
  #setUnchecked(x,y,index){
    const bit=0x8000>>>(x&15);
    for(let p=0;p<this.#planes;p++){
      const at=this.#word(x,y,p);
      this.#bits[at]=(index&(1<<p))?(this.#bits[at]|bit):(this.#bits[at]&~bit);
    }
  }
  getPixel(x,y){int(x,0,this.#width-1,'x');int(y,0,this.#height-1,'y');return this.#pixelUnchecked(x,y);}
  setPixel(x,y,index){
    int(x,0,this.#width-1,'x');int(y,0,this.#height-1,'y');
    pixelColor(index,this.#planes);this.#setUnchecked(x,y,index);return this;
  }
  clear(index=0){
    pixelColor(index,this.#planes);
    for(let p=0;p<this.#planes;p++)
      this.#bits.fill(index&(1<<p)?0xffff:0,p*this.#planeWords,(p+1)*this.#planeWords);
    return this;
  }
  fillRect(x,y,width,height,index){
    rect(x,y,width,height,this.#width,this.#height,'fill');
    pixelColor(index,this.#planes);
    for(let row=y;row<y+height;row++)for(let col=x;col<x+width;col++)
      this.#setUnchecked(col,row,index);
    return this;
  }
  /** Deliberately reject out-of-bounds endpoints; no implicit clipping. */
  line(x0,y0,x1,y1,index){
    int(x0,0,this.#width-1,'x0');int(y0,0,this.#height-1,'y0');
    int(x1,0,this.#width-1,'x1');int(y1,0,this.#height-1,'y1');
    pixelColor(index,this.#planes);
    let dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,err=dx+dy;
    for(;;){
      this.#setUnchecked(x0,y0,index);if(x0===x1&&y0===y1)break;
      const e=err*2;if(e>=dy){err+=dy;x0+=sx;}if(e<=dx){err+=dx;y0+=sy;}
    }
    return this;
  }
  /** Per-plane three-input minterm, bit (A*4+B*2+C): A=mask B=source C=destination.
   * A omitted means 1; 0xca is cookie cut. Clipping affects destination only.
   * Alias sources are sampled before writes, avoiding overlapping-copy corruption.
   * Reject malformed arguments and invalid source rectangles before changing bytes.
   */
  blit(src,options={}){
    source(src,'source');
    if(!options||![Object.prototype,null].includes(Object.getPrototypeOf(options)))
      throw new TypeError('blit options must be a plain data record');
    const desc=Object.getOwnPropertyDescriptors(options);
    const allowed=['sx','sy','dx','dy','width','height','mask','minterm'];
    if(Reflect.ownKeys(desc).some(key=>typeof key!=='string'||!allowed.includes(key)||
       !desc[key].enumerable||!Object.hasOwn(desc[key],'value')))
      throw new TypeError('unknown or accessor blit option');
    const get=(name,fallback)=>Object.hasOwn(desc,name)?desc[name].value:fallback;
    const sx=get('sx',0),sy=get('sy',0),dx=get('dx',0),dy=get('dy',0);
    const width=get('width',src.width),height=get('height',src.height);
    const mask=get('mask',null),minterm=get('minterm',BLIT_COPY);
    if(src.planes!==this.#planes)throw new RangeError('source/destination plane counts differ');
    if(mask!==null){
      source(mask,'mask');
      if(mask.planes!==1||mask.width!==src.width||mask.height!==src.height)
        throw new RangeError('mask must be one bitplane with source dimensions');
    }
    rect(sx,sy,width,height,src.width,src.height,'source rectangle');
    int(dx,-this.#width,this.#width,'destination x');
    int(dy,-this.#height,this.#height,'destination y');int(minterm,0,255,'minterm');
    const left=Math.max(0,-dx),top=Math.max(0,-dy);
    const right=Math.min(width,this.#width-dx),bottom=Math.min(height,this.#height-dy);
    if(right<=left||bottom<=top)return 0;
    const cw=right-left,ch=bottom-top;
    let oldSrc=null,oldMask=null;
    if(src===this||mask===this){
      oldSrc=src===this?new Uint8Array(cw*ch):null;
      oldMask=mask===this?new Uint8Array(cw*ch):null;
      for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
        const k=y*cw+x,px=sx+left+x,py=sy+top+y;
        if(oldSrc)oldSrc[k]=src.#pixelUnchecked(px,py);
        if(oldMask)oldMask[k]=mask.#pixelUnchecked(px,py);
      }
    }
    let changed=0;
    for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){
      const px=sx+left+x,py=sy+top+y,tx=dx+left+x,ty=dy+top+y,k=y*cw+x;
      const b=oldSrc?oldSrc[k]:src.#pixelUnchecked(px,py);
      const a=mask?(oldMask?oldMask[k]:mask.#pixelUnchecked(px,py)):1;
      const c=this.#pixelUnchecked(tx,ty);let result=0;
      for(let plane=0;plane<this.#planes;plane++){
        const bit=(minterm>>((a<<2)|(((b>>plane)&1)<<1)|((c>>plane)&1)))&1;
        result|=bit<<plane;
      }
      if(result!==c){this.#setUnchecked(tx,ty,result);changed++;}
    }
    return changed;
  }
  indices(){
    const out=new Uint8Array(this.#width*this.#height);
    for(let y=0;y<this.#height;y++)for(let x=0;x<this.#width;x++)
      out[y*this.#width+x]=this.#pixelUnchecked(x,y);
    return out;
  }
  rgba(palette){
    const lut=rgbaPalette(palette,1<<this.#planes),out=new Uint8ClampedArray(this.#width*this.#height*4);
    for(let y=0;y<this.#height;y++)for(let x=0;x<this.#width;x++){
      const src=this.#pixelUnchecked(x,y)*4,dst=(y*this.#width+x)*4;
      out[dst]=lut[src];out[dst+1]=lut[src+1];out[dst+2]=lut[src+2];out[dst+3]=lut[src+3];
    }
    return out;
  }
}
