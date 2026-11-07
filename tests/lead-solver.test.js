// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {leadIntercept} from '../modules/lead-solver/index.js';
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps*Math.max(1,Math.abs(b)),
  a+' differs from '+b);
const solve=o=>leadIntercept({shooterPosition:[0,0,0],targetPosition:[100,0,0],
  projectileSpeed:50,...o});

test('stationary, closing and perpendicular targets yield actual coincidences',()=>{
  const stationary=solve({});near(stationary.time,2);
  assert.deepEqual(stationary.direction,[1,0,0]);
  const closing=solve({targetVelocity:[-10,0,0]});near(closing.time,100/60);
  const crossing=solve({targetVelocity:[0,10,0]});
  near(crossing.time,100/Math.sqrt(2500-100));
  for(const shot of [stationary,closing,crossing]){
    const source=[0,0,0],end=source.map((x,i)=>x+shot.launchVelocity[i]*shot.time);
    for(let i=0;i<3;i++)near(end[i],shot.interceptPoint[i],1e-8);
    near(Math.hypot(...shot.direction),1);
  }
});

test('partial and full shooter-velocity inheritance change the intercept',()=>{
  const half=solve({shooterVelocity:[20,0,0],inheritance:.5});
  const full=solve({shooterVelocity:[20,0,0],inheritance:1});
  const none=solve({shooterVelocity:[20,0,0],inheritance:0});
  near(none.time,2);near(half.time,100/60);near(full.time,100/70);
  near(half.launchVelocity[0],60);near(full.launchVelocity[0],70);
});

test('impossible chase, too short horizon and coincident points abstain',()=>{
  assert.equal(solve({targetVelocity:[60,0,0]}),null);
  assert.equal(solve({maxTime:1}),null);
  assert.equal(solve({targetPosition:[0,0,0]}),null);
  assert.equal(solve({targetVelocity:[0,0,100]}),null);
});

test('result is caller-owned and identical repeated inputs reproduce',()=>{
  const shooter=[1,2,3],target=[101,22,3],velocity=[0,-3,0];
  const inputs={shooterPosition:shooter,targetPosition:target,
    targetVelocity:velocity,projectileSpeed:70,inheritance:0.25};
  const first=leadIntercept(inputs),second=leadIntercept(inputs);
  assert.deepEqual(first,second);assert.ok(first.time>0);
  first.direction[0]=999;shooter[0]=999;velocity[0]=999;
  assert.deepEqual(second,leadIntercept({...inputs,shooterPosition:[1,2,3],
    targetVelocity:[0,-3,0]}));
});

test('input shapes, bounds and nonfinite values fail before solving',()=>{
  const invalid=[
    {projectileSpeed:0},{projectileSpeed:Infinity},{projectileSpeed:1e12},
    {inheritance:-1},{inheritance:2},{maxTime:Infinity},
    {shooterPosition:[0,,0]},{targetPosition:[0,0,NaN]},
    {targetVelocity:[1,2,'3']},{shooterVelocity:[1,2,1e10]}
  ];
  for(const value of invalid)assert.throws(()=>solve(value));
});
