// SPDX-License-Identifier: Apache-2.0
// Independent pure-JS implementation of the published mathematical contract
// in QSOLKCB/NEXUS@ac9ef5ac79008b46be3351c57cab946b93dd37e8
// docs/LATTICE.md (underlying NEXUS source is MPL-2.0).
// Integer, bounded, classical Z_4 state machine. This module's JS code is
// newly authored; NEXUS's Lean theorems do not constitute a proof of this JS.
const V=12,MAX_CELLS=256,MAX_ROUNDS=1024;
const uint32=(v,label)=>{
  if(!Number.isSafeInteger(v)||v<0||v>0xffffffff)
    throw new RangeError(label+' must be uint32');
  return v>>>0;
};
const checkedCells=cells=>{
  if(!Number.isSafeInteger(cells)||cells<2||cells>MAX_CELLS||cells%2)
    throw new RangeError('cells must be even in [2,256]');
  return cells;
};
const rotate7=x=>((x<<7)|(x>>>25))>>>0;
function stir(input){
  let n=input>>>0;
  n^=n>>>16;n=Math.imul(n,0x21f0aaad);
  n^=n>>>15;n=Math.imul(n,0x735a2d97);
  return (n^(n>>>15))>>>0;
}
function graphFromCoordinates(){
  const vertices=[];
  for(const x of [-1,0,1])for(const y of [-1,0,1])for(const z of [-1,0,1])
    if(Number(x===0)+Number(y===0)+Number(z===0)===1)vertices.push([x,y,z]);
  const edges=[],squared=(a,b)=>a.reduce((s,v,k)=>s+(v-b[k])**2,0);
  for(let i=0;i<V;i++)for(let j=i+1;j<V;j++)
    if(squared(vertices[i],vertices[j])===2)edges.push([i,j]);
  const edgeSet=new Set(edges.map(e=>e.join(','))),triangles=[];
  for(let i=0;i<V;i++)for(let j=i+1;j<V;j++)for(let k=j+1;k<V;k++)
    if(edgeSet.has(i+','+j)&&edgeSet.has(i+','+k)&&edgeSet.has(j+','+k))
      triangles.push([i,j,k]);
  const controlFace=edges.map(([a,b])=>{
    const owners=triangles.map((t,i)=>t.includes(a)&&t.includes(b)?i:-1).filter(i=>i!==-1);
    if(owners.length!==1)throw Error('invalid cuboctahedral edge face');
    return owners[0];
  });
  const colours=Array(edges.length).fill(-1);
  const occupied=Array.from({length:V},()=>[false,false,false,false]);
  function assign(edge){
    if(edge===edges.length)return true;
    const [a,b]=edges[edge];
    for(let c=0;c<4;c++){
      if(occupied[a][c]||occupied[b][c])continue;
      occupied[a][c]=occupied[b][c]=true;colours[edge]=c;
      if(assign(edge+1))return true;
      occupied[a][c]=occupied[b][c]=false;
      colours[edge]=-1;
    }
    return false;
  }
  if(vertices.length!==12||edges.length!==24||triangles.length!==8||!assign(0))
    throw Error('cuboctahedral derivation failed');
  for(let c=0;c<4;c++){
    const seen=new Set();
    for(let i=0;i<edges.length;i++)if(colours[i]===c)
      for(const v of edges[i]){if(seen.has(v))throw Error('matching overlap');seen.add(v);}
    if(seen.size!==V)throw Error('matching is not perfect');
  }
  return Object.freeze({vertices:vertices.map(v=>Object.freeze(v)),
    edges:edges.map(v=>Object.freeze(v)),triangles:triangles.map(v=>Object.freeze(v)),
    colours:Object.freeze(colours),controlFace:Object.freeze(controlFace)});
}
const GRAPH=graphFromCoordinates();
/** Caller receives owned graph arrays, not internal mutable tables. */
export function cuboctahedron(){
  return {vertices:GRAPH.vertices.map(v=>[...v]),
    edges:GRAPH.edges.map(v=>[...v]),triangles:GRAPH.triangles.map(v=>[...v]),
    colours:[...GRAPH.colours],controlFace:[...GRAPH.controlFace]};
}
function seedValue(seed,cell,vertex){
  const raw=(stir(seed^0x6e657875)+Math.imul(cell,0x9e3779b1)+
             Math.imul(vertex,0x7f4a7c15))>>>0;
  return stir(raw)&3;
}
function plan(seed,round){
  const h=stir(rotate7(seed)^Math.imul(round,0x2545f491)^0x734c4154);
  return {matching:h&3,flip:(h&4)!==0,face:(h>>>3)&7};
}
/** Bounded, reversible twelve-register Z4 lattice with six updates/cell/round.
 * No geometry buffers or rendering state; entirely CPU deterministic.
 * Forward: controlled local increments, then face swaps of disjoint cell pairs.
 * Backward: inverse swaps, then inverse local increments.
 */
