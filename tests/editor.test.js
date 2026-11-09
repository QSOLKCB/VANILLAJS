// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createScene,validateScene,addEntity,updateEntity,removeEntity,
  duplicateEntity,sceneWorld,serializeScene,parseScene,makeHistory,commitHistory,
  undoHistory,redoHistory} from '../demos/editor/model.js';
import {createGridVertices,createSceneVertices,cameraMatrix,cameraRay,
  hitWorldBox,pickObject,displayWorld} from '../demos/editor/viewport.js';
import {createPreview,stepPreview,PREVIEW_DT} from '../demos/editor/preview.js';

test('default editor project is deterministic, bounded, and round-trips exactly',()=>{
  const a=createScene(),b=createScene();
  assert.deepEqual(a,b);
  assert.equal(a.objects.length,4);
  assert.equal(a.objects.filter(e=>e.body==='player').length,1);
  assert.deepEqual(parseScene(serializeScene(a)),a);
  assert.equal(JSON.stringify(a),JSON.stringify(b));
});
test('edit is transactional and caller-owned, including names, colour and visibility',()=>{
  const original=createScene();
  const edited=updateEntity(original,'entity-4',{
    name:'A new beacon',position:[1.25,2,-3],color:[0,1,.5],
    visible:false,rotationY:90,scale:[2,.5,3]
  });
  assert.equal(original.objects[3].name,'Beacon');
  assert.equal(original.objects[3].position[0],3);
  assert.equal(edited.objects[3].position[0],1.25);
  assert.equal(edited.objects[3].visible,false);
  assert.throws(()=>updateEntity(original,'entity-4',{scale:[1,-2,1]}),RangeError);
  assert.throws(()=>updateEntity(original,'entity-4',{evil:'test'}),TypeError);
  assert.deepEqual(original,createScene());
});
test('parent hierarchy transforms local translation, yaw and scale and catches cycles',()=>{
  let s=createScene();
  s=updateEntity(s,'entity-4',{rotationY:90,scale:[2,2,2],position:[3,0,0]});
  s=addEntity(s,{parent:'entity-4',name:'Child'});
  const w=sceneWorld(s).at(-1);
  assert.equal(w.parent,'entity-4');
  assert.ok(Math.abs(w.position[0]-5)<1e-12);
  assert.ok(Math.abs(w.position[2])<1e-12);
  assert.deepEqual(w.scale,[2,2,2]);
  assert.throws(()=>updateEntity(s,'entity-4',{parent:w.id}),/cycle/);
  assert.throws(()=>updateEntity(s,'entity-3',{parent:'entity-1'}),/root/);
  assert.throws(()=>updateEntity(s,'entity-4',{parent:'entity-700'}),/parent/);
});
test('duplicate and remove treat subtrees atomically, preserving original IDs',()=>{
  let s=addEntity(createScene(),{parent:'entity-4',name:'Child'});
  const result=duplicateEntity(s,'entity-4');
  assert.equal(result.selected,'entity-6');
  assert.equal(result.scene.objects.length,7);
  const copied=result.scene.objects.find(e=>e.name==='Child Copy');
  assert.equal(copied.parent,'entity-6');
  const removed=removeEntity(result.scene,'entity-4');
  assert.equal(removed.objects.length,5);
  assert.ok(removed.objects.some(e=>e.id===result.selected));
  assert.deepEqual(s.objects.at(-1).name,'Child');
  assert.throws(()=>removeEntity(s,'missing'),/unknown/);
});
test('undo/redo and bounded edits never mutate prior history snapshots',()=>{
  let h=makeHistory(createScene());
  const old=h.present;
  h=commitHistory(h,updateEntity(h.present,'entity-4',{name:'Renamed'}));
  h=commitHistory(h,addEntity(h.present));
  assert.equal(h.past.length,2);
  h=undoHistory(h);
  assert.equal(h.present.objects.length,4);
  h=undoHistory(h);assert.equal(h.present.objects[3].name,'Beacon');
  h=redoHistory(h);assert.equal(h.present.objects[3].name,'Renamed');
  assert.deepEqual(old,createScene());
  h=commitHistory(h,updateEntity(h.present,'entity-4',{name:'Branch'}));
  assert.equal(h.future.length,0);
});
test('strict scene schema rejects unsafe imports, invalid parents and excessive files',()=>{
  const original=createScene();
  for(const corrupt of [
    {...original,schemaVersion:99},
    {...original,name:'X\nmalicious'},
    {...original,nextId:1},
    {...original,objects:[...original.objects,original.objects[0]]},
    {...original,objects:[...original.objects,{...original.objects[0],id:'entity-10',parent:'entity-10'}]},
    {...original,objects:original.objects.map((e,i)=>i===0?{...e,color:[NaN,0,0]}:e)},
    {...original,objects:original.objects.map((e,i)=>i===0?{...e,unexpected:1}:e)},
    {...original,objects:original.objects.map((e,i)=>i===0?{...e,body:'player'}:e)}
  ])assert.throws(()=>validateScene(corrupt));
  assert.throws(()=>parseScene('A'.repeat(128*1024+1)),RangeError);
  assert.throws(()=>parseScene(JSON.stringify({...original,__proto__:null,foreign:1})),TypeError);
});
test('scene mesh uses retained Float32 triangles and selection changes only appearance',()=>{
  const s=createScene(),world=sceneWorld(s),pixels=createSceneVertices(world);
  assert.ok(pixels instanceof Float32Array);
  assert.equal(pixels.length,world.length*36*6);
  const selected=createSceneVertices(world,'entity-3');
  assert.equal(selected.length,pixels.length);
  let differs=0;
  for(let i=0;i<pixels.length;i++){
    if(i%6>=3)differs+=Number(!Object.is(pixels[i],selected[i]));
    else assert.ok(Object.is(pixels[i],selected[i]),'selection must not move geometry');
  }
  assert.ok(differs>0);
  assert.equal(createGridVertices().length%12,0);
});
test('camera matrices and rays pick both unrotated and rotated visible boxes',()=>{
  const camera={yaw:0,pitch:0,distance:10,target:[0,0,0]};
  const matrix=cameraMatrix(camera,800,600);
  assert.equal(matrix.length,16);assert.ok([...matrix].every(Number.isFinite));
  const ray=cameraRay(camera,400,300,800,600);
  const cube={id:'cube',position:[0,0,0],scale:[2,2,2],rotationY:43,visible:true};
  assert.equal(pickObject([cube],ray),'cube');
  assert.ok(hitWorldBox(cube,ray)>0);
  assert.equal(pickObject([{...cube,visible:false}],ray),null);
  assert.equal(pickObject([cube],cameraRay(camera,1,1,800,600)),null);
  assert.throws(()=>cameraMatrix(camera,0,100),RangeError);
});
test('Play preview has exact replay, ground contact, input and snapshot isolation',()=>{
  const s=createScene(),frozen=serializeScene(s);
  let a=createPreview(s),b=createPreview(s);
  const commands=Array.from({length:400},(_,i)=>({
    x:i%90<45?1:-1,z:i%31<15?1:0,jump:i===150
  }));
  for(const c of commands){a=stepPreview(s,a,c);b=stepPreview(s,b,c);}
  assert.deepEqual(a,b);
  assert.equal(a.tick,400);
  assert.equal(serializeScene(s),frozen,'play may never edit the authoring state');
  assert.ok(a.bodies['entity-3'].position[1]>=0);
  assert.throws(()=>stepPreview(s,a,{x:2}),TypeError);
  assert.ok(PREVIEW_DT>0);
});
