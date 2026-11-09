// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createForgeScene,updateEntity,addEntity,sceneWorld,serializeScene} from '../demos/editor/model.js';
import {parseOBJ,createAssetLibrary,validateAssetLibrary,addMeshAsset,addTextureAsset,
  addMaterialAsset,addPrefabAsset,instantiatePrefab,setPlacement,prunePlacements,
  serializeProject,parseProject,MAX_MESH_VERTICES} from '../demos/editor/asset-foundry.js';
import {createSceneVertices,sceneResourceBudget} from '../demos/editor/viewport.js';
const digest=x=>x.repeat(64);
const OBJ=[
  '# user authored simple rectangle',
  'o Alien_Plane',
  'v -1 0 -1',
  'v 1 0 -1',
  'v 1 0 1',
  'v -1 0 1',
  'vt 0 0','vt 1 0','vt 1 1','vt 0 1',
  'f 1/1 2/2 3/3 4/4'
].join('\n');
function mesh(library=createAssetLibrary()){
  return addMeshAsset(library,{name:'Alien Plane',license:'OWNER-LOCAL-ONLY',
    sourceName:'alien.obj',sourceSha256:digest('a'),text:OBJ});
}
function texture(library){
  const rgba=new Uint8Array([
    255,0,0,255, 0,255,0,255,
    0,0,255,255, 255,255,255,255
  ]);
  return addTextureAsset(library,{name:'Pixel Art',license:'OWNER-LOCAL-ONLY',
    sourceName:'pixels.png',sourceSha256:digest('b'),width:2,height:2,bytes:rgba});
}
test('OBJ triangle fan, UV and normalized local geometry are deterministic',()=>{
  const a=parseOBJ(OBJ),b=parseOBJ(OBJ.replaceAll('\n','\r\n'));
  assert.deepEqual(a,b);
  assert.equal(a.length,30);
  assert.deepEqual(a.slice(0,5),[-1,0,-1,0,0]);
  assert.equal(a.length/5,6);
  assert.equal(MAX_MESH_VERTICES>=a.length/5,true);
});
test('OBJ external materials, malformed faces and unbounded data are refused',()=>{
  const invalid=[
    'mtllib ../../secrets.mtl\n'+OBJ,
    'usemtl remote\n'+OBJ,
    'v 0 0 0\nf 1 2',
    'v 0 0 NaN\nv 1 0 0\nv 0 1 0\nf 1 2 3',
    'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 9',
    'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1/8 2/8 3/8',
    'A'.repeat(65537),
  ];
  for(const text of invalid)assert.throws(()=>parseOBJ(text),undefined,
    'OBJ validation must refuse unsafe/unsupported syntax');
});
test('local OBJ, canonical texture, material and placements survive an exact project roundtrip',()=>{
  const scene=createForgeScene(),m=mesh(),t=texture(m.library);
  const material=addMaterialAsset(t.library,{name:'Alien Metal',
    license:'OWNER-LOCAL-ONLY',color:[1,1,1],textureId:t.id});
  const library=setPlacement(scene,material.library,'entity-4',m.id,material.id);
  const exported=serializeProject(scene,library),
    imported=parseProject(exported);
  assert.deepEqual(imported,{scene,library});
  assert.deepEqual(validateAssetLibrary(library,scene),library);
  assert.equal(imported.library.assets.length,3);
  assert.ok(exported.includes(digest('a')));
  assert.ok(exported.includes(digest('b')));
});
test('retained WebGL geometry includes imported triangles with canonical texel colours',()=>{
  const scene=createForgeScene(),m=mesh(),t=texture(m.library);
  const mat=addMaterialAsset(t.library,{name:'Alien Colours',
    license:'OWNER-LOCAL-ONLY',color:[1,1,1],textureId:t.id});
  const l=setPlacement(scene,mat.library,'entity-4',m.id,mat.id);
  const world=sceneWorld(scene),before=serializeScene(scene);
  const vertices=createSceneVertices(world,null,l),repeat=createSceneVertices(world,null,l);
  assert.deepEqual(vertices,repeat);
  assert.equal(vertices.length,3*36*6+6*6);
  assert.ok(vertices.every(Number.isFinite));
  assert.equal(sceneResourceBudget(world,l).vertexBytes,vertices.byteLength);
  assert.equal(serializeScene(scene),before,'render must never modify authored scenes');
  // Source vertices are attached under the exact entity world position.
  const first=vertices.slice(3*36*6,3*36*6+6);
  assert.ok(Math.abs(first[0]-1.9)<1e-5);
  assert.equal(first[1],1);
  assert.ok(Math.abs(first[2]+4.1)<1e-5);
  assert.deepEqual(Array.from(first.slice(3)),[0,0,1]);
});
test('authored material changes a primitive box without replacing its geometry',()=>{
  const scene=createForgeScene(),
    mat=addMaterialAsset(createAssetLibrary(),{name:'Red',license:'OWNER-LOCAL-ONLY',
      color:[1,0,0]});
  const base=createSceneVertices(sceneWorld(scene));
  const l=setPlacement(scene,mat.library,'entity-4',null,mat.id);
  const coloured=createSceneVertices(sceneWorld(scene),null,l);
  assert.equal(coloured.length,base.length);
  assert.notDeepEqual(coloured,base);
  for(let i=0;i<coloured.length;i+=6)
    assert.ok(Number.isFinite(coloured[i]));
});
test('prefab duplication remaps stable IDs, preserves mesh/material references and avoids second player',()=>{
  const s=createForgeScene(),m=mesh(),
    l=setPlacement(s,m.library,'entity-4',m.id);
  const p=addPrefabAsset(s,l,'entity-4','Alien Beacon', 'OWNER-LOCAL-ONLY');
  const before=serializeScene(s);
  const duplicated=instantiatePrefab(s,p.library,p.id);
  assert.equal(duplicated.scene.objects.length,5);
  assert.equal(duplicated.selected,'entity-5');
  assert.deepEqual(duplicated.library.placements.find(x=>x.entityId==='entity-5'),
    {entityId:'entity-5',meshId:m.id,materialId:null});
  assert.equal(serializeScene(s),before);
  const playerPrefab=addPrefabAsset(s,p.library,'entity-3','Player Clone','OWNER-LOCAL-ONLY');
  const spawned=instantiatePrefab(s,playerPrefab.library,playerPrefab.id);
  assert.equal(spawned.scene.objects.filter(e=>e.body==='player').length,1);
  assert.equal(spawned.scene.objects.at(-1).body,'dynamic');
});
test('nested prefab dependency is topologically stored and instantiated',()=>{
  let s=createForgeScene();
  s=addEntity(s,{parent:'entity-2',name:'Child'});
  s=addEntity(s,{parent:'entity-5',name:'Grandchild'});
  const library=createAssetLibrary();
  const created=addPrefabAsset(s,library,'entity-2','Nested','OWNER-LOCAL-ONLY');
  const spawned=instantiatePrefab(s,created.library,created.id);
  assert.equal(spawned.scene.objects.length,9);
  assert.equal(spawned.scene.objects.find(e=>e.id==='entity-8').parent,'entity-7');
  assert.equal(spawned.scene.objects.find(e=>e.id==='entity-9').parent,'entity-8');
});
test('dangling assignments are pruned after deletion but not silently rewritten during preview',()=>{
  const s=createForgeScene(),m=mesh(),
    l=setPlacement(s,m.library,'entity-4',m.id);
  const dropped={...s,objects:s.objects.filter(e=>e.id!=='entity-4')};
  assert.throws(()=>validateAssetLibrary(l,dropped),/dangling/);
  const clean=prunePlacements(dropped,l);
  assert.equal(clean.placements.length,0);
  assert.equal(l.placements.length,1,'caller owned source unchanged');
});
test('untrusted project, asset references, alpha, licensing and oversized payloads refuse safely',()=>{
  const s=createForgeScene(),m=mesh(),original=serializeProject(s,m.library);
  assert.throws(()=>parseProject(original.replace('"format": "qsol.vanillajs.asset-project.v1"',
    '"format": "untrusted"')),/format/);
  assert.throws(()=>addMeshAsset(createAssetLibrary(),{
    name:'Bad',license:'UNKNOWN',sourceName:'bad.obj',sourceSha256:digest('a'),text:OBJ
  }),/license/);
  const tBytes=new Uint8Array([1,2,3,0]);
  assert.throws(()=>addTextureAsset(createAssetLibrary(),{
    name:'Alpha',license:'OWNER-LOCAL-ONLY',sourceName:'alpha.png',
    sourceSha256:digest('c'),width:1,height:1,bytes:tBytes}),/alpha/);
  assert.throws(()=>setPlacement(s,m.library,'entity-4','asset-999'),/missing/);
  const invalid=structuredClone(m.library);
  invalid.assets.push({...invalid.assets[0]});
  assert.throws(()=>validateAssetLibrary(invalid),/duplicate/);
  const tooBig={...m.library,assets:m.library.assets.map(a=>
    ({...a,vertices:Array(MAX_MESH_VERTICES*5+15).fill(0)}))};
  assert.throws(()=>validateAssetLibrary(tooBig),/mesh triangles/);
});
