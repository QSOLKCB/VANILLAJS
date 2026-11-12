// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {STARTER_SCENES,createStarterScene,addGameplayPiece,inspectCreatorScene} from '../demos/editor/creator-workflow.js';
import {createForgeScene,updateEntity,setEntityComponent,removeEntity,addEntity,validateScene} from '../demos/editor/model.js';
import {createPreview,stepPreview} from '../demos/editor/preview.js';

test('starter scenes are owned v2 projects with fresh IDs and no common setup warnings',()=>{
  for(const {id}of STARTER_SCENES){
    const scene=createStarterScene(id,{firstId:50});
    assert.deepEqual(validateScene(scene),scene);
    assert.equal(scene.objects[0].id,'entity-50');
    assert.equal(scene.nextId,50+scene.objects.length);
    assert.deepEqual(inspectCreatorScene(scene).issues,[]);
    assert.equal(scene.objects.filter(e=>e.body==='player').length,1);
    scene.objects[0].position[0]=999;
    assert.notEqual(createStarterScene(id,{firstId:50}).objects[0].position[0],999);
  }
  assert.throws(()=>createStarterScene('missing'),/available starter/);
  for(const firstId of [0,NaN,1.5,999999])assert.throws(()=>createStarterScene('playground',{firstId}));
});

test('jumping starter reaches its finish event through actual fixed-step input',()=>{
  const scene=createStarterScene('jumping-course'),before=JSON.stringify(scene),events=[];
  let state=createPreview(scene);
  for(let tick=0;tick<240;tick++){
    state=stepPreview(scene,state,{z:-1,jump:true});events.push(...state.events);
  }
  assert.equal(events.filter(event=>event.tag==='finish').length,1);
  assert.equal(JSON.stringify(scene),before);
});

test('trigger trail produces three ordered checkpoints without solid-zone blockage',()=>{
  const scene=createStarterScene('trigger-trail'),events=[];
  let state=createPreview(scene);
  for(const [ticks,input]of [[60,{z:-1}],[45,{x:1}],[60,{z:-1}],[45,{x:-1}],[60,{z:-1}]])
    for(let tick=0;tick<ticks;tick++){state=stepPreview(scene,state,input);events.push(...state.events);}
  assert.deepEqual(events.map(event=>event.tag),['checkpoint-1','checkpoint-2','checkpoint-3']);
});

test('gameplay pieces configure real components and reject duplicate players atomically',()=>{
  const source=createForgeScene(),before=JSON.stringify(source);
  const trigger=addGameplayPiece(source,'trigger');
  const object=trigger.scene.objects.find(e=>e.id===trigger.selected);
  assert.equal(object.components.trigger.enabled,true);
  assert.equal(object.components.collider.enabled,false);
  assert.equal(addGameplayPiece(source,'decoration').scene.objects.at(-1).components.collider.enabled,false);
  assert.equal(addGameplayPiece(source,'platform').scene.objects.at(-1).components.collider.enabled,true);
  assert.throws(()=>addGameplayPiece(source,'player'),/player already exists/);
  assert.throws(()=>addGameplayPiece(source,'script'),/available gameplay/);
  assert.equal(JSON.stringify(source),before);
  const next=addGameplayPiece(removeEntity(source,'entity-3'),'player');
  assert.equal(next.scene.objects.at(-1).body,'player');
  assert.equal(next.scene.objects.at(-1).components.rigidbody.mode,'dynamic');
});

test('piece capacity failure leaves input unchanged',()=>{
  let scene=createForgeScene();while(scene.objects.length<128)scene=addEntity(scene);
  const before=JSON.stringify(scene);
  assert.throws(()=>addGameplayPiece(scene,'trigger'),/capacity/);
  assert.equal(JSON.stringify(scene),before);
});

test('scene checks identify absent controls, absent ground and unsafe spawning',()=>{
  let scene=createForgeScene();
  scene=updateEntity(scene,'entity-3',{visible:false});
  assert.ok(inspectCreatorScene(scene).issues.some(i=>i.code==='missing-player'));
  scene=createForgeScene();
  scene=updateEntity(scene,'entity-3',{position:[0,0,0]});
  assert.ok(inspectCreatorScene(scene).issues.some(i=>i.code==='spawn-overlap'&&i.entityId==='entity-3'));
  scene=updateEntity(scene,'entity-3',{position:[100,1,100]});
  assert.ok(inspectCreatorScene(scene).issues.some(i=>i.code==='no-floor-below'));
  for(const e of scene.objects.filter(e=>e.body==='static'))scene=removeEntity(scene,e.id);
  assert.ok(inspectCreatorScene(scene).issues.some(i=>i.code==='missing-ground'));
});

test('scene checks match world visibility, composed rotations and trigger semantics',()=>{
  let scene=createForgeScene();
  scene=updateEntity(scene,'entity-4',{rotationY:45});
  scene=setEntityComponent(scene,'entity-4','trigger',{enabled:true});
  const codes=inspectCreatorScene(scene).issues.map(i=>i.code);
  for(const code of ['rotated-collider','rotated-trigger','solid-trigger'])assert.ok(codes.includes(code));
  scene=updateEntity(scene,'entity-4',{visible:false});
  assert.equal(inspectCreatorScene(scene).issues.length,0);
  scene=updateEntity(scene,'entity-4',{visible:true,rotationY:0,parent:'entity-2'});
  scene=updateEntity(scene,'entity-2',{rotationY:45});
  assert.ok(inspectCreatorScene(scene).issues.some(i=>i.code==='rotated-trigger'&&i.entityId==='entity-4'));
});

test('scene checks flag runtime limitations without changing or accepting invalid input',()=>{
  let scene=createForgeScene();
  scene=setEntityComponent(scene,'entity-3','controller',{speed:0});
  scene=setEntityComponent(scene,'entity-3','camera',{enabled:true});
  scene=updateEntity(scene,'entity-4',{body:'dynamic'});
  const before=JSON.stringify(scene),codes=inspectCreatorScene(scene).issues.map(i=>i.code);
  for(const code of ['zero-speed','camera-metadata','dynamic-contacts'])assert.ok(codes.includes(code));
  assert.equal(JSON.stringify(scene),before);
  assert.throws(()=>inspectCreatorScene({...scene,unknown:true}),/keys invalid/);
});
