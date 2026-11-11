// SPDX-License-Identifier: Apache-2.0
// Exact finite-field mechanics. These are classical states, not amplitudes.
export const MAX_DIMENSION=8;
export const MAX_GRAPH_DIMENSION=4;
const transforms=new WeakSet();
const frozen=Object.freeze;
function trit(x){
  if(!Number.isInteger(x)||x<0||x>2||Object.is(x,-0))
    throw new RangeError('GF(3) element must be 0, 1 or 2');
  return x;
}
function dense(value,max){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||
    value.length<1||value.length>max||Reflect.ownKeys(value).length!==value.length+1)
    throw new TypeError('bounded nonempty dense array required');
  const d=Object.getOwnPropertyDescriptors(value);
  return Array.from({length:value.length},(_,i)=>{
    if(!Object.hasOwn(d,i)||!Object.hasOwn(d[i],'value'))
      throw new TypeError('array elements must be own data');
    return d[i].value;
  });
}
export const add3=(a,b)=>(trit(a)+trit(b))%3;
export const subtract3=(a,b)=>(trit(a)+3-trit(b))%3;
export const multiply3=(a,b)=>trit(a)*trit(b)%3;
export function stateVector(input){return frozen(dense(input,MAX_DIMENSION).map(trit));}
export function ternaryMatrix(input){
  const rows=dense(input,MAX_DIMENSION).map(stateVector);
  if(rows.some(r=>r.length!==rows[0].length))throw new RangeError('ragged matrix');
  return frozen(rows);
}
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0)%3;
export function matrixVector(input,state){
  const a=ternaryMatrix(input),x=stateVector(state);
  if(a[0].length!==x.length)throw new RangeError('matrix/vector dimensions differ');
  return frozen(a.map(row=>dot(row,x)));
}
export function matrixProduct(left,right){
  const a=ternaryMatrix(left),b=ternaryMatrix(right);
  if(a[0].length!==b.length)throw new RangeError('matrix dimensions differ');
  return frozen(a.map(row=>frozen(b[0].map((_,j)=>dot(row,b.map(r=>r[j]))))));
}
export function inverseMatrix(input){
  const a=ternaryMatrix(input),n=a.length;
  if(a[0].length!==n)throw new RangeError('square matrix required');
  const rows=a.map((r,i)=>[...r,...Array.from({length:n},(_,j)=>Number(i===j))]);
  for(let col=0;col<n;col++){
    const pivot=rows.findIndex((r,i)=>i>=col&&r[col]!==0);
    if(pivot<0)throw new RangeError('singular GF(3) matrix');
    [rows[col],rows[pivot]]=[rows[pivot],rows[col]];
    const scale=rows[col][col]; // 1^-1=1 and 2^-1=2 in GF(3).
    rows[col]=rows[col].map(v=>v*scale%3);
    for(let i=0;i<n;i++)if(i!==col){
      const factor=rows[i][col];
      rows[i]=rows[i].map((v,j)=>(v+6-factor*rows[col][j])%3);
    }
  }
  return frozen(rows.map(r=>frozen(r.slice(n))));
}
/** Only invertible square affine maps are admitted. Copies before returning. */
export function affineTransform(id,matrix,offset){
  if(typeof id!=='string'||! /^[a-z][a-z0-9-]{0,31}$/.test(id))
    throw new TypeError('canonical transform ID required');
  const a=ternaryMatrix(matrix),b=stateVector(offset),inverse=inverseMatrix(a);
  if(b.length!==a.length)throw new RangeError('affine dimensions differ');
  const result=frozen({id,matrix:a,offset:b,inverse});transforms.add(result);return result;
}
function genuine(op){
  if(!transforms.has(op))throw new TypeError('compiled affine transform required');
  return op;
}
export function applyAffine(op,state){
  genuine(op);return frozen(matrixVector(op.matrix,state).map((v,i)=>(v+op.offset[i])%3));
}
export function invertAffine(op){
  genuine(op);
  return affineTransform(op.id,op.inverse,matrixVector(op.inverse,op.offset).map(v=>(3-v)%3));
}
/** H*x over GF(3). No correction/quantum-code claim. */
export const syndrome=matrixVector;
export function transition(op,state,tick){
  genuine(op);
  if(!Number.isSafeInteger(tick)||tick<1||tick>1000000)throw new RangeError('tick out of range');
  const before=stateVector(state),after=applyAffine(op,before);
  return frozen({kind:'qsol.gf3.transition.v1',tick,operation:op.id,before,after,
    id:`${tick}:${op.id}:${before.join('')}>${after.join('')}`});
}
/** Directed labelled multigraph, including loops; not an ExactGraph simple graph. */
export function transitionGraph(operations){
  const ops=dense(operations,8).map(genuine),n=ops[0].offset.length;
  if(n>MAX_GRAPH_DIMENSION||ops.some(o=>o.offset.length!==n)||
    new Set(ops.map(o=>o.id)).size!==ops.length)throw new RangeError('graph dimension/ID budget');
  const states=Array.from({length:3**n},(_,id)=>
    frozen(Array.from({length:n},(_,i)=>Math.floor(id/3**i)%3)));
  const edges=[];
  for(let from=0;from<states.length;from++)for(const op of ops){
    const after=applyAffine(op,states[from]);
    edges.push(frozen({from,to:after.reduce((v,x,i)=>v+x*3**i,0),operation:op.id}));
  }
  return frozen({states:frozen(states),edges:frozen(edges)});
}
