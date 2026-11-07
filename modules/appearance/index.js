// SPDX-License-Identifier: Apache-2.0
// Generalised from the render-independent, colour-LUT/LOD/seeded-emitter design
// in QSOLKCB/CorpoWars3d PR #8, source 7b42cae4d7f46a36f00e86beee35cf4258994dab.
// No game skins, art, factions, shaders, frame clock or ambient randomness.
import {CuboidStream} from '../cuboid-stream/index.js';

const MAX_PALETTE=256, MAX_SLOTS=32, MAX_PARTS=256, MAX_BOUND=1e6;
const own=(o,k)=>Object.hasOwn(o,k);
const finite=(v,name)=>{
  if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>MAX_BOUND)
    throw new RangeError(name+' must be finite and within +/-1e6');
  return v===0?0:v;
};
const triple=(v,name)=>{
  if(!Array.isArray(v)||v.length!==3||
     ![0,1,2].every(i=>own(v,i)))
    throw new TypeError(name+' must be a dense three-element array');
  return Object.freeze(v.map((x,i)=>finite(x,name+'['+i+']')));
};
const colour=(v,i)=>{
  const a=triple(v,'palette['+i+']');
  if(a.some(x=>x<0||x>1))throw new RangeError('RGB channels must be in [0, 1]');
  return a;
};
const uint32=(n,name)=>{
  if(!Number.isSafeInteger(n)||n<0||n>0xffffffff)
    throw new RangeError(name+' must be a uint32 integer');
  return n;
};
function validateIndex(value,count,label){
  if(!Number.isInteger(value)||value<0||value>=count)
    throw new RangeError(label+' must index the palette');
  return value;
}
const validName=(s)=>typeof s==='string'&&/^[a-z][a-z0-9_-]{0,31}$/.test(s);

function partsFor(raw,slotMap,bounds,kind){
  if(!Array.isArray(raw)||raw.length>MAX_PARTS||
     !Array.from({length:raw.length},(_,i)=>own(raw,i)).every(Boolean))
    throw new RangeError(kind+' must be a dense array of <=256 parts');
  return Object.freeze(raw.map((part,i)=>{
    const label=kind+'['+i+']';
    if(!part||typeof part!=='object')throw new TypeError(label+' must be an object');
    const {x,y,z,w,h,d,slot,glow=0,gaitZ=0,detail='both',head=false}=part;
    const v=[x,y,z,w,h,d,gaitZ,glow].map((n,j)=>finite(n,label+'.'+['x','y','z','w','h','d','gaitZ','glow'][j]));
    if(v.slice(3,6).some(n=>n<=0))throw new RangeError(label+' must have positive cuboid dimensions');
    if(glow<0||glow>1)throw new RangeError(label+' glow must be [0, 1]');
    if(!slotMap.has(slot))throw new TypeError(label+' unknown colour slot');
    if(detail!=='high'&&detail!=='both')throw new TypeError(label+' detail must be high or both');
    if(typeof head!=='boolean')throw new TypeError(label+' head must be boolean');
    const eps=1e-12;
    if(Math.abs(x)+w/2>bounds.halfWidth+eps ||
       y-h/2<-eps||y+h/2>bounds.height+eps ||
       z-Math.abs(gaitZ)-d/2<bounds.minZ-eps ||
       z+Math.abs(gaitZ)+d/2>bounds.maxZ+eps)
      throw new RangeError(label+' escapes declared hit volume at gait extremes');
    if(head&&y+h/2<bounds.height*bounds.headBand-eps)
      throw new RangeError(label+' head part does not reach declared headshot band');
    return Object.freeze({x,y,z,w,h,d,slotIndex:slotMap.get(slot),glow,gaitZ,detail,head});
  }));
}

/** Compile a reusable appearance. Palette and colour selection are copied
 * into frozen records; a model can be shared by WebGL/software consumers.
 * All bounding-volume checks occur before the model becomes usable. */
