// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createScene,updateEntity,addEntity,sceneWorld} from '../demos/editor/model.js';
import {cameraMatrix,cameraBasis,cameraRay,hitWorldBox,pickObject,
  createGridVertices,createSceneVertices,displayWorld} from '../demos/editor/viewport.js';

const camera={yaw:0,pitch:0,distance:8,target:[0,0,0]};
test('projective camera is finite and ray points into the scene center',()=>{
  const {eye,back,right,up}=cameraBasis(camera);
  assert.deepEqual(eye,[0,0,8]);assert.deepEqual(back,[0,0,1]);
  assert.deepEqual(right,[1,0,0]);assert.deepEqual(up,[0,1,0]);
  const ray=cameraRay(camera,200,100,400,200);
  assert.deepEqual(ray.dir,[0,0,-1]);
  const matrix=cameraMatrix(camera,400,200);
  assert.equal(matrix.length,16);assert.ok(matrix.every(Number.isFinite));
  assert.throws(()=>cameraMatrix(camera,0,200),RangeError);
  assert.throws(()=>cameraRay(camera,0,0,0,200),RangeError);
});
test('box picking resolves closest box and rotated box hit',()=>{
  const a={id:'entity-11',visible:true,position:[0,0,-5],scale:[2,2,2],rotationY:0},
    b={...a,id:'entity-12',position:[0,0,-2],rotationY:45};
  const ray=cameraRay(camera,200,100,400,200);
  assert.ok(hitWorldBox(a,ray)>hitWorldBox(b,ray));
  assert.equal(pickObject([a,b],ray),b.id);
  assert.equal(pickObject([{...b,visible:false},a],ray),a.id);
  assert.equal(pickObject([a],{origin:[10,0,8],dir:[0,0,-1]}),null);
});
test('editor geometry batches exact boxes and isolates selection recolouring',()=>{
  let s=createScene();
  s=updateEntity(s,'entity-4',{rotationY:35});
  const world=sceneWorld(s),original=createSceneVertices(world);
  const selected=createSceneVertices(world,'entity-4');
  assert.equal(original.length,4*36*6);
  assert.equal(selected.length,original.length);
  assert.notDeepEqual(Array.from(original),Array.from(selected));
  const scene=createScene(),normal=createSceneVertices(sceneWorld(scene));
  const rotated=createSceneVertices(world);
  assert.equal(new Uint8Array(normal.buffer).length,new Uint8Array(rotated.buffer).length);
  assert.ok(createGridVertices().every(Number.isFinite));
});
test('preview positions affect visual world only, never authoring state',()=>{
  let s=createScene();
  const before=JSON.stringify(s);
  const preview={bodies:{'entity-3':{position:[2,3,-4]}}};
  const observed=displayWorld(s,preview);
  assert.deepEqual(observed.find(o=>o.id==='entity-3').position,[2,3,-4]);
  assert.equal(JSON.stringify(s),before);
});