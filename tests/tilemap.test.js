// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {generateSprite} from '../modules/sprite2d/index.js';
import {createBody2D,stepBody2D} from '../modules/motion2d/index.js';
import {TILEMAP_FORMAT,TILEMAP_BYTES,TILEMAP_SCALE,Tilemap,createTilemap,validateTilemap,parseTilemap,serializeTilemap,tileToWorld,worldToTile,tileBounds,sweepTileBody,stepTileBody,cameraFollow} from '../modules/tilemap/index.js';

const copy=v=>JSON.parse(JSON.stringify(v));
const palette=[[0,0,0,0],[32,64,96,255],[64,96,128,255],[128,160,192,255],[240,208,128,255]];
const tileset=()=>generateSprite({kind:'terrain',size:8,seed:42,symmetry:false,frameCount:3,palette},{name:'Original tiles'});
function map(width=10,height=8){return createTilemap({width,height,tileset:tileset()});}
function solid(m,column,row){m.collision[row*m.width+column]=1;m.layers[0].cells[row*m.width+column]=0;}
function floor(){const m=map();for(let c=0;c<m.width;c++)solid(m,c,7);return m;}
const at=(x,y,options={})=>createBody2D({x,y,...options});
const square={halfWidth:64,halfHeight:64};

test('tilemap admission owns layers, atlas, markers and camera without widening Sprite Foundry',()=>{
  const m=map();m.name='A <literal> world';m.spawns=[{id:'player',column:1,row:5}];m.triggers=[{id:'gate',column:7,row:5,tag:'exit'}];
  m.layers.push({id:'distance',name:'Distant tiles',parallax:.25,cells:Array(80).fill(-1)});m.layers[1].cells[4]=2;
  const admitted=validateTilemap(m),runtime=new Tilemap(m);assert.equal(admitted.format,TILEMAP_FORMAT);assert.equal(TILEMAP_SCALE,256);
  m.tileset.frames[0].pixels[0]=4;m.layers[0].cells[0]=1;m.spawns[0].column=4;
  assert.notDeepEqual(admitted,m);assert.deepEqual(runtime.snapshot(),admitted);
  const snap=runtime.snapshot();snap.collision[0]=1;assert.equal(runtime.snapshot().collision[0],0);
  assert.deepEqual(parseTilemap(serializeTilemap(admitted)),admitted);
  assert.equal(runtime.snapshot().tileset.license,'Apache-2.0');
});

test('versioned tilemap rejects unsafe, unknown, oversized and inconsistent records',()=>{
  const base=map();
  for(const change of [m=>m.version=2,m=>m.format='remote',m=>m.script='run()',m=>m.width=65,m=>m.height=0,m=>m.layers[0].cells.pop(),m=>m.layers[0].cells[1]=3,m=>m.layers[0].cells[1]=-2,m=>m.layers[0].parallax=1.1,m=>m.collision[0]=2,m=>m.collision.pop(),m=>m.tileset.recipe.size=12,m=>m.tileset.license='unknown',m=>m.layers.push(copy(m.layers[0])),m=>m.layers=[],m=>m.camera.follow=1,m=>m.camera.deadZoneX=-1,m=>m.name='bad\nname']){
    const bad=copy(base);change(bad);assert.throws(()=>validateTilemap(bad));
  }
  const max=map(64,64);max.layers=Array.from({length:4},(_,i)=>({id:'layer-'+i,name:'Layer '+i,parallax:1,cells:Array(4096).fill(2)}));assert.equal(validateTilemap(max).collision.length,4096);
  max.layers.push({...copy(max.layers[0]),id:'fifth'});assert.throws(()=>validateTilemap(max),/bounded dense/);
  assert.throws(()=>parseTilemap(' '.repeat(TILEMAP_BYTES+1)),/512 KiB/);assert.throws(()=>parseTilemap({}));
  const getter=map();let calls=0;Object.defineProperty(getter,'tileset',{get(){calls++;return tileset();},enumerable:true});assert.throws(()=>validateTilemap(getter),/executable/);assert.equal(calls,0);
  const cell=map();Object.defineProperty(cell.collision,'0',{get(){calls++;return 0;},enumerable:true});assert.throws(()=>validateTilemap(cell),/accessor/);assert.equal(calls,0);
  const sparse=map();delete sparse.layers[0].cells[0];assert.throws(()=>validateTilemap(sparse));
  const subclass=map();subclass.layers=new(class extends Array{})(...subclass.layers);assert.throws(()=>validateTilemap(subclass));
  const symbol=map();symbol[Symbol('hidden')]=1;assert.throws(()=>validateTilemap(symbol));
  const prototype=Object.create({hidden:'instructions'});Object.assign(prototype,map());assert.throws(()=>validateTilemap(prototype));
});

