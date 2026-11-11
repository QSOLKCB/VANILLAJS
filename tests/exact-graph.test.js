// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ExactRational as R} from '../modules/exact-rational/index.js';
import {point2} from '../modules/exact-geometry/index.js';
import {D4_ELEMENTS,composeD4,transformPoint2} from '../modules/exact-d4/index.js';
import {ExactGraph,MAX_VERTICES,breadthFirst,depthFirst,connectedComponents,relabelGraph,
  graphInvariants,characteristicPolynomial,closedWalkCounts} from '../modules/exact-graph/index.js';
const path=n=>new ExactGraph(n,Array.from({length:Math.max(0,n-1)},(_,i)=>[i,i+1]));
const complete=n=>new ExactGraph(n,Array.from({length:n},(_,i)=>Array.from({length:n-i-1},(_,j)=>[i,i+j+1])).flat());
const strings=values=>values.map(String);

test('bounded simple graph admission, canonical immutable storage and hostile inputs',()=>{
  assert.equal(MAX_VERTICES,16);
  for(const n of [-1,17,1.5,NaN,Infinity,'2',2n,null])assert.throws(()=>new ExactGraph(n,[]));
  for(const edges of [null,{},[[0,0]],[[0,2]],[[0,1],[1,0]],[[0]],[[0,1,2]],[[0,'1']],Array(1)])assert.throws(()=>new ExactGraph(2,edges));
  const edges=[[2,0],[1,0]],g=new ExactGraph(3,edges);edges[0][0]=1;
  assert.deepEqual(g.edges,[[0,1],[0,2]]);assert.ok(Object.isFrozen(g));assert.ok(Object.isFrozen(g.edges[0]));
  assert.throws(()=>{g.edges[0][0]=2;},TypeError);
  assert.throws(()=>{class Child extends ExactGraph{}new Child(0,[]);},TypeError);
  for(const fake of [null,{},Object.create(ExactGraph.prototype),new Proxy(g,{})]){
    for(const f of [breadthFirst,depthFirst,connectedComponents,graphInvariants,characteristicPolynomial,closedWalkCounts])assert.throws(()=>f(fake,0),TypeError);
  }
  assert.equal(complete(16).edges.length,120);assert.equal(new ExactGraph(0,[]).vertexCount,0);
});

test('BFS/DFS tie order, parent/depth semantics, cycles, unreachable and empty graphs',()=>{
  const g=new ExactGraph(6,[[0,2],[0,1],[1,3],[2,3],[4,5]]);
  assert.deepEqual(breadthFirst(g,0),{order:[0,1,2,3],parent:[-1,0,0,1,-1,-1],depth:[0,1,1,2,-1,-1]});
  assert.deepEqual(depthFirst(g,0),{order:[0,1,3,2],parent:[-1,0,3,1,-1,-1],depth:[0,1,3,2,-1,-1]});
  assert.deepEqual(connectedComponents(g),[[0,1,2,3],[4,5]]);
  assert.deepEqual(connectedComponents(new ExactGraph(0,[])),[]);
  for(const start of [-1,6,0.5,'0',null])for(const f of [breadthFirst,depthFirst])assert.throws(()=>f(g,start));
  assert.throws(()=>breadthFirst(new ExactGraph(0,[]),0),RangeError);
  assert.ok(Object.isFrozen(breadthFirst(g,0).parent));
});

test('known exact spectral and rational invariants, empty convention and walk bounds',()=>{
  assert.deepEqual(characteristicPolynomial(new ExactGraph(0,[])),[1n]);
  assert.deepEqual(characteristicPolynomial(path(1)),[1n,0n]);
  assert.deepEqual(characteristicPolynomial(path(3)),[1n,0n,-2n,0n]);
  assert.deepEqual(characteristicPolynomial(complete(3)),[1n,0n,-3n,-2n]);
  assert.deepEqual(closedWalkCounts(complete(3),3),[3n,0n,6n,6n]);
  const info=graphInvariants(complete(3));assert.equal(info.triangles,1n);assert.equal(info.density.toString(),'1');
  assert.equal(graphInvariants(path(3)).density.toString(),'2/3');
  assert.equal(graphInvariants(new ExactGraph(0,[])).density.toString(),'0');
  assert.deepEqual(closedWalkCounts(new ExactGraph(0,[]),3),[0n,0n,0n,0n]);
  for(const k of [-1,17,0.5,'3',NaN])assert.throws(()=>closedWalkCounts(path(2),k));
  assert.equal(characteristicPolynomial(complete(16)).length,17);
  assert.ok(Object.isFrozen(characteristicPolynomial(path(3))));
});

test('relabeling rejects nonpermutations, preserves invariants and BFS distances, not visit order',()=>{
  assert.deepEqual(relabelGraph(new ExactGraph(4,[[0,1],[1,2]]),[2,0,3,1]).edges,[[0,2],[0,3]]);
  const g=new ExactGraph(5,[[0,1],[1,2],[2,3],[3,0]]),map=[3,2,1,0,4],h=relabelGraph(g,map);
  for(const bad of [null,{},[0,1],[0,1,2,3,3],[0,1,2,3,5],[0,1,2,3,'4'],Array(5)])assert.throws(()=>relabelGraph(g,bad));
  assert.deepEqual(characteristicPolynomial(g),characteristicPolynomial(h));assert.deepEqual(graphInvariants(g),graphInvariants(h));
  const a=breadthFirst(g,0),b=breadthFirst(h,map[0]);map.forEach((v,i)=>assert.equal(a.depth[i],b.depth[v]));
  assert.notDeepEqual(a.order.map(i=>map[i]),b.order);
});

