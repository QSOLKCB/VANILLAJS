// SPDX-License-Identifier: Apache-2.0
// Fixed rendering workloads, not a simulated performance claim about player input.
import {createVault} from '../demos/clockwork-vault/world.js';
import {solvePuzzle} from '../demos/clockwork-vault/puzzles.js';
export const FRAME_COUNT=240;
export const WORKLOADS=['idle','opening-gate','working-console','cycling-lift','changing-both'];
export function releaseForView(session,index){
  const lock=session.locks[index];
  for(const command of solvePuzzle(index).commands){
    if(command===0){for(let i=0;i<8;i++)lock.detent();}else lock.lever(command);
  }
  session.sealedAt[index]=0;
}
export function* viewWorkload(name,frames=FRAME_COUNT){
  if(!WORKLOADS.includes(name))throw new RangeError('Unknown rendering workload');
  const session=createVault();
  if(name==='opening-gate')releaseForView(session,0);
  if(name==='cycling-lift'||name==='changing-both')for(let i=0;i<5;i++)releaseForView(session,i);
  if(name==='working-console')session.locks[0].turn();
  for(let i=0;i<frames;i++){
    session.ticks=i*4;
    session.mechanismTick=name==='cycling-lift'?960+i*4:name==='changing-both'?1200+i:i;
    if(name==='changing-both')session.locks[5].lever(1);
    if(name==='working-console'){
      for(let n=0;n<4;n++)session.locks[0].tick();
      if(i%30===29){session.locks[0].lever(1);session.locks[0].turn();}
    }
    yield session;
  }
}
