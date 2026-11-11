// SPDX-License-Identifier: Apache-2.0
// GALAXY-inspired bounded resident spiral sampling, independently implemented
// using the engine's exact logical sampler. No GALAXY MPL source transplanted.
import {logicalIndex} from '../../modules/logical-sampling/index.js';
import {boxMeshBatch} from '../../modules/geometry/index.js';
export function galaxy(count=512){
  if(!Number.isInteger(count)||count<16||count>2048)throw new RangeError('resident stars 16..2048');
  const data=[];
  for(let i=0;i<count;i++){
    const id=Number(logicalIndex(16777216n,count,i)),u=((Math.imul(id^303,1664525)+1013904223)>>>0)/4294967296;
    const r=20+75*Math.sqrt((i+.5)/count),a=i*Math.PI+Math.log(r)*3+u*.5;
    data.push(Math.cos(a)*r,(u-.5)*22,Math.sin(a)*r,.35+u*.6,.5+u*.4,1);
  }
  return new Float32Array(data);
}
export function sphere(center,radius,segments=20){
  const out=[],rings=segments/2;
  const v=(i,j)=>{const a=i/segments*Math.PI*2,b=j/rings*Math.PI,p=[Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a)],k=.3+.7*Math.max(0,(p[0]+p[1]+p[2])/1.732);
    return [...p.map((x,n)=>center[n]+x*radius),.12*k,.5*k,.72*k];};
  for(let j=0;j<rings;j++)for(let i=0;i<segments;i++)out.push(...v(i,j),...v(i+1,j),...v(i+1,j+1),...v(i,j),...v(i+1,j+1),...v(i,j+1));
  return new Float32Array(out);
}
export function station(){
  const boxes=[{center:[0,0,0],size:[3,2,3],color:[.35,.55,.7]}];
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2;boxes.push({center:[Math.cos(a)*5,0,Math.sin(a)*5],size:[1.6,.7,1.6],color:[.35,.65,.72]});}
  return boxMeshBatch(boxes);
}
export function ship(w){
  const p=w.position,boxes=[{center:p,size:[1,.6,2.5],color:[.65,.8,.85]},
    {center:[p[0],p[1],p[2]+.5],size:[3,.2,.8],color:[.2,.5,.65]},
    ...w.shots.map(s=>({center:s.p,size:[.2,.2,.5],color:[1,.65,.2]}))];
  const data=boxMeshBatch(boxes),c=Math.cos(w.yaw),s=Math.sin(w.yaw);
  for(let i=0;i<72*6;i+=6){const x=data[i]-p[0],z=data[i+2]-p[2];data[i]=p[0]+c*x-s*z;data[i+2]=p[2]+s*x+c*z;}
  return data;
}