test('marker identity, bounds, collision and capacity are checked before replacement',()=>{
  const original=floor(),runtime=new Tilemap(original);
  for(const change of [m=>m.spawns=[{id:'p',column:-1,row:0}],m=>m.spawns=[{id:'p',column:10,row:0}],m=>m.spawns=[{id:'p',column:0,row:7}],m=>m.triggers=[{id:'t',column:0,row:7,tag:'hazard'}],m=>m.triggers=[{id:'t',column:0,row:0,tag:'<script>'}],m=>m.spawns=[{id:'p',column:0,row:0},{id:'p',column:1,row:0}],m=>{m.spawns=[{id:'p',column:0,row:0}];m.triggers=[{id:'p',column:1,row:0,tag:'exit'}];},m=>m.spawns=[{id:'a',column:0,row:0},{id:'b',column:0,row:0}],m=>m.triggers=[{id:'a',column:0,row:0,tag:'exit'},{id:'b',column:0,row:0,tag:'collect'}]]){
    const bad=copy(original);change(bad);assert.throws(()=>runtime.replace(bad));assert.deepEqual(runtime.snapshot(),original);
  }
  const many=map(64,64);many.spawns=Array.from({length:32},(_,i)=>({id:'s-'+i,column:i,row:0}));many.triggers=Array.from({length:128},(_,i)=>({id:'t-'+i,column:i%64,row:2+Math.floor(i/64),tag:'zone'}));assert.equal(validateTilemap(many).triggers.length,128);
  many.spawns.push({id:'extra',column:32,row:0});assert.throws(()=>validateTilemap(many));
});

test('tile/world conversion has exact bottom-left and half-open boundary semantics',()=>{
  const m=map(4,3),runtime=new Tilemap(m);assert.deepEqual(tileBounds(m),{minX:0,minY:0,maxX:1024,maxY:768});
  assert.deepEqual(tileToWorld(m,0,0),{x:128,y:640});assert.deepEqual(runtime.tileToWorld(3,2),{x:896,y:128});
  assert.deepEqual(worldToTile(m,0,0),{column:0,row:2});assert.deepEqual(worldToTile(m,255,255),{column:0,row:2});assert.deepEqual(worldToTile(m,256,256),{column:1,row:1});
  assert.deepEqual(runtime.worldToTile(1023,767),{column:3,row:0});
  for(let row=0;row<3;row++)for(let c=0;c<4;c++){const p=tileToWorld(m,c,row);assert.deepEqual(worldToTile(m,p.x,p.y),{column:c,row});}
  for(const [x,y] of [[1024,0],[0,768],[-1,0],[0,-1],[.1,0]])assert.throws(()=>worldToTile(m,x,y));
  assert.throws(()=>tileToWorld(m,0,3));assert.throws(()=>tileToWorld(m,-1,0));
});

