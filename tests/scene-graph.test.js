// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSceneGraph,sceneNode,validateSceneGraph,serializeSceneGraph,sampleSceneGraph,localToWorld,worldToLocal,transformMatrix,inverseSceneMatrix,transformPoint,SceneGraph} from '../modules/scene-graph/index.js';
import {createScene,createForgeScene,addEntity,updateEntity,serializeScene} from '../demos/editor/model.js';
import {captureComposition,compositionExample,saveCompositionPrefab,addCompositionInstance,captureCompositionKey,compositionHistory,commitComposition,travelComposition} from '../demos/editor/scene-composition.js';
import {SceneCompositionPreview,compositionVertices} from '../demos/editor/scene-composition-preview.js';
const approx=(a,b)=>a.forEach((x,i)=>assert.ok(Math.abs(x-b[i])<1e-9,`${x} != ${b[i]}`));
const clone=x=>JSON.parse(JSON.stringify(x));
function graph(){const g=createSceneGraph();g.nodes=[sceneNode('root',{position:[3,2,-1],rotation:[0,Math.sin(.4),0,Math.cos(.4)],scale:[2,1,3]}),sceneNode('child',{parent:'root',position:[1,2,3],rotation:[Math.sin(.3),0,0,Math.cos(.3)],scale:[1,2,1]})];return g;}
test('scene graph composes actual affine hierarchy and inverse with nonuniform parent scale',()=>{
  const g=graph(),snapshot=sampleSceneGraph(g);assert.deepEqual(snapshot.map(n=>n.id),['root','child']);
  for(const p of [[0,0,0],[.3,-.5,2],[10,7,-3]]){
    approx(localToWorld(g,'child',p),transformPoint(transformMatrix(g.nodes[0].transform),transformPoint(transformMatrix(g.nodes[1].transform),p)));
    approx(worldToLocal(g,'child',localToWorld(g,'child',p)),p);
  }
  assert.notDeepEqual(snapshot[1].matrix,transformMatrix(g.nodes[1].transform));
  assert.throws(()=>inverseSceneMatrix([0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),/singular/);
  assert.deepEqual(validateSceneGraph(serializeSceneGraph(g)),validateSceneGraph(g));
});
test('strict inert admission rejects unknown versions, getters, array subclasses, bad references and deep graphs',()=>{
  const base=graph();for(const mutate of [g=>g.version=2,g=>g.script='alert(1)',g=>g.nodes[1].parent='missing',g=>g.nodes[0].parent='child',g=>g.nodes[0].transform.scale[0]=0,g=>g.nodes[0].transform.rotation=[0,0,0,0],g=>g.nodes.push(clone(g.nodes[0]))]){const bad=clone(base);mutate(bad);assert.throws(()=>validateSceneGraph(bad));}
  let called=false;const getter=graph();Object.defineProperty(getter,'name',{get(){called=true;return 'unsafe';},enumerable:true});assert.throws(()=>validateSceneGraph(getter));assert.equal(called,false);
  const sub=graph();sub.nodes=new(class extends Array{})(...sub.nodes);assert.throws(()=>validateSceneGraph(sub));
  const deep=createSceneGraph();for(let i=0;i<17;i++)deep.nodes.push(sceneNode('n-'+i,{parent:i?'n-'+(i-1):null}));assert.throws(()=>validateSceneGraph(deep),/depth/);
  assert.throws(()=>validateSceneGraph(' '.repeat(262145)),/256 KiB/);
});
test('camera/light/appearance and inherited visibility remain owned validated metadata',()=>{
  const g=graph();g.nodes[0].name='<literal, not markup>';g.nodes[0].visible=false;g.nodes[1].components.camera={fov:1,near:.1,far:200};g.nodes[1].components.light={kind:'directional',color:[1,.8,.6],intensity:2};
  const world=sampleSceneGraph(g);assert.equal(world[1].visible,false);assert.equal(world[1].components.camera.fov,1);world[1].components.camera.fov=2;assert.equal(g.nodes[1].components.camera.fov,1);
  g.nodes[1].components.camera.far=.01;assert.throws(()=>validateSceneGraph(g),/clipping/);
});
test('absolute animation sampling is deterministic and independent of render cadence; quaternion shortest arc',()=>{
  const g=graph();g.tracks=[{node:'root',keys:[{time:0,transform:clone(g.nodes[0].transform)},{time:2,transform:{position:[7,4,3],rotation:g.nodes[0].transform.rotation.map(n=>-n),scale:[4,3,5]}}]}];
  const scene=new SceneGraph(g);for(const t of [0,.1,1,1.1,2,3])scene.sample(t);const a=scene.sample(1),b=new SceneGraph(g).sample(1);
  assert.deepEqual(a,b);approx(a[0].transform.position,[5,3,1]);approx(a[0].transform.scale,[3,2,4]);approx(a[0].transform.rotation,g.nodes[0].transform.rotation);
  assert.throws(()=>scene.sample(-1));assert.throws(()=>scene.sample(11));
  const accepted=scene.snapshot(),bad=clone(g);bad.tracks[0].keys.reverse();assert.throws(()=>scene.replace(bad));assert.deepEqual(scene.snapshot(),accepted);
});
test('nested prefabs remap identity and references, preserve transforms and enforce cycle/expansion budgets',()=>{
  let g=createSceneGraph();g.nodes=[sceneNode('lamp',{position:[1,0,0]})];g=saveCompositionPrefab(g,'lamp','light');g.prefabs.push({id:'pair',nodes:[],instances:[]});
  g=addCompositionInstance(g,{id:'a',prefab:'light',container:'pair'});g=addCompositionInstance(g,{id:'b',prefab:'light',container:'pair',position:[2,0,0]});g=addCompositionInstance(g,{id:'assembly',prefab:'pair',position:[0,3,0]});
  const world=sampleSceneGraph(g);assert.deepEqual(world.find(n=>n.id==='assembly/b/lamp').position,[3,3,0]);assert.equal(new Set(world.map(n=>n.id)).size,world.length);
  const bad=clone(g);bad.prefabs[0].instances.push({id:'cycle',prefab:'pair',parent:null,transform:clone(g.nodes[0].transform)});assert.throws(()=>validateSceneGraph(bad),/cycle/);
  const huge=createSceneGraph();huge.prefabs=[{id:'bulk',nodes:Array.from({length:32},(_,i)=>sceneNode('n-'+i)),instances:[]}];huge.instances=Array.from({length:4},(_,i)=>({id:'i-'+i,prefab:'bulk',parent:null,transform:{position:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1]}}));assert.throws(()=>validateSceneGraph(huge),/128/);
  const unused=createSceneGraph();unused.prefabs=[{id:'unused',nodes:[],instances:[{id:'bad',prefab:'absent',parent:null,transform:clone(g.nodes[0].transform)}]}];assert.throws(()=>validateSceneGraph(unused),/missing prefab/);
});
test('legacy Workbench scenes remain unchanged and explicit capture/key/history are transactional',()=>{
  for(const base of [createScene(),createForgeScene()]){const bytes=serializeScene(base),g=captureComposition(base);assert.equal(g.nodes.length,base.objects.length);assert.equal(serializeScene(base),bytes);assert.equal(g.format,'qsol.vanillajs.scene-graph.v1');}
  let scene=addEntity(createForgeScene(),{parent:'entity-4'});scene=updateEntity(scene,'entity-4',{rotationY:60,scale:[2,1,3]});const original=captureComposition(scene);
  let g=captureCompositionKey(original,'entity-4',scene,'entity-4',0);scene=updateEntity(scene,'entity-4',{position:[6,2,1]});g=captureCompositionKey(g,'entity-4',scene,'entity-4',2);
  approx(sampleSceneGraph(g,1).find(n=>n.id==='entity-4').position,[4.5,1.5,-1]);
  const history=compositionHistory(original),next=commitComposition(history,g);assert.deepEqual(travelComposition(next,'undo').present,original);assert.deepEqual(travelComposition(travelComposition(next,'undo'),'redo').present,g);
});
test('preview transforms every vertex with full affine matrix and releases exactly its owned renderer',()=>{
  const g=graph(),world=sampleSceneGraph(g),vertices=compositionVertices(world);assert.equal(vertices.length,2*36*6);assert.ok(vertices.every(Number.isFinite));
  const calls={created:0,disposed:0,frames:0},api={createMesh(){calls.created++;return {};},updateMesh(h,v){assert.ok(v instanceof Float32Array);},beginFrame(){calls.frames++;},draw(){},endFrame(){},stats(){return {...calls};},dispose(){calls.disposed++;}};
  const canvas={width:0,height:0,getBoundingClientRect:()=>({width:320,height:200})},preview=new SceneCompositionPreview(canvas,g,{rendererFactory:()=>api});
  preview.draw(0);preview.draw(0);assert.equal(calls.created,1);assert.equal(calls.frames,2);const accepted=preview.snapshot();assert.throws(()=>preview.load({}));assert.deepEqual(preview.snapshot(),accepted);
  preview.dispose();preview.dispose();assert.equal(calls.disposed,1);assert.throws(()=>preview.draw(0),/disposed/);
  assert.ok(sampleSceneGraph(compositionExample(),3).find(n=>n.id==='lantern').position[0]<0);
});
test('runtime bound failures at an intermediate key sample preserve the accepted graph',()=>{
  const g=createSceneGraph();g.duration=2;g.nodes=[sceneNode('root',{scale:[100,100,100]}),sceneNode('arm',{parent:'root',scale:[100,100,100]}),sceneNode('tip',{parent:'arm',position:[1000,0,1000]})];
  g.tracks=[{node:'arm',keys:[{time:0,transform:clone(g.nodes[1].transform)},{time:2,transform:{...clone(g.nodes[1].transform),rotation:[0,1,0,0]}}]}];
  const scene=new SceneGraph(g),accepted=scene.snapshot();assert.throws(()=>scene.sample(.5),/bounded|range/);assert.deepEqual(scene.snapshot(),accepted);assert.equal(scene.sample(0).length,3);
});
test('every admitted export reimports within its own UTF-8 budget',()=>{
  const g=createSceneGraph();g.nodes=Array.from({length:100},(_,i)=>sceneNode('n-'+i,{name:'Lantern '.repeat(7)}));
  g.tracks=g.nodes.map(n=>({node:n.id,keys:Array.from({length:8},(_,i)=>({time:i,transform:clone(n.transform)}))}));
  const text=serializeSceneGraph(g);assert.ok(new TextEncoder().encode(text).length<=262144);assert.deepEqual(validateSceneGraph(text),validateSceneGraph(g));
});

test('capture retains valid legacy camera endpoints and literal names',()=>{
  const scene=createForgeScene();scene.name='<A scene>';scene.objects[0].name='<A cube>';scene.objects[0].components.camera={enabled:true,fov:120};
  const g=captureComposition(scene);assert.equal(g.name,scene.name);assert.equal(g.nodes[0].name,scene.objects[0].name);assert.equal(g.nodes[0].components.camera.fov,120*Math.PI/180);
});

test('independent quarter-turn oracle fixes matrix layout, handedness and inverse',()=>{
  const g=createSceneGraph();g.nodes=[sceneNode('axis',{position:[5,6,7],rotation:[0,Math.SQRT1_2,0,Math.SQRT1_2],scale:[2,3,4]})];
  approx(localToWorld(g,'axis',[1,2,3]),[17,12,5]);approx(worldToLocal(g,'axis',[17,12,5]),[1,2,3]);
});
