import test from 'node:test';
import assert from 'node:assert/strict';
import {NavigationGrid,findPath,formationSlots} from '../modules/navigation/index.js';
import {seededRandom} from '../modules/math/index.js';
const grid=(options={})=>new NavigationGrid({width:8,height:6,...options});
test('grid owns its inputs and edits create independent snapshots',()=>{
  const origin=[-3,5],blocked=[[2,2]],g=grid({origin,blocked});origin[0]=100;blocked[0][0]=0;
  assert.deepEqual(g.origin,[-3,5]);assert.equal(g.walkable([2,2]),false);
  const next=g.withBlocked([[2,2]],false).withBlocked([[3,3]]);assert.equal(next.walkable([2,2]),true);assert.equal(g.walkable([2,2]),false);assert.equal(g.walkable([3,3]),true);
  assert.throws(()=>{g.width=1;});assert.throws(()=>g.withBlocked([[1,1],[999,2]]));assert.equal(g.walkable([1,1]),true);
});
test('grid conversions use X/Z metres and half-open bounds including negative origins',()=>{
  const g=grid({origin:[-4,-6],cellSize:2});assert.deepEqual(g.cellCenter([0,0]),[-3,-5]);
  assert.deepEqual(g.worldToCell([-4,-6]),[0,0]);assert.deepEqual(g.worldToCell([0,0]),[2,3]);
  assert.equal(g.worldToCell([12,0]),null);assert.equal(g.worldToCell([-4,6]),null);assert.equal(g.worldToCell([-4.001,-6]),null);
  assert.equal(g.worldToCell([Number.MAX_VALUE,0]),null);
});
test('grid rejects malformed cells, excessive allocation and world overflow',()=>{
  for(const options of [{width:0},{height:1.5},{width:65537,height:1},{cellSize:0},{cellSize:Infinity},{cellSize:Number.MIN_VALUE},{cellSize:1e307},{origin:[1e16,0],cellSize:2},{origin:[NaN,0]},{origin:[1e20,0]},{blocked:[[8,0]]}])assert.throws(()=>grid(options));
  const g=grid();for(const c of [[1.5,1],[NaN,0],[1],null])assert.throws(()=>g.walkable(c));
  assert.equal(g.contains([-1,0]),false);assert.equal(g.walkable([8,0]),false);assert.throws(()=>g.cellCenter([8,0]));assert.throws(()=>g.worldToCell([Infinity,0]));assert.throws(()=>g.withBlocked([],1));
});
test('A* routes around walls with cardinal steps and exact metric length',()=>{
  const g=grid({cellSize:2,blocked:[[3,0],[3,1],[3,2],[3,3]]}),r=findPath(g,[1,1],[5,1]);
  assert.equal(r.status,'found');assert.equal(r.cost,20);assert.deepEqual(r.path[0],[1,1]);assert.deepEqual(r.path.at(-1),[5,1]);
  for(let i=1;i<r.path.length;i++){assert.ok(g.walkable(r.path[i]));assert.equal(Math.abs(r.path[i][0]-r.path[i-1][0])+Math.abs(r.path[i][1]-r.path[i-1][1]),1);}
  r.path[0][0]=7;assert.deepEqual(findPath(g,[1,1],[5,1]).path[0],[1,1]);
});
test('A* distinguishes blocked, unreachable, exhausted budget and already arrived',()=>{
  const g=grid({blocked:Array.from({length:6},(_,z)=>[3,z])});
  assert.equal(findPath(g,[0,0],[7,0]).status,'unreachable');assert.equal(findPath(g,[3,0],[1,0]).status,'blocked');
  assert.equal(findPath(g,[-1,0],[1,0]).status,'blocked');
  assert.deepEqual(findPath(g,[0,0],[2,0],{maxExpanded:1}),{status:'budget',path:[],cost:null,expanded:1});
  assert.deepEqual(findPath(g,[1,1],[1,1],{maxExpanded:1}),{status:'found',path:[[1,1]],cost:0,expanded:1});
  assert.equal(findPath(g,[0,0],[2,0],{maxExpanded:3}).status,'found');
  for(const maxExpanded of [0,1.5,65537,Infinity])assert.throws(()=>findPath(g,[0,0],[2,0],{maxExpanded}));
  assert.throws(()=>findPath({},[0,0],[2,0]));
});
test('A* tie ordering and results do not depend on obstacle insertion order',()=>{
  const blocked=[[3,2],[4,2]],a=findPath(grid({blocked}),[1,2],[6,2]),b=findPath(grid({blocked:blocked.toReversed()}),[1,2],[6,2]);
  assert.deepEqual(a,b);assert.ok(a.path.some(c=>c[1]===1));
});
test('A* matches an independent breadth-first shortest-path oracle on 80 seeded maps',()=>{
  const random=seededRandom(712),w=12,h=9;
  for(let sample=0;sample<80;sample++){
    const blocked=[];for(let z=0;z<h;z++)for(let x=0;x<w;x++)if(random()<.3&&!(x===0&&z===0)&&!(x===w-1&&z===h-1))blocked.push([x,z]);
    const g=new NavigationGrid({width:w,height:h,blocked}),queue=[[0,0,0]],seen=new Set(['0,0']);let expected=null;
    for(let i=0;i<queue.length;i++){
      const [x,z,d]=queue[i];if(x===w-1&&z===h-1){expected=d;break;}
      for(const c of [[x+1,z],[x-1,z],[x,z+1],[x,z-1]])if(g.walkable(c)&&!seen.has(c.join(','))){seen.add(c.join(','));queue.push([...c,d+1]);}
    }
    const r=findPath(g,[0,0],[w-1,h-1]);assert.equal(r.cost,expected);assert.equal(r.status,expected===null?'unreachable':'found');assert.ok(r.expanded<=w*h);
  }
});
test('formation destinations are unique, reachable, compact, stable and exclude occupied slots',()=>{
  const g=grid({blocked:[[4,2],[4,3]]}),r=formationSlots(g,[3,2],6,{exclude:[[3,2]]});
  assert.equal(r.status,'found');assert.equal(new Set(r.slots.map(c=>c.join(','))).size,6);assert.ok(!r.slots.some(c=>c[0]===3&&c[1]===2));
  for(const c of r.slots)assert.equal(findPath(g,[3,2],c).status,'found');
  assert.deepEqual(r,formationSlots(g,[3,2],6,{exclude:[[3,2]]}));assert.deepEqual(r.slots[0],[3,1]);
});
test('formation reports too little connected space separately from its work budget',()=>{
  const g=new NavigationGrid({width:2,height:2});assert.equal(formationSlots(g,[0,0],5).status,'partial');
  assert.deepEqual(formationSlots(g,[0,0],2,{maxExpanded:1}),{status:'budget',slots:[[0,0]],expanded:1});
  assert.equal(formationSlots(g.withBlocked([[0,0]]),[0,0],1).status,'blocked');
  assert.equal(formationSlots(g,[0,0],1,{exclude:[[0,0],[1,0],[0,1],[1,1]]}).status,'partial');
  for(const count of [0,257,1.5])assert.throws(()=>formationSlots(g,[0,0],count));assert.throws(()=>formationSlots(g,[0,0],1,{exclude:[[99,0]]}));
});
