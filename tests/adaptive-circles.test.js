// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {AdaptiveCircleQueries} from '../modules/adaptive-circles/index.js';
import {nextRandom} from '../modules/integer-math/index.js';

// Independent all-pairs segment/circle oracle: quadratic projection form.
function reference(circles,start,delta,ignored=[]){
  const skip=new Set(ignored);let best=null;
  for(let i=0;i<circles.length;i++){
    const c=circles[i];if(skip.has(c.id))continue;
    const rx=start[0]-c.x,ry=start[1]-c.y;
    const dx=delta[0],dy=delta[1],a=dx*dx+dy*dy;
    const inside=rx*rx+ry*ry<=c.radius*c.radius;
    let time=null;
    if(inside)time=0;
    else if(a>0){
      const p=rx*dx+ry*dy;
      const disc=p*p-a*(rx*rx+ry*ry-c.radius*c.radius);
      if(disc>=0){
        const root=(-p-Math.sqrt(disc))/a;
        if(root>=0&&root<=1)time=root;
      }
    }
    if(time!==null&&(!best||time<best.time||
      (time===best.time&&c.id<best.id)))best={id:c.id,index:i,time};
  }
  return best;
}
function match(actual,expected){
  assert.equal(actual?.id??null,expected?.id??null);
  assert.equal(actual?.index??null,expected?.index??null);
  if(actual)assert.ok(Math.abs(actual.time-expected.time)<1e-8);
}

test('nearest entry, stable IDs, inclusion and ignored colliders',()=>{
  const objects=[{id:9,x:0,y:0,radius:1},{id:2,x:0,y:0,radius:1},
    {id:6,x:5,y:0,radius:1}];
  const index=new AdaptiveCircleQueries(objects,{gridMin:2,cellSize:2});
  const hit=index.castSegment([-5,0],[12,0]);
  assert.deepEqual(hit.hit,{id:2,index:1,time:1/3});
  assert.equal(hit.mode,'grid');
  assert.equal(index.castSegment([-5,0],[12,0],{ignoreIds:[2]}).hit.id,9);
  assert.equal(index.castSegment([-5,0],[12,0],{ignoreIds:[2,9]}).hit.id,6);
  assert.equal(index.castSegment([0,0],[0,0]).hit.id,2);
  assert.equal(index.castSegment([-5,3],[12,0]).hit,null);
  assert.deepEqual(index.castSegment([0,0],[0,0],{ignoreIds:[2,9,6]}).hit,null);
});

test('small encounters use the all-pairs path; large encounters reduce tests',()=>{
  const small=Array.from({length:14},(_,id)=>({id:id+1,x:1000+id*20,y:50,radius:3}));
  const smallIndex=new AdaptiveCircleQueries(small,{gridMin:32});
  assert.equal(smallIndex.indexed,false);
  assert.equal(smallIndex.castSegment([0,0],[10,0]).tested,14);
  const large=Array.from({length:58},(_,i)=>({id:i+1,x:i*400,y:(i%3)*100,radius:2}));
  const grid=new AdaptiveCircleQueries(large,{cellSize:64,gridMin:32});
  const result=grid.castSegment([0,0],[10,0]);
  assert.equal(result.mode,'grid');
  assert.ok(result.tested<large.length/2);
  match(result.hit,reference(large,[0,0],[10,0]));
});

test('long sweeps fall back rather than visiting unlimited cells',()=>{
  const objects=Array.from({length:40},(_,i)=>({id:i+1,x:i*50,y:0,radius:1}));
  const engine=new AdaptiveCircleQueries(objects,{gridMin:4,cellSize:1,maxCellVisits:5});
  const actual=engine.castSegment([0,0],[2000,0]);
  assert.equal(actual.mode,'brute');assert.equal(actual.tested,40);
  match(actual.hit,reference(objects,[0,0],[2000,0]));
});

test('constructor and query validation reject invalid/sparse/nonfinite input',()=>{
  for(const object of [{id:1,x:Infinity,y:0,radius:2},
    {id:1,x:0,y:0,radius:-1},{id:0,x:0,y:0,radius:1},
    {id:1,x:1e9,y:0,radius:2}]){
    assert.throws(()=>new AdaptiveCircleQueries([object]));
  }
  assert.throws(()=>new AdaptiveCircleQueries([{id:1,x:0,y:0,radius:1},
    {id:1,x:3,y:0,radius:1}]),/duplicate/);
  assert.throws(()=>new AdaptiveCircleQueries([], {cellSize:0}));
  assert.throws(()=>new AdaptiveCircleQueries([], {gridMin:0}));
  assert.throws(()=>new AdaptiveCircleQueries([], {maxCellVisits:0}));
  const scene=new AdaptiveCircleQueries([{id:1,x:0,y:0,radius:1}]);
  for(const bad of [[0,0,0],[,0],['1',0],[Infinity,0],[1e10,0]]){
    assert.throws(()=>scene.castSegment(bad,[0,0]));
  }
  assert.throws(()=>scene.castSegment([0,0],[Infinity,0]));
  assert.throws(()=>scene.castSegment([0,0],[1e10,0]));
  assert.throws(()=>scene.castSegment([0,0],[0,0],{ignoreIds:[0]}));
  assert.throws(()=>scene.castSegment([0,0],[0,0],{ignoreIds:'bad'}));
});

test('snapshots retain original data when caller mutates donor actors',()=>{
  const src=Array.from({length:40},(_,i)=>({id:i+1,x:i*15,y:i%2,radius:1}));
  const index=new AdaptiveCircleQueries(src,{cellSize:8,gridMin:32});
  const before=index.castSegment([-2,0],[14,0]);
  src[0].x=10000;src[0].radius=100;src.length=0;
  assert.deepEqual(index.castSegment([-2,0],[14,0]),before);
});

test('3200 seeded crowded cases match independent all-pairs oracle',()=>{
  let seed=419;
  const random=()=>{seed=nextRandom(seed);return seed/4294967296;};
  for(const count of [14,58,100]){
    const circles=Array.from({length:count},(_,i)=>({
      id:i+1,x:(random()-.5)*2000,y:(random()-.5)*2000,radius:2+random()*28
    }));
    const grid=new AdaptiveCircleQueries(circles,{cellSize:48,gridMin:32,maxCellVisits:4000});
    for(let j=0;j<(count===14?400:1400);j++){
      const start=[(random()-.5)*1800,(random()-.5)*1800];
      const delta=[(random()-.5)*200,(random()-.5)*200];
      const ignored=j%7===0?[1,2,3]:[];
      const got=grid.castSegment(start,delta,{ignoreIds:ignored});
      match(got.hit,reference(circles,start,delta,ignored));
    }
  }
});