test('swept body stops at a thin wall even when the endpoint is beyond it',()=>{
  const m=map();solid(m,4,4);const b=at(600,896,{vx:512});
  const hit=sweepTileBody(m,b,{x:1000,y:0},square);assert.equal(hit.body.x,960);assert.equal(hit.hitX,-1);assert.equal(hit.body.vx,0);assert.equal(hit.body.y,896);
  const left=sweepTileBody(m,at(1600,896,{vx:-512}),{x:-1000,y:0},square);assert.equal(left.body.x,1344);assert.equal(left.hitX,1);
  const touch=sweepTileBody(m,at(960,896),{x:1,y:0},square);assert.equal(touch.body.x,960);assert.equal(touch.hitX,-1);
  const exact=sweepTileBody(m,b,{x:360,y:0},square);assert.equal(exact.hitX,-1,'exact endpoint face contact clears the velocity');
  assert.deepEqual(b,at(600,896,{vx:512}),'caller body stays unchanged');
});

test('floor, ceiling and world boundaries stop full bodies with stable contact normals',()=>{
  const m=map();solid(m,3,4);const top=1024,bottom=768,x=896;
  const land=sweepTileBody(m,at(x,1600,{vy:-512}),{x:0,y:-1000},square);assert.equal(land.body.y,top+64);assert.equal(land.hitY,1);assert.equal(land.body.grounded,true);assert.equal(land.body.vy,0);
  const ceiling=sweepTileBody(m,at(x,400,{vy:512}),{x:0,y:1000},square);assert.equal(ceiling.body.y,bottom-64);assert.equal(ceiling.hitY,-1);assert.equal(ceiling.body.grounded,false);
  const empty=map(2,2),runtime=new Tilemap(empty);
  assert.equal(runtime.sweep(at(128,128),{x:-500,y:-500},square).body.x,64);
  const limits=runtime.sweep(at(128,128),{x:1000,y:1000},square);assert.deepEqual([limits.body.x,limits.body.y,limits.hitX,limits.hitY],[448,448,-1,-1]);
  assert.equal(runtime.sweep(at(128,64),{x:0,y:0},square).body.grounded,true);
  assert.throws(()=>runtime.sweep(at(63,128),{x:0,y:0},square),/outside/);
  assert.throws(()=>sweepTileBody(m,at(x,900),{x:0,y:0},square),/overlapping/);
});

// Independent small-grid reference: move one integer subunit at a time, using
// direct rectangle intersection instead of the production tile-face sweep.
function reference(m,b,delta,shape){
  const hw=shape.halfWidth,hh=shape.halfHeight;
  function blocked(x,y){
    if(x-hw<0||y-hh<0||x+hw>m.width*256||y+hh>m.height*256)return true;
    for(let r=0;r<m.height;r++)for(let c=0;c<m.width;c++)if(m.collision[r*m.width+c]){
      const l=c*256,bt=(m.height-r-1)*256;
      if(x+hw>l&&x-hw<l+256&&y+hh>bt&&y-hh<bt+256)return true;
    }
    return false;
  }
  let x=b.x,y=b.y;
  for(const axis of ['x','y'])for(let i=0;i<Math.abs(delta[axis]);i++){
    const nextX=x+(axis==='x'?Math.sign(delta.x):0),nextY=y+(axis==='y'?Math.sign(delta.y):0);
    if(blocked(nextX,nextY))break;x=nextX;y=nextY;
  }
  return {x,y};
}
test('axis sweeps match an independent integer rectangle oracle across corners and high speeds',()=>{
  const m=map(8,8);for(const [c,r]of [[2,3],[3,3],[5,4],[5,5],[1,6]])solid(m,c,r);
  for(const p of [[400,1450],[1000,700],[1700,600],[1200,1600]])for(const delta of [{x:1200,y:-1000},{x:-1000,y:800},{x:3,y:-600},{x:0,y:400},{x:512,y:512}]){
    const b=at(...p),result=sweepTileBody(m,b,delta,square).body;assert.deepEqual({x:result.x,y:result.y},reference(m,b,delta,square));
  }
});

