// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createScene,validateScene,addEntity,updateEntity,removeEntity,
  duplicateEntity,sceneWorld,serializeScene,parseScene,makeHistory,commitHistory,
  undoHistory,redoHistory} from '../demos/editor/model.js';

const copy=o=>structuredClone(o);
test('default project is stable, valid, serializable and independently owned',()=>{
  const a=createScene(),b=parseScene(serializeScene(a));
  assert.deepEqual(b,a);
  assert.equal(a.objects.length,4);
  b.objects[0].scale[0]=7;
  assert.equal(a.objects[0].scale[0],16);
});
test('hierarchy world transform and rotation in right-handed coordinates',()=>{
  let s=createScene();
  s=addEntity(s,{parent:'entity-2',name:'Child'});
  s=updateEntity(s,'entity-5',{position:[1,2,0],scale:[.5,.5,.5]});
  const child=sceneWorld(s).find(e=>e.id==='entity-5');
  assert.deepEqual(child.position,[-1,2.65,-1]);
  assert.deepEqual(child.scale,[1.5,.25,1.5]);
  s=updateEntity(s,'entity-2',{rotationY:90});
  const rotated=sceneWorld(s).find(e=>e.id==='entity-5');
  assert.ok(Math.abs(rotated.position[0]+2)<1e-10);
  assert.ok(Math.abs(rotated.position[2]+2.5)<1e-10);
});
test('parent cycles and missing parents are rejected transactionally',()=>{
  let s=createScene();s=addEntity(s,{parent:'entity-2'});
  const original=serializeScene(s);
  assert.throws(()=>updateEntity(s,'entity-2',{parent:'entity-5'}),/cycle/);
  assert.throws(()=>updateEntity(s,'entity-5',{parent:'entity-999'}),/parent/);
  assert.throws(()=>updateEntity(s,'entity-5',{parent:'entity-5'}),/parent/);
  assert.equal(serializeScene(s),original);
});
test('duplicate nested objects remaps parent IDs and avoids duplicate player roles',()=>{
  let s=createScene();s=addEntity(s,{parent:'entity-2',name:'Child'});
  const result=duplicateEntity(s,'entity-2');
  const root=result.scene.objects.find(e=>e.id===result.selected);
  const child=result.scene.objects.find(e=>e.parent===root.id);
  assert.equal(root.name,'Platform Copy');
  assert.equal(child.name,'Child Copy');
  assert.notEqual(child.id,'entity-5');
  assert.equal(s.objects.length,5);
  const player=duplicateEntity(s,'entity-3');
  assert.equal(player.scene.objects.filter(e=>e.body==='player').length,1);
  assert.equal(player.scene.objects.find(e=>e.id===player.selected).body,'dynamic');
});
test('remove deletes complete descendant subtree while keeping other entities',()=>{
  let s=createScene();s=addEntity(s,{parent:'entity-2'});
  s=addEntity(s,{parent:'entity-5'});
  const out=removeEntity(s,'entity-2');
  assert.deepEqual(out.objects.map(e=>e.id),['entity-1','entity-3','entity-4']);
  assert.equal(out.nextId,7);
  assert.equal(s.objects.length,6);
});
test('undo/redo retains full state snapshots and invalidates redo after new edit',()=>{
  let h=makeHistory(createScene());
  const scene1=addEntity(h.present);
  h=commitHistory(h,scene1);
  h=commitHistory(h,scene1);
  assert.equal(h.past.length,1);
  const undone=undoHistory(h);assert.equal(undone.present.objects.length,4);
  const redone=redoHistory(undone);assert.deepEqual(redone.present,scene1);
  const alternate=commitHistory(undone,addEntity(undone.present,{name:'Fork'}));
  assert.equal(alternate.future.length,0);
});
test('malicious or malformed scene imports fail before replacing scene',()=>{
  const s=createScene();
  const mutations=[
    x=>{x.schemaVersion=2;},
    x=>{x.objects[0].id=x.objects[1].id;},
    x=>{x.objects[0].color[0]=1.2;},
    x=>{x.objects[0].position[0]=NaN;},
    x=>{x.objects[0].rotationY=Infinity;},
    x=>{x.objects[0].name='<bad>\u0000';},
    x=>{x.objects[0].scale[1]=0;},
    x=>{x.objects[1].body='player';},
    x=>{x.objects[2].parent='entity-1';},
    x=>{x.nextId=4;},
    x=>{x.objects[0].bonus='untrusted';},
    x=>{x.objects[1].parent='entity-999';},
    x=>{x.objects[0].visible=1;},
  ];
  for(const modify of mutations){
    const x=copy(s);modify(x);
    assert.throws(()=>validateScene(x),undefined,'invalid mutation should reject');
  }
  assert.throws(()=>parseScene('x'.repeat(131073)),/128 KiB/);
  assert.throws(()=>parseScene('{"schemaVersion":1,"objects":[],"__proto__":{}}'));
  assert.deepEqual(createScene(),s);
});
test('bounded object count, name and IDs prevent resource exhaustion',()=>{
  let s=createScene();
  for(let i=s.objects.length;i<128;i++)s=addEntity(s);
  assert.equal(s.objects.length,128);
  assert.throws(()=>addEntity(s),/capacity/);
  assert.throws(()=>addEntity(createScene(),{name:'a'.repeat(65)}),/bounded/);
  assert.throws(()=>updateEntity(createScene(),'entity-1',{position:[-1001,0,0]}),/finite/);
});