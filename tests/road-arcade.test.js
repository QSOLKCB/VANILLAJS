// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoadVehicle,createRoadCurve} from '../modules/road-arcade/index.js';
const rest=()=>({offset:0,speed:0,lateralSpeed:0,steering:0,slip:0});
test('road vehicle: owned SI settings, stationary steering, throttle/brake priority and coasting',()=>{
  const options={topSpeed:80},car=createRoadVehicle(options);options.topSpeed=20;assert.equal(car.settings.topSpeed,80);
  const original=rest();let s=original;for(let i=0;i<60;i++)s=car.step(s,{steer:1});assert.equal(s.offset,0);assert.equal(s.speed,0);assert.deepEqual(original,rest());
  for(let i=0;i<600;i++)s=car.step(s,{throttle:1});assert.ok(s.speed>79&&s.speed<=80);
  const coast=car.step(s),brake=car.step(s,{throttle:1,brake:1,boost:1});assert.ok(brake.speed<coast.speed&&coast.speed<s.speed);
  for(let i=0;i<600;i++)s=car.step(s,{brake:1});assert.equal(s.speed,0);assert.equal(s.lateralSpeed,0);
});
test('road vehicle: steering inertia, shoulder drag, curvature and finite bounded outputs',()=>{
  const car=createRoadVehicle();let s={...rest(),speed:70};const right=car.step(s,{steer:1}),left=car.step(s,{steer:-1});assert.ok(right.offset>0&&left.offset<0);assert.equal(right.offset,-left.offset);
  const released=car.step(right);assert.ok(released.lateralSpeed>0);assert.ok(car.step(s,{},.003).offset<0);
  const shoulder=car.step({...s,offset:7});assert.ok(shoulder.speed<car.step(s).speed);
  for(let i=0;i<10000;i++){s=car.step(s,{throttle:1,boost:1,steer:1},.05);assert.ok(Math.abs(s.offset)<=9.3);for(const n of Object.values(s))assert.ok(Number.isFinite(n));}
});
test('road vehicle rejects invalid authoring, time and input without mutation',()=>{
  for(const option of [{topSpeed:NaN},{drag:0},{grip:61},{nonsense:1},null])assert.throws(()=>createRoadVehicle(option));
  const car=createRoadVehicle(),s=rest();for(const input of [{steer:2},{throttle:Infinity},{boost:-1},{brake:NaN}])assert.throws(()=>car.step(s,input));
  for(const dt of [0,-1,.11,NaN])assert.throws(()=>car.step(s,{},0,dt));assert.throws(()=>car.step({...s,speed:NaN}));assert.deepEqual(s,rest());
});
test('road curve owns its samples and joins periodically without discontinuity',()=>{
  const bends=[.002,-.003,0],curve=createRoadCurve(bends,{segmentLength:100});bends[0]=.05;
  assert.equal(curve.sample(0),.002);assert.equal(curve.sample(100),-.003);assert.equal(curve.sample(300),.002);
  assert.ok(Math.abs(curve.sample(99.999)-curve.sample(100.001))<1e-9);
  for(const bad of [[],[1,0],[NaN,0],Array(3)])assert.throws(()=>createRoadCurve(bad));assert.throws(()=>curve.sample(-1));assert.throws(()=>curve.sample(Infinity));
});
