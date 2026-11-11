// SPDX-License-Identifier: Apache-2.0
// ALIEN-MATH-005: bounded simple undirected graphs; exact authoring only.
import {ExactRational} from '../exact-rational/index.js';
export const MAX_VERTICES=16;
function integer(v,lo,hi){
  if(typeof v!=='number'||!Number.isInteger(v))throw new TypeError('integer Number required');
  if(v<lo||v>hi)throw new RangeError('graph bound exceeded');return v===0?0:v;
}
const freezeRows=rows=>Object.freeze(rows.map(row=>Object.freeze(row)));
export class ExactGraph {
  #n;#edges;#adj;
  constructor(vertexCount,edges){
    if(new.target!==ExactGraph)throw new TypeError('ExactGraph subclass forbidden');
    this.#n=integer(vertexCount,0,MAX_VERTICES);
    if(!Array.isArray(edges))throw new TypeError('edge array required');
    if(edges.length>this.#n*(this.#n-1)/2)throw new RangeError('too many edges');
    const seen=new Set(),canonical=[],adj=Array.from({length:this.#n},()=>[]);
    for(const edge of edges){
      if(!Array.isArray(edge)||edge.length!==2)throw new TypeError('edge pair required');
      let a=integer(edge[0],0,this.#n-1),b=integer(edge[1],0,this.#n-1);
      if(a===b)throw new RangeError('self loop forbidden');if(a>b)[a,b]=[b,a];
      const key=a*this.#n+b;if(seen.has(key))throw new RangeError('duplicate edge');seen.add(key);
      canonical.push([a,b]);adj[a].push(b);adj[b].push(a);
    }
    this.#edges=freezeRows(canonical.sort((a,b)=>a[0]-b[0]||a[1]-b[1]));
    this.#adj=freezeRows(adj.map(row=>row.sort((a,b)=>a-b)));Object.freeze(this);
  }
  get vertexCount(){return this.#n;}
  get edges(){return this.#edges;}
  get adjacency(){return this.#adj;}
}
const getAdj=Object.getOwnPropertyDescriptor(ExactGraph.prototype,'adjacency').get;
function adjacency(graph){
  if(graph===null||typeof graph!=='object'||Object.getPrototypeOf(graph)!==ExactGraph.prototype)throw new TypeError('genuine ExactGraph required');
  return getAdj.call(graph);
}
function traverse(adj,start,dfs){
  const parent=Array(adj.length).fill(-1),depth=Array(adj.length).fill(-1),order=[];
  depth[start]=0;
  if(dfs){
    const visit=v=>{order.push(v);for(const w of adj[v])if(depth[w]===-1){parent[w]=v;depth[w]=depth[v]+1;visit(w);}};
    visit(start);
  }else{
    order.push(start);for(let i=0;i<order.length;i++){const v=order[i];for(const w of adj[v])if(depth[w]===-1){parent[w]=v;depth[w]=depth[v]+1;order.push(w);}}
  }
  return Object.freeze({order:Object.freeze(order),parent:Object.freeze(parent),depth:Object.freeze(depth)});
}
/** Ascending-neighbor BFS; unreachable vertices have parent/depth -1, root parent -1. */
export function breadthFirst(graph,start){const adj=adjacency(graph);return traverse(adj,integer(start,0,adj.length-1),false);}
/** Ascending-neighbor recursive preorder DFS; depth is tree depth, not shortest distance. */
export function depthFirst(graph,start){const adj=adjacency(graph);return traverse(adj,integer(start,0,adj.length-1),true);}
export function connectedComponents(graph){
  const adj=adjacency(graph),seen=new Set(),out=[];
  for(let i=0;i<adj.length;i++)if(!seen.has(i)){const component=[...traverse(adj,i,false).order].sort((a,b)=>a-b);for(const v of component)seen.add(v);out.push(component);}
  return freezeRows(out);
}
/** permutation[oldId] = newId; no order-invariance claim for label-tiebroken traversal. */
export function relabelGraph(graph,permutation){
  const adj=adjacency(graph),n=adj.length;
  if(!Array.isArray(permutation)||permutation.length!==n)throw new TypeError('permutation array required');
  // Array.from also visits holes; they cannot escape validation via map().
  const map=Array.from(permutation,v=>integer(v,0,n-1));
  if(new Set(map).size!==n)throw new RangeError('bijection required');
  const edges=[];for(let i=0;i<n;i++)for(const j of adj[i])if(i<j)edges.push([map[i],map[j]]);
  return new ExactGraph(n,edges);
}
export function graphInvariants(graph){
  const adj=adjacency(graph),n=adj.length,edges=adj.reduce((s,a)=>s+a.length,0)/2;
  let triangles=0n;for(let i=0;i<n;i++)for(const j of adj[i])if(j>i)for(const k of adj[j])if(k>j&&adj[i].includes(k))triangles++;
  return Object.freeze({vertices:n,edges,degreeSequence:Object.freeze(adj.map(a=>a.length).sort((a,b)=>a-b)),
    components:connectedComponents(graph).length,triangles,density:n<2?new ExactRational(0):new ExactRational(2*edges,n*(n-1))});
}
const identity=n=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1n:0n));
function multiplyAdj(adj,b){return adj.map(neighbors=>Array.from({length:adj.length},(_,j)=>neighbors.reduce((sum,k)=>sum+b[k][j],0n)));}
const trace=m=>m.reduce((sum,row,i)=>sum+row[i],0n);
/** Descending coefficients of det(lambda I-A). Faddeev-LeVerrier with checked exact division. */
export function characteristicPolynomial(graph){
  const adj=adjacency(graph),n=adj.length,coefficients=[1n];let b=identity(n);
  for(let k=1;k<=n;k++){
    b=multiplyAdj(adj,b);const numerator=-trace(b),divisor=BigInt(k);
    if(numerator%divisor!==0n)throw new Error('nonintegral characteristic coefficient');
    const c=numerator/divisor;coefficients.push(c);for(let i=0;i<n;i++)b[i][i]+=c;
  }
  return Object.freeze(coefficients);
}
/** Trace(A^k), k=0..steps, steps in 0..16; trace(I_0)=0. */
export function closedWalkCounts(graph,steps){
  const adj=adjacency(graph);steps=integer(steps,0,16);let power=identity(adj.length);const counts=[BigInt(adj.length)];
  for(let k=1;k<=steps;k++){power=multiplyAdj(adj,power);counts.push(trace(power));}
  return Object.freeze(counts);
}
