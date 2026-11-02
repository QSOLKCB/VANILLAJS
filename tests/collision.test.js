import test from 'node:test';
import assert from 'node:assert/strict';
import {aabb,sweepBox,moveAndSlide} from '../modules/collision/index.js';
const wall=aabb([5,-20,-20],[5.02,20,20]);
test('fast body cannot tunnel through a 2 cm wall',()=>{
  const r=moveAndSlide([0,0,0],[10000,0,0],.05,.5,[wall]);assert.ok(r.position[0]<4.5);assert.equal(r.velocity[0],0);assert.equal(r.contacts.length,1);
});
test('diagonal contact preserves tangential movement and removes inward velocity',()=>{
  const r=moveAndSlide([0,0,0],[100,20,0],.1,.5,[wall]);assert.ok(r.position[0]<4.5);assert.ok(Math.abs(r.position[1]-2)<1e-9);assert.equal(r.velocity[1],20);
});
test('starting on a surface permits moving away or along it',()=>{
  assert.equal(sweepBox([4.5,0,0],[-1,0,0],.5,wall),null);
  assert.equal(sweepBox([4.5,0,0],[0,1,0],.5,wall),null);
  assert.equal(sweepBox([4.5,0,0],[1,0,0],.5,wall).time,0);
});
test('parallel rays outside slab miss; reverse-direction sweep has correct normal',()=>{
  assert.equal(sweepBox([0,0,0],[0,1,0],.5,wall),null);
  const hit=sweepBox([10,0,0],[-10,0,0],.5,wall);assert.deepEqual(hit.normal,[1,0,0]);assert.ok(hit.time>0&&hit.time<1);
});
test('a corner blocks both axes without tunnelling',()=>{
  const r=moveAndSlide([0,0,0],[100,100,0],.1,.5,[wall,aabb([-20,5,-20],[20,5.1,20])]);
  assert.ok(r.position[0]<4.5&&r.position[1]<4.5);assert.deepEqual(r.velocity,[0,0,0]);
});
test('initial overlap is depenetrated before movement',()=>{
  const r=moveAndSlide([4.8,0,0],[1,0,0],.1,.5,[wall]);assert.ok(r.position[0]<4.5);assert.equal(r.velocity[0],0);
});
test('a finite slide budget reports truncation rather than advancing through solids',()=>{
  const r=moveAndSlide([0,0,0],[100,100,0],.1,.5,[wall],1);assert.equal(r.truncated,true);assert.ok(r.position[0]<4.5);
});
test('invalid collision geometry and dimensions are rejected',()=>{
  assert.throws(()=>aabb([0,0,0],[0,1,1]));assert.throws(()=>moveAndSlide([0,0,0],[0,0,0],.1,-1,[]));
});
