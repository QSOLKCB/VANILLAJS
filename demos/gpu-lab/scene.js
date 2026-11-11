// SPDX-License-Identifier: Apache-2.0
// Demo-owned kinetic sculpture; bounded geometry, no simulation or GPU dependency.
import {boxMeshBatch} from '../../modules/geometry/index.js';
export const PATTERNS=Object.freeze(['ripple','conveyor','weave']);
export const SIZES=Object.freeze([8,12,16]);
export function createSculpture(pattern='ripple',size=8){
  if(!PATTERNS.includes(pattern)||!SIZES.includes(size))throw new RangeError('unknown sculpture preset or population');
  return {pattern,size,tick:0};
}
export function stepSculpture(state){state.tick++;}
export function sculpture(state){
  const {size,pattern,tick}=state;
  if(!SIZES.includes(size)||!PATTERNS.includes(pattern)||!Number.isSafeInteger(tick)||tick<0)throw new RangeError('invalid sculpture');
  const boxes=[],spacing=24/size,time=tick/60;
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
    const u=(x-(size-1)/2)*spacing,v=(z-(size-1)/2)*spacing;
    const wave=pattern==='ripple'?Math.sin(Math.hypot(u,v)*.55-time*2):pattern==='conveyor'?Math.sin(v*.6-time*2.4):Math.sin(u*.5+time)*Math.cos(v*.5-time);
    const height=1.1+(wave+1)*2.6;
    const color=pattern==='conveyor'?[1,.32+.27*(wave+1),.16]:pattern==='weave'?[.6+.17*wave,.35,.9]:[.13,.56+.15*wave,.7+.15*wave];
    boxes.push({center:[u,height/2,v],size:[spacing*.72,height,spacing*.72],color});
  }
  return boxMeshBatch(boxes);
}
export function plinth(){
  // Small floor facets avoid giant painter-sorted triangles covering pillars.
  const out=[],quad=(a,b,c,d,color)=>{for(const p of [a,b,c,a,c,d])out.push(...p,...color);};
  for(let z=-13.5;z<13.5;z+=1.5)for(let x=-13.5;x<13.5;x+=1.5)
    quad([x,-.1,z],[x+1.5,-.1,z],[x+1.5,-.1,z+1.5],[x,-.1,z+1.5],[.12,.18,.24]);
  for(let i=-13.5;i<13.5;i+=1.5){
    quad([i,-.1,13.5],[i+1.5,-.1,13.5],[i+1.5,-1.5,13.5],[i,-1.5,13.5],[.08,.12,.18]);
    quad([13.5,-.1,i],[13.5,-.1,i+1.5],[13.5,-1.5,i+1.5],[13.5,-1.5,i],[.1,.16,.21]);
    quad([i,-.1,-13.5],[i+1.5,-.1,-13.5],[i+1.5,-1.5,-13.5],[i,-1.5,-13.5],[.08,.12,.18]);
    quad([-13.5,-.1,i],[-13.5,-.1,i+1.5],[-13.5,-1.5,i+1.5],[-13.5,-1.5,i],[.1,.16,.21]);
  }
  return new Float32Array(out);
}
export function grid(){
  const out=[];for(let i=-12;i<=12;i+=3){out.push(i,-.08,-12,.24,.36,.45,i,-.08,12,.24,.36,.45,-12,-.08,i,.24,.36,.45,12,-.08,i,.24,.36,.45);}return new Float32Array(out);
}
