// SPDX-License-Identifier: Apache-2.0
// Explicit 240-root E8 source geometry, adapted as an independently authored
// optional projection instrument. NOT a canonical 3D rendering of E8.
const RANK=8;
const PROJECTION=Object.freeze([
  Object.freeze([1,3,-2,5,0,1,-3,2]),
  Object.freeze([2,-1,4,0,3,-2,1,-5]),
  Object.freeze([-3,2,1,-4,2,5,0,1])
]);
export function generateE8Roots(){
  const roots=[];
  for(let i=0;i<RANK;i++)for(let j=i+1;j<RANK;j++){
    for(const si of [-1,1])for(const sj of [-1,1]){
      const v=Array(RANK).fill(0);v[i]=si;v[j]=sj;roots.push(v);
    }
  }
  for(let mask=0;mask<256;mask++){
    let minus=0;const root=[];
    for(let k=0;k<RANK;k++){
      const negative=(mask&(1<<k))!==0;
      if(negative)minus++;
      root.push(negative?-.5:.5);
    }
    if(minus%2===0)roots.push(root);
  }
  return roots;
}
/** Generate one point per root as bounded, owned XYZ/RGB Float32 interleaved
 * vertices. Projection weights are authored dyadic coefficients, not a
 * distance-, angle- or root-system-preserving embedding. */
export function projectE8RootPoints({scale=1}={}){
  if(!Number.isFinite(scale)||scale<=0||scale>1000)throw new RangeError('scale must be in (0,1000]');
  const roots=generateE8Roots(),out=new Float32Array(roots.length*6);
  for(let i=0;i<roots.length;i++){
    const root=roots[i],offset=i*6;
    for(let axis=0;axis<3;axis++){
      let sum=0;
      for(let k=0;k<RANK;k++)sum+=root[k]*PROJECTION[axis][k];
      out[offset+axis]=sum/8*scale;
    }
    const half=i>=112;
    out[offset+3]=half?.45:.85;
    out[offset+4]=half?.72:.58;
    out[offset+5]=half?.96:.25;
  }
  return out;
}
