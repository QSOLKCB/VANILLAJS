// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameMaker,GAME_MAKER_LIMITS} from '../api/game-maker/index.js';
import {generateSprite,serializeSpriteProject,rgbaFrame} from '../modules/sprite2d/index.js';
import {createTilemap,serializeTilemap} from '../modules/tilemap/index.js';

function surface(){
  const canvases=[];
  const create=()=>{
    const calls=[],context={calls};
    for(const name of ['setTransform','clearRect','fillRect','beginPath','arc','fill','moveTo','lineTo','stroke','fillText','save','restore','translate','scale','drawImage'])context[name]=(...args)=>calls.push({name,args});
    context.createImageData=(w,h)=>({data:new Uint8ClampedArray(w*h*4)});
    context.putImageData=(image,x,y)=>calls.push({name:'putImageData',args:[new Uint8Array(image.data),x,y]});
    const canvas={width:0,height:0,context,getContext:kind=>kind==='2d'?context:null,ownerDocument:{createElement(tag){assert.equal(tag,'canvas');return create();}}};
    canvases.push(canvas);return canvas;
  };
  const canvas=create();return {canvas,canvases,calls:canvas.context.calls};
}
const sprite=()=>generateSprite({kind:'character',size:8,seed:41,symmetry:true,frameCount:2,palette:[[0,0,0,0],[60,140,150,255],[230,190,100,255],[255,245,220,255],[240,80,50,255]]});
function map(){const value=createTilemap({width:4,height:3,tileset:sprite()});value.layers[0].cells[1*4+2]=1;return value;}
const score=()=>({frames:4800,events:[{id:1,sample:0,duration:4800,channel:0,frequency:440,wave:'triangle',gain:4000,seed:3}]});
function audio(){
  const nodes=[],ctx={state:'running',currentTime:0,destination:{},buffers:0,nodes,closed:false};
  const node=()=>{const value={connect(){},disconnect(){this.disconnected=true;},stop(){this.stopped=true;},start(...args){this.started=args;},gain:{value:1},pan:{value:0}};nodes.push(value);return value;};
  ctx.createBuffer=(channels,frames)=>{ctx.buffers++;return {getChannelData:()=>new Float32Array(frames)};};
  ctx.createGain=node;ctx.createBufferSource=node;ctx.createStereoPanner=node;ctx.close=()=>{ctx.closed=true;};return ctx;
}
test('native drawing facade preserves +Y-up lower-left coordinates and camera projection',()=>{
  const s=surface(),g=createGameMaker({canvas:s.canvas,width:100,height:80,pixelsPerUnit:10});
  g.setCamera({x:2,y:3,zoom:2});g.begin('#01020300');g.rect(1,2,2,1,'#ff0000');g.circle(2,4,1);g.line(0,0,1,1);g.text('<literal>',2,3);g.text('HUD',4,6,{screen:true,size:12});
  assert.deepEqual(s.calls.filter(c=>c.name==='fillRect').map(c=>c.args),[[0,0,100,80],[30,40,40,20]]);
  assert.deepEqual(s.calls.find(c=>c.name==='clearRect').args,[0,0,100,80]);
  assert.deepEqual(s.calls.find(c=>c.name==='arc').args,[50,20,20,0,Math.PI*2]);
  assert.deepEqual(s.calls.filter(c=>c.name==='fillText').map(c=>c.args),[['<literal>',50,40],['HUD',4,6]]);
  const before=s.calls.length;for(const f of [()=>g.rect(0,0,-1,1),()=>g.circle(0,0,Infinity),()=>g.text('x',0,0,{font:'remote'}),()=>g.begin('url(https://invalid)'),()=>g.setCamera({x:0,y:0,zoom:0})])assert.throws(f);
  assert.equal(s.calls.length,before);assert.deepEqual(g.snapshot().camera,{x:2,y:3,zoom:2});g.dispose();
});
test('sprites retain admitted pixels and use existing atlas rectangles; replacement releases owned scratch canvas',()=>{
  const s=surface(),g=createGameMaker({canvas:s.canvas,width:100,height:80,pixelsPerUnit:10}),project=sprite();
  g.loadSprite('hero',serializeSpriteProject(project));const first=s.canvases[1],pixels=first.context.calls[0].args[0];
  assert.deepEqual(pixels.slice(0,8*4),rgbaFrame(project,0).slice(0,8*4));
  project.frames[0].pixels.fill(0);assert.notDeepEqual(g.spriteProject('hero'),project);
  const copy=g.spriteProject('hero');copy.frames[0].pixels.fill(0);assert.notDeepEqual(g.spriteProject('hero'),copy);
  g.sprite('hero',1,0,0,{width:2,height:1,flipX:true});
  assert.deepEqual(s.calls.find(c=>c.name==='translate').args,[70,30]);
  assert.deepEqual(s.calls.find(c=>c.name==='drawImage').args.slice(1),[8,0,8,8,0,0,20,10]);
  const accepted=g.spriteProject('hero');assert.throws(()=>g.loadSprite('hero',{...accepted,script:'bad'}));assert.deepEqual(g.spriteProject('hero'),accepted);assert.ok(first.width>0);
  g.loadSprite('hero',sprite());assert.equal(first.width,0);assert.equal(g.snapshot().sprites,1);
  g.dispose();assert.equal(s.canvases[2].width,0);assert.equal(s.canvas.width,100,'caller surface remains owned by caller');
});
test('tile layers use source frame indices, downward rows, parallax and transactional map admission',()=>{
  const s=surface(),g=createGameMaker({canvas:s.canvas,width:100,height:80,pixelsPerUnit:10}),value=map();
  value.layers.push({...value.layers[0],id:'backdrop',name:'Backdrop',parallax:.5,cells:[...value.layers[0].cells]});
  g.loadTilemap('level',serializeTilemap(value));g.setCamera({x:2,y:1});assert.equal(g.tilemap('level'),2);
  assert.deepEqual(s.calls.filter(c=>c.name==='drawImage').map(c=>c.args.slice(-4)),[[50,30,10,10],[60,25,10,10]]);
  value.layers[0].cells.fill(-1);assert.notDeepEqual(g.tilemapData('level'),value);
  const accepted=g.tilemapData('level'),bad=structuredClone(accepted);bad.layers[0].cells[0]=99;
  assert.throws(()=>g.loadTilemap('level',bad));assert.deepEqual(g.tilemapData('level'),accepted);
  assert.throws(()=>g.tilemap('level',{layer:'missing'}));assert.equal(g.tilemap('level',{layer:'backdrop'}),1);g.dispose();
});
test('fixed-tick input preserves taps across zero-step frames, consumes edges once and requires release after cancellation',()=>{
  const g=createGameMaker({canvas:surface().canvas}),inputs=[];g.pause(false);g.setInput({right:true,jump:true});
  assert.equal(g.advance(0,()=>assert.fail('no tick')).steps,0);assert.equal(g.input().pressed.jump,true);
  g.setInput({right:true,jump:false});g.advance(1/30,(dt,input,tick)=>{assert.equal(dt,1/60);inputs.push({input,tick});});
  assert.deepEqual(inputs.map(v=>[v.input.x,v.input.jump,v.input.pressed.jump,v.tick]),[[1,false,true,1],[1,false,false,2]]);
  assert.ok(Object.isFrozen(inputs[0].input)&&Object.isFrozen(inputs[0].input.held));
  g.pause(true);assert.equal(g.input().x,0);g.pause(false);g.setInput({right:true,jump:true});assert.equal(g.input().x,0);assert.equal(g.input().pressed.jump,false);
  g.setInput({});g.setInput({right:true,jump:true});assert.equal(g.input().x,1);assert.equal(g.input().pressed.jump,true);
  const before=g.input();let invoked=false;const hostile={};Object.defineProperty(hostile,'left',{get(){invoked=true;return true;}});
  assert.throws(()=>g.setInput(hostile));assert.equal(invoked,false);assert.deepEqual(g.input(),before);
  assert.throws(()=>g.setInput({right:true,jump:'yes'}));assert.deepEqual(g.input(),before);g.dispose();
});
test('render cadence does not change fixed input/particle evolution, pause stops ticks and callback faults cancel',()=>{
  function run(fps){
    const g=createGameMaker({canvas:surface().canvas});g.pause(false);g.setInput({right:true});g.emit({x:0,y:0,seed:91,count:2,life:240});let position=0;
    for(let i=0;i<fps*3;i++){g.advance(1/fps,(_,input)=>{position+=input.x;g.tickParticles();});g.drawParticles();}
    const result={position,ticks:g.snapshot().ticks,particles:g.particleSnapshot()};g.dispose();return result;
  }
  assert.deepEqual(run(30),run(60));assert.deepEqual(run(144),run(60));assert.equal(run(60).ticks,180);
  const g=createGameMaker({canvas:surface().canvas});g.pause(false);g.setInput({action:true});assert.throws(()=>g.advance(1/60,()=>{throw new Error('game rule failed');}),/game rule failed/);
  assert.equal(g.snapshot().paused,true);assert.equal(g.input().action,false);g.advance(1,()=>assert.fail('paused'));
  g.pause(false);assert.throws(()=>g.advance(1/60,()=>g.advance(0,()=>{})),/reentrant/);assert.equal(g.snapshot().paused,true);g.dispose();
});
test('seeded particles have bounded bursts, deterministic eviction, explicit ticks and owned snapshots',()=>{
  const g=createGameMaker({canvas:surface().canvas});g.emit({x:1,y:2,seed:0,count:1,life:3,speed:1,gravity:0});
  assert.deepEqual(g.particleSnapshot()[0],{x:1,y:2,vx:-0.5278640543110669,vy:-0.44286618288606405,life:3,gravity:0,size:.05,color:'#ffd27d'});
  g.tickParticles();assert.equal(g.particleSnapshot()[0].life,3,'paused ticks cannot move particles');g.pause(false);g.tickParticles();assert.equal(g.particleSnapshot()[0].life,2);
  const copy=g.particleSnapshot();copy[0].x=100;assert.notDeepEqual(g.particleSnapshot(),copy);
  const before=g.particleSnapshot();assert.throws(()=>g.emit({x:0,y:0,seed:0,count:65}));assert.deepEqual(g.particleSnapshot(),before);
  g.tickParticles();g.tickParticles();assert.equal(g.snapshot().particles,0);
  for(let i=0;i<5;i++)g.emit({x:i,y:0,seed:i,count:64});assert.equal(g.snapshot().particles,GAME_MAKER_LIMITS.particles);assert.equal(g.particleSnapshot()[0].x,1);
  g.reset();assert.equal(g.snapshot().particles,0);assert.equal(g.snapshot().ticks,0);assert.equal(g.snapshot().paused,true);g.dispose();
});
test('audio facade owns voices but not devices; replacement, pause and disposal release native resources',()=>{
  const a=audio(),b=audio(),g=createGameMaker({canvas:surface().canvas,audioContext:a});g.loadSound('pickup',score());
  assert.equal(g.playSound('pickup'),null,'initially paused');g.pause(false);assert.ok(g.playSound('pickup'));assert.equal(g.snapshot().voices,1);
  assert.throws(()=>g.setAudioContext({}));assert.equal(g.snapshot().voices,1,'invalid device must retain current voices');
  g.setAudioContext(b);assert.ok(a.nodes.every(n=>n.disconnected));assert.equal(a.closed,false);g.playSound('pickup');g.pause(true);assert.equal(g.snapshot().voices,0);
  assert.ok(b.nodes.every(n=>n.disconnected));g.pause(false);g.playSound('pickup');g.dispose();g.dispose();assert.ok(b.nodes.every(n=>n.disconnected));assert.equal(b.closed,false);
  assert.equal(g.snapshot().sounds,0);assert.equal(g.snapshot().disposed,true);assert.throws(()=>g.playSound('pickup'),/disposed/);
});
test('local sound data rejects executable/unknown records before synthesis and validates options without a device',()=>{
  const g=createGameMaker({canvas:surface().canvas});g.loadSound('tone',score());let invoked=false;
  const hostile=score();Object.defineProperty(hostile.events[0],'frequency',{get(){invoked=true;return 400;},enumerable:true});
  assert.throws(()=>g.loadSound('tone',hostile));assert.equal(invoked,false);
  const bad=score();bad.events[0].url='remote';assert.throws(()=>g.loadSound('tone',bad));
  for(const invalid of [{pan:NaN},{gain:3},{when:-1},{loop:1},{fetch:'bad'}])assert.throws(()=>g.playSound('tone',invalid));
  assert.equal(g.snapshot().sounds,1);g.pause(false);assert.equal(g.playSound('tone'),null);g.dispose();
});
test('independent instances retain their resources and rejected allocations do not replace accepted assets',()=>{
  const one=surface(),two=surface(),a=createGameMaker({canvas:one.canvas}),b=createGameMaker({canvas:two.canvas});a.loadSprite('hero',sprite());b.loadSprite('hero',sprite());
  const accepted=a.spriteProject('hero'),old=one.canvases[1];const factory=one.canvas.ownerDocument.createElement;
  one.canvas.ownerDocument.createElement=tag=>{const c=factory(tag);c.context.createImageData=()=>{throw new Error('allocation failed');};return c;};
  assert.throws(()=>a.loadSprite('hero',sprite()),/allocation failed/);assert.deepEqual(a.spriteProject('hero'),accepted);assert.ok(old.width>0);assert.equal(one.canvases[2].width,0);
  a.pause(false);a.advance(1/30,()=>{});assert.equal(a.snapshot().ticks,2);assert.equal(b.snapshot().ticks,0);a.dispose();assert.ok(two.canvases[1].width>0);assert.equal(b.snapshot().sprites,1);b.dispose();
});
test('surface, asset and data budgets reject before partial replacement',()=>{
  const s=surface();assert.throws(()=>createGameMaker({canvas:s.canvas,width:2049}));assert.equal(s.canvas.width,0);
  assert.throws(()=>createGameMaker({canvas:{getContext:()=>null}}),/Canvas 2D is unavailable/);
  const g=createGameMaker({canvas:s.canvas});for(let i=0;i<16;i++)g.loadSprite('sprite-'+i,sprite());
  assert.throws(()=>g.loadSprite('sprite-overflow',sprite()),/capacity/);g.loadSprite('sprite-0',sprite());assert.equal(g.snapshot().sprites,16);
  for(const id of ['../escape','https://example.test','UPPER',''])assert.throws(()=>g.loadSprite(id,sprite()));
  assert.throws(()=>g.loadSprite('remote',{url:'https://example.test'}));assert.throws(()=>g.loadTilemap('remote',{url:'https://example.test'}));g.dispose();
});
