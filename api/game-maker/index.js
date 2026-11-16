// SPDX-License-Identifier: Apache-2.0
// Small, explicitly owned facade over the existing native Canvas2D path.
// Apps supply elapsed time, input snapshots, assets and any audio device.
import {FixedClock} from '../../modules/time/index.js';
import {Actions} from '../../modules/input/index.js';
import {validateSpriteProject,parseSpriteProject,buildSpriteAtlas} from '../../modules/sprite2d/index.js';
import {validateTilemap,parseTilemap} from '../../modules/tilemap/index.js';
import {createSound2D} from '../../modules/audio2d/index.js';
import {createEffectPlayer} from '../audio/effects.js';

export const GAME_MAKER_LIMITS=Object.freeze({assetsPerKind:16,particles:256,burst:64,text:1024,surface:2048});
const ACTIONS=Object.freeze(['left','right','up','down','jump','action']);
const finite=(n,label,min=-1e6,max=1e6)=>{
  if(!Number.isFinite(n)||n<min||n>max)throw new RangeError('Invalid '+label);
  return n;
};
const integer=(n,label,min,max)=>{
  finite(n,label,min,max);if(!Number.isSafeInteger(n))throw new RangeError('Invalid '+label);return n;
};
function record(value,keys,required=[],label='options'){
  if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new TypeError(label+' must be a plain record');
  const own=Reflect.ownKeys(value);
  if(own.some(k=>typeof k!=='string'||!keys.includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,k),'value'))||required.some(k=>!Object.hasOwn(value,k)))throw new TypeError('Unknown, missing or executable '+label+' field');
  return value;
}
const color=value=>{
  if(typeof value!=='string'||!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(value))throw new TypeError('Color must be #RRGGBB or #RRGGBBAA');
  return value;
};
const identifier=value=>{
  if(typeof value!=='string'||! /^[a-z][a-z0-9-]{0,47}$/.test(value))throw new TypeError('Invalid local asset ID');
  return value;
};
function soundData(value){
  record(value,['frames','events'],['frames','events'],'sound');
  const events=value.events;
  if(!Array.isArray(events)||Object.getPrototypeOf(events)!==Array.prototype||events.length>128||Reflect.ownKeys(events).length!==events.length+1)throw new TypeError('Sound events must be a bounded dense array');
  for(let i=0;i<events.length;i++){
    if(!Object.hasOwn(Object.getOwnPropertyDescriptor(events,String(i))??{},'value'))throw new TypeError('Executable sound event');
    record(events[i],['id','channel','sample','duration','frequency','wave','gain','seed'],['id','channel','sample','duration','frequency','wave'],'sound event');
  }
  return createSound2D(value);
}

