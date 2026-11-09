// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createScene,updateEntity,addEntity,serializeScene} from '../demos/editor/model.js';
import {createPreview,stepPreview,PREVIEW_DT} from '../demos/editor/preview.js';
test('fixed-step play tape is reproducible and never mutates the authored scene',()=>{
  const scene=createScene(),before=serializeScene(scene);
  let a=createPreview(scene),b=createPreview(scene);
  for(let tick=0;tick<450;tick++){
    const input={x:tick%121<58?1:-1,z:tick%73<24?-1:0,jump:tick%43===0};
    a=stepPreview(scene,a,input);b=stepPreview(scene,b,input);
  }
  assert.deepEqual(a,b);
  assert.equal(serializeScene(scene),before);
  assert.equal(a.tick,450);
});
test('preview gravity lands on top of static ground and jump then returns',()=>{
  const scene=createScene();let state=createPreview(scene),landed=false,maxY=-Infinity;
  for(let i=0;i<150;i++){
    state=stepPreview(scene,state,{});
    const p=state.bodies['entity-3'];
    if(p.grounded)landed=true;
  }
  assert.ok(landed);
  const initial=state.bodies['entity-3'].position[1];
  state=stepPreview(scene,state,{jump:true});
  for(let i=0;i<45;i++){state=stepPreview(scene,state);maxY=Math.max(maxY,state.bodies['entity-3'].position[1]);}
  assert.ok(maxY>initial+.05,'jump must lift above support');
});
test('invalid input and exhausted tick cap fail closed',()=>{
  const scene=createScene(),state=createPreview(scene);
  assert.throws(()=>stepPreview(scene,state,{x:2}),/invalid/);
  assert.throws(()=>stepPreview(scene,{...state,tick:36000}),RangeError);
});
test('no player is a valid simulation, static authored entities never move',()=>{
  let s=createScene();
  s=updateEntity(s,'entity-3',{body:'static'});
  let p=createPreview(s);
  for(let i=0;i<10;i++)p=stepPreview(s,p,{});
  assert.deepEqual(p.bodies,{});
  assert.equal(s.objects.length,4);
});