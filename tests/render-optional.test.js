// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {OptionalRenderer,projectVertices,packedVertices,clipPolygon,clipLine,MAX_VERTICES} from '../modules/render-optional/index.js';
import bytes from '../modules/render-optional/wasm-bytes.js';
import {createWorld,stepWorld,CONFIG} from '../demos/space-lab/world.js';
import {sphere,galaxy} from '../demos/space-lab/geometry.js';
import {createForgeScene} from '../demos/editor/model.js';
import {createAssetLibrary,serializeProject,parseProject} from '../demos/editor/asset-foundry.js';
import {exportGame} from '../demos/editor/game-export.js';
const identity=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
test('bundled WASM projection matches float32 reference across matrices and bounded streams',async()=>{
  const {instance}=await WebAssembly.instantiate(bytes),memory=instance.exports.memory.buffer;
  for(const data of [galaxy(256),sphere([0,0,-3],2),new Float32Array(MAX_VERTICES*6)]){
    for(const m of [identity,Float32Array.from(identity,(v,i)=>v+(i%3)*.0125)]){
      new Float32Array(memory,0,16).set(m);new Float32Array(memory,64,data.length).set(data);
      instance.exports.project(64,4194304,0,data.length/6);
      assert.deepEqual(new Float32Array(memory,4194304,data.length/6*7),projectVertices(data,m));
    }
  }
});
test('near-plane surface and crossing line survive while fully hidden geometry is rejected',()=>{
  const a=[-.5,0,-2,1,1,0,0],b=[.5,0,0,1,1,0,0],c=[0,.5,0,1,1,0,0];
  assert.equal(clipPolygon([a,b,c]).length,4);
  const line=clipLine(a,b);assert.equal(line.length,2);assert.notDeepEqual(line[0],line[1]);
  assert.equal(line[0][2],-1);assert.deepEqual(clipPolygon([a,a,a]),[]);
});
test('retained snapshots reject mutation, overflow and malformed primitives',()=>{
  const data=[0,0,0,1,0,0],p=packedVertices(data,'points');data[0]=10;assert.equal(p[0],0);
  assert.throws(()=>packedVertices([Infinity,0,0,1,0,0],'points'));
  assert.throws(()=>packedVertices(data,'triangles'));
  assert.throws(()=>packedVertices(new Float32Array((MAX_VERTICES+1)*6),'points'));
  const ctx={fillRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){}};
  const r=new OptionalRenderer({width:100,height:100,getContext:()=>ctx}),m=r.createMesh([0,0,0,1,0,0],'points');
  assert.equal(r.updateMesh(m,[0,0,0,1,0,0]),false);r.beginFrame();assert.throws(()=>r.beginFrame());r.draw(m);r.endFrame();assert.throws(()=>r.endFrame());r.dispose();assert.throws(()=>r.createMesh([]));
});
test('docking requires low speed, broadside hits are swept and orbit stays bounded',()=>{
  const fast=createWorld('docking');fast.position=[0,0,0];fast.velocity=[3,0,0];stepWorld(fast,{dock:true});assert.equal(fast.docked,false);
  const slow=createWorld('docking');slow.position=[0,0,0];stepWorld(slow,{dock:true});assert.equal(slow.docked,true);
  const w=createWorld('broadside');for(let i=0;i<120;i++)stepWorld(w,{fire:true});assert.ok(w.hits>0);assert.ok(w.shots.length<=32);
  const orbit=createWorld('orbit');for(let i=0;i<600;i++)stepWorld(orbit);assert.ok(Math.abs(Math.hypot(...orbit.position)-25)<.01);
  assert.equal(CONFIG.thrust,6.25);assert.throws(()=>stepWorld(w,{thrust:NaN}));
});
test('project graphics setting round-trips without granting GPU consent; legacy still loads',()=>{
  const scene=createForgeScene(),library=createAssetLibrary();
  assert.equal(parseProject(serializeProject(scene,library)).graphics,undefined);
  assert.equal(parseProject(serializeProject(scene,library,{optionalGPU:true})).graphics.optionalGPU,true);
  assert.throws(()=>serializeProject(scene,library,{optionalGPU:'yes'}));
  const html=exportGame(scene,library,{optionalGPU:true});assert.match(html,/mountGame/);assert.match(html,/optionalGPU/);assert.doesNotMatch(html,/enableGPU\(/);
});
