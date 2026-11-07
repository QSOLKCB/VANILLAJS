// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {NavigationGrid,findPath} from '../modules/navigation/index.js';
import {PooledPathfinder} from '../modules/navigation-pool/index.js';

// Independent seeded Xorshift32 fixtures. The original findPath() is the
// complete behavioral oracle; BFS verifies shortest costs independently.
function rng(seed){
  let s=seed>>>0;
  return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;};
}
function shortest(grid,start,goal){
  if(!grid.walkable(start)||!grid.walkable(goal))return null;
  const queue=[[...start,0]],seen=new Set([start.join(',')]);
  for(let i=0;i<queue.length;i++){
    const [x,z,d]=queue[i];if(x===goal[0]&&z===goal[1])return d;
    for(const n of [[x,z-1],[x-1,z],[x+1,z],[x,z+1]]){
      const key=n.join(',');
      if(!grid.walkable(n)||seen.has(key))continue;
      seen.add(key);queue.push([...n,d+1]);
    }
  }
  return null;
}
test('pooled routes match the original reference for blocked, budget and tie order',()=>{
  const blocked=[[3,0],[3,1],[3,2],[3,3],[5,4]];
  const grid=new NavigationGrid({width:8,height:6,blocked,cellSize:2});
  const pool=new PooledPathfinder(grid);
  assert.equal(pool.grid,grid);
  assert.equal(pool.cells,48);
  const queries=[
    [[1,1],[6,1],4096],
    [[0,0],[7,5],4096],
    [[3,1],[6,4],4096],
    [[1,1],[1,1],1],
    [[1,1],[6,1],1],
    [[1,1],[6,1],4],
    [[-1,0],[2,2],4096],
    [[1,1],[8,5],4096],
  ];
  for(const [start,goal,maxExpanded] of queries){
    assert.deepEqual(pool.findPath(start,goal,{maxExpanded}),
      findPath(grid,start,goal,{maxExpanded}));
  }
  assert.equal(pool.findPath([1,1],[6,1]).cost,findPath(grid,[1,1],[6,1]).cost);
});

test('2,560 seeded searches and bounded expansions match reference byte-for-byte',()=>{
  const random=rng(0x7157b00b),width=20,height=14;
  for(let map=0;map<40;map++){
    const blocked=[];
    for(let z=0;z<height;z++)for(let x=0;x<width;x++){
      if(random()<.29)blocked.push([x,z]);
    }
    const grid=new NavigationGrid({width,height,blocked,cellSize:1+(map%4)});
    const pool=new PooledPathfinder(grid);
    for(let q=0;q<16;q++){
      const start=[Math.floor(random()*width),Math.floor(random()*height)];
      const goal=[Math.floor(random()*width),Math.floor(random()*height)];
      for(const maxExpanded of [1,2,17,65536]){
        const actual=pool.findPath(start,goal,{maxExpanded});
        const expected=findPath(grid,start,goal,{maxExpanded});
        assert.deepEqual(actual,expected,
          'map='+map+' query='+q+' maxExpanded='+maxExpanded);
        if(actual.status==='found'){
          const shortestCost=shortest(grid,start,goal);
          assert.equal(actual.cost/ grid.cellSize,shortestCost);
          assert.equal(actual.expanded<=maxExpanded,true);
        }
      }
    }
  }
});

test('the same workspace may be reused 1024 times without stale parents or routes',()=>{
  const grid=new NavigationGrid({width:16,height:12,blocked:
    Array.from({length:12},(_,z)=>[6,z]).filter(x=>x[1]!==8)});
  const pool=new PooledPathfinder(grid);
  const reference=findPath(grid,[1,1],[14,10],{maxExpanded:65536});
  assert.equal(reference.status,'found');
  for(let i=0;i<1024;i++){
    const blocked=pool.findPath([6,0],[0,0]);
    assert.equal(blocked.status,'blocked');
    const route=pool.findPath([1,1],[14,10],{maxExpanded:65536});
    assert.deepEqual(route,reference);
    route.path[0][0]=999;
  }
  assert.deepEqual(pool.findPath([1,1],[14,10],{maxExpanded:65536}),reference,
    'result ownership survives external mutation');
});

test('copy-on-edit grids require a new workspace; earlier snapshot is preserved',()=>{
  const grid=new NavigationGrid({width:8,height:8});
  const pool=new PooledPathfinder(grid);
  const before=pool.findPath([0,0],[7,7]);
  const updated=grid.withBlocked([[0,1],[1,0]]);
  const updatedPool=new PooledPathfinder(updated);
  assert.equal(updatedPool.findPath([0,0],[7,7]).status,'unreachable');
  assert.deepEqual(pool.findPath([0,0],[7,7]),before);
  assert.deepEqual(updatedPool.findPath([0,0],[7,7]),
    findPath(updated,[0,0],[7,7]));
});

test('full-capacity grid, heap growth and far-goal results match baseline',()=>{
  const grid=new NavigationGrid({width:256,height:256});
  const pool=new PooledPathfinder(grid);
  assert.equal(pool.cells,65536);
  const expected=findPath(grid,[0,0],[255,255],{maxExpanded:65536});
  const observed=pool.findPath([0,0],[255,255],{maxExpanded:65536});
  assert.deepEqual(observed,expected);
  assert.equal(observed.status,'found');
  assert.equal(observed.cost,510);
  // Also exercise many small later searches on the retained 65K-cell workspace.
  for(let i=0;i<12;i++)assert.deepEqual(
    pool.findPath([i,0],[i+1,0],{maxExpanded:20}),
    findPath(grid,[i,0],[i+1,0],{maxExpanded:20}));
});

test('constructor, invalid cells and budgets reject identically to reference',()=>{
  assert.throws(()=>new PooledPathfinder(null),TypeError);
  assert.throws(()=>new PooledPathfinder({width:4,height:4}),TypeError);
  const grid=new NavigationGrid({width:6,height:6}),pool=new PooledPathfinder(grid);
  for(const [start,goal,opt] of [
    [[0],[1,1],{}],[[0,0],[NaN,2],{}],
    [[0,0],[1,1],{maxExpanded:0}],
    [[0,0],[1,1],{maxExpanded:1.5}],
    [[0,0],[1,1],{maxExpanded:65537}],
    [[0,0],[1,1],{maxExpanded:Infinity}],
    [null,[0,0],{}]
  ]){
    assert.throws(()=>findPath(grid,start,goal,opt));
    assert.throws(()=>pool.findPath(start,goal,opt));
  }
  // A bad query must not poison the next one or retain a half-open heap.
  assert.deepEqual(pool.findPath([0,0],[5,5]),
    findPath(grid,[0,0],[5,5]));
});
