// SPDX-License-Identifier: Apache-2.0
// Demo-owned exact reuse: OPT-INV-001 / OPT-INC-001. See docs/OPTIMIZATION.md.
import {boxVertices,ringVertices} from '../../modules/render-webgl/index.js';
import {mechanismGeometry,consolePosition,progress,palette} from './world.js';

export function captureVaultView(session){
  const n=progress(session);
  return {
    mechanisms:{light:[...palette.light],parts:mechanismGeometry(session).map(p=>({
      id:p.id,center:[...p.center],size:[...p.size],color:[...p.color]
    }))},
    consoles:Array.from({length:6},(_,i)=>({center:consolePosition(i),word:session.locks[i].snapshot().word,
      color:i<n?[.62,.77,.43]:i===n?[...palette.light]:[.32,.35,.25],active:i===n}))
  };
}
const geometry=(vertices,lines)=>Object.freeze({vertices:Object.freeze(vertices),lines:Object.freeze(lines)});
export function buildMechanisms({parts,light}){
  const vertices=[],lines=[];
  for(const part of parts){
    vertices.push(...boxVertices(part.center,part.size,part.color));
    if(part.id.startsWith('door-')){
      const [x,y,z]=part.center,w=part.size[0]*.36,h=1.4;
      vertices.push(...boxVertices([x,y,z+.27],[part.size[0]*.68,2.8,.035],[.25,.27,.18]));
      lines.push(x-w,y-h,z+.3,...light,x+w,y+h,z+.3,...light,
        x-w,y+h,z+.3,...light,x+w,y-h,z+.3,...light);
      lines.push(...ringVertices([x,y,z+.31],.4,light,24));
    }else{
      const [x,y,z]=part.center;
      for(const dx of [-2.2,2.2])vertices.push(...boxVertices([x+dx,y+.27,z],[.09,.035,part.size[2]-.08],light));
    }
  }
  return geometry(vertices,lines);
}
export function buildConsoles(consoles){
  const vertices=[],lines=[];
  for(const {center:c,word,color,active} of consoles){
    lines.push(...ringVertices([c[0],c[1]+.5,c[2]-.06],.35,color,32));
    for(let bit=0;bit<16;bit++)vertices.push(...boxVertices([c[0]-.48+(bit%4)*.32,c[1]+.81-Math.floor(bit/4)*.20,c[2]-.07],[.14,.11,.04],word&(1<<(15-bit))?color:[.15,.19,.13]));
    if(active)lines.push(c[0],c[1]+1.2,c[2],...color,c[0],c[1]+2.1,c[2],...color);
  }
  return geometry(vertices,lines);
}
export class VaultGeometry {
  #keys=null; #current=null;
  clear(){this.#keys=null;this.#current=null;}
  update(session){
    const inputs=captureVaultView(session),keys={mechanisms:JSON.stringify(inputs.mechanisms),consoles:JSON.stringify(inputs.consoles)};
    if(this.#keys?.mechanisms===keys.mechanisms&&this.#keys?.consoles===keys.consoles)return this.#current;
    // Build both candidates before committing. No consumer can mutate a hit.
    const mechanisms=this.#keys?.mechanisms===keys.mechanisms?this.#current.mechanisms:buildMechanisms(inputs.mechanisms);
    const consoles=this.#keys?.consoles===keys.consoles?this.#current.consoles:buildConsoles(inputs.consoles);
    const next=Object.freeze({mechanisms,consoles});
    this.#keys=keys;this.#current=next;return next;
  }
}
