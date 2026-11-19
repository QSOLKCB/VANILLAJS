// SPDX-License-Identifier: Apache-2.0
import {generateE8Roots} from '../../experiments/e8-geometry/index.js';
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
export const roots=generateE8Roots();
export const neighbors=roots.map(r=>roots.flatMap((s,i)=>dot(r,s)===1?[i]:[]));
// Fourier component of an order-30 Coxeter orbit. All reflections use roots of norm squared 2.
const simple=[[.5,-.5,-.5,-.5,-.5,-.5,-.5,.5],[1,1,0,0,0,0,0,0],
  ...Array.from({length:6},(_,i)=>Array.from({length:8},(_,j)=>Number(j===i+1)-Number(j===i)))];
function reflectCycle(v) {
  for(const r of simple){const d=dot(v,r);v=v.map((x,i)=>x-d*r[i]);}
  return v;
}
const axes=[Array(8).fill(0),Array(8).fill(0)];
let v=[1,0,0,0,0,0,0,0];
for(let i=0;i<30;i++) {
  const a=i*2*Math.PI/30;
  for(let j=0;j<8;j++){axes[0][j]+=v[j]*Math.cos(a);axes[1][j]+=v[j]*Math.sin(a);}
  v=reflectCycle(v);
}
export const projection=roots.map(r=>axes.map(axis=>dot(r,axis)/Math.hypot(...axis)));
export const walk=[0];
for(let i=0;i<303;i++){const edges=neighbors[walk[i]];walk.push(edges[(i*17+walk[i]+5)%edges.length]);}
export const support=n=>[n%101,n%3];
