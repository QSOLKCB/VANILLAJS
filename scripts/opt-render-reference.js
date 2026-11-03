// SPDX-License-Identifier: Apache-2.0
// Frozen geometry baseline from VANILLAJS v1.0.0, main a9d40685135a3480b4ccaad4e03607be833b05ec.
// Preserve independently of optimized view code; tooling only, never packaged.
import {boxVertices,ringVertices} from '../modules/render-webgl/index.js';
import {mechanismGeometry,consolePosition,progress,palette} from '../demos/clockwork-vault/world.js';
export function referenceGeometry(session){
  const vertices=[],lines=[],parts=mechanismGeometry(session);
  for(const part of parts){
    vertices.push(...boxVertices(part.center,part.size,part.color));
    if(part.id.startsWith('door-')){
      const [x,y,z]=part.center,w=part.size[0]*.36,h=1.4;
      vertices.push(...boxVertices([x,y,z+.27],[part.size[0]*.68,2.8,.035],[.25,.27,.18]));
      lines.push(x-w,y-h,z+.3,...palette.light,x+w,y+h,z+.3,...palette.light,
        x-w,y+h,z+.3,...palette.light,x+w,y-h,z+.3,...palette.light);
      lines.push(...ringVertices([x,y,z+.31],.4,palette.light,24));
    }else{
      const [x,y,z]=part.center;
      for(const dx of [-2.2,2.2])vertices.push(...boxVertices([x+dx,y+.27,z],[.09,.035,part.size[2]-.08],palette.light));
    }
  }
  const n=progress(session);
  for(let i=0;i<6;i++){
    const c=consolePosition(i),state=session.locks[i].snapshot(),color=i<n?[.62,.77,.43]:i===n?palette.light:[.32,.35,.25];
    lines.push(...ringVertices([c[0],c[1]+.5,c[2]-.06],.35,color,32));
    for(let bit=0;bit<16;bit++)vertices.push(...boxVertices([c[0]-.48+(bit%4)*.32,c[1]+.81-Math.floor(bit/4)*.20,c[2]-.07],[.14,.11,.04],state.word&(1<<(15-bit))?color:[.15,.19,.13]));
    if(i===n){lines.push(c[0],c[1]+1.2,c[2],...palette.light,c[0],c[1]+2.1,c[2],...palette.light);}
  }
  return {vertices,lines};
}