test('D4 grid automorphisms compose and preserve exact graph invariants',()=>{
  const points=Array.from({length:9},(_,i)=>point2(new R(i%3-1),new R(Math.floor(i/3)-1)));
  const permutations=Object.fromEntries(D4_ELEMENTS.map(g=>[g,points.map(p=>{
    const t=transformPoint2(g,p);return points.findIndex(q=>q.x.compare(t.x)===0&&q.y.compare(t.y)===0);
  })]));
  const edges=[];for(let i=0;i<9;i++){if(i%3<2)edges.push([i,i+1]);if(i<6)edges.push([i,i+3]);}
  const grid=new ExactGraph(9,edges),asymmetric=new ExactGraph(9,[[0,1],[1,4],[4,8],[3,6]]);
  assert.deepEqual(relabelGraph(asymmetric,permutations.r).edges,[[0,1],[2,5],[4,5],[4,6]]);
  for(const g of D4_ELEMENTS){
    assert.deepEqual(relabelGraph(grid,permutations[g]).edges,grid.edges);
    const transformed=relabelGraph(asymmetric,permutations[g]);
    assert.deepEqual(characteristicPolynomial(transformed),characteristicPolynomial(asymmetric));
    assert.deepEqual(closedWalkCounts(transformed,8),closedWalkCounts(asymmetric,8));
    for(const h of D4_ELEMENTS)assert.deepEqual(permutations[composeD4(g,h)],permutations[h].map(i=>permutations[g][i]));
  }
});

test('independent polynomial determinant and graph oracle matches frozen domain',async()=>{
  const raw=await readFile(new URL('./fixtures/alien-math-005-input.json',import.meta.url));
  const spec=JSON.parse(raw),expected=JSON.parse(await readFile(new URL('./fixtures/alien-math-005-oracle.json',import.meta.url),'utf8'));
  assert.equal(createHash('sha256').update(raw).digest('hex'),expected.inputSHA256);
  const rows=[...spec.fixed];
  for(let n=0;n<=4;n++)for(let mask=0;mask<2**(n*(n-1)/2);mask++){
    const edges=[];let bit=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++,bit++)if(mask&(1<<bit))edges.push([i,j]);rows.push({n,edges});
  }
  let state=spec.seed;const next=()=>state=(Math.imul(state,1664525)+1013904223)>>>0;
  for(let t=0;t<spec.generated;t++){const n=next()%8,edges=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(next()%3===0)edges.push([i,j]);rows.push({n,edges});}
  const digest=createHash('sha256');
  for(const {n,edges} of rows){
    const graph=new ExactGraph(n,edges),stats=graphInvariants(graph);
    const row={n,edges:graph.edges,polynomial:strings(characteristicPolynomial(graph)),walks:strings(closedWalkCounts(graph,8)),degrees:stats.degreeSequence,components:connectedComponents(graph),triangles:String(stats.triangles),density:String(stats.density),bfs:n?breadthFirst(graph,0):null,dfs:n?depthFirst(graph,0):null};
    digest.update(JSON.stringify(row)+'\n');
    const reverse=Array.from({length:n},(_,i)=>n-1-i),other=relabelGraph(graph,reverse);
    assert.deepEqual(characteristicPolynomial(other),characteristicPolynomial(graph));
    assert.deepEqual(closedWalkCounts(other,8),closedWalkCounts(graph,8));
  }
  assert.equal(rows.length,expected.cases);assert.equal(digest.digest('hex'),expected.sha256);
});

test('cospectral graphs need not be isomorphic; Cayley-Hamilton holds at the maximum bound',()=>{
  const star=new ExactGraph(5,[[0,1],[0,2],[0,3],[0,4]]);
  const cycle=new ExactGraph(5,[[0,1],[1,2],[2,3],[3,0]]);
  assert.deepEqual(characteristicPolynomial(star),characteristicPolynomial(cycle));
  assert.notDeepEqual(graphInvariants(star).degreeSequence,graphInvariants(cycle).degreeSequence);
  for(const g of [star,cycle,path(16),complete(16)]){
    const coefficients=characteristicPolynomial(g),n=g.vertexCount;
    let result=Array.from({length:n},()=>Array(n).fill(0n));
    // Independent dense Horner evaluation of p(A), rather than coefficient recurrence.
    for(const c of coefficients){
      result=result.map(row=>Array.from({length:n},(_,j)=>row.reduce((sum,v,k)=>sum+(g.adjacency[k].includes(j)?v:0n),0n)));
      for(let i=0;i<n;i++)result[i][i]+=c;
    }
    assert.ok(result.flat().every(v=>v===0n));
  }
});

test('all 24 relabelings of every four-vertex graph preserve exact invariants and mapped distances',()=>{
  const permutations=values=>values.length?values.flatMap(v=>permutations(values.filter(w=>w!==v)).map(t=>[v,...t])):[[]];
  const maps=permutations([0,1,2,3]),pairs=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
  for(let mask=0;mask<64;mask++){
    const g=new ExactGraph(4,pairs.filter((_,i)=>mask&(1<<i))),polynomial=characteristicPolynomial(g),info=graphInvariants(g),dist=breadthFirst(g,2).depth;
    for(const map of maps){
      const h=relabelGraph(g,map),stats=graphInvariants(h),mapped=breadthFirst(h,map[2]).depth;
      assert.deepEqual(characteristicPolynomial(h),polynomial);assert.deepEqual(stats.degreeSequence,info.degreeSequence);
      assert.equal(stats.density.toString(),info.density.toString());assert.equal(stats.triangles,info.triangles);assert.equal(stats.components,info.components);
      map.forEach((v,i)=>assert.equal(mapped[v],dist[i]));
    }
  }
});
