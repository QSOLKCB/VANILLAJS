// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCADPrimitive,revolveProfile,cadMeshOBJ,cadColorStream,CAD_LIMITS} from '../modules/cad-geometry/index.js';
import {parseOBJ,addMeshAsset,setPlacement,validateAssetLibrary,createAssetLibrary,serializeProject,parseProject}
  from '../demos/editor/asset-foundry.js';
import {createForgeScene,addEntity,updateEntity,sceneWorld} from '../demos/editor/model.js';
import {createSceneVertices,sceneResourceBudget} from '../demos/editor/viewport.js';

const shape=(kind='column',segments=16)=>createCADPrimitive({kind,radius:1,height:2,segments});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const vec=values=>[values[0],values[1],values[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const minus=(a,b)=>a.map((v,i)=>v-b[i]);
const normal=(data,index)=>{const i=index*15,a=vec(data.slice(i,i+3)),b=vec(data.slice(i+5,i+8)),c=vec(data.slice(i+10,i+13));return cross(minus(b,a),minus(c,a));};

test('column, cone and urn are bounded closed revolutions with correct face budgets',()=>{
  for(const [kind,expected] of [['column',64],['cone',32],['urn',160]]){
    const g=shape(kind),repeat=shape(kind);
    assert.equal(g.triangleCount,expected);
    assert.equal(g.vertexCount,expected*3);
    assert.equal(g.vertices.length,expected*15);
    assert.ok(g.vertices.every(Number.isFinite));
    assert.ok(g.vertices.every((v,i)=>i%5<3||v>=0&&v<=1));
    assert.deepEqual(repeat.vertices,g.vertices);
    assert.ok(Object.isFrozen(g)&&Object.isFrozen(g.vertices));
  }
});
test('side triangles wind outward, bottom cap down and top cap up in +Y-up system',()=>{
  const m=shape('column',8).vertices;
  const side=normal(m,0),capDown=normal(m,16),capUp=normal(m,24);
  assert.ok(side[0]>0&&Math.abs(side[1])<1e-8,'first radial side outward +X');
  assert.ok(capDown[1]<0,'bottom cap must be outward -Y');
  assert.ok(capUp[1]>0,'top cap must be outward +Y');
  assert.ok(Math.hypot(...side)>0);
  const cone=shape('cone',8).vertices;
  assert.ok(normal(cone,0)[0]>0,'cone wall outward +X');
});
test('generated OBJ fits the existing strict parser, no foreign source or asset runtime',()=>{
  for(const kind of ['column','cone','urn']){
    const m=shape(kind,24),raw=cadMeshOBJ(m),parsed=parseOBJ(raw);
    assert.equal(parsed.length,m.vertices.length);
    assert.ok(new TextEncoder().encode(raw).length<64*1024);
    for(let i=0;i<parsed.length;i++){
      assert.ok(Math.abs(parsed[i]-m.vertices[i])<=.00000051,
        kind+' OBJ round-trip coordinate '+i);
    }
    assert.equal(cadMeshOBJ(m),raw,'byte-identical generated OBJ');
    assert.match(raw,/# SPDX-License-Identifier: Apache-2.0/);
  }
});
test('packed Float32 XYZ/RGB is exact to one Float32 conversion and does not modify source',()=>{
  const g=shape('urn',12),original=[...g.vertices],colour=[.1,.3,.7];
  const batch=cadColorStream(g,colour);
  assert.ok(batch instanceof Float32Array);
  assert.equal(batch.length,g.vertexCount*6);
  for(let i=0;i<g.vertexCount;i++){
    for(let j=0;j<3;j++)assert.equal(batch[i*6+j],Math.fround(g.vertices[i*5+j]));
    for(let j=0;j<3;j++)assert.equal(batch[i*6+j+3],Math.fround(colour[j]));
  }
  assert.deepEqual(g.vertices,original);
});
test('generated assets pass the existing editor, placements, geometry budget and project IO',()=>{
  let scene=createForgeScene(),library=createAssetLibrary();
  const g=shape('urn',16),text=cadMeshOBJ(g),id='entity-'+scene.nextId;
  scene=addEntity(scene,{name:'CAD Urn'});
  scene=updateEntity(scene,id,{position:[0,g.height/2,0],scale:[1,1,1]});
  const result=addMeshAsset(library,{name:'CAD Urn',license:'Apache-2.0',
    sourceName:'cad-urn.obj',sourceSha256:sha(text),text});
  library=setPlacement(scene,result.library,id,result.id);
  const validated=validateAssetLibrary(library,scene);
  assert.equal(validated.placements.at(-1).entityId,id);
  const world=sceneWorld(scene),vertices=createSceneVertices(world,id,library),budget=sceneResourceBudget(world,library);
  assert.equal(vertices.byteLength,budget.vertexBytes);
  assert.ok(vertices.every(Number.isFinite));
  assert.ok(budget.geometryBudgetBytes>=budget.vertexBytes);
  const roundtrip=parseProject(serializeProject(scene,library,{optionalGPU:false}));
  assert.deepEqual(roundtrip.scene,scene);
  assert.deepEqual(roundtrip.library,library);
  assert.equal(roundtrip.library.assets.at(-1).sourceSha256,sha(text));
});
test('lathe cap zero radius and minimum facets never emit degenerate triangles',()=>{
  const m=revolveProfile({profile:[[1,-1],[.5,0],[0,1]],segments:3});
  assert.equal(m.triangleCount,3*2+3+3);
  for(let i=0;i<m.triangleCount;i++)assert.ok(Math.hypot(...normal(m.vertices,i))>1e-12,
    'must never emit a zero-area triangle');
});
test('veto invalid coordinates, dense/accessor traps and excessive mesh complexity',()=>{
  assert.throws(()=>createCADPrimitive({kind:'sphere'}));
  assert.throws(()=>createCADPrimitive({kind:'column',radius:0}));
  assert.throws(()=>createCADPrimitive({kind:'cone',height:Infinity}));
  assert.throws(()=>createCADPrimitive({kind:'urn',segments:25}));
  assert.throws(()=>createCADPrimitive({kind:'urn',segments:2}));
  assert.throws(()=>createCADPrimitive({kind:'urn',segments:8.5}));
  assert.throws(()=>createCADPrimitive({kind:'urn',segments:8,surprise:1}));
  assert.throws(()=>cadMeshOBJ({vertices:[]}));
  assert.throws(()=>cadColorStream(shape(),[NaN,1,1]));
  assert.throws(()=>revolveProfile({profile:[[1,0],[1,0]],segments:8}));
  assert.throws(()=>revolveProfile({profile:[[0,0],[0,1]],segments:8}));
  assert.throws(()=>revolveProfile({profile:[[0,0],[0,1],[1,2]],segments:8}));
  assert.throws(()=>revolveProfile({profile:[,[1,1]],segments:8}));
  assert.throws(()=>revolveProfile({profile:Array.from({length:9},(_,i)=>[1,i]),segments:8}));
  let reads=0;const spec={kind:'column'};
  Object.defineProperty(spec,'radius',{get(){reads++;return 1;},enumerable:true});
  assert.throws(()=>createCADPrimitive(spec));assert.equal(reads,0);
  const a=[1,0];Object.defineProperty(a,0,{get(){reads++;return 1;},enumerable:true});
  assert.throws(()=>revolveProfile({profile:[a,[1,2]],segments:8}));assert.equal(reads,0);
  assert.equal(CAD_LIMITS.vertices,1536);
});
test('seeded 120 parameter combinations retain strict finite budgets and OBJ parity',()=>{
  let seed=264;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let i=0;i<120;i++){
    const kind=['column','cone','urn'][i%3],segments=3+Math.floor(rng()*22),
      radius=.1+rng()*4.9,height=.2+rng()*9.8;
    const g=createCADPrimitive({kind,radius,height,segments});
    assert.ok(g.vertexCount<=CAD_LIMITS.vertices);
    const parsed=parseOBJ(cadMeshOBJ(g));
    assert.equal(parsed.length,g.vertices.length);
    assert.ok(parsed.every(Number.isFinite));
  }
});
