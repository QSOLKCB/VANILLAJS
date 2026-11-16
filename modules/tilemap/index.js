// SPDX-License-Identifier: Apache-2.0
// Integer 2D grid authoring and swept, axis-separated body motion.
// A tile is one motion2d game unit: 256 subunits. World +Y is up; rows grow down.
import {validateSpriteProject,serializeSpriteProject} from '../sprite2d/index.js';
import {createBody2D,stepBody2D,MOTION2D_SCALE} from '../motion2d/index.js';

export const TILEMAP_FORMAT='qsol.vanillajs.tilemap.v1';
export const TILEMAP_BYTES=512*1024;
export const TILEMAP_SCALE=MOTION2D_SCALE;
export const TILEMAP_LIMITS=Object.freeze({side:64,cells:4096,layers:4,spawns:32,triggers:128});
const S=TILEMAP_SCALE;
function record(v,keys,name,optional=false){
  if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw new TypeError(name+' must be a plain record');
  const own=Reflect.ownKeys(v);
  if((!optional&&own.length!==keys.length)||own.some(k=>typeof k!=='string'||!keys.includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value'))||(!optional&&keys.some(k=>!Object.hasOwn(v,k))))throw new TypeError(name+' has unknown, missing or executable fields');
  return v;
}
function array(v,min,max,name){
  if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length<min||v.length>max||Reflect.ownKeys(v).length!==v.length+1)throw new TypeError(name+' must be a bounded dense array');
  for(let i=0;i<v.length;i++)if(!Object.hasOwn(Object.getOwnPropertyDescriptor(v,String(i))??{},'value'))throw new TypeError(name+' contains an accessor or hole');
  return v;
}
function integer(v,min,max,name){if(!Number.isSafeInteger(v)||v<min||v>max)throw new RangeError(name+' outside integer bounds');return v;}
function text(v,max,name){if(typeof v!=='string'||!v.length||v.length>max||/[\u0000-\u001f\u007f]/.test(v))throw new TypeError('invalid '+name);return v;}
function id(v){if(typeof v!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(v))throw new TypeError('invalid identifier');return v;}
function unique(values,name){if(new Set(values).size!==values.length)throw new TypeError('duplicate '+name);}
function bytes(raw){if(new TextEncoder().encode(raw).length>TILEMAP_BYTES)throw new RangeError('tilemap exceeds 512 KiB');return raw;}
const clone=v=>JSON.parse(JSON.stringify(v));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/** Admission always returns an owned map. Unknown fields are never ignored. */
export function validateTilemap(value){
  record(value,['format','version','name','width','height','tileset','layers','collision','spawns','triggers','camera'],'tilemap');
  if(value.format!==TILEMAP_FORMAT||value.version!==1)throw new RangeError('unsupported tilemap format or version');
  const width=integer(value.width,1,64,'width'),height=integer(value.height,1,64,'height'),count=width*height;
  const tileset=validateSpriteProject(value.tileset);
  serializeSpriteProject(tileset); // Preserve the existing embedded asset byte contract.
  const layers=array(value.layers,1,4,'layers').map(layer=>{
    record(layer,['id','name','parallax','cells'],'layer');
    if(!Number.isFinite(layer.parallax)||layer.parallax<0||layer.parallax>1)throw new RangeError('parallax must be 0–1');
    return {id:id(layer.id),name:text(layer.name,48,'layer name'),parallax:layer.parallax,cells:array(layer.cells,count,count,'layer cells').map(v=>integer(v,-1,tileset.frames.length-1,'atlas frame'))};
  });
  unique(layers.map(l=>l.id),'layer identifier');
  const collision=array(value.collision,count,count,'collision cells').map(v=>integer(v,0,1,'collision cell'));
  function marker(v,trigger){
    record(v,trigger?['id','column','row','tag']:['id','column','row'],'marker');
    const column=integer(v.column,0,width-1,'marker column'),row=integer(v.row,0,height-1,'marker row');
    if(collision[row*width+column])throw new RangeError('marker occupies a collision tile');
    return {id:id(v.id),column,row,...(trigger?{tag:id(v.tag)}:{})};
  }
  const spawns=array(value.spawns,0,32,'spawns').map(v=>marker(v,false)),triggers=array(value.triggers,0,128,'triggers').map(v=>marker(v,true));
  unique([...spawns,...triggers].map(v=>v.id),'marker identifier');
  unique(spawns.map(v=>v.column+','+v.row),'spawn cell');
  unique(triggers.map(v=>v.column+','+v.row),'trigger cell');
  record(value.camera,['follow','deadZoneX','deadZoneY'],'camera');
  if(typeof value.camera.follow!=='boolean')throw new TypeError('camera follow must be boolean');
  const result={format:TILEMAP_FORMAT,version:1,name:text(value.name,80,'map name'),width,height,tileset,layers,collision,spawns,triggers,camera:{follow:value.camera.follow,deadZoneX:integer(value.camera.deadZoneX,0,4096,'camera deadZoneX'),deadZoneY:integer(value.camera.deadZoneY,0,4096,'camera deadZoneY')}};
  bytes(JSON.stringify(result));
  return result;
}
export function parseTilemap(raw){if(typeof raw!=='string')throw new TypeError('tilemap JSON text required');return validateTilemap(JSON.parse(bytes(raw)));}
export function serializeTilemap(value){return bytes(JSON.stringify(validateTilemap(value))+'\n');}
export function createTilemap({width=24,height=14,name='Untitled map',tileset}={}){
  integer(width,1,64,'width');integer(height,1,64,'height');
  return validateTilemap({format:TILEMAP_FORMAT,version:1,name,width,height,tileset,layers:[{id:'ground',name:'Ground',parallax:1,cells:Array(width*height).fill(-1)}],collision:Array(width*height).fill(0),spawns:[],triggers:[],camera:{follow:true,deadZoneX:128,deadZoneY:128}});
}
function bounds(m){return {minX:0,minY:0,maxX:m.width*S,maxY:m.height*S};}
function toWorld(m,column,row){integer(column,0,m.width-1,'column');integer(row,0,m.height-1,'row');return {x:column*S+S/2,y:(m.height-row)*S-S/2};}
function toTile(m,x,y){integer(x,0,m.width*S-1,'world x');integer(y,0,m.height*S-1,'world y');return {column:Math.floor(x/S),row:m.height-1-Math.floor(y/S)};}
export function tileBounds(value){return bounds(validateTilemap(value));}
export function tileToWorld(value,column,row){return toWorld(validateTilemap(value),column,row);}
export function worldToTile(value,x,y){return toTile(validateTilemap(value),x,y);}
function shape(options){
  record(options,['halfWidth','halfHeight'],'body shape',true);
  return {halfWidth:integer(options.halfWidth??80,1,128,'halfWidth'),halfHeight:integer(options.halfHeight??112,1,128,'halfHeight')};
}
function body(value){
  record(value,['x','y','vx','vy','heading','grounded'],'body');
  if(typeof value.grounded!=='boolean')throw new TypeError('grounded must be boolean');
  integer(value.x,-1000000000,1000000000,'body x');integer(value.y,-1000000000,1000000000,'body y');
  integer(value.vx,-512,512,'body vx');integer(value.vy,-512,512,'body vy');integer(value.heading,0,15,'body heading');
  return createBody2D(value);
}
function solid(m,column,upRow){return column<0||upRow<0||column>=m.width||upRow>=m.height||m.collision[(m.height-upRow-1)*m.width+column]===1;}
function overlap(m,x,y,hw,hh){
  for(let ty=Math.floor((y-hh)/S);ty<=Math.floor((y+hh-1)/S);ty++)for(let tx=Math.floor((x-hw)/S);tx<=Math.floor((x+hw-1)/S);tx++)if(solid(m,tx,ty))return true;
  return false;
}
function position(m,b,s){
  if(b.x<s.halfWidth||b.x>m.width*S-s.halfWidth||b.y<s.halfHeight||b.y>m.height*S-s.halfHeight||overlap(m,b.x,b.y,s.halfWidth,s.halfHeight))throw new RangeError('body starts outside the world or overlapping a solid tile');
}
function supported(m,b,s){return overlap(m,b.x,b.y-1,s.halfWidth,s.halfHeight);}
function sweep(m,value,delta,options){
  const b=body(value),s=shape(options),hw=s.halfWidth,hh=s.halfHeight;
  record(delta,['x','y'],'displacement');
  const dx=integer(delta.x,-16384,16384,'displacement x'),dy=integer(delta.y,-16384,16384,'displacement y');
  position(m,b,s);let x=b.x,y=b.y,hitX=0,hitY=0;
  // Each axis sweeps complete faces through all crossed tile intervals. Endpoint
  // occupancy alone cannot stop a fast body from skipping a one-tile wall.
  if(dx!==0){
    let move=dx;
    if(dx>0&&x+hw+move>=m.width*S){move=m.width*S-x-hw;hitX=-1;}
    if(dx<0&&x-hw+move<=0){move=hw-x;hitX=1;}
    for(let ty=Math.floor((y-hh)/S);ty<=Math.floor((y+hh-1)/S);ty++)for(let tx=0;tx<m.width;tx++)if(solid(m,tx,ty)){
      if(dx>0&&tx*S>=x+hw&&tx*S-(x+hw)<=move){move=tx*S-x-hw;hitX=-1;}
      if(dx<0&&(tx+1)*S<=x-hw&&(tx+1)*S-(x-hw)>=move){move=(tx+1)*S-x+hw;hitX=1;}
    }
    x+=move;
  }
  if(dy!==0){
    let move=dy;
    if(dy>0&&y+hh+move>=m.height*S){move=m.height*S-y-hh;hitY=-1;}
    if(dy<0&&y-hh+move<=0){move=hh-y;hitY=1;}
    for(let tx=Math.floor((x-hw)/S);tx<=Math.floor((x+hw-1)/S);tx++)for(let ty=0;ty<m.height;ty++)if(solid(m,tx,ty)){
      if(dy>0&&ty*S>=y+hh&&ty*S-(y+hh)<=move){move=ty*S-y-hh;hitY=-1;}
      if(dy<0&&(ty+1)*S<=y-hh&&(ty+1)*S-(y-hh)>=move){move=(ty+1)*S-y+hh;hitY=1;}
    }
    y+=move;
  }
  const next=createBody2D({x,y,vx:hitX?0:b.vx,vy:hitY?0:b.vy,heading:b.heading,grounded:supported(m,{x,y},s)});
  return {body:next,hitX,hitY};
}
export function sweepTileBody(value,b,delta,options={}){return sweep(validateTilemap(value),b,delta,options);}
function step(m,value,controls,options){
  record(options,['halfWidth','halfHeight','profile','motor'],'step options',true);
  const s=shape({halfWidth:options.halfWidth??80,halfHeight:options.halfHeight??112}),b=body(value);
  position(m,b,s);
  record(controls,['x','y','steer','throttle','jump','impulseX','impulseY'],'controls',true);
  const motor=options.motor??{};record(motor,['speed','acceleration','drag','jumpSpeed','gravity','fallSpeed'],'motor',true);
  const ownedMotor={};for(const k of Object.keys(motor))ownedMotor[k]=integer(motor[k],1,512,'motor '+k);
  const proposal=stepBody2D({...b,grounded:supported(m,b,s)},controls,{profile:options.profile??'platform',motor:ownedMotor,bounds:{minX:-100000,minY:-100000,maxX:100000,maxY:100000},groundY:-100000});
  return sweep(m,{...b,vx:proposal.vx,vy:proposal.vy,heading:proposal.heading},{x:proposal.x-b.x,y:proposal.y-b.y},s);
}
export function stepTileBody(value,b,controls={},options={}){return step(validateTilemap(value),b,controls,options);}
function camera(m,target,viewport,previous){
  record(target,['x','y'],'target');record(viewport,['width','height'],'viewport');record(previous,['x','y'],'previous camera');
  integer(target.x,0,m.width*S,'camera target x');integer(target.y,0,m.height*S,'camera target y');
  integer(previous.x,-32768,32768,'previous camera x');integer(previous.y,-32768,32768,'previous camera y');
  const w=integer(viewport.width,1,32768,'viewport width'),h=integer(viewport.height,1,32768,'viewport height');
  function follow(p,t,d,view,total){
    if(m.camera.follow)p+=t<p-d?t-(p-d):t>p+d?t-(p+d):0;
    return view>=total?total/2:clamp(p,Math.ceil(view/2),total-Math.ceil(view/2));
  }
  return {x:follow(previous.x,target.x,m.camera.deadZoneX,w,m.width*S),y:follow(previous.y,target.y,m.camera.deadZoneY,h,m.height*S)};
}
export function cameraFollow(value,target,viewport,previous=target){return camera(validateTilemap(value),target,viewport,previous);}

/** Admission once, private ownership thereafter. Mutable caller data is never retained. */
export class Tilemap {
  #map;
  constructor(value){this.#map=validateTilemap(value);}
  replace(value){const next=validateTilemap(value);this.#map=next;return this.snapshot();}
  snapshot(){return clone(this.#map);}
  bounds(){return bounds(this.#map);}
  tileToWorld(column,row){return toWorld(this.#map,column,row);}
  worldToTile(x,y){return toTile(this.#map,x,y);}
  sweep(b,delta,options={}){return sweep(this.#map,b,delta,options);}
  step(b,controls={},options={}){return step(this.#map,b,controls,options);}
  camera(target,viewport,previous=target){return camera(this.#map,target,viewport,previous);}
}
