// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBody} from '../modules/flight/index.js';
import {createVehicle,vehiclePreset} from '../modules/vehicle3d/index.js';
import {createCockpitRig,sampleCockpitCamera,cockpitTelemetry,
  cockpitGunRays,inspectCockpitSight,projectCockpitPoint,testCockpitTarget,
  COCKPIT_MODES} from '../modules/cockpit-rig/index.js';
const rig=()=>createCockpitRig({seat:[0,.5,.4],nose:[0,0,-2],chase:[0,2,8],external:[8,4,12],
  guns:[[-2,0,-1],[2,0,-1]],convergence:200,fov:1});
const body=()=>createBody({position:[0,200,0],velocity:[0,0,-50],mass:2500,inertia:[12000,15000,9000]});
const viewport={width:960,height:600};
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<=e,`${a} vs ${b}`);
test('all four camera modes are visual-only and leave a six-axis body unchanged',()=>{
  const b=body(),before=structuredClone(b),r=rig();
  assert.deepEqual(COCKPIT_MODES,['cockpit','nose','chase','external']);
  const cameras=COCKPIT_MODES.map(mode=>sampleCockpitCamera(b,r,mode));
  assert.deepEqual(b,before);
  assert.equal(new Set(cameras.map(c=>c.position.join(','))).size,4);
  assert.deepEqual(cameras[0].position,[0,200.5,.4]);
  assert.equal(cameras[0].fov,1);
  assert.ok(Object.isFrozen(cameras[0])&&Object.isFrozen(cameras[0].position));
});
test('camera head look moves reticle only; physical gun rays are exactly unchanged',()=>{
  const b=body(),r=rig(),guns=cockpitGunRays(b,r);
  const forward=sampleCockpitCamera(b,r,'cockpit'),away=sampleCockpitCamera(b,r,'cockpit',{yaw:.3,pitch:.2});
  const a=projectCockpitPoint(forward,guns.target,viewport),c=projectCockpitPoint(away,guns.target,viewport);
  assert.ok(a.visible&&c.visible);assert.ok(Math.abs(c.x-a.x)>10);
  assert.deepEqual(cockpitGunRays(b,r),guns);
});
test('wing gun rays physically converge at configured target range',()=>{
  const b=body(),r=rig(),view=sampleCockpitCamera(b,r);
  const at=inspectCockpitSight(b,r,view,{range:200,...viewport});
  assert.equal(at.impacts.length,2);
  for(const hit of at.impacts){near(hit.errorMetres,0);near(hit.offsetX,0);near(hit.offsetY,0);}
  const nearRange=inspectCockpitSight(b,r,view,{range:100,...viewport});
  assert.ok(nearRange.impacts.every(x=>x.errorMetres>.95&&x.errorMetres<1.05));
  assert.ok(nearRange.impacts[0].offsetX<0&&nearRange.impacts[1].offsetX>0);
});
test('real ray/sphere intersection accepts aimed target and rejects distant miss',()=>{
  const b=body(),r=rig(),target=[0,200,-200];
  const center=testCockpitTarget(b,r,target,.2);
  assert.ok(center.every(g=>g.hit&&g.distance>0));
  const missing=testCockpitTarget(b,r,[40,200,-200],.2);
  assert.ok(missing.every(g=>!g.hit));
  assert.deepEqual(testCockpitTarget(b,r,target,.2),center);
});
test('camera projection maps direct boresight and rejects targets behind viewer',()=>{
  const b=body(),r=rig(),camera=sampleCockpitCamera(b,r,'nose');
  const point=projectCockpitPoint(camera,[0,200,-200],viewport);
  assert.equal(point.visible,true);near(point.x,480);
  const behind=projectCockpitPoint(camera,[0,200,300],viewport);
  assert.equal(behind.visible,false);assert.equal(behind.x,null);
});
test('telemetry derives from actual pose, not fabricated HUD states',()=>{
  const b=body(),snap=structuredClone(b);
  const t=cockpitTelemetry(b);near(t.speed,50);near(t.forwardSpeed,50);
  near(t.verticalSpeed,0);near(t.altitude,200);near(t.pitch,0);near(t.bank,0);
  assert.deepEqual(b,snap);
});
test('same rig accepts native vehicle3d state without replacing its physics',()=>{
  const m=createVehicle(vehiclePreset('arcade')),car=m.spawn();
  const original=structuredClone(car),r=createCockpitRig({guns:[[0,0,-1]],convergence:150});
  const c=sampleCockpitCamera(car,r,'cockpit');
  assert.equal(c.mode,'cockpit');assert.equal(cockpitGunRays(car,r).rays.length,1);
  assert.ok(cockpitTelemetry(car).speed===0);assert.deepEqual(car,original);
});
test('malformed inputs fail closed, without executing getters',()=>{
  const b=body(),r=rig(),before=structuredClone(b);let read=false;
  const malicious={seat:[0,1,0]};Object.defineProperty(malicious,'fov',{get(){read=true;return 1;},enumerable:true});
  assert.throws(()=>createCockpitRig(malicious));assert.equal(read,false);
  assert.throws(()=>createCockpitRig({guns:[[-1,0,-1],,]}));
  assert.throws(()=>createCockpitRig({convergence:Infinity}));
  assert.throws(()=>sampleCockpitCamera(b,r,'bird'));
  assert.throws(()=>sampleCockpitCamera(b,r,'cockpit',{yaw:NaN}));
  assert.throws(()=>inspectCockpitSight(b,r,sampleCockpitCamera(b,r),{range:4,...viewport}));
  assert.throws(()=>projectCockpitPoint(sampleCockpitCamera(b,r),[0,0,0],{width:0,height:100}));
  assert.deepEqual(b,before);
});
