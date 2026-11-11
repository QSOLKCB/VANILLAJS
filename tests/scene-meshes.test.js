// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {SceneMeshes} from '../demos/editor/scene-meshes.js';
import {OptionalRenderer,packedVertices} from '../modules/render-optional/index.js';
import {createSceneVertices,displayWorld} from '../demos/editor/viewport.js';
import {serializeProject} from '../demos/editor/asset-foundry.js';
import {largeEditorProject} from '../scripts/browser-optional-labs.js';
test('valid 43-object project preserves 66048 vertices across whole-triangle batches',()=>{
  const {scene,library}=largeEditorProject();assert.ok(serializeProject(scene,library).length<256*1024);
  const data=createSceneVertices(displayWorld(scene),null,library);assert.equal(data.length/6,66048);
  assert.throws(()=>packedVertices(data));
  const r=new OptionalRenderer({getContext:()=>({})}),meshes=new SceneMeshes(r);meshes.update(data);
  assert.deepEqual(Array.from(r.meshes.values(),m=>m.data.length/6),[65535,513]);
  assert.deepEqual(Float32Array.from(Array.from(r.meshes.values()).flatMap(m=>Array.from(m.data))),data);
  const first=meshes.handles[0];meshes.update(data.subarray(0,18));assert.equal(meshes.handles[0],first);assert.equal(r.meshes.size,1);
  assert.throws(()=>meshes.update(new Float32Array(17)));assert.equal(r.meshes.size,1);
  meshes.update(data);assert.equal(r.meshes.size,2);meshes.update(new Float32Array());assert.equal(r.meshes.size,0);
  meshes.update(data);meshes.dispose();assert.equal(r.meshes.size,0);
});
