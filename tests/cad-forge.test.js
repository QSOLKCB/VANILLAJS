// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  createForgeExtrusion,createForgePreset,forgePresetFootprint,forgeVolumeReference,
  inspectForgeTriangles,cadMeshOBJ,cadColorStream,FORGE_LIMITS
} from '../modules/cad-geometry/index.js';
import {parseOBJ,createAssetLibrary,addMeshAsset,setPlacement,
  validateAssetLibrary,serializeProject,parseProject} from '../demos/editor/asset-foundry.js';
import {createForgeScene,addEntity,updateEntity,sceneWorld,makeHistory,
  commitHistory,undoHistory,redoHistory} from '../demos/editor/model.js';
import {createSceneVertices,sceneResourceBudget} from '../demos/editor/viewport.js';
import {parseForgeFootprint,forgeCompoundPlan} from '../demos/editor/geometry-forge.js';
const digest=s=>createHash('sha256').update(s).digest('hex');
const cube=(bevel=0)=>createForgeExtrusion({footprint:[[-1,-1],[1,-1],[1,1],[-1,1]],
  height:2,bevel});
const close=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<=t,
  'expected '+a+' ≈ '+b+' tolerance '+t);
const good=m=>{
  const r=inspectForgeTriangles(m);
  assert.equal(r.closed,true,'closed, correctly wound indexed surface');
  assert.equal(r.boundaryEdges,0);assert.equal(r.nonManifoldEdges,0);
  assert.equal(r.orientationErrors,0);assert.equal(r.degenerate,0);
  assert.equal(r.euler,2);assert.ok(r.signedVolume>0);
  return r;
};
test('original rectangle and four industrial presets form closed positive solids',()=>{
  const mesh=cube(),r=good(mesh);
  assert.equal(mesh.source,'forge-extrusion');
  assert.equal(r.triangles,12);assert.equal(r.weldedVertices,8);
  assert.equal(r.edges,18);close(r.volume,8);close(r.area,24);
  for(const kind of ['wall','platform','tower','wedge']){
    for(const bevel of [0,.2]){
      const opt={kind,width:2,depth:2,height:2,bevel},
        model=createForgePreset(opt),info=good(model);
      assert.ok(info.triangles<=FORGE_LIMITS.meshVertices/3);
      close(info.volume,forgeVolumeReference(forgePresetFootprint(opt)));
    }
  }
});
test('true geometric edge chamfer reduces volume with independent analytic rectangle reference',()=>{
  for(const bevel of [.05,.1,.2,.4]){
    const opts={footprint:[[-1,-1],[1,-1],[1,1],[-1,1]],height:2,bevel},
      info=good(createForgeExtrusion(opts));
    // Independent algebra for a rectangle with an edge-parallel uniform
    // inset: outer central prism plus two linearly tapered bevel bands.
    const width=2,depth=2,central=width*depth*(2-2*bevel),
      bevelBands=2*bevel*(width*depth-bevel*(width+depth)+4*bevel**2/3);
    close(info.volume,central+bevelBands,1e-8);
    assert.ok(info.volume<8);
    close(forgeVolumeReference(opts),info.volume,1e-8);
    assert.equal(info.triangles,28); // 4*3 quad bands + two 2-triangle caps
  }
});
test('strict XZ convexity, winding, positive volume and bevel budget fail closed',()=>{
  const ccw=[[-1,-1],[1,-1],[1,1],[-1,1]],base={footprint:ccw,height:2};
  for(const patch of [
    {footprint:[...ccw].reverse()},
    {footprint:[[0,0],[2,0],[1,1],[2,2],[0,2]]},
    {footprint:[[0,0],[.00001,0],[0,1]]},
    {footprint:[[0,0],[1,0],[2,0],[2,1]]},
    {footprint:[[-1,-1],[1,-1],[1,1],[1,1]]},
    {footprint:[[-6,-1],[1,-1],[1,1],[-1,1]]},
    {footprint:[[0,0],[0,0],[1,0]]},
    {height:Infinity},{height:0},{bevel:-.2},{bevel:1.2},{bevel:.0000004},
    {height:.2,bevel:.1},
    {footprint:ccw,bevel:.99}
  ])assert.throws(()=>createForgeExtrusion({...base,...patch}));
  assert.throws(()=>createForgePreset({kind:'unknown'}));
  assert.throws(()=>createForgePreset({kind:'tower',width:0}));
  assert.throws(()=>createForgeExtrusion({footprint:ccw,height:2,unknown:true}));
  assert.throws(()=>createForgeExtrusion({footprint:ccw,height:2,
    bevel:0,extra:()=>{throw Error('executed')}}));
});
test('JSON/OBJ boundary, source provenance and native XYZ/RGB are deterministic',()=>{
  for(const kind of ['wall','platform','tower','wedge'])for(const bevel of [0,.15]){
    const a=createForgePreset({kind,width:2.5,depth:2,height:3,bevel}),
      b=createForgePreset({kind,width:2.5,depth:2,height:3,bevel});
    assert.deepEqual(a.vertices,b.vertices);
    const text=cadMeshOBJ(a),parsed=parseOBJ(text);
    assert.equal(cadMeshOBJ(a),cadMeshOBJ(b));
    assert.equal(parsed.length,a.vertices.length);
    assert.ok(text.length<64*1024);
    assert.ok(parsed.every(Number.isFinite));
    const unpacked=inspectForgeTriangles(parsed);
    assert.equal(unpacked.closed,true);
    close(unpacked.volume,good(a).volume,2e-5);
    const rgb=cadColorStream(a,[.3,.7,.8]);
    assert.equal(rgb.length,a.vertexCount*6);
    for(let i=0;i<a.vertexCount;i++){
      for(let j=0;j<3;j++)assert.equal(rgb[i*6+j],Math.fround(a.vertices[i*5+j]));
      for(let j=0;j<3;j++)assert.equal(rgb[i*6+j+3],Math.fround([.3,.7,.8][j]));
    }
  }
});
test('topology inspection reports independent open, reversed and degenerate geometry',()=>{
  const m=cube(),raw=[...m.vertices],tri=15;
  const open=inspectForgeTriangles(raw.slice(tri));
  assert.equal(open.closed,false);assert.ok(open.boundaryEdges>0);
  const reverse=[...raw];
  for(let j=0;j<5;j++) [reverse[5+j],reverse[10+j]]=[reverse[10+j],reverse[5+j]];
  const badWinding=inspectForgeTriangles(reverse);
  assert.equal(badWinding.closed,false);assert.ok(badWinding.orientationErrors>0);
  const degenerate=inspectForgeTriangles(raw.map((v,i)=>i<3*5?v: v));
  assert.equal(degenerate.closed,true); // unchanged fixture
  const bad=[...raw];
  for(let j=0;j<5;j++)bad[10+j]=bad[j];
  assert.equal(inspectForgeTriangles(bad).closed,false);
  assert.ok(inspectForgeTriangles(bad).degenerate>0);
  const duplicated=inspectForgeTriangles([...raw,...raw.slice(0,15)]);
  assert.equal(duplicated.closed,false);
  assert.ok(duplicated.nonManifoldEdges>0);
  assert.throws(()=>inspectForgeTriangles([0,0,0]));
  assert.throws(()=>inspectForgeTriangles(Array(30)));
  assert.throws(()=>inspectForgeTriangles([...raw.slice(0,8),Infinity,...raw.slice(9)]));
  assert.throws(()=>inspectForgeTriangles({vertices:raw}));
});
test('game-world meshes use the strict existing Asset Foundry and export intact',()=>{
  let scene=createForgeScene(),library=createAssetLibrary(),history=makeHistory(scene);
  for(const kind of ['wall','tower','wedge']){
    const model=createForgePreset({kind,width:2,depth:2,height:2,bevel:.15}),
      raw=cadMeshOBJ(model),id='entity-'+scene.nextId;
    scene=addEntity(scene,{name:'Forge '+kind});
    scene=updateEntity(scene,id,{position:[0,1,0],scale:[1,1,1]});
    const record=addMeshAsset(library,{name:'Forge '+kind,license:'Apache-2.0',
      sourceName:'cad-forge.obj',sourceSha256:digest(raw),text:raw});
    library=setPlacement(scene,record.library,id,record.id);
    history=commitHistory(history,scene);
  }
  const checked=validateAssetLibrary(library,scene);
  assert.equal(checked.assets.length,3);assert.equal(checked.placements.length,3);
  const world=sceneWorld(scene),verts=createSceneVertices(world,null,library);
  assert.ok(verts.every(Number.isFinite));
  assert.equal(verts.byteLength,sceneResourceBudget(world,library).vertexBytes);
  const restored=parseProject(serializeProject(scene,library,{optionalGPU:false}));
  assert.deepEqual(restored.scene,scene);assert.deepEqual(restored.library,library);
  for(const asset of restored.library.assets){
    assert.equal(asset.license,'Apache-2.0');
    assert.equal(asset.sourceName,'cad-forge.obj');
    assert.equal(inspectForgeTriangles(asset.vertices).closed,true);
  }
  assert.equal(undoHistory(history).present.objects.length,scene.objects.length-1);
  assert.deepEqual(redoHistory(undoHistory(history)).present,scene);
});
test('strict inert custom polygon parser refuses scripts, giant strings and hidden data',()=>{
  assert.deepEqual(parseForgeFootprint('-1,-1;1,-1;1,1;-1,1'),
    [[-1,-1],[1,-1],[1,1],[-1,1]]);
  for(const input of ['','1,2','1,2;3,4;5,6;','1,2;eval(1),4;5,6',
    '1,2;3,4;NaN,6','1,2;3,4;5,Infinity','1e5,2;3,4;5,6',
    '1,2;3,4;5,6;7,8;'.repeat(90)])
    assert.throws(()=>parseForgeFootprint(input));
  assert.throws(()=>parseForgeFootprint(null));
  const huge=Array(14).fill('0,0').join(';');
  assert.throws(()=>parseForgeFootprint(huge));
});
test('original six-piece industrial compound fits bounds and topology budget',()=>{
  const plan=forgeCompoundPlan();
  assert.equal(plan.length,6);
  assert.ok(Object.isFrozen(plan)&&plan.every(Object.isFrozen));
  const names=new Set(plan.map(x=>x.name));
  assert.equal(names.size,6);
  let vertexCount=0;
  for(const row of plan){
    const options={kind:row.kind,width:row.width,depth:row.depth,
      height:row.height,bevel:row.bevel};
    const mesh=createForgePreset(options),diag=good(mesh);
    close(diag.volume,forgeVolumeReference(forgePresetFootprint(options)));
    vertexCount+=mesh.vertexCount;
    assert.equal(row.position[1],row.height/2);
  }
  assert.ok(vertexCount<6*FORGE_LIMITS.meshVertices);
});
test('seeded 144 varied convex footprints preserve Euler, native/OBJ volume parity',()=>{
  let state=303;const rnd=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2**32;};
  for(let i=0;i<144;i++){
    const n=3+(i%10),r1=.75+rnd()*2,r2=.75+rnd()*2,
      footprint=Array.from({length:n},(_,k)=>{
        const angle=2*Math.PI*k/n;return [r1*Math.cos(angle),r2*Math.sin(angle)];
      }),height=.5+rnd()*7,bevel=i%3===0?0:.05+rnd()*.1,
      opts={footprint,height,bevel},model=createForgeExtrusion(opts);
    const info=good(model),expected=forgeVolumeReference(opts);
    close(info.volume,expected,Math.max(1e-8,expected*1e-8));
    const round=inspectForgeTriangles(parseOBJ(cadMeshOBJ(model)));
    assert.equal(round.closed,true,'OBJ triangle parity trial '+i);
    close(round.volume,expected,5e-5);
  }
});
