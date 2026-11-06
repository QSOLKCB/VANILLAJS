// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {ballisticStep} from '../modules/ballistics/index.js';
import {Heightfield} from '../modules/terrain/index.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,'expected '+a+' to equal '+b);

test('closed-form ballistic step has partition invariance before impact',()=>{
  for(const [height,velocity,dt,gravity,groundHeight] of [
    [0,4.3,1/60,11,0],[.4,2.1,.05,11,0],[1,-2,.01,9.81,0],
    [20,2,.08,15,5], [50,-4,.07,2,1]
  ]){
    const whole=ballisticStep({height,velocity,dt,gravity,groundHeight});
    const half=ballisticStep({height,velocity,dt:dt/2,gravity,groundHeight});
    const split=ballisticStep({...half,dt:dt/2,gravity,groundHeight});
    near(whole.height,split.height);near(whole.velocity,split.velocity);
  }
});

test('bounded jump returns to the ground and clamps downward speed',()=>{
  let state={height:0,velocity:4.3},peak=0;
  for(let i=0;i<180;i++){
    state=ballisticStep({...state,dt:1/60,gravity:11});
    peak=Math.max(peak,state.height);
    assert.ok(state.height>=0);
  }
  assert.ok(peak>.7&&peak<1);
  assert.deepEqual(state,{height:0,velocity:0});
  assert.deepEqual(ballisticStep({height:1,velocity:-10,dt:.1,gravity:11,groundHeight:1}),
    {height:1,velocity:0});
});

test('heightfield sample may be used as a static local ground height',()=>{
  const surface=new Heightfield({cellsX:1,cellsZ:1,heights:[2,2,2,2]});
  let state={height:surface.sample(.5,.5).height,velocity:5};
  for(let i=0;i<240;i++){
    state=ballisticStep({...state,dt:1/120,groundHeight:2});
    assert.ok(state.height>=2);
  }
  assert.deepEqual(state,{height:2,velocity:0});
});

test('zero dt is inert; invalid physics and overflow are rejected',()=>{
  assert.deepEqual(ballisticStep({height:3,velocity:-2,dt:0}),{height:3,velocity:-2});
  assert.deepEqual(ballisticStep({height:0,velocity:-2,dt:0}),{height:0,velocity:-2});
  for(const args of [
    {height:-1,velocity:1,dt:.01},{height:1,velocity:1,dt:-.01},
    {height:1,velocity:1,dt:.101},{height:1,velocity:NaN,dt:.01},
    {height:1,velocity:1,dt:Infinity},{height:1,velocity:1,dt:.01,gravity:0},
    {height:1,velocity:1,dt:.01,gravity:-1},
    {height:1,velocity:1,dt:.01,groundHeight:2},
    {height:Number.MAX_VALUE,velocity:Number.MAX_VALUE,dt:.1,gravity:9.81},
    {height:1,velocity:1,dt:.01,groundHeight:NaN}
  ])assert.throws(()=>ballisticStep(args),RangeError);
});
