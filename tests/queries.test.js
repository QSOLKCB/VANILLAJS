import test from 'node:test';
import assert from 'node:assert/strict';
import {aabb,castSegment,raycast} from '../modules/collision/index.js';
const box=(id,min,max)=>({id,box:aabb(min,max)});
const wall=box('wall',[-2,-2,-5.01],[2,2,-5]);
test('a fast finite query stops at a thin wall before a target',()=>{
  const target=box('target',[-1,-1,-9],[1,1,-8]);
  const hit=castSegment([0,0,0],[0,0,-1000],[target,wall]);
  assert.equal(hit.id,'wall');assert.equal(hit.time,.005);assert.equal(hit.distance,5);
  assert.deepEqual(hit.point,[0,0,-5]);assert.deepEqual(hit.normal,[0,0,1]);
  assert.equal(castSegment([0,0,0],[0,0,-4.99],[wall]),null);
});
test('queries include endpoint and tangency, but miss parallel separated slabs',()=>{
  assert.equal(castSegment([2,0,0],[0,0,-5],[wall]).time,1);
  assert.equal(castSegment([2.001,0,0],[0,0,-100],[wall]),null);
  assert.equal(castSegment([0,0,0],[0,0,5],[wall]),null);
});
test('closed-volume start overlap includes stationary and outward queries',()=>{
  for(const delta of [[0,0,0],[0,0,1],[1,1,-2]]){
    const hit=castSegment([0,0,-5],delta,[wall]);
    assert.equal(hit.time,0);assert.equal(hit.startedInside,true);assert.deepEqual(hit.normal,[0,0,0]);
  }
  assert.equal(castSegment([0,0,0],[0,0,0],[wall]),null);
});
test('cube extent changes the contact point; it is not a sphere approximation',()=>{
  const hit=castSegment([2.4,0,0],[0,0,-10],[wall],{halfSize:.5});
  assert.equal(hit.distance,4.5);assert.deepEqual(hit.point,[2.4,0,-4.5]);
});
test('ties use stable ids and ignored colliders cannot occlude',()=>{
  const other={...wall,id:'a'};
  for(const colliders of [[wall,other],[other,wall]]){
    assert.equal(castSegment([0,0,0],[0,0,-6],colliders).id,'a');
    assert.equal(castSegment([0,0,0],[0,0,-6],colliders,{ignoreIds:['a']}).id,'wall');
  }
});
test('finite rays normalize direction and respect range',()=>{
  assert.equal(raycast([0,0,0],[0,0,-12],5,[wall]).distance,5);
  assert.equal(raycast([0,0,0],[0,0,-12],4,[wall]),null);
  assert.equal(raycast([0,0,-5],[1,0,0],0,[wall]).time,0);
});
test('invalid query contracts reject instead of silently missing',()=>{
  const cases=[()=>castSegment([NaN,0,0],[0,0,1],[wall]),
    ()=>castSegment([0,0,0],[0,0,1],[wall,wall]),
    ()=>castSegment([0,0,0],[0,0,1],[{id:'bad',box:{min:[0,0,0],max:[0,1,1]}}]),
    ()=>castSegment([0,0,0],[0,0,1],[wall],{halfSize:-1}),
    ()=>castSegment([0,0,0],[0,0,1],[wall],{ignoreIds:[null]}),
    ()=>raycast([0,0,0],[0,0,0],2,[wall]),()=>raycast([0,0,0],[1,0,0],Infinity,[wall]),
    ()=>castSegment([Number.MAX_VALUE,0,0],[Number.MAX_VALUE,0,0],[])];
  for(const run of cases)assert.throws(run);
});
