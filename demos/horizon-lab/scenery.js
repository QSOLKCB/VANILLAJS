// SPDX-License-Identifier: Apache-2.0
// Cape Aster is an authored HORIZON Lab world, not an engine default.
import {SCENIC_FORMAT,validateScenery} from '../../modules/scenic3d/index.js';

export function createCapeAsterScenery(){
  const xyz=[
    [0,4,0],[0,5,-35],[-12,8,-75],[-38,16,-112],[-42,24,-155],
    [-15,27,-195],[27,26,-230],[50,19,-270],[39,13,-315],
    [8,10,-355],[-20,14,-395],[-8,21,-435],[27,28,-475]
  ];
  const banks=[0,.02,.08,.13,.09,-.05,-.12,-.1,.03,.09,.04,-.05,0];
  return validateScenery({
    format:SCENIC_FORMAT,version:1,name:'Cape Aster — the high road',
    seed:7331,profile:'high',environment:'coast',
    road:xyz.map(([x,y,z],i)=>({
      id:'span-'+i,x,y,z,width:i===0?10:9,bank:banks[i],
      structure:i===4||i===5?'bridge':i===8||i===9?'tunnel':'ground',
      surface:'asphalt'
    }))
  });
}