export function createAppearance({palette,slots,colours,parts,fallen=[],
  variants={},bounds={}}={}){
  if(!Array.isArray(palette)||palette.length<1||palette.length>MAX_PALETTE||
     !Array.from({length:palette.length},(_,i)=>own(palette,i)).every(Boolean))
    throw new RangeError('palette must have 1..256 colours');
  const lut=Object.freeze(palette.map(colour));
  if(!Array.isArray(slots)||slots.length<1||slots.length>MAX_SLOTS||
    !Array.from({length:slots.length},(_,i)=>own(slots,i)).every(Boolean)||
    slots.some(x=>!validName(x))||new Set(slots).size!==slots.length)
    throw new TypeError('slots must be 1..32 distinct lower-case identifiers');
  const slotNames=Object.freeze([...slots]);
  const slotMap=new Map(slotNames.map((s,i)=>[s,i]));
  if(!Array.isArray(colours)||colours.length!==slotNames.length||
     !slotNames.every((_,i)=>own(colours,i)))
    throw new TypeError('colours must provide one palette index per slot');
  const indices=Object.freeze(colours.map((x,i)=>validateIndex(x,lut.length,'colours['+i+']')));
  if(!bounds||typeof bounds!=='object')throw new TypeError('bounds required');
  const b={height:finite(bounds.height,'height'),halfWidth:finite(bounds.halfWidth,'halfWidth'),
    minZ:finite(bounds.minZ,'minZ'),maxZ:finite(bounds.maxZ,'maxZ'),
    headBand:bounds.headBand===undefined?.82:finite(bounds.headBand,'headBand')};
  if(b.height<=0||b.halfWidth<=0||b.minZ>=b.maxZ||b.headBand<0||b.headBand>1)
    throw new RangeError('invalid declared hit volume');
  Object.freeze(b);
  if(variants===null||typeof variants!=='object'||Array.isArray(variants))
    throw new TypeError('variants must be a slot-to-indices object');
  const options=new Array(slotNames.length).fill(null);
  for(const [slot,values] of Object.entries(variants)){
    const i=slotMap.get(slot);
    if(i===undefined||!Array.isArray(values)||values.length<1||values.length>MAX_PALETTE||
       !Array.from({length:values.length},(_,j)=>own(values,j)).every(Boolean))
      throw new TypeError('variant choices must be a nonempty palette-index list for a known slot');
    options[i]=Object.freeze(values.map((x,j)=>validateIndex(x,lut.length,slot+'['+j+']')));
  }
  const live=partsFor(parts,slotMap,b,'parts');
  const dead=partsFor(fallen,slotMap,b,'fallen');
  if(!live.length)throw new RangeError('at least one live part required');
  return Object.freeze({palette:lut,slots:slotNames,colours:indices,bounds:b,
    parts:live,fallen:dead,variants:Object.freeze(options)});
}

/** Three seeded 16-bit words, four deterministic additive rotations.
 * Source-inspired by PR #8's 1980s-style crowd variation, with explicit
 * uint32 ID validation and no global unbounded memoization. */
export function seedAppearance(id){
  const n=uint32(id,'actor id');
  let a=(0x4357^Math.imul(n,0x9e37))&0xffff;
  let b=(0x5752+Math.imul(n,0x0101))&0xffff;
  let c=(0x3344^(n<<5))&0xffff;
  for(let i=0;i<4;i++){const next=(a+b+c)&0xffff;a=b;b=c;c=next;}
  return Object.freeze([a,b,c]);
}

function poseInput({id=0,position=[0,0,0],yaw=0,gait=0,lod='high',
  flash=false,dead=false}={}){
  const actor=uint32(id,'actor id');
  const p=triple(position,'position');
  const angle=finite(yaw,'yaw'),stride=finite(gait,'gait');
  if(Math.abs(stride)>1)throw new RangeError('gait must be [-1,1]');
  if(lod!=='low'&&lod!=='high')throw new RangeError('lod must be high or low');
  if(typeof flash!=='boolean'||typeof dead!=='boolean')
    throw new TypeError('flash/dead must be boolean');
  return {id:actor,position:p,yaw:angle,gait:stride,lod,flash,dead};
}
function countParts(model,p){
  const source=p.dead?model.fallen:model.parts;
  let count=0;
  for(const part of source)if(p.lod==='high'||part.detail==='both')count++;
  return count;
}

/** Emit a renderer-neutral list of world-space, yaw-oriented cuboids directly
 * to callback(x,y,z,w,h,d,rgb,glow,yaw). One callback per included part.
 * Invalid appearance/pose is rejected before any callback; caller failures
 * during emission are not rolled back. No gameplay or collision state changes. */
export function emitAppearance(model,callback,pose={}){
  if(!model||!Object.isFrozen(model)||!Array.isArray(model.palette)||
     !Array.isArray(model.parts))throw new TypeError('compiled appearance required');
  if(typeof callback!=='function')throw new TypeError('callback required');
  const p=poseInput(pose),count=countParts(model,p);
  if(!count)return 0;
  const seeds=seedAppearance(p.id);
  const paletteIndices=model.colours.map((original,i)=>{
    const choices=model.variants[i];
    return choices?choices[(seeds[i%3]+Math.imul(i+1,0x9e37))%choices.length]:original;
  });
  const cos=Math.cos(p.yaw),sin=Math.sin(p.yaw);
  const source=p.dead?model.fallen:model.parts;
  for(const part of source){
    if(p.lod==='low'&&part.detail==='high')continue;
    const z=part.z+part.gaitZ*p.gait;
    const x=p.position[0]+part.x*cos+z*sin;
    const y=p.position[1]+part.y;
    const depth=p.position[2]-part.x*sin+z*cos;
    // Verify transformed Float32 and world ranges before calling the renderer.
    if(![x,y,depth].every(v=>Number.isFinite(v)&&Number.isFinite(Math.fround(v))))
      throw new RangeError('appearance world position overflow');
    callback(x,y,depth,part.w,part.h,part.d,
      model.palette[paletteIndices[part.slotIndex]],
      p.flash?1:part.glow,p.yaw);
  }
  return count;
}

/** Adapter for the existing retained CuboidStream. Does not change shaders,
 * require GPU instancing or introduce per-part mesh allocations. */
export function emitAppearanceToStream(model,stream,pose={}){
  if(!(stream instanceof CuboidStream))throw new TypeError('CuboidStream required');
  const p=poseInput(pose),count=countParts(model,p);
  if(count>16384-stream.count)throw new RangeError('appearance exceeds remaining stream capacity');
  return emitAppearance(model,(...args)=>stream.box(...args),p);
}
