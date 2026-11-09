// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createForgeScene,updateEntity,addEntity,sceneWorld} from '../demos/editor/model.js';
import {axisDirection,gizmoLines,projectPoint,pickGizmo,axisDragAmount,applyGizmo}
  from '../demos/editor/gizmos.js';
const camera={yaw:0,pitch:0,distance:10,target:[0,1,0]};
test('projected move axes show actual 3D handles and hit testing',()=>{
  const scene=createForgeScene(),world=sceneWorld(scene),e=world[2],
    lines=gizmoLines(world,e.id);
  assert.ok(lines instanceof Float32Array);
  assert.ok(lines.length>=3*2*6);
  const a=projectPoint(camera,e.position,800,600);
  const b=projectPoint(camera,e.position.map((x,i)=>x+(i===0?2.15:0)),800,600);
  assert.ok(a&&b&&b.x>a.x);
  assert.equal(pickGizmo(camera,e,(a.x+b.x)*.5,(a.y+b.y)*.5,800,600),'x');
  assert.equal(pickGizmo(camera,null,400,300,800,600),null);
  const amount=axisDragAmount(camera,e,'x',{x:a.x,y:a.y},{x:b.x,y:b.y},800,600);
  assert.ok(Math.abs(amount-2.15)<.01);
});
test('world-space and local-space axis edits preserve parent and original scene',()=>{
  let s=createForgeScene();
  s=updateEntity(s,'entity-2',{rotationY:90,scale:[2,1,3]});
  s=addEntity(s,{parent:'entity-2'});
  const original=structuredClone(s),id='entity-5',v=sceneWorld(s).find(e=>e.id===id);
  const worldMoved=applyGizmo(s,id,'move','x',3,{space:'world'});
  const worldDelta=sceneWorld(worldMoved).find(e=>e.id===id).position.map((n,i)=>n-v.position[i]);
  assert.ok(Math.abs(worldDelta[0]-3)<1e-5);
  assert.ok(Math.abs(worldDelta[2])<1e-5);
  const localMoved=applyGizmo(s,id,'move','x',2,{space:'local'});
  const localDelta=sceneWorld(localMoved).find(e=>e.id===id).position.map((n,i)=>n-v.position[i]);
  assert.ok(Math.abs(localDelta[2]+2)<1e-5);
  assert.deepEqual(s,original);
});
test('Y rotation and XYZ scale are bounded and snap-aware',()=>{
  const scene=createForgeScene();
  const turned=applyGizmo(scene,'entity-4','rotate','y',22,{snapping:true});
  assert.equal(turned.objects[3].rotationY,15);
  const grown=applyGizmo(scene,'entity-4','scale','x',.26,{snapping:true});
  assert.equal(grown.objects[3].scale[0],1.4);
  assert.throws(()=>applyGizmo(scene,'entity-4','rotate','x',15),/yaw-only/);
  assert.throws(()=>applyGizmo(scene,'entity-4','scale','x',-200),RangeError);
  assert.throws(()=>applyGizmo(scene,'entity-4','move','x',NaN),RangeError);
  assert.throws(()=>applyGizmo(scene,'entity-999','move','x',1),/unknown/);
});
test('snap step is deterministic across repeated transactions',()=>{
  const scene=createForgeScene(),a=applyGizmo(scene,'entity-4','move','z',.36,{snapping:true}),
    b=applyGizmo(scene,'entity-4','move','z',.36,{snapping:true});
  assert.deepEqual(a,b);
  assert.equal(a.objects[3].position[2],-2.75);
});