test('platform adapter reuses motion2d motor law, grounds on tiles, jumps and clears support on walkoff',()=>{
  const m=floor(),runtime=new Tilemap(m),options={...square,motor:{speed:24,acceleration:6,drag:6,jumpSpeed:72,gravity:4,fallSpeed:80}};
  let b=at(400,600);for(let i=0;i<20;i++)b=runtime.step(b,{},options).body;
  assert.equal(b.y,320);assert.equal(b.grounded,true);
  const jump=runtime.step(b,{jump:true,x:1},options);assert.equal(jump.body.vy,68);assert.equal(jump.body.y,388);assert.equal(jump.body.vx,6);assert.equal(jump.body.grounded,false);
  for(let i=0;i<60;i++)b=runtime.step(i===0?jump.body:b,{},options).body;assert.equal(b.y,320);assert.equal(b.grounded,true);
  const floating=map();solid(floating,2,4);const stepper=new Tilemap(floating);let edge=at(832,1088,{grounded:true});
  for(let i=0;i<12;i++)edge=stepper.step(edge,{x:1},options).body;
  assert.equal(edge.grounded,false);assert.ok(edge.y<1088);
  const airborne=at(400,1400,{vx:7,vy:8}),actual=stepTileBody(m,airborne,{x:-1},options).body;
  const expected=stepBody2D(airborne,{x:-1},{profile:'platform',motor:options.motor,bounds:{minX:-100000,minY:-100000,maxX:100000,maxY:100000},groundY:-100000});assert.deepEqual(actual,expected);
});

test('deterministic ticks are independent of presentation grouping and inputs remain owned',()=>{
  const m=floor(),runtime=new Tilemap(m),input={x:1,jump:false};let a=at(384,368),b=a;
  const tick=(state,i)=>runtime.step(state,{x:i<40?1:0,jump:i===3}).body;
  for(let i=0;i<80;i++)a=tick(a,i);
  let i=0;for(const group of [1,3,2,10,8,16,40])for(let j=0;j<group;j++)b=tick(b,i++);
  assert.deepEqual(a,b);runtime.step(at(384,368),input);assert.deepEqual(input,{x:1,jump:false});
  const before=runtime.snapshot();for(const call of [()=>runtime.step(at(384,368),{x:2}),()=>runtime.step(at(384,368),{jump:'yes'}),()=>runtime.step(at(384,368),{}, {motor:{speed:513}}),()=>runtime.sweep(at(384,368),{x:16385,y:0}),()=>runtime.sweep(at(384,368),{x:0,y:0},{halfWidth:0}),()=>runtime.sweep({...at(384,368),x:undefined},{x:0,y:0}),()=>runtime.step(at(384,368),{execute:'bad'})])assert.throws(call);
  assert.deepEqual(runtime.snapshot(),before);
});

test('camera deadzones, disabled follow and world clamps use caller-owned integer coordinates',()=>{
  const m=map(20,12),runtime=new Tilemap(m),viewport={width:2048,height:1536};
  assert.deepEqual(cameraFollow(m,{x:2100,y:1700},viewport,{x:2000,y:1600}),{x:2000,y:1600});
  assert.deepEqual(runtime.camera({x:2600,y:2000},viewport,{x:2000,y:1600}),{x:2472,y:1872});
  assert.deepEqual(runtime.camera({x:0,y:0},viewport),{x:1024,y:768});
  assert.deepEqual(runtime.camera({x:5120,y:3072},viewport),{x:4096,y:2304});
  assert.deepEqual(runtime.camera({x:2000,y:2000},{width:30000,height:30000}),{x:2560,y:1536});
  m.camera.follow=false;runtime.replace(m);assert.deepEqual(runtime.camera({x:4000,y:2500},viewport,{x:2000,y:1600}),{x:2000,y:1600});
  assert.throws(()=>runtime.camera({x:0,y:0},{width:0,height:50}));assert.throws(()=>runtime.camera({x:-1,y:0},viewport));
});
