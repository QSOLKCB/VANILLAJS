// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {distanceCheck2D,withinRange2D} from '../modules/range2d/index.js';

test('conservative axis rejection preserves Euclidean closed and open ranges',()=>{
  const a={x:0,y:0},cases=[
    [{x:3,y:4},5],[{x:5,y:0},5],[{x:5,y:1},5],
    [{x:5.01,y:0},5],[{x:0,y:0},0],[{x:-3,y:-4},5],
    [{x:1e8,y:1},.1],[{x:Number.MAX_VALUE,y:0},1e100],
    [{x:Number.MIN_VALUE,y:0},0]
  ];
  for(const [b,limit] of cases){
    const d=Math.hypot(a.x-b.x,a.y-b.y);
    const result=distanceCheck2D(a,b,limit);
    assert.equal(result.within,d<=limit);
    assert.equal(distanceCheck2D(a,b,limit,{inclusive:false}).within,d<limit);
    if(result.axisRejected)assert.equal(result.distance,null);
    else assert.equal(result.distance,d);
  }
});
test('5,000 seeded candidate pairs preserve original hypot comparisons',()=>{
  let seed=0x62b3a719;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
  for(let i=0;i<5000;i++){
    const a={x:(rand()-.5)*2e8,y:(rand()-.5)*2e8};
    const b={x:a.x+(rand()-.5)*1e5,y:a.y+(rand()-.5)*1e5};
    const range=i%9===0?0:i%9===1?Number.MAX_VALUE:rand()*90000;
    const expected=Math.hypot(a.x-b.x,a.y-b.y)<=range;
    assert.equal(distanceCheck2D(a,b,range).within,expected);
  }
});
test('short circuit never invokes expensive predicate on early rejects',()=>{
  let calls=0;
  const visible=()=>{calls++;return true;};
  assert.equal(withinRange2D({x:0,y:0},{x:100,y:0},1,visible),false);
  assert.equal(calls,0);
  assert.equal(withinRange2D({x:0,y:0},{x:3,y:4},5,visible),true);
  assert.equal(calls,1);
  assert.equal(withinRange2D({x:0,y:0},{x:3,y:4},4,visible),false);
  assert.equal(calls,1);
});
test('invalid shapes fail closed before any expensive predicate runs',()=>{
  let called=0;
  for(const input of [
    [null,{x:0,y:0},1],[{x:0,y:0},{x:NaN,y:0},1],
    [{x:0,y:0},{x:0,y:0},-1],[{x:0,y:0},{x:0,y:0},Infinity],
    [{x:0,y:0},{x:0,y:0},1,{inclusive:'no'}]
  ])assert.throws(()=>distanceCheck2D(...input));
  assert.throws(()=>withinRange2D({x:0,y:0},{x:1,y:1},1,1));
  assert.throws(()=>withinRange2D({x:0,y:0},{x:Infinity,y:0},1,()=>{called++;}));
  assert.equal(called,0);
});
