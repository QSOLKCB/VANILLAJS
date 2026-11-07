// SPDX-License-Identifier: Apache-2.0
// QSOL OPT-INV-001 / OPT-POOL-001: reusable, generation-stamped A* workspace.
// Derived architecturally from QSOLKCB/QwakeTF PR #4 src/nav.js at
// 46367b7b946b0254aa7cbdbb4a454735b81e3052 (Apache-2.0).
// VANILLAJS's existing findPath() remains the independent output oracle.
import {NavigationGrid} from '../navigation/index.js';

const MAX_CELLS=65536;
const MAX_HEAP=4*MAX_CELLS;
function cell(value){
  if(!value||value.length!==2||!Array.from(value).every(Number.isSafeInteger))
    throw new TypeError('cell must contain two safe integers');
  return Array.from(value);
}
function budget(value){
  if(!Number.isInteger(value)||value<1||value>MAX_CELLS)
    throw new RangeError('maxExpanded must be 1..65536');
  return value;
}
// Preserve the reference Frontier's total order: f, then h, then cell index.
// This is deliberately NOT QwakeTF's simpler f-only heap tie behaviour.
const before=(f,h,i,F,H,I)=>f<F||(f===F&&(h<H||(h===H&&i<I)));

/** Four parallel, grow-only typed arrays. No heap-node objects per expansion. */
class ParallelFrontier {
  #indices=new Int32Array(16);
  #g=new Float64Array(16);
  #h=new Float64Array(16);
  #f=new Float64Array(16);
  #length=0;
  poppedIndex=0;
  poppedG=0;
  get length(){return this.#length;}
  clear(){this.#length=0;}
  #grow(){
    const current=this.#indices.length;
    if(current>=MAX_HEAP)throw new RangeError('bounded A* heap exhausted');
    const capacity=Math.min(MAX_HEAP,current*2);
    const indices=new Int32Array(capacity),g=new Float64Array(capacity);
    const h=new Float64Array(capacity),f=new Float64Array(capacity);
    indices.set(this.#indices);g.set(this.#g);h.set(this.#h);f.set(this.#f);
    this.#indices=indices;this.#g=g;this.#h=h;this.#f=f;
  }
  push(index,g,h){
    if(this.#length===this.#indices.length)this.#grow();
    const f=g+h,indices=this.#indices,gs=this.#g,hs=this.#h,fs=this.#f;
    let at=this.#length++;
    while(at>0){
      const parent=(at-1)>>1;
      if(!before(f,h,index,fs[parent],hs[parent],indices[parent]))break;
      indices[at]=indices[parent];gs[at]=gs[parent];
      hs[at]=hs[parent];fs[at]=fs[parent];
      at=parent;
    }
    indices[at]=index;gs[at]=g;hs[at]=h;fs[at]=f;
  }
  pop(){
    const indices=this.#indices,gs=this.#g,hs=this.#h,fs=this.#f;
    this.poppedIndex=indices[0];this.poppedG=gs[0];
    const end=--this.#length;
    if(end<=0)return;
    const index=indices[end],g=gs[end],h=hs[end],f=fs[end];
    let at=0;
    while(at*2+1<end){
      const left=at*2+1,right=left+1;
      const child=right<end&&before(fs[right],hs[right],indices[right],
        fs[left],hs[left],indices[left])?right:left;
      if(!before(fs[child],hs[child],indices[child],f,h,index))break;
      indices[at]=indices[child];gs[at]=gs[child];
      hs[at]=hs[child];fs[at]=fs[child];
      at=child;
    }
    indices[at]=index;gs[at]=g;hs[at]=h;fs[at]=f;
  }
}

/** An optional single-owner pathfinding workspace bound to one immutable grid.
 * Reusing across sequential queries avoids reallocating/clearing O(cells)
 * score/parent/closed arrays and a per-query object heap.
 *
 * The constructor makes one immutable walkability mask. withBlocked() creates
 * a new NavigationGrid; construct a NEW pathfinder for the edited grid.
 * Do not share a workspace between simultaneous/reentrant searches.
 */
export class PooledPathfinder {
  #grid;#width;#height;#mask;#scores;#parents;#seen;#closed;#epoch=0;
  #heap=new ParallelFrontier();#active=false;
  constructor(grid){
    if(!(grid instanceof NavigationGrid))throw new TypeError('expected NavigationGrid');
    this.#grid=grid;this.#width=grid.width;this.#height=grid.height;
    const total=grid.width*grid.height;
    this.#mask=new Uint8Array(total);
    for(let z=0;z<grid.height;z++)for(let x=0;x<grid.width;x++){
      const at=z*grid.width+x;
      this.#mask[at]=Number(grid.walkable([x,z]));
    }
    this.#scores=new Float64Array(total);
    this.#parents=new Int32Array(total);
    this.#seen=new Uint32Array(total);
    this.#closed=new Uint32Array(total);
  }
  get grid(){return this.#grid;}
  get cells(){return this.#mask.length;}
  /** Exact result parity with navigation.findPath(), including expanded,
   * tie order, cost, blocked/budget/unreachable and fresh owned route cells. */
  findPath(start,goal,{maxExpanded=4096}={}){
    if(this.#active)throw new Error('PooledPathfinder cannot be used reentrantly');
    this.#active=true;
    try{return this.#search(start,goal,maxExpanded);}
    finally{this.#active=false;this.#heap.clear();}
  }
  #search(start,goal,maxExpanded){
    start=cell(start);goal=cell(goal);budget(maxExpanded);
    const width=this.#width,height=this.#height;
    const result=(status,expanded,path=[])=>({
      status,path,cost:status==='found'?(path.length-1)*this.#grid.cellSize:null,expanded
    });
    const valid=(x,z)=>x>=0&&z>=0&&x<width&&z<height;
    if(!valid(start[0],start[1])||!valid(goal[0],goal[1]))
      return result('blocked',0);
    const from=start[1]*width+start[0],to=goal[1]*width+goal[0];
    const mask=this.#mask;
    if(!mask[from]||!mask[to])return result('blocked',0);
    let epoch=++this.#epoch;
    if(epoch>=0xffffffff){
      this.#seen.fill(0);this.#closed.fill(0);
      epoch=this.#epoch=1;
    }
    const seen=this.#seen,closed=this.#closed,scores=this.#scores,
      parents=this.#parents,heap=this.#heap;
    const heuristic=index=>{
      const x=index%width,z=Math.floor(index/width);
      return Math.abs(x-goal[0])+Math.abs(z-goal[1]);
    };
    scores[from]=0;seen[from]=epoch;parents[from]=-1;
    heap.clear();
    const initialH=heuristic(from);
    heap.push(from,0,initialH);
    let expanded=0;
    while(heap.length){
      heap.pop();
      const current=heap.poppedIndex;
      if(closed[current]===epoch||heap.poppedG!==scores[current])continue;
      if(expanded===maxExpanded)return result('budget',expanded);
      closed[current]=epoch;expanded++;
      if(current===to){
        const path=[];
        for(let at=to;at!==-1;at=parents[at])
          path.push([at%width,Math.floor(at/width)]);
        path.reverse();
        return result('found',expanded,path);
      }
      const x=current%width,z=Math.floor(current/width),g=scores[current]+1;
      const relax=next=>{
        if(!mask[next]||closed[next]===epoch||
           (seen[next]===epoch&&g>=scores[next]))return;
        scores[next]=g;seen[next]=epoch;parents[next]=current;
        heap.push(next,g,heuristic(next));
      };
      // Same N,W,E,S cardinal expansion order as navigation.neighbours().
      if(z>0)relax(current-width);
      if(x>0)relax(current-1);
      if(x+1<width)relax(current+1);
      if(z+1<height)relax(current+width);
    }
    return result('unreachable',expanded);
  }
}
