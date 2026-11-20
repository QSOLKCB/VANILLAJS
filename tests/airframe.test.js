// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBody} from '../modules/flight/index.js';
import {createAirframeConfig,stepAirframe,sampleAirframe,AIRFRAME_STEP} from '../modules/airframe/index.js';
const setup=(opts={})=>createBody({position:[0,180,30],velocity:[0,0,-55],orientation:[0,0,0,1],
  mass:2600,inertia:[14000,18000,10000],halfSize:2.3,...opts});
const finite=body=>assert.ok([...body.position,...body.velocity,...body.orientation,...body.angularVelocity].every(Number.isFinite));
test('airframe produces finite lift and genuine gravitational acceleration over 6DOF',()=>{
  const b=setup(),p=createAirframeConfig(),before=sampleAirframe(b,p);
  assert.ok(before.airSpeed===55&&before.lift>0&&before.drag>0);
  stepAirframe(b,{throttle:0},AIRFRAME_STEP,p);
  assert.ok(b.velocity[1]<0&&b.velocity[1]>-9.81*AIRFRAME_STEP);
  assert.ok(b.velocity[2]>-55,'drag reduces forward speed');
  finite(b);
});
test('flight at stall angle lowers lift coefficient and increases drag',()=>{
  const p=createAirframeConfig(),identity=setup(),angle=Math.PI/4;
  const steep=setup({orientation:[Math.sin(angle/2),0,0,Math.cos(angle/2)]});
  const safe=sampleAirframe(identity,p),stall=sampleAirframe(steep,p);
  assert.equal(safe.stalled,false);assert.equal(stall.stalled,true);
  assert.ok(stall.angleOfAttack>.7&&stall.cl<safe.cl*1.1);
  assert.ok(stall.cd>safe.cd);
});
test('pitch, yaw and roll inputs change body-space rotational state, never fake camera state',()=>{
  const b=setup(),p=createAirframeConfig();
  stepAirframe(b,{throttle:.8,pitch:1,roll:-1,yaw:.5},AIRFRAME_STEP,p);
  assert.ok(b.angularVelocity[0]>0);assert.ok(b.angularVelocity[1]>0);assert.ok(b.angularVelocity[2]<0);
  assert.ok(b.orientation.some((n,i)=>Math.abs(n-([0,0,0,1][i]))>1e-8));
  finite(b);
});
test('repeatable fixed-tick inputs produce identical complete physical state',()=>{
  const p=createAirframeConfig(),a=setup(),b=setup();
  for(let i=0;i<360;i++){
    const input={throttle:.72,pitch:i<80?.12:0,yaw:i>190?.07:0,roll:i>50&&i<140?.25:0};
    stepAirframe(a,input,AIRFRAME_STEP,p);
    stepAirframe(b,input,AIRFRAME_STEP,p);
  }
  assert.deepEqual(a,b);
  finite(a);
});
test('zero dt is a no-op; low or reverse airflow does not create spurious lift',()=>{
  const p=createAirframeConfig(),b=setup({velocity:[0,0,0]}),prior=structuredClone(b);
  stepAirframe(b,{throttle:.9,pitch:1},0,p);assert.deepEqual(b,prior);
  assert.equal(sampleAirframe(b,p).lift,0);
  const reverse=setup({velocity:[0,0,20]});
  assert.equal(sampleAirframe(reverse,p).lift,0);
});
test('invalid input/config/dt rejects before physical body mutation',()=>{
  const p=createAirframeConfig(),b=setup(),prior=structuredClone(b);
  for(const input of [{throttle:2},{pitch:Infinity},{yaw:NaN},{roll:-2},{throttle:0,magic:1}]){
    assert.throws(()=>stepAirframe(b,input,AIRFRAME_STEP,p));
  }
  assert.throws(()=>stepAirframe(b,{},-.1,p));
  assert.throws(()=>stepAirframe(b,{},.06,p));
  assert.throws(()=>stepAirframe(b,{},AIRFRAME_STEP,{}));
  assert.throws(()=>createAirframeConfig({wingArea:0}));
  assert.throws(()=>createAirframeConfig({thrust:NaN}));
  assert.deepEqual(b,prior);
});
test('input and parameters are owned; controls do not change the model during sampling',()=>{
  const source={wingArea:25},p=createAirframeConfig(source),b=setup(),prior=structuredClone(b);
  source.wingArea=30;assert.equal(p.wingArea,25);assert.ok(Object.isFrozen(p));
  const sample=sampleAirframe(b,p);assert.ok(Object.isFrozen(sample));assert.deepEqual(b,prior);
  assert.throws(()=>createAirframeConfig({wingArea:3,unused:1}));
});
