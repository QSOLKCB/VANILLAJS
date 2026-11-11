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
// Faceted ocean/land body: deterministic colour, baked directional light.
export function sphere(center,radius,segments=24){
  if(!Number.isInteger(segments)||segments<8||segments>48||segments%2)throw new RangeError('even planet segments 8..48');
  const out=[],rings=segments/2;
  const vertex=(i,j)=>{const a=i/segments*Math.PI*2,b=j/rings*Math.PI,p=[Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a)];
    const land=Math.sin(p[0]*6+p[2]*3)+Math.sin(p[2]*8-p[1]*5)*.55;
    const base=Math.abs(p[1])>.87?[.8,.87,.87]:land>.55?[.18,.48,.37]:land>.35?[.55,.56,.36]:[.09,.29,.52];
    const light=.2+.8*Math.max(0,(p[0]+p[1]+p[2])*.577);
    return [...p.map((v,n)=>center[n]+v*radius),...base.map(c=>c*light)];};
  for(let j=0;j<rings;j++)for(let i=0;i<segments;i++)out.push(...vertex(i,j),...vertex(i+1,j),...vertex(i+1,j+1),...vertex(i,j),...vertex(i+1,j+1),...vertex(i,j+1));
  return new Float32Array(out);
}
export function ring(center,radius,color=[.3,.7,.8],plane='xy',segments=48){
  const out=[],p=a=>plane==='xz'?[center[0]+Math.cos(a)*radius,center[1],center[2]+Math.sin(a)*radius]:[center[0]+Math.cos(a)*radius,center[1]+Math.sin(a)*radius,center[2]];
  for(let i=0;i<segments;i++)out.push(...p(i/segments*Math.PI*2),...color,...p((i+1)/segments*Math.PI*2),...color);
  return new Float32Array(out);
}
export function station(){
  const boxes=[];
  // An open arrival aperture, segmented pressure hull and paired solar arrays.
  for(let i=0;i<16;i++){
    const a=i/16*Math.PI*2;
    boxes.push({center:[Math.cos(a)*4,Math.sin(a)*4,0],size:[1.45,1.45,1.8],color:i%4===0?[.85,.58,.23]:[.44,.59,.66]});
  }
  boxes.push({center:[0,-4.2,-1],size:[13,.5,.6],color:[.35,.48,.52]},
    {center:[0,4.5,-.2],size:[2,1,2.8],color:[.55,.65,.7]});
  for(const side of [-1,1])for(let i=0;i<3;i++){
    boxes.push({center:[side*(6.5+i*1.6),0,-.8],size:[1.4,6,.18],color:[.08,.25,.48]},
      {center:[side*(6.5+i*1.6),0,-.65],size:[.12,6.15,.12],color:[.5,.7,.8]});
  }
  return boxMeshBatch(boxes);
}
const hull=(()=>{
  const data=Array.from(boxMeshBatch([
    {center:[0,0,0],size:[.9,.55,2.3],color:[.78,.82,.8]},
    {center:[0,.36,-.3],size:[.6,.25,.95],color:[.12,.6,.75]},
    {center:[-1,-.08,.55],size:[1.5,.16,.7],color:[.4,.54,.65]},
    {center:[1,-.08,.55],size:[1.5,.16,.7],color:[.4,.54,.65]},
    {center:[-.47,0,1.25],size:[.3,.36,.28],color:[1,.48,.15]},
    {center:[.47,0,1.25],size:[.3,.36,.28],color:[1,.48,.15]},
  ]));
  const tip=[0,0,-2],a=[-.45,-.275,-1.15],b=[.45,-.275,-1.15],c=[.45,.275,-1.15],d=[-.45,.275,-1.15];
  for(const [face,color] of [[[a,b,tip],[.5,.6,.64]],[[b,c,tip],[.64,.7,.73]],[[c,d,tip],[.9,.92,.87]],[[d,a,tip],[.42,.5,.54]]])for(const p of face)data.push(...p,...color);
  return new Float32Array(data);
})();
export function ship(w){
  const data=hull.slice(),c=Math.cos(w.yaw),s=Math.sin(w.yaw),p=w.position;
  for(let i=0;i<data.length;i+=6){const x=data[i],z=data[i+2];data[i]=p[0]+c*x-s*z;data[i+1]+=p[1];data[i+2]=p[2]+s*x+c*z;}
  return data;
}
export function projectiles(w){return boxMeshBatch(w.shots.map(s=>({center:s.p,size:[.55,.18,.18],color:[1,.72,.25]})));}
export function trail(points){const out=[];for(let i=1;i<points.length;i++){const k=.25+.65*i/points.length;out.push(...points[i-1],.12*k,.8*k,.9*k,...points[i],.12*k,.8*k,.9*k);}return new Float32Array(out);}
