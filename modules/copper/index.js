// SPDX-License-Identifier: Apache-2.0
// COPPER-001 — original bounded scanline palette/scroll command processor.
// Presentation-only: no CRT clock, DMA, interrupts, registers or game authority.
export const COPPER_FORMAT='qsol.vanillajs.copper.v1';
export const COPPER_LIMITS=Object.freeze({width:512,height:384,paletteEntries:16,commands:512,scroll:511});
const owned=new WeakMap();
function integer(n,lo,hi,name){
  if(!Number.isSafeInteger(n)||n<lo||n>hi)throw new RangeError(name+' outside integer domain');
  return n;
}
function plain(o,keys,name){
  if(!o||![Object.prototype,null].includes(Object.getPrototypeOf(o)))throw new TypeError(name+' needs plain data');
  const d=Object.getOwnPropertyDescriptors(o);
  if(Reflect.ownKeys(d).length!==keys.length||Reflect.ownKeys(d).some(k=>
    typeof k!=='string'||!keys.includes(k)||!Object.hasOwn(d[k],'value')||!d[k].enumerable)||
    keys.some(k=>!Object.hasOwn(d,k)))
    throw new TypeError(name+' requires exact fields with no accessors');
  return d;
}
function dense(a,lo,hi,name){
  if(!Array.isArray(a)||Object.getPrototypeOf(a)!==Array.prototype||a.length<lo||a.length>hi||
    Reflect.ownKeys(a).length!==a.length+1)throw new TypeError(name+' must be dense bounded plain array');
  const ds=Object.getOwnPropertyDescriptors(a);
  return Array.from({length:a.length},(_,i)=>{
    const d=ds[i];if(!d||!Object.hasOwn(d,'value')||!d.enumerable)
      throw new TypeError(name+' contains hole/accessor');
    return d.value;
  });
}
function color(c){return dense(c,4,4,'color').map(v=>integer(v,0,255,'RGBA byte'));}
function palette(input){
  const entries=dense(input,16,16,'palette'),out=new Uint8Array(64);
  entries.forEach((c,i)=>out.set(color(c),i*4));return out;
}
function copyProgram(options){
  const d=plain(options,['height','palette','commands'],'copper program');
  const height=integer(d.height.value,1,COPPER_LIMITS.height,'height');
  const colors=palette(d.palette.value);
  const commands=dense(d.commands.value,0,COPPER_LIMITS.commands,'commands');
  const encoded=[];let previous=-1;
  for(const cmd of commands){
    if(!cmd||typeof cmd!=='object')throw new TypeError('command needs plain record');
    const descriptors=Object.getOwnPropertyDescriptors(cmd),op=descriptors.op?.value;
    if(op==='palette'){
      const c=plain(cmd,['line','op','index','color'],'palette command');
      const line=integer(c.line.value,0,height-1,'line');
      if(line<previous)throw new RangeError('commands must be ordered by scanline');
      previous=line;encoded.push(Object.freeze({line,op,
        index:integer(c.index.value,0,15,'palette index'),color:color(c.color.value)}));
    }else if(op==='scroll'){
      const c=plain(cmd,['line','op','x'],'scroll command');
      const line=integer(c.line.value,0,height-1,'line');
      if(line<previous)throw new RangeError('commands must be ordered by scanline');
      previous=line;encoded.push(Object.freeze({line,op,
        x:integer(c.x.value,-COPPER_LIMITS.scroll,COPPER_LIMITS.scroll,'scroll')}));
    }else throw new TypeError('unsupported copper command');
  }
  return {height,colors,commands:encoded};
}
/** Inert ordered scanline list. Same-line commands execute in input order. */
export function createCopperProgram(spec){
  const data=copyProgram(spec);
  const handle=Object.freeze({format:COPPER_FORMAT,height:data.height,commandCount:data.commands.length});
  owned.set(handle,data);return handle;
}
/** Own retained RGBA output. Indexed source remains untouched.
 * Scroll is horizontal wrapping; command changes persist between rows
 * but are reset to the initial palette/zero scroll for each render call.
 */
export class CopperDisplay{
  #width;#height;#rgba;
  constructor(width,height){
    this.#width=integer(width,1,COPPER_LIMITS.width,'width');
    this.#height=integer(height,1,COPPER_LIMITS.height,'height');
    this.#rgba=new Uint8ClampedArray(width*height*4);
  }
  get width(){return this.#width;}
  get height(){return this.#height;}
  get retainedBytes(){return this.#rgba.byteLength;}
  /** Caller-owned access to writable PRESENTATION memory; not an authoritative snapshot. */
  view(){return this.#rgba;}
  render(indexed,program){
    const info=owned.get(program);
    if(!info)throw new TypeError('createCopperProgram handle required');
    if(info.height!==this.#height)throw new RangeError('program/display height mismatch');
    if(!(indexed instanceof Uint8Array)||Object.getPrototypeOf(indexed)!==Uint8Array.prototype||
       indexed.length!==this.#width*this.#height)
      throw new TypeError('exact native Uint8Array indexed frame required');
    if(!(indexed.buffer instanceof ArrayBuffer)||indexed.buffer===this.#rgba.buffer)
      throw new TypeError('indexed source must own a separate ordinary ArrayBuffer');
    // Check every index before writing a single RGBA byte.
    for(let i=0;i<indexed.length;i++)if(indexed[i]>15)
      throw new RangeError('palette index outside 0..15');
    const colors=info.colors.slice(),commands=info.commands;
    let cursor=0,scroll=0;const width=this.#width;
    for(let y=0;y<this.#height;y++){
      while(cursor<commands.length&&commands[cursor].line===y){
        const c=commands[cursor++];
        if(c.op==='scroll')scroll=c.x;
        else colors.set(c.color,c.index*4);
      }
      let sourceX=((scroll%width)+width)%width;
      for(let x=0;x<width;x++){
        const src=indexed[y*width+sourceX]*4,dst=(y*width+x)*4;
        this.#rgba[dst]=colors[src];this.#rgba[dst+1]=colors[src+1];
        this.#rgba[dst+2]=colors[src+2];this.#rgba[dst+3]=colors[src+3];
        if(++sourceX===width)sourceX=0;
      }
    }
    return this.#rgba;
  }
}
