// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {CuboidStream} from '../modules/cuboid-stream/index.js';

const dims=[4,5,6];
test('packed cuboids preserve exact Float32 values, order and independent snapshots',()=>{
  const stream=new CuboidStream({capacity:1}),colors=[.1,.4,.7];
  assert.equal(stream.box(1,2,3,...dims,colors,.25,Math.PI/3),0);
  const expected=new Float32Array([1,2,3,4,5,6,...colors,
    Math.cos(Math.PI/3),Math.sin(Math.PI/3),.25]);
  assert.deepEqual(stream.snapshot(),expected);
  colors[0]=100;
  assert.equal(stream.snapshot()[6],Math.fround(.1));
  assert.equal(stream.rotationEvaluations,2);
  assert.equal(stream.box(1,2,3,...dims,[1,1,1],.2,Math.PI/3),1);
  assert.equal(stream.rotationEvaluations,2,'same contiguous angle reuses trigonometry');
  assert.equal(stream.capacity,2);assert.equal(stream.growths,1);
  const first=stream.snapshot();
  stream.clear();
  assert.equal(stream.count,0);assert.equal(stream.rotationEvaluations,0);
  assert.deepEqual(first.slice(0,12),expected,'old snapshot remains owned');
  assert.equal(stream.capacity,2,'clear preserves allocated storage');
});
test('signed zero angle and explicit packed cos/sin bytes are preserved',()=>{
  const stream=new CuboidStream({capacity:0});
  stream.box(0,0,0,1,1,1,[1,0,0],0,-0);
  assert.ok(Object.is(stream.view()[10],-0),'negative zero sine preserved');
  stream.box(0,0,0,1,1,1,[1,0,0],0,+0);
  assert.ok(Object.is(stream.view()[22],+0));
  assert.equal(stream.rotationEvaluations,0);
  const encoded=new Float32Array([4,5,6,1,2,3,.2,.4,.6,
    Math.fround(.46),Math.fround(-.82),.1]);
  const before=encoded.slice();
  assert.equal(stream.encoded(encoded),2);
  assert.deepEqual(stream.view().slice(24,36),before);
  encoded[0]=100;
  assert.equal(stream.view()[24],4,'encoded source is copied');
  // A pre-encoded rotation invalidates the last-angle cache.
  stream.box(0,0,0,1,1,1,[1,1,1],.5,Math.PI/4);
  assert.equal(stream.rotationEvaluations,2);
});
test('invalid entries, sparse RGB, infinities and stream capacities fail atomically',()=>{
  const stream=new CuboidStream({capacity:1});
  stream.box(1,1,1,1,1,1,[.1,.2,.3]);
  const original=stream.snapshot(),count=stream.count,capacity=stream.capacity;
  for(const args of [
    [1,1,1,0,1,1,[1,1,1]],
    [1,1,1,-1,1,1,[1,1,1]],
    [1,1,1,1,1,1,[1,,1]],
    [1,1,1,1,1,1,[1,NaN,1]],
    [1,1,1,1,1,1,[1,1,1],Infinity],
    [1,1,1,1,1,1,[1,1,1],0,Infinity],
    [1e100,1,1,1,1,1,[1,1,1]]
  ]) assert.throws(()=>stream.box(...args));
  assert.throws(()=>stream.encoded([1,2,3]));
  assert.throws(()=>stream.encoded([0,0,0,0,1,1,.1,.2,.3,1,0,.5]));
  assert.throws(()=>stream.encoded(new Array(12)));
  assert.deepEqual(stream.snapshot(),original);
  assert.equal(stream.count,count);
  assert.equal(stream.capacity,capacity,'invalid values do not reserve storage');
  assert.throws(()=>new CuboidStream({capacity:-1}),RangeError);
  assert.throws(()=>new CuboidStream({capacity:16385}),RangeError);
});
test('LOD is conservative at equality, deterministic and validates its coordinate boundary',()=>{
  assert.equal(CuboidStream.detail([0,0,0],[3,4,0],{distance:5}),'high');
  assert.equal(CuboidStream.detail([0,0,0],[3,4,0],{distance:4.999}),'low');
  assert.equal(CuboidStream.detail([0,0,0],[0,0,0]),'high');
  assert.throws(()=>CuboidStream.detail([0,0,0],[Infinity,0,0]));
  assert.throws(()=>CuboidStream.detail([0,0,0],[1,1,1],{distance:-1}));
  assert.throws(()=>CuboidStream.detail([0,0],[1,1,1]));
  assert.throws(()=>CuboidStream.detail([0,0,0],[1e308,0,0]),RangeError);
});
test('many emissions reuse contiguous angles, and snapshots stay detached',()=>{
  const stream=new CuboidStream({capacity:2});
  for(let i=0;i<500;i++)stream.box(i,0,0,1,2,3,[.1,.2,.3],0,0.25);
  assert.equal(stream.count,500);
  assert.equal(stream.rotationEvaluations,2);
  const a=stream.snapshot(),b=stream.view();
  assert.equal(a.length,6000);assert.equal(b.length,6000);
  a.fill(0);
  assert.notEqual(b[3],0,'snapshot must not alias internal storage');
  assert.ok(stream.capacity>=500&&stream.capacity<=16384);
});
