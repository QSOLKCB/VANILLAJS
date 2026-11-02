// SPDX-License-Identifier: Apache-2.0
// Four-neighbour, uniform-cost navigation on an immutable X/Z occupancy grid.
const MAX_CELLS=65536;
function cell(value){
  if(!value || value.length!==2 || !Array.from(value).every(Number.isSafeInteger))throw new TypeError('cell must contain two safe integers');
  return Array.from(value);
}
function budget(value){if(!Number.isInteger(value)||value<1||value>MAX_CELLS)throw new RangeError('maxExpanded must be 1..65536');return value;}
function checkedGrid(grid){if(!(grid instanceof NavigationGrid))throw new TypeError('expected NavigationGrid');return grid;}
export class NavigationGrid {
  #blocked;
  constructor({width,height,cellSize=1,origin=[0,0],blocked=[]}={}){
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>MAX_CELLS)throw new RangeError('grid must contain 1..65536 cells');
    if(!Number.isFinite(cellSize)||cellSize<=0||!Number.isFinite(width*height*cellSize)||!origin||origin.length!==2||!Array.from(origin).every(Number.isFinite))throw new RangeError('invalid grid world bounds');
    origin=Array.from(origin);
    // Require distinct representable boundaries, including at the far edge.
    for(const [i,n] of [[0,width],[1,height]]){
      const end=origin[i]+n*cellSize;
      if(!Number.isFinite(n*cellSize)||!Number.isFinite(end)||cellSize/2===0||
        cellSize<4*Number.EPSILON*Math.max(Math.abs(origin[i]),Math.abs(end))||origin[i]+cellSize<=origin[i]||end-cellSize>=end)throw new RangeError('grid world bounds overflow');
    }
    if(!Array.isArray(blocked))throw new TypeError('blocked must be an array of cells');
    Object.assign(this,{width,height,cellSize,origin:Object.freeze(origin)});
    this.#blocked=new Uint8Array(width*height);
    for(const c of blocked){if(!this.contains(c))throw new RangeError('blocked cell outside grid');this.#blocked[c[1]*width+c[0]]=1;}
    Object.freeze(this);
  }
  contains(value){const [x,z]=cell(value);return x>=0&&z>=0&&x<this.width&&z<this.height;}
  walkable(value){return this.contains(value)&&!this.#blocked[value[1]*this.width+value[0]];}
  /** Copy-on-edit: existing paths still refer to the old grid snapshot. */
  withBlocked(cells,blocked=true){
    if(!Array.isArray(cells)||typeof blocked!=='boolean')throw new TypeError('expected cell array and boolean');
    for(const c of cells)if(!this.contains(c))throw new RangeError('edited cell outside grid');
    const next=new NavigationGrid(this);next.#blocked.set(this.#blocked);
    for(const c of cells)next.#blocked[c[1]*this.width+c[0]]=Number(blocked);
    return next;
  }
  worldToCell(position){
    if(!position||position.length!==2||!Array.from(position).every(Number.isFinite))throw new TypeError('position must contain finite X/Z');
    const c=Array.from(position,(v,i)=>Math.floor((v-this.origin[i])/this.cellSize));
    return c.every(Number.isSafeInteger)&&this.contains(c)?c:null;
  }
  cellCenter(value){
    if(!this.contains(value))throw new RangeError('cell outside grid');
    return Array.from(value,(v,i)=>this.origin[i]+(v+.5)*this.cellSize);
  }
}
const indexOf=(g,c)=>c[1]*g.width+c[0];
const fromIndex=(g,i)=>[i%g.width,Math.floor(i/g.width)];
function neighbours(g,index){
  const [x,z]=fromIndex(g,index);
  return [[x,z-1],[x-1,z],[x+1,z],[x,z+1]].filter(c=>g.walkable(c)).map(c=>indexOf(g,c));
}
// Binary min-heap, with a total order independent of insertion scheduling.
class Frontier {
  items=[];
  before(a,b){return a.f<b.f||(a.f===b.f&&(a.h<b.h||(a.h===b.h&&a.index<b.index)));}
  push(item){let i=this.items.length;this.items.push(item);while(i){const p=(i-1)>>1;if(!this.before(item,this.items[p]))break;this.items[i]=this.items[p];i=p;}this.items[i]=item;}
  pop(){const first=this.items[0],last=this.items.pop();if(this.items.length){let i=0;while(i*2+1<this.items.length){let c=i*2+1;if(c+1<this.items.length&&this.before(this.items[c+1],this.items[c]))c++;if(!this.before(this.items[c],last))break;this.items[i]=this.items[c];i=c;}this.items[i]=last;}return first;}
}
/** Shortest four-neighbour path. Budget exhaustion never returns a partial route. */
export function findPath(grid,start,goal,{maxExpanded=4096}={}){
  checkedGrid(grid);start=cell(start);goal=cell(goal);budget(maxExpanded);
  const result=(status,expanded,path=[])=>({status,path,cost:status==='found'?(path.length-1)*grid.cellSize:null,expanded});
  if(!grid.walkable(start)||!grid.walkable(goal))return result('blocked',0);
  const total=grid.width*grid.height,from=indexOf(grid,start),to=indexOf(grid,goal);
  const scores=new Float64Array(total).fill(Infinity),parents=new Int32Array(total).fill(-1),closed=new Uint8Array(total),heap=new Frontier();
  const heuristic=i=>{const c=fromIndex(grid,i);return Math.abs(c[0]-goal[0])+Math.abs(c[1]-goal[1]);};
  scores[from]=0;heap.push({index:from,g:0,h:heuristic(from),f:heuristic(from)});let expanded=0;
  while(heap.items.length){
    const item=heap.pop(),current=item.index;if(closed[current]||item.g!==scores[current])continue;
    if(expanded===maxExpanded)return result('budget',expanded);
    closed[current]=1;expanded++;
    if(current===to){const path=[];for(let i=to;i!==-1;i=parents[i])path.push(fromIndex(grid,i));return result('found',expanded,path.reverse());}
    for(const next of neighbours(grid,current)){
      const g=scores[current]+1;if(closed[next]||g>=scores[next])continue;
      scores[next]=g;parents[next]=current;const h=heuristic(next);heap.push({index:next,g,h,f:g+h});
    }
  }
  return result('unreachable',expanded);
}
/** Compact reachable destinations in breadth-first order from the anchor.
 * Excluded cells may be traversed but cannot become a destination. */
export function formationSlots(grid,anchor,count,{exclude=[],maxExpanded=4096}={}){
  checkedGrid(grid);anchor=cell(anchor);budget(maxExpanded);
  if(!Number.isInteger(count)||count<1||count>256)throw new RangeError('formation size must be 1..256');
  if(!Array.isArray(exclude))throw new TypeError('exclude must be an array');
  const excluded=new Set(exclude.map(c=>{if(!grid.contains(c))throw new RangeError('excluded cell outside grid');return indexOf(grid,c);}));
  if(!grid.walkable(anchor))return {status:'blocked',slots:[],expanded:0};
  const visited=new Uint8Array(grid.width*grid.height),queue=[indexOf(grid,anchor)],slots=[];visited[queue[0]]=1;let expanded=0;
  while(expanded<queue.length&&expanded<maxExpanded){
    const current=queue[expanded++];if(!excluded.has(current))slots.push(fromIndex(grid,current));
    if(slots.length===count)return {status:'found',slots,expanded};
    for(const next of neighbours(grid,current))if(!visited[next]){visited[next]=1;queue.push(next);}
  }
  return {status:expanded<queue.length?'budget':'partial',slots,expanded};
}
