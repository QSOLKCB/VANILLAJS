// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SPRITE_FORMAT,SPRITE_MAX_BYTES,SPRITE_SIZES,SPRITE_KINDS,generateSprite,validateSpriteRecipe,
  validateSpriteProject,parseSpriteProject,serializeSpriteProject,rgbaFrame,paintSpritePixel,paintSpriteStroke,fillSpritePixels,
  setSpritePalette,duplicateSpriteFrame,moveSpriteFrame,removeSpriteFrame,setSpriteDuration,spriteFrameAt,buildSpriteAtlas}
  from '../modules/sprite2d/index.js';
import {exampleSprite,examples,palettes} from '../demos/sprite-foundry/examples.js';
const recipe=(extra={})=>({kind:'character',size:8,seed:123,symmetry:true,frameCount:2,palette:palettes.relay,...extra});
const hash=p=>createHash('sha256').update(rgbaFrame(p)).digest('hex');
test('v1 source pixels have an explicit integer oracle and stable RGBA digest',()=>{
  const p=generateSprite(recipe()),expected=[
    0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,3,3,0,0,0,0,0,0,2,2,0,0,0,
    0,2,1,3,3,1,2,0,0,2,1,1,1,1,2,0,0,0,1,2,2,1,0,0,0,0,3,3,3,3,0,0];
  assert.deepEqual(p.frames[0].pixels,expected);
  assert.equal(hash(p),'8d40a512493e0c4d88af8326ef4d3d0e18de7edefda317fc6b26c0f30b4da349');
  assert.deepEqual(generateSprite(recipe()),p);
  const rgba=rgbaFrame(p);assert.equal(rgba.length,8*8*4);assert.deepEqual([...rgba.slice(0,4)],[0,0,0,0]);
  assert.deepEqual([...rgba.slice(11*4,12*4)],palettes.relay[2]);
});
test('every original bounded algorithm and common size yields seeded nonempty editable frames',()=>{
  for(const kind of SPRITE_KINDS)for(const size of SPRITE_SIZES){
    const p=generateSprite(recipe({kind,size,symmetry:false,frameCount:4}));
    assert.equal(p.frames.length,4);assert.equal(p.frames[0].pixels.length,size*size);
    assert.ok(p.frames[0].pixels.some(Boolean),kind+' '+size);
    assert.deepEqual(parseSpriteProject(serializeSpriteProject(p)),p);
    assert.deepEqual(generateSprite(recipe({kind,size,symmetry:false,frameCount:4})),p);
  }
  assert.notEqual(hash(generateSprite(recipe({size:32,seed:123}))),hash(generateSprite(recipe({size:32,seed:124}))));
  assert.notEqual(hash(generateSprite(recipe({size:16,symmetry:true}))),hash(generateSprite(recipe({size:16,symmetry:false}))));
  for(const example of examples)assert.equal(exampleSprite(example.id).license,'Apache-2.0');
});
test('symmetry is exact for all frames and palettes change colors without changing source indices',()=>{
  const p=generateSprite(recipe({size:32,frameCount:8}));
  for(const frame of p.frames)for(let y=0;y<32;y++)for(let x=0;x<32;x++)
    assert.equal(frame.pixels[y*32+x],frame.pixels[y*32+31-x]);
  const varied=setSpritePalette(p,palettes.signal);
  assert.deepEqual(varied.frames,p.frames);assert.notEqual(hash(varied),hash(p));
  assert.deepEqual(varied.recipe.palette,palettes.signal);
  assert.deepEqual(p.recipe.palette,palettes.relay);
});
test('pixel, fill and palette operations own output and preserve source on rejection',()=>{
  const original=generateSprite(recipe()),before=serializeSpriteProject(original);
  const drawn=paintSpritePixel(original,0,0,0,3);assert.equal(drawn.frames[0].pixels[0],3);
  const filled=fillSpritePixels(original,0,0,0,2);assert.ok(filled.frames[0].pixels[0]===2);
  assert.equal(filled.frames[0].pixels[11],2,'a pre-existing painted source pixel stays unchanged');
  assert.equal(serializeSpriteProject(original),before);
  assert.throws(()=>paintSpritePixel(original,0,8,0,1),/pixel x/);
  assert.throws(()=>fillSpritePixels(original,4,0,0,1),/frame index/);
  assert.throws(()=>setSpritePalette(original,[[0,0,0,0],[255,0,0,255]]),/palette index/);
  assert.equal(serializeSpriteProject(original),before);
  const retained=parseSpriteProject(before);
  assert.throws(()=>parseSpriteProject(before.replace(SPRITE_FORMAT,'malicious.format.v8')),/unsupported/);
  assert.deepEqual(retained,original);
});
test('batched 64-pixel strokes own the accepted 64x64 / 16-frame project and reject bad paths',()=>{
  const original=generateSprite(recipe({size:64,frameCount:16})),before=serializeSpriteProject(original);
  const points=Array.from({length:64},(_,x)=>({x,y:7})),expected=structuredClone(original);
  for(const {x,y} of points)expected.frames[15].pixels[y*64+x]=2;
  const painted=paintSpriteStroke(original,15,points,2);
  assert.deepEqual(painted,expected);
  assert.equal(serializeSpriteProject(original),before);
  assert.deepEqual(painted.frames.slice(0,15),original.frames.slice(0,15));
  assert.notStrictEqual(painted.frames[15].pixels,original.frames[15].pixels);
  assert.equal(paintSpriteStroke(original,15,[{x:0,y:0},{x:0,y:0}],3).frames[15].pixels[0],3);
  const small=generateSprite(recipe()),coords=[{x:0,y:1},{x:1,y:1},{x:2,y:2},{x:3,y:2}];
  let serial=small;
  for(const {x,y} of coords)serial=paintSpritePixel(serial,0,x,y,3);
  assert.deepEqual(paintSpriteStroke(small,0,coords,3),serial);
  for(const invalid of [[{x:0,y:0},{x:64,y:0}],[{x:-1,y:0}],[{x:0,y:NaN}],[],Array.from({length:129},()=>({x:0,y:0})),[{x:0,y:0,script:'bad'}]]){
    assert.throws(()=>paintSpriteStroke(original,15,invalid,1));
    assert.equal(serializeSpriteProject(original),before);
  }
  assert.throws(()=>paintSpriteStroke(original,16,points,1),/frame index/);
  assert.throws(()=>paintSpriteStroke(original,0,points,99),/palette index/);
  let invoked=false;
  const hostile={x:0,y:0};Object.defineProperty(hostile,'x',{get(){invoked=true;return 0;},enumerable:true});
  assert.throws(()=>paintSpriteStroke(original,15,[hostile],1),/executable/);
  assert.equal(invoked,false);
  assert.equal(serializeSpriteProject(original),before);
});
test('bounded flood fill fills only connected equal indices and does not wrap rows',()=>{
  const p=generateSprite(recipe({frameCount:1}));p.frames[0].pixels=Array(64).fill(1);
  p.frames[0].pixels[7]=0;p.frames[0].pixels[8]=0;p.frames[0].pixels[15]=0;
  const f=fillSpritePixels(p,0,7,0,3);
  assert.equal(f.frames[0].pixels[7],3);assert.equal(f.frames[0].pixels[15],3);
  assert.equal(f.frames[0].pixels[8],0);
  assert.deepEqual(fillSpritePixels(f,0,7,0,3),f);
});
test('animation ordering, duplication, deletion, durations and exact boundaries are explicit',()=>{
  const p=paintSpritePixel(generateSprite(recipe()),0,0,0,1);
  const duplicated=duplicateSpriteFrame(p,0);assert.equal(duplicated.frames.length,3);
  assert.deepEqual(duplicated.frames[0],duplicated.frames[1]);
  duplicated.frames[1].pixels[0]=3;assert.equal(duplicated.frames[0].pixels[0],1);
  const moved=moveSpriteFrame(duplicated,1,2);assert.equal(moved.frames[2].pixels[0],3);
  assert.deepEqual(removeSpriteFrame(moved,2),p);
  const timed=setSpriteDuration(p,0,40);assert.equal(spriteFrameAt(timed,0),0);
  assert.equal(spriteFrameAt(timed,39),0);assert.equal(spriteFrameAt(timed,40),1);
  assert.equal(spriteFrameAt(timed,159),1);assert.equal(spriteFrameAt(timed,160),0);
  assert.throws(()=>spriteFrameAt(timed,1.5),/elapsed/);
  assert.throws(()=>removeSpriteFrame(generateSprite(recipe({frameCount:1})),0),/at least/);
  assert.throws(()=>duplicateSpriteFrame(generateSprite(recipe({frameCount:16})),0),/capacity/);
});
test('atlas byte placement, transparent padding, alpha mask and tight bounds are correct',()=>{
  const p=generateSprite(recipe({frameCount:3}));
  p.frames.forEach(f=>f.pixels.fill(0));
  p.frames[0].pixels[2*8+3]=1;p.frames[1].pixels[0]=2;
  p.recipe.palette[1][3]=127;
  const {rgba,metadata:m}=buildSpriteAtlas(p,{columns:2,padding:1,alphaThreshold:128});
  assert.equal(m.width,20);assert.equal(m.height,20);assert.equal(rgba.length,1600);
  assert.deepEqual(m.frames.map(f=>[f.x,f.y]),[[1,1],[11,1],[1,11]]);
  assert.deepEqual([...rgba.slice(((1+2)*20+1+3)*4,((1+2)*20+1+3)*4+4)],p.recipe.palette[1]);
  assert.equal(rgba[3],0);assert.equal(m.frames[0].bounds,null);
  assert.deepEqual(m.frames[1].bounds,{x:0,y:0,width:1,height:1});
  assert.equal(m.frames[1].mask.reduce((a,b)=>a+b,0),1);
  assert.equal(m.frames[2].bounds,null);
  assert.deepEqual(buildSpriteAtlas(p,{columns:2,padding:1,alphaThreshold:1}).metadata.frames[0].bounds,{x:3,y:2,width:1,height:1});
  assert.throws(()=>buildSpriteAtlas(p,{columns:0}),/columns/);
  assert.throws(()=>buildSpriteAtlas(p,{padding:9}),/padding/);
  assert.throws(()=>buildSpriteAtlas(p,{alphaThreshold:0}),/threshold/);
  assert.throws(()=>buildSpriteAtlas(generateSprite(recipe({size:64,frameCount:16})),{columns:16,padding:8}),/1024/);
});
test('imports reject unknown versions, code, nonfinite indices, bad bounds and oversized input',()=>{
  const p=generateSprite(recipe());
  for(const change of [
    q=>q.script='alert(1)',q=>q.implementationVersion=2,q=>q.frames[0].html='<script/>',
    q=>q.recipe.seed=-1,q=>q.recipe.size=128,q=>q.recipe.symmetry=1,q=>q.recipe.frameCount=17,
    q=>q.recipe.palette[0]=[1,0,0,0],q=>q.frames[0].durationMs=0,
    q=>q.frames[0].pixels[0]=NaN,q=>q.frames[0].pixels[0]=1.1,q=>q.frames[0].pixels[0]=16,
    q=>q.frames[0].pixels.pop(),q=>q.license='unknown',q=>q.name='bad\nname'
  ]){const q=structuredClone(p);change(q);assert.throws(()=>validateSpriteProject(q));}
  assert.throws(()=>parseSpriteProject(' '.repeat(SPRITE_MAX_BYTES+1)),/256 KiB/);
  assert.throws(()=>parseSpriteProject(serializeSpriteProject(p).replace('"name":','"__proto__":{},"name":')),/unknown/);
  assert.throws(()=>validateSpriteRecipe({...recipe(),callback:()=>{}}),/unknown/);
});
test('public validation rejects getters, custom array methods and sparse arrays without executing them',()=>{
  const p=generateSprite(recipe());let invoked=0;
  Object.defineProperty(p,'name',{get(){invoked++;return 'bad';},enumerable:true});
  assert.throws(()=>validateSpriteProject(p),/executable/);assert.equal(invoked,0);
  class BadArray extends Array{map(){invoked++;return [];}}
  const q=generateSprite(recipe());q.frames=new BadArray(...q.frames);
  assert.throws(()=>validateSpriteProject(q),/plain array/);assert.equal(invoked,0);
  const r=generateSprite(recipe());delete r.frames[0].pixels[0];
  assert.throws(()=>validateSpriteProject(r),/dense/);
});
test('largest supported project stays within import/export and atlas budgets',()=>{
  const p=generateSprite(recipe({size:64,frameCount:16}));
  const raw=serializeSpriteProject(p);assert.ok(Buffer.byteLength(raw)<SPRITE_MAX_BYTES);
  const atlas=buildSpriteAtlas(parseSpriteProject(raw));
  assert.equal(atlas.metadata.frames.length,16);
  for(const f of atlas.metadata.frames){
    assert.ok(f.x>=0&&f.y>=0&&f.x+f.width<=atlas.metadata.width&&f.y+f.height<=atlas.metadata.height);
    assert.equal(f.mask.length,4096);
  }
});
