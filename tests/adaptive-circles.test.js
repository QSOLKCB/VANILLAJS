// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {AdaptiveCircleQueries} from '../modules/adaptive-circles/index.js';
import {nextRandom} from '../modules/integer-math/index.js';

// Independent geometric oracle. Clamp the closest *segment* point and
// bisect the entry on the decreasing-distance half of the segment. This
// deliberately avoids any quadratic/discriminant calculation and is separate
// from production's unit-tangent/half-chord solution.
function reference(circles,start,delta,ignored=[]){
  const skip=new Set(ignored);let best=null;
  for(let i=0;i<circles.length;i++){
    const c=circles[i];if(skip.has(c.id))continue;
    const dx=delta[0],dy=delta[1],fx=start[0]-c.x,fy=start[1]-c.y;
    let time=null;
    if(Math.hypot(fx,fy)<=c.radius)time=0;
    else{
      const squared=dx*dx+dy*dy;
      if(squared>0){
        const nearest=Math.max(0,Math.min(1,-(fx*dx+fy*dy)/squared));
        const distance=t=>Math.hypot(
          start[0]+t*dx-c.x,start[1]+t*dy-c.y);
        if(distance(nearest)<=c.radius){
          let lo=0,hi=nearest;
          for(let step=0;step<56;step++){
            const mid=(lo+hi)/2;
            if(distance(mid)<=c.radius)hi=mid;else lo=mid;
          }
          time=hi;
        }
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

test('long segments and subunit circles use stable geometry in both broadphases',()=>{
  // The old b*b-4*a*c discriminant rounds to zero for the first case,
  // inventing a tangent at t=0.5 despite a full metre of clearance.
  const cases=[
    {name:'reported false hit',start:[-1e8,-1],delta:[2e8,0],hit:null},
    {name:'close miss',start:[-1e8,-.101],delta:[2e8,0],hit:null},
    {name:'exact tangent',start:[-1e8,-.1],delta:[2e8,0],hit:.5},
    {name:'near-tangent entry',start:[-1e8,-.099],delta:[2e8,0],
      hit:.5-Math.sqrt((.1-.099)*(.1+.099))/2e8},
    {name:'center entry',start:[-1e8,0],delta:[2e8,0],
      hit:.5-.1/2e8},
    {name:'diagonal miss',start:[-1e8,-1e8-.2],delta:[2e8,2e8],
      cellSize:1e8,hit:null},
    {name:'diagonal crossing',start:[-1e8,-1e8],delta:[2e8,2e8],
      cellSize:1e8,hit:.5-.1/Math.hypot(2e8,2e8)},
    {name:'translated circle miss',start:[2e8,2e8-1],delta:[2e8,0],
      center:[3e8,2e8],hit:null}
  ];
  for(const example of cases){
    const [x,y]=example.center??[0,0];
    // A larger, distant circle expands the grid's candidate margin,
    // ensuring the grid *actually tests* the small circle even on misses.
    const circles=[{id:1,x,y,radius:.1},{id:2,x:7e8,y:1000,radius:2}];
    const settings={cellSize:example.cellSize??1e5,maxCellVisits:16384};
    const brute=new AdaptiveCircleQueries(circles,{...settings,gridMin:32})
      .castSegment(example.start,example.delta);
    const grid=new AdaptiveCircleQueries(circles,{...settings,gridMin:1})
      .castSegment(example.start,example.delta);
    assert.equal(brute.mode,'brute',example.name);
    assert.equal(grid.mode,'grid',example.name);
    assert.ok(grid.tested>=1,example.name+' must exercise grid narrowphase');
    const geometric=reference(circles,example.start,example.delta);
    match(brute.hit,geometric);match(grid.hit,geometric);
    assert.deepEqual(grid.hit,brute.hit,example.name+' broadphase parity');
    if(example.hit===null){
      assert.equal(brute.hit,null,example.name+' must miss');
    }else{
      assert.equal(brute.hit?.id,1,example.name+' must hit small circle');
      assert.ok(Math.abs(brute.hit.time-example.hit)<1e-12,
        example.name+' entry time must match geometric expectation');
    }
  }
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