/** Own one supplied canvas. Never installs listeners, schedules frames or fetches. */
export function createGameMaker(options){
  record(options,['canvas','width','height','pixelsPerUnit','step','maxSteps','audioContext'],['canvas']);
  const {canvas,width=640,height=360,pixelsPerUnit=32,step=1/60,maxSteps=8,audioContext=null}=options;
  integer(width,'surface width',1,2048);integer(height,'surface height',1,2048);
  finite(pixelsPerUnit,'pixels per unit',1,256);finite(step,'clock step',1/240,1);integer(maxSteps,'catch-up steps',1,32);
  if(!canvas||typeof canvas.getContext!=='function')throw new TypeError('A supplied canvas is required');
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas 2D is unavailable');
  let player=audioContext===null?null:createEffectPlayer(audioContext,{maxVoices:12,maxBuffers:16});
  const clock=new FixedClock({step,maxFrame:.25,maxSteps}),actions=new Actions(),blocked=new Set();
  const sprites=new Map(),maps=new Map(),sounds=new Map();
  let camera={x:0,y:0,zoom:1},particles=[],disposed=false,advancing=false;
  canvas.width=width;canvas.height=height;clock.setPaused(true);
  const check=()=>{if(disposed)throw new Error('Game Maker is disposed');};
  const ensureCapacity=(assets,id)=>{identifier(id);if(!assets.has(id)&&assets.size>=16)throw new RangeError('Local asset capacity is 16 per kind');};
  const asset=(assets,id)=>{identifier(id);const item=assets.get(id);if(!item)throw new RangeError('Unknown local asset: '+id);return item;};
  const point=(x,y,parallax=1)=>[(x-camera.x*parallax)*pixelsPerUnit*camera.zoom+width/2,height/2-(y-camera.y*parallax)*pixelsPerUnit*camera.zoom];
  function atlas(project){
    const generated=buildSpriteAtlas(project,{columns:4,padding:0});let surface;
    if(canvas.ownerDocument&&typeof canvas.ownerDocument.createElement==='function')surface=canvas.ownerDocument.createElement('canvas');
    else if(typeof OffscreenCanvas==='function')surface=new OffscreenCanvas(1,1);
    else throw new Error('A local Canvas2D asset surface is unavailable');
    try{
      surface.width=generated.metadata.width;surface.height=generated.metadata.height;
      const target=surface.getContext('2d');if(!target)throw new Error('Canvas 2D is unavailable for assets');
      const pixels=target.createImageData(surface.width,surface.height);pixels.data.set(generated.rgba);target.putImageData(pixels,0,0);
      return {surface,frames:generated.metadata.frames,project};
    }catch(error){surface.width=0;surface.height=0;throw error;}
  }
  function releaseAtlas(item){item.surface.width=0;item.surface.height=0;}
  function drawSprite(item,frame,x,y,w,h,flipX=false,parallax=1){
    const source=item.frames[frame],[px,py]=point(x,y+h,parallax),pw=w*pixelsPerUnit*camera.zoom,ph=h*pixelsPerUnit*camera.zoom;
    if(px+pw<0||py+ph<0||px>width||py>height)return false;
    ctx.imageSmoothingEnabled=false;
    if(flipX){ctx.save();try{ctx.translate(px+pw,py);ctx.scale(-1,1);ctx.drawImage(item.surface,source.x,source.y,source.width,source.height,0,0,pw,ph);}finally{ctx.restore();}}
    else ctx.drawImage(item.surface,source.x,source.y,source.width,source.height,px,py,pw,ph);
    return true;
  }
  function input(consume=false){
    const held={},pressed={};
    for(const action of ACTIONS){held[action]=Boolean(actions.value(action));pressed[action]=consume?actions.consume(action):actions.edges.has(action);}
    return Object.freeze({x:Number(held.right)-Number(held.left),y:Number(held.up)-Number(held.down),jump:held.jump,action:held.action,held:Object.freeze(held),pressed:Object.freeze(pressed)});
  }
  function pause(value=true){
    check();if(typeof value!=='boolean')throw new TypeError('Pause state must be boolean');
    clock.setPaused(value);
    if(value){actions.clear();for(const a of ACTIONS)blocked.add(a);player?.stopAll();}
  }
  const api={
    begin(background='#081526'){
      check();color(background);ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
      ctx.clearRect(0,0,width,height);ctx.fillStyle=background;ctx.fillRect(0,0,width,height);
    },
    setCamera(value){check();record(value,['x','y','zoom']);const next={x:finite(value.x??0,'camera x'),y:finite(value.y??0,'camera y'),zoom:finite(value.zoom??1,'camera zoom',.125,8)};camera=next;return Object.freeze({...camera});},
    rect(x,y,w,h,fill='#ffffff'){
      check();finite(x,'x');finite(y,'y');finite(w,'width',0,1e4);finite(h,'height',0,1e4);color(fill);
      const p=point(x,y+h);ctx.fillStyle=fill;ctx.fillRect(p[0],p[1],w*pixelsPerUnit*camera.zoom,h*pixelsPerUnit*camera.zoom);
    },
    circle(x,y,radius,fill='#ffffff'){
      check();finite(x,'x');finite(y,'y');finite(radius,'radius',0,1e4);color(fill);const p=point(x,y);
      ctx.fillStyle=fill;ctx.beginPath();ctx.arc(p[0],p[1],radius*pixelsPerUnit*camera.zoom,0,Math.PI*2);ctx.fill();
    },
    line(x1,y1,x2,y2,stroke='#ffffff',lineWidth=.03){
      check();for(const v of [x1,y1,x2,y2])finite(v,'line coordinate');color(stroke);finite(lineWidth,'line width',.001,100);
      const a=point(x1,y1),b=point(x2,y2);ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth*pixelsPerUnit*camera.zoom;
      ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
    },
    text(value,x,y,options={}){
      check();record(options,['color','size','screen']);
      if(typeof value!=='string'||value.length>1024)throw new TypeError('Text must be at most 1024 characters');
      finite(x,'text x');finite(y,'text y');const fill=color(options.color??'#ffffff'),size=integer(options.size??14,'text size',6,128),screen=options.screen??false;
      if(typeof screen!=='boolean')throw new TypeError('screen must be boolean');
      const p=screen?[x,y]:point(x,y);ctx.fillStyle=fill;ctx.font=size+'px monospace';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(value,...p);
    },
    loadSprite(id,value){
      check();ensureCapacity(sprites,id);const project=typeof value==='string'?parseSpriteProject(value):validateSpriteProject(value),next=atlas(project),previous=sprites.get(id);
      sprites.set(id,next);if(previous)releaseAtlas(previous);return Object.freeze({id,frames:next.frames.length,size:project.recipe.size});
    },
    sprite(id,frame,x,y,options={}){
      check();record(options,['width','height','flipX']);const item=asset(sprites,id);integer(frame,'sprite frame',0,item.frames.length-1);
      finite(x,'sprite x');finite(y,'sprite y');const w=finite(options.width??1,'sprite width',.001,1e4),h=finite(options.height??1,'sprite height',.001,1e4),flipX=options.flipX??false;
      if(typeof flipX!=='boolean')throw new TypeError('flipX must be boolean');return drawSprite(item,frame,x,y,w,h,flipX);
    },
    spriteProject(id){check();return validateSpriteProject(asset(sprites,id).project);},
    loadTilemap(id,value){
      check();ensureCapacity(maps,id);const data=typeof value==='string'?parseTilemap(value):validateTilemap(value),tiles=atlas(data.tileset),previous=maps.get(id);
      maps.set(id,{data,tiles});if(previous)releaseAtlas(previous.tiles);return Object.freeze({id,width:data.width,height:data.height,layers:data.layers.length});
    },
    tilemapData(id){check();return validateTilemap(asset(maps,id).data);},
    tilemap(id,options={}){
      check();record(options,['layer']);const {data,tiles}=asset(maps,id),name=options.layer??null;
      if(name!==null&&(typeof name!=='string'||!data.layers.some(l=>l.id===name)))throw new RangeError('Unknown tilemap layer');
      let drawn=0;
      for(const layer of data.layers){if(name!==null&&layer.id!==name)continue;
        for(let row=0;row<data.height;row++)for(let col=0;col<data.width;col++){
          const frame=layer.cells[row*data.width+col];if(frame!==-1&&drawSprite(tiles,frame,col,data.height-row-1,1,1,false,layer.parallax))drawn++;
        }
      }return drawn;
    },
    setInput(value){
      check();record(value,ACTIONS);for(const a of ACTIONS)if(value[a]!==undefined&&typeof value[a]!=='boolean')throw new TypeError('Input actions must be booleans');
      for(const a of ACTIONS){const down=value[a]??false;if(!down)blocked.delete(a);if(clock.paused&&down)blocked.add(a);actions.set(a,!clock.paused&&!blocked.has(a)&&down);}
      return input();
    },
    input(){check();return input();},
    advance(seconds,update){
      check();finite(seconds,'elapsed seconds',0,1e6);if(typeof update!=='function')throw new TypeError('A fixed-step update callback is required');if(advancing)throw new Error('Game Maker advance cannot be reentrant');
      advancing=true;try{return clock.advance(seconds,dt=>update(dt,input(true),clock.ticks+1));}
      catch(error){if(!disposed)pause(true);throw error;}finally{advancing=false;}
    },
    pause,
    reset(){check();if(advancing)throw new Error('Reset outside the update callback');pause(true);clock.reset();particles=[];camera={x:0,y:0,zoom:1};},
    setAudioContext(context){
      check();const next=context===null?null:createEffectPlayer(context,{maxVoices:12,maxBuffers:16}),previous=player;player=next;previous?.dispose();
    },
    loadSound(id,value){check();ensureCapacity(sounds,id);const score=soundData(value);sounds.set(id,score);return Object.freeze({id,frames:score.frames,events:score.eventCount});},
    playSound(id,options={}){
      check();const score=asset(sounds,id);record(options,['when','offset','pan','gain','loop']);
      if(options.when!==undefined)finite(options.when,'sound time',0,1e12);
      if(options.offset!==undefined)finite(options.offset,'sound offset',0,1e12);
      if(options.pan!==undefined)finite(options.pan,'sound pan',-1,1);
      if(options.gain!==undefined)finite(options.gain,'sound gain',0,2);
      if(options.loop!==undefined&&typeof options.loop!=='boolean')throw new TypeError('Sound loop must be boolean');
      if(clock.paused||!player)return null;return player.play(score,options);
    },
    stopSounds(){check();player?.stopAll();},
    emit(options){
      check();record(options,['x','y','seed','count','color','life','speed','gravity','size'],['x','y','seed']);
      const x=finite(options.x,'particle x',-1e5,1e5),y=finite(options.y,'particle y',-1e5,1e5),count=integer(options.count??12,'burst count',1,64),life=integer(options.life??30,'particle life',1,240),speed=finite(options.speed??.1,'particle speed',0,2),gravity=finite(options.gravity??-.005,'particle gravity',-.1,.1),size=finite(options.size??.05,'particle size',.001,1),fill=color(options.color??'#ffd27d');
      let seed=integer(options.seed,'particle seed',0,0xffffffff);const next=[];
      const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;};
      for(let i=0;i<count;i++)next.push({x,y,vx:(random()*2-1)*speed,vy:(random()*2-1)*speed,life,gravity,size,color:fill});
      particles=[...particles,...next].slice(-256);return count;
    },
    tickParticles(){check();if(clock.paused)return;particles=particles.filter(p=>--p.life>0);for(const p of particles){p.vy+=p.gravity;p.x+=p.vx;p.y+=p.vy;}},
    drawParticles(){check();for(const p of particles)api.rect(p.x-p.size/2,p.y-p.size/2,p.size,p.size,p.color);},
    particleSnapshot(){check();return particles.map(p=>({...p}));},
    snapshot(){return Object.freeze({width,height,pixelsPerUnit,camera:Object.freeze({...camera}),paused:clock.paused,ticks:clock.ticks,disposed,sprites:sprites.size,tilemaps:maps.size,sounds:sounds.size,particles:particles.length,voices:player?.snapshot().voices??0});},
    dispose(){
      if(disposed)return;clock.setPaused(true);actions.clear();blocked.clear();particles=[];player?.dispose();player=null;
      for(const item of sprites.values())releaseAtlas(item);for(const item of maps.values())releaseAtlas(item.tiles);
      sprites.clear();maps.clear();sounds.clear();disposed=true;
    }
  };
  return Object.freeze(api);
}
