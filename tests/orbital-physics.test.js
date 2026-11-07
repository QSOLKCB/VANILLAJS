// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {GRAVITATIONAL_CONSTANT_SI as G,centralAccelerationSI,circularSpeedSI,
  specificOrbitalEnergySI,KeplerOrbit} from '../modules/orbital-physics/index.js';

const near=(a,b,relative=1e-10)=>assert.ok(Math.abs(a-b)<=relative*Math.max(1,Math.abs(b)),
  'expected '+a+' near '+b);
test('UFF-compatible SI point-mass constants, acceleration and circular speed',()=>{
  assert.equal(G,6.67430e-11);
  near(circularSpeedSI(5.9722e24,6371e3),7909.78,0.0002);
  const a=centralAccelerationSI([6371e3,0,0],5.9722e24);
  near(a[0],-9.82,0.002);assert.deepEqual(a.slice(1),[-0,-0]);
  const shifted=centralAccelerationSI([6371e3+100,0,-50],5.9722e24,
    {center:[100,0,-50]});
  assert.deepEqual(shifted,a);
});
test('velocity-Verlet conserves energy and nearly closes a circular orbit',()=>{
  // 400-km altitude Earth orbit with 10-second steps; reference period uses
  // T=2 pi sqrt(r^3/(GM)). This is not a per-frame GPU metric.
  const mass=5.9722e24,r=6371e3+400e3,speed=circularSpeedSI(mass,r);
  const period=2*Math.PI*Math.sqrt(r**3/(G*mass));
  const count=Math.round(period/10),dt=period/count;
  const orbit=new KeplerOrbit({mass,position:[r,0,0],velocity:[0,speed,0]});
  const initial=orbit.snapshot(),energy=orbit.energy();
  for(let i=0;i<count;i++)orbit.step(dt);
  const final=orbit.snapshot();
  const radius=Math.hypot(...final.position);
  assert.ok(Math.abs(radius-r)/r<5e-5,'radial drift too large');
  assert.ok(Math.hypot(final.position[0]-r,final.position[1],final.position[2])/r<1e-4,
    'orbital phase drift too large');
  assert.ok(Math.abs(orbit.energy()-energy)/Math.abs(energy)<1e-7,
    'symplectic one-orbit energy drift too large');
  assert.equal(final.steps,count);
  for(let i=0;i<count;i++)orbit.step(-dt);
  const back=orbit.snapshot();
  assert.ok(Math.hypot(...back.position.map((x,i)=>x-initial.position[i]))/r<1e-10,
    'time-reverse positional drift');
  assert.ok(Math.hypot(...back.velocity.map((x,i)=>x-initial.velocity[i]))/speed<1e-10,
    'time-reverse velocity drift');
});
test('gravity, energy and initial conditions are independent of caller mutation',()=>{
  const pos=[5,0,0],vel=[0,2,0],center=[1,0,0];
  const orbit=new KeplerOrbit({mass:1e10,position:pos,velocity:vel,center});
  pos[0]=999;vel[1]=999;center[0]=999;
  const snapshot=orbit.snapshot();
  assert.deepEqual(snapshot.position,[5,0,0]);
  assert.deepEqual(snapshot.velocity,[0,2,0]);
  assert.deepEqual(snapshot.center,[1,0,0]);
  snapshot.position[0]=999;
  assert.deepEqual(orbit.snapshot().position,[5,0,0]);
  near(specificOrbitalEnergySI({position:[5,0,0],velocity:[0,2,0],
    center:[1,0,0],mass:1e10}),2-G*1e10/4,1e-12);
});
test('invalid SI values, singularities and pathological steps fail without mutation',()=>{
  for(const invalid of [
    {mass:0,position:[1,0,0],velocity:[0,0,0]},
    {mass:1,position:[0,0,0],velocity:[0,0,0]},
    {mass:1,position:[1,,0],velocity:[0,0,0]},
    {mass:1,position:[1,0,0],velocity:[NaN,0,0]},
    {mass:Infinity,position:[1,0,0],velocity:[0,0,0]},
    {mass:1,position:[1,0,0],velocity:[0,0,0],minimumRadius:2},
  ])assert.throws(()=>new KeplerOrbit(invalid));
  const orbit=new KeplerOrbit({mass:1e12,position:[1,0,0],
    velocity:[-1e8,0,0],minimumRadius:.3});
  const original=orbit.snapshot();
  for(const dt of [-1,Infinity,86401,NaN]){
    if(dt===-1)continue; // Valid negative steps intentionally permit inverse testing.
    assert.throws(()=>orbit.step(dt));
    assert.deepEqual(orbit.snapshot(),original);
  }
  assert.throws(()=>orbit.step(1e-8),RangeError);
  assert.deepEqual(orbit.snapshot(),original,'center-radius rejection must be atomic');
  assert.throws(()=>circularSpeedSI(0,100));
  assert.throws(()=>centralAccelerationSI([1,0,0],1,{minimumRadius:-1}));
  assert.throws(()=>specificOrbitalEnergySI({
    mass:1,position:[0,0,0],velocity:[0,0,0]}));
});
