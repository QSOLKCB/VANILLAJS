// SPDX-License-Identifier: Apache-2.0
import {DemoPlayer} from './player.js';
import {machineRemembers} from './preset.js';
/** Opt-in original intro. Call start from a gesture; skip/dispose own all nodes.
 * The consumer owns the main menu. No game integration or network side effects.
 */
export function createIntro(canvas,{project=machineRemembers(),enabled=true,onComplete=()=>{}}={}){
  let player=null,frame=0,finished=false;
  const finish=()=>{if(finished)return;finished=true;cancelAnimationFrame(frame);if(player)void player.dispose();onComplete();};
  const tick=()=>{if(finished)return;player.draw();if(player.transport.sample===2880000)finish();else frame=requestAnimationFrame(tick);};
  return {async start(){if(finished)return;if(!enabled){finish();return;}player??=new DemoPlayer(canvas,project);await player.transport.play();if(!finished)tick();},skip:finish,dispose(){finished=true;cancelAnimationFrame(frame);if(player)void player.dispose();}};
}
