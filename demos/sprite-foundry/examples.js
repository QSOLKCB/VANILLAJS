// SPDX-License-Identifier: Apache-2.0
import {generateSprite} from '../../modules/sprite2d/index.js';
export const palettes={
  relay:[[0,0,0,0],[68,61,111,255],[145,119,181,255],[246,197,91,255],[255,244,211,255]],
  garden:[[0,0,0,0],[35,83,76,255],[88,144,100,255],[199,218,119,255],[245,244,199,255]],
  signal:[[0,0,0,0],[40,65,104,255],[68,143,172,255],[253,137,107,255],[249,238,217,255]]
};
export const examples=Object.freeze([
  {id:'relay-cadet',name:'Relay Cadet',kind:'character',seed:26311,palette:'relay',symmetry:true},
  {id:'moss-guardian',name:'Moss Guardian',kind:'enemy',seed:40127,palette:'garden',symmetry:true},
  {id:'signal-tool',name:'Signal Tool',kind:'weapon',seed:6271,palette:'signal',symmetry:false},
  {id:'sun-token',name:'Sun Token',kind:'item',seed:716,palette:'relay',symmetry:false},
  {id:'garden-edge',name:'Garden Edge',kind:'terrain',seed:9281,palette:'garden',symmetry:false},
  {id:'signal-spark',name:'Signal Spark',kind:'particle',seed:287,palette:'signal',symmetry:false},
  {id:'relay-impact',name:'Relay Impact',kind:'impact',seed:345,palette:'relay',symmetry:false}
]);
export function exampleSprite(id='relay-cadet'){
  const spec=examples.find(e=>e.id===id);
  if(!spec)throw new RangeError('Unknown original sprite example');
  return generateSprite({kind:spec.kind,size:16,seed:spec.seed,symmetry:spec.symmetry,frameCount:4,palette:palettes[spec.palette]},{name:spec.name});
}
