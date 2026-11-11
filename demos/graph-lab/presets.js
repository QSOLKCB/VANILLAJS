// SPDX-License-Identifier: Apache-2.0
import {ExactGraph} from '../../modules/exact-graph/index.js';
export const PRESETS=Object.freeze({
  grid:'3 × 3 grid · D4 symmetry',path:'Path · 8 vertices',complete:'Complete · 6 vertices',
  star:'Star K₁,₄ · cospectral pair',cycle:'Cycle C₄ + isolated vertex',empty:'Empty graph'
});
export function presetGraph(name){
  if(name==='grid')return new ExactGraph(9,[...Array.from({length:9},(_,i)=>i).filter(i=>i%3<2).map(i=>[i,i+1]),...Array.from({length:6},(_,i)=>[i,i+3])]);
  if(name==='path')return new ExactGraph(8,Array.from({length:7},(_,i)=>[i,i+1]));
  if(name==='complete')return new ExactGraph(6,Array.from({length:6},(_,i)=>Array.from({length:5-i},(_,j)=>[i,i+j+1])).flat());
  if(name==='star')return new ExactGraph(5,[[0,1],[0,2],[0,3],[0,4]]);
  if(name==='cycle')return new ExactGraph(5,[[0,1],[1,2],[2,3],[3,0]]);
  if(name==='empty')return new ExactGraph(0,[]);
  throw new TypeError('unknown graph preset');
}
