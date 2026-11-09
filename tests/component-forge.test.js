// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createScene,createForgeScene,upgradeScene,validateScene,
  setEntityComponent,updateEntity,addEntity,duplicateEntity,sceneWorld,
  parseScene,serializeScene,makeHistory,commitHistory,undoHistory,redoHistory
} from '../demos/editor/model.js';
import {defaultComponents,normalizeComponents,patchComponent,bodyForComponents
} from '../demos/editor/components.js';
import {createPreview,stepPreview} from '../demos/editor/preview.js';
import {displayWorld} from '../demos/editor/viewport.js';
const clone=o=>structuredClone(o);

test('v1 file round-trips unchanged; explicit migration preserves every authored field',()=>{
  const legacy=createScene(),bytes=serializeScene(legacy);
  assert.equal(parseScene(bytes).schemaVersion,1);
  assert.equal(serializeScene(parseScene(bytes)),bytes);
  const migrated=upgradeScene(parseScene(bytes));
  assert.equal(migrated.schemaVersion,2);
  assert.equal(migrated.objects.length,legacy.objects.length);
  for(let i=0;i<legacy.objects.length;i++){
    const {components,...v1}=migrated.objects[i];
    assert.deepEqual(v1,legacy.objects[i]);
    assert.deepEqual(components,defaultComponents(v1.body));
  }
  assert.deepEqual(upgradeScene(migrated),migrated);
  assert.deepEqual(parseScene(serializeScene(migrated)),migrated);
  assert.deepEqual(createForgeScene(),migrated);
});
test('typed Inspector components are strictly validated, bounded and data-only',()=>{
  const scene=createForgeScene(),original=serializeScene(scene);
  const changed=setEntityComponent(scene,'entity-2','mesh',{enabled:false});
  assert.equal(changed.objects[1].components.mesh.enabled,false);
  assert.equal(displayWorld(changed).find(e=>e.id==='entity-2').visible,false);
  assert.equal(scene.objects[1].components.mesh.enabled,true);
  const rejected=[
    () => setEntityComponent(scene,'entity-2','untrusted',{enabled:true}),
    () => setEntityComponent(scene,'entity-2','mesh',{script:'alert(1)'}),
    () => setEntityComponent(scene,'entity-2','trigger',{tag:'<script>'}),
    () => setEntityComponent(scene,'entity-2','camera',{fov:0}),
    () => setEntityComponent(scene,'entity-2','controller',{speed:Infinity}),
    () => setEntityComponent(scene,'entity-2','rigidbody',{gravityScale:-1}),
    () => setEntityComponent(scene,'entity-999','mesh',{enabled:false}),
    () => validateScene({...scene,objects:scene.objects.map((e,i)=>i?e:{
      ...e,components:{...e.components,evil:{enabled:true}}})}),
    () => validateScene({...scene,objects:scene.objects.map((e,i)=>i?e:{
      ...e,body:'dynamic'})})
  ];
  for(const reject of rejected)assert.throws(reject);
  assert.equal(serializeScene(scene),original);
});
test('controller and Rigidbody edits reconcile body role without multiple players',()=>{
  let scene=createForgeScene();
  assert.throws(()=>setEntityComponent(scene,'entity-2','controller',{enabled:true}),/one player/);
  scene=setEntityComponent(scene,'entity-3','controller',{enabled:false});
  assert.equal(scene.objects[2].body,'dynamic');
  scene=setEntityComponent(scene,'entity-2','controller',{enabled:true});
  assert.equal(scene.objects[1].body,'player');
  assert.equal(scene.objects[1].components.rigidbody.mode,'dynamic');
  scene=setEntityComponent(scene,'entity-2','rigidbody',{mode:'static'});
  assert.equal(scene.objects[1].body,'static');
  assert.equal(scene.objects[1].components.controller.enabled,false);
  scene=updateEntity(scene,'entity-3',{body:'player'});
  assert.equal(scene.objects[2].components.controller.enabled,true);
  const copy=duplicateEntity(scene,'entity-3').scene;
  assert.equal(copy.objects.filter(e=>e.body==='player').length,1);
  assert.equal(copy.objects.at(-1).body,'dynamic');
  assert.equal(copy.objects.at(-1).components.controller.enabled,false);
});
test('all schema v2 editing operations preserve typed components and undo atomically',()=>{
  let scene=createForgeScene();const history=makeHistory(scene);
  scene=addEntity(scene,{parent:'entity-2',name:'Subpart'});
  scene=setEntityComponent(scene,'entity-5','mesh',{enabled:false});
  assert.equal(scene.objects.at(-1).components.mesh.enabled,false);
  const h=commitHistory(history,scene);
  assert.equal(undoHistory(h).present.objects.length,4);
  assert.deepEqual(redoHistory(undoHistory(h)).present,scene);
  assert.deepEqual(history.present,createForgeScene());
});
test('component-driven Play remains deterministic and freezes the authored scene',()=>{
  const s=createForgeScene(),snapshot=serializeScene(s);
  let a=createPreview(s),b=createPreview(s);
  const tape=Array.from({length:300},(_,tick)=>({
    x:tick%70<30?1:-1,z:tick%40<10?1:0,jump:tick%29===0
  }));
  for(const input of tape){a=stepPreview(s,a,input);b=stepPreview(s,b,input);}
  assert.deepEqual(a,b);
  assert.equal(a.tick,300);
  assert.ok(a.bodies['entity-3']);
  assert.ok(a.bodies['entity-3'].position.every(Number.isFinite));
  assert.equal(serializeScene(s),snapshot);
});
test('authored Controller movement speed changes actual Play displacement',()=>{
  let s=createForgeScene(),base=createPreview(s);
  const slow=setEntityComponent(s,'entity-3','controller',{speed:1});
  const fast=setEntityComponent(s,'entity-3','controller',{speed:8});
  const a=stepPreview(slow,base,{x:1}),b=stepPreview(fast,base,{x:1});
  assert.ok(b.bodies['entity-3'].position[0]>a.bodies['entity-3'].position[0]);
});
test('trigger-enter emits only on first overlap, with stable authored tag',()=>{
  let s=createForgeScene();
  s=updateEntity(s,'entity-4',{position:[0,2.5,2],scale:[2,2,2]});
  s=setEntityComponent(s,'entity-4','trigger',{enabled:true,tag:'alien_gate'});
  const start=createPreview(s),a=stepPreview(s,start,{}),b=stepPreview(s,a,{});
  assert.deepEqual(a.events,[{
    type:'trigger-enter',entityId:'entity-3',triggerId:'entity-4',tag:'alien_gate',tick:1
  }]);
  assert.equal(b.events.length,0);
  assert.deepEqual(s.objects[3].components.trigger.tag,'alien_gate');
});
test('Rigidbody and Collider toggles change real collision behavior',()=>{
  let s=createForgeScene(),p=createPreview(s);
  for(let i=0;i<100;i++)p=stepPreview(s,p,{});
  const withGround=p.bodies['entity-3'].position[1];
  const noGround=setEntityComponent(s,'entity-1','collider',{enabled:false});
  let q=createPreview(noGround);
  for(let i=0;i<100;i++)q=stepPreview(noGround,q,{});
  assert.ok(withGround>q.bodies['entity-3'].position[1]+1);
});
