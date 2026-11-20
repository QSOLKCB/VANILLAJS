// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  createCADPrimitive,cadProfileDraft,cadProfilePreset,cadProfileMesh,
  cadProfileMove,cadProfileInsert,cadProfileRemove,cadProfileSegments,
  cadProfileRecover,cadProfileScreen,cadProfileUnproject,cadMeshOBJ,
  CAD_LIMITS,CAD_SNAP_STEPS
} from '../modules/cad-geometry/index.js';
import {
  parseOBJ,createAssetLibrary,addMeshAsset,setPlacement,serializeProject,parseProject
} from '../demos/editor/asset-foundry.js';
import {
  createForgeScene,addEntity,updateEntity,sceneWorld,makeHistory,commitHistory,
  undoHistory,redoHistory
} from '../demos/editor/model.js';
import {createSceneVertices} from '../demos/editor/viewport.js';
const digest=text=>createHash('sha256').update(text).digest('hex');
const preset=(kind='urn',segments=16)=>cadProfilePreset({kind,radius:1,height:2,segments});
const asset=(mesh,sourceName='cad-profile.obj')=>{
  const text=cadMeshOBJ(mesh);
  return {id:'asset-1',kind:'mesh',name:'CAD Profile',license:'Apache-2.0',
    sourceName,sourceSha256:digest(text),vertices:parseOBJ(text)};
};
test('profile presets preserve exact CAD-001 authored geometry, three primitives',()=>{
  for(const kind of ['column','cone','urn'])for(const segments of [3,8,16,24]){
    const d=preset(kind,segments),g=cadProfileMesh(d),
      old=createCADPrimitive({kind,radius:1,height:2,segments});
    assert.deepEqual(g.vertices,old.vertices,kind+' source parity');
    assert.equal(d.vertices,old.vertexCount);
    assert.ok(Object.isFrozen(d)&&Object.isFrozen(d.profile)&&Object.isFrozen(d.profile[0]));
  }
});
test('pure ring edits snap real dimensions, preserve untouched rings and originals',()=>{
  const original=preset(),first=original.profile[2],before=[...original.profile.map(x=>[...x])];
  const altered=cadProfileMove(original,{index:2,radius:1.234,y:.071,snap:.05});
  assert.equal(altered.profile[2][0],1.25);
  assert.equal(altered.profile[2][1],.05);
  assert.deepEqual(original.profile.map(x=>[...x]),before);
  assert.notDeepEqual(cadMeshOBJ(cadProfileMesh(altered)),cadMeshOBJ(cadProfileMesh(original)));
  assert.deepEqual(altered.profile[0],original.profile[0]);
  assert.deepEqual(altered.profile[4],original.profile[4]);
  assert.deepEqual(CAD_SNAP_STEPS,[0,.025,.05,.1,.25]);
  assert.ok(first[1]<altered.profile[2][1]||first[1]>altered.profile[2][1]);
});
test('ring insertion/removal, facet edits and canonical finite bounds',()=>{
  const a=preset('urn',12),b=cadProfileInsert(a,{after:1});
  assert.equal(b.profile.length,6);assert.equal(a.profile.length,5);
  const c=cadProfileRemove(b,{index:2});
  assert.deepEqual(c.profile,a.profile);
  const d=cadProfileSegments(a,20);
  assert.equal(d.segments,20);assert.notEqual(d.triangles,a.triangles);
  assert.throws(()=>cadProfileInsert(a,{after:4}));
  assert.throws(()=>cadProfileRemove(cadProfileDraft({profile:[[.4,-1],[.6,1]],segments:12}),{index:0}));
  assert.throws(()=>cadProfileDraft({profile:[[1,-7],[.7,6]],segments:12}),
    /height.*limit/);
  assert.throws(()=>cadProfileMove(a,{index:2,radius:5.1,y:0}));
  assert.throws(()=>cadProfileMove(a,{index:2,radius:1,y:12}));
  assert.throws(()=>cadProfileMove(a,{index:2,radius:1,y:0,snap:.03}));
  assert.throws(()=>cadProfileMove(a,{index:2,radius:1,y:a.profile[1][1]}),
    /height must increase/);
  assert.throws(()=>cadProfileMove(a,{index:222,radius:1,y:0}));
});
test('recover edit-friendly rings from existing CAD-001 and CAD-002 project meshes',()=>{
  for(const kind of ['urn','column','cone'])for(const segments of [3,9,16,24]){
    const primitive=createCADPrimitive({kind,radius:.8,height:2.3,segments}),
      parsed=asset(primitive,'cad-'+kind+'.obj'),loaded=cadProfileRecover(parsed);
    assert.equal(loaded.segments,segments);
    assert.equal(loaded.profile.length,kind==='urn'?5:2);
    const generated=parseOBJ(cadMeshOBJ(cadProfileMesh(loaded)));
    assert.equal(generated.length,parsed.vertices.length);
    for(let i=0;i<generated.length;i++)assert.ok(Math.abs(generated[i]-parsed.vertices[i])<=1.000001e-6,
      kind+' reproducible point '+i);
    const edited=cadProfileMove(loaded,{index:0,radius:Math.min(4,loaded.profile[0][0]+.1),
      y:loaded.profile[0][1],snap:0});
    const reloaded=cadProfileRecover(asset(cadProfileMesh(edited)));
    assert.equal(reloaded.profile.length,loaded.profile.length);
  }
});
test('short supported CAD-001 meshes recover with mathematically bounded UV quantisation',()=>{
  // Codex P2 reproduction: after 6-decimal OBJ rounding, relative V can
  // differ by >1e-6 although every world-space ring is a valid CAD mesh.
  for(const height of [.200001,.234567,.301234,.687654,9.999999]){
    for(const kind of ['urn','column','cone']){
      const model=createCADPrimitive({kind,radius:.8,height,segments:16});
      const roundtripped=asset(model,'cad-'+kind+'.obj');
      const draft=cadProfileRecover(roundtripped);
      assert.equal(draft.segments,16);
      assert.equal(draft.profile.length,kind==='urn'?5:2);
    }
  }
  const original=asset(createCADPrimitive({kind:'urn',radius:.8,height:.234567,segments:16}),
    'cad-urn.obj');
  const poisoned={...original,vertices:original.vertices.map((v,i)=>i%5===4?v+.02:v)};
  assert.throws(()=>cadProfileRecover(poisoned),/not a recognisable native CAD surface/,
    'V rounding tolerance must not accept deliberately distorted UVs');
});
test('mismatched, copied/non-CAD and malformed meshes cannot impersonate a native profile',()=>{
  const raw=asset(cadProfileMesh(preset()));
  assert.throws(()=>cadProfileRecover({...raw,sourceName:'obj-import.obj'}));
  assert.throws(()=>cadProfileRecover({...raw,license:'OWNER-LOCAL-ONLY'}));
  assert.throws(()=>cadProfileRecover({...raw,vertices:[...raw.vertices.slice(0,35),9999,...raw.vertices.slice(36)]}));
  assert.throws(()=>cadProfileRecover({...raw,unknown:1}));
  assert.throws(()=>cadProfileRecover({...raw,vertices:[, ...raw.vertices.slice(1)]}));
  assert.throws(()=>cadProfileRecover({}));
  let called=0;const malicious={...raw};
  Object.defineProperty(malicious,'vertices',{get(){called++;return raw.vertices;},enumerable:true});
  assert.throws(()=>cadProfileRecover(malicious));assert.equal(called,0);
});
test('2D preview transforms are reversible and do not change authoritative mesh',()=>{
  const d=preset(),bytes=cadMeshOBJ(cadProfileMesh(d)),
    a=cadProfileScreen(d,{width:320,height:270,zoom:1,panX:0,panY:0}),
    b=cadProfileScreen(d,{width:320,height:270,zoom:2,panX:60,panY:0});
  assert.notDeepEqual(a.handles,b.handles);
  const p=cadProfileUnproject(a,a.handles[2]);
  assert.ok(Math.abs(p.radius-d.profile[2][0])<1e-12);
  assert.ok(Math.abs(p.y-d.profile[2][1])<1e-12);
  assert.equal(cadMeshOBJ(cadProfileMesh(d)),bytes);
  assert.throws(()=>cadProfileScreen(d,{width:0,height:270}));
  assert.throws(()=>cadProfileScreen(d,{width:320,height:270,zoom:100}));
  assert.throws(()=>cadProfileUnproject({}, {x:0,y:0}));
});
test('immutable CAD profile variants retain old asset/scene and survive project save/reload',()=>{
  let scene=createForgeScene(),library=createAssetLibrary(),past=makeHistory(scene);
  const original=preset(),text0=cadMeshOBJ(cadProfileMesh(original));
  const id1='entity-'+scene.nextId;
  scene=addEntity(scene,{name:'CAD Profile Original'});
  scene=updateEntity(scene,id1,{position:[0,-original.profile[0][1],0]});
  let result=addMeshAsset(library,{name:'CAD Profile',license:'Apache-2.0',sourceName:'cad-profile.obj',
    sourceSha256:digest(text0),text:text0});
  library=setPlacement(scene,result.library,id1,result.id);
  past=commitHistory(past,scene);
  const firstId=result.id;
  const next=cadProfileMove(original,{index:2,radius:1.25,y:.12,snap:.05});
  const id2='entity-'+scene.nextId,text1=cadMeshOBJ(cadProfileMesh(next));
  const revised=addEntity(scene,{name:'CAD Profile'});
  const revisedPositioned=updateEntity(revised,id2,{position:[0,-next.profile[0][1],0]});
  result=addMeshAsset(library,{name:'CAD Profile',license:'Apache-2.0',
    sourceName:'cad-profile.obj',sourceSha256:digest(text1),text:text1});
  library=setPlacement(revisedPositioned,result.library,id2,result.id);
  past=commitHistory(past,revisedPositioned);
  assert.notEqual(result.id,firstId);
  assert.equal(library.placements.length,2);
  assert.equal(library.assets.length,2);
  assert.ok(createSceneVertices(sceneWorld(revisedPositioned),id2,library).every(Number.isFinite));
  const loaded=parseProject(serializeProject(revisedPositioned,library,{optionalGPU:false}));
  assert.deepEqual(loaded.library,library);
  assert.equal(cadProfileRecover(loaded.library.assets[1]).profile.length,next.profile.length);
  const undone=undoHistory(past);
  assert.equal(undone.present.objects.some(o=>o.id===id2),false);
  const redone=redoHistory(undone);
  assert.equal(redone.present.objects.some(o=>o.id===id2),true);
});
test('seeded geometry round-trip for bounded profile sketches',()=>{
  let seed=2026;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let t=0;t<96;t++){
    const n=2+(t%7),segments=3+(t%22),base=-3+rand(),
      profile=Array.from({length:n},(_,i)=>[.1+rand()*3.5,base+i*8/(n-1)]);
    const d=cadProfileDraft({profile,segments}),mesh=cadProfileMesh(d);
    assert.ok(mesh.vertexCount<=CAD_LIMITS.vertices);
    const recovered=cadProfileRecover(asset(mesh));
    assert.equal(recovered.profile.length,n);
    assert.equal(recovered.segments,segments);
    assert.equal(recovered.vertices,d.vertices);
  }
});