export class NexusLattice{
  #seed;#cells;#round=0;#values;
  constructor({cells=6,seed=0x4e455853}={}){
    this.#seed=uint32(seed,'seed');this.#cells=checkedCells(cells);
    this.#values=Uint8Array.from({length:cells*V},
      (_,i)=>seedValue(this.#seed,Math.floor(i/V),i%V));
  }
  get cells(){return this.#cells;}
  get seed(){return this.#seed;}
  get round(){return this.#round;}
  registers(){return new Uint8Array(this.#values);}
  snapshot(){return {schema:'qsol-nexus-lattice/1',cells:this.#cells,
    seed:this.#seed,round:this.#round,registers:Array.from(this.#values)};}
  static fromSnapshot(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||
       Object.keys(value).sort().join(',')!=='cells,registers,round,schema,seed'||
       value.schema!=='qsol-nexus-lattice/1')
      throw new TypeError('unsupported lattice snapshot shape');
    // Explicit checks prevent undefined checkpoint fields from activating
    // constructor defaults and silently changing the reversible round plan.
    const cells=checkedCells(value.cells),seed=uint32(value.seed,'seed');
    const lattice=new NexusLattice({cells,seed});
    if(!Number.isSafeInteger(value.round)||value.round<0||value.round>MAX_ROUNDS)
      throw new RangeError('invalid lattice round');
    if(!Array.isArray(value.registers)||value.registers.length!==lattice.#values.length||
       !Array.from({length:value.registers.length},(_,i)=>
         Object.hasOwn(value.registers,i)&&Number.isInteger(value.registers[i])&&
         value.registers[i]>=0&&value.registers[i]<=3).every(Boolean))
      throw new RangeError('invalid lattice registers');
    lattice.#round=value.round;lattice.#values.set(value.registers);
    return lattice;
  }
  #local(round,inverse){
    const p=plan(this.#seed,round);
    const data=this.#values;
    for(let cell=0;cell<this.#cells;cell++){
      const base=cell*V;
      for(let edge=0;edge<GRAPH.edges.length;edge++){
        if(GRAPH.colours[edge]!==p.matching)continue;
        const [a,b]=GRAPH.edges[edge],control=p.flip?b:a,target=p.flip?a:b;
        const word=stir((this.#seed+Math.imul(round,0x27d4eb2f)+
          Math.imul(cell,0x165667b1)+
          Math.imul(GRAPH.controlFace[edge],0x9e3779b1))>>>0)%3;
        const delta=1+((data[base+control]+word+edge+cell)>>>0)%3;
        const i=base+target;
        data[i]=(data[i]+(inverse?4-delta:delta))&3;
      }
    }
  }
  #couple(round){
    const face=GRAPH.triangles[plan(this.#seed,round).face];
    for(let pair=0;pair<this.#cells/2;pair++){
      const first=(2*pair+(round&1))%this.#cells,second=(first+1)%this.#cells;
      for(const v of face){
        const a=first*V+v,b=second*V+v,old=this.#values[a];
        this.#values[a]=this.#values[b];this.#values[b]=old;
      }
    }
  }
  forward(rounds=1){
    if(!Number.isSafeInteger(rounds)||rounds<0||this.#round+rounds>MAX_ROUNDS)
      throw new RangeError('forward rounds exceed bounded lattice');
    for(let i=0;i<rounds;i++){
      this.#local(this.#round,false);this.#couple(this.#round);this.#round++;
    }
    return this;
  }
  rewind(rounds=1){
    if(!Number.isSafeInteger(rounds)||rounds<0||rounds>this.#round)
      throw new RangeError('cannot rewind before round zero');
    for(let i=0;i<rounds;i++){
      const r=--this.#round;this.#couple(r);this.#local(r,true);
    }
    return this;
  }
  mismatchesFromSeed(){
    let count=0;
    for(let i=0;i<this.#values.length;i++)
      count+=Number(this.#values[i]!==seedValue(this.#seed,Math.floor(i/V),i%V));
    return count;
  }
}
