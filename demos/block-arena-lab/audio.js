// SPDX-License-Identifier: Apache-2.0
import {createSound2D} from '../../modules/audio2d/index.js';
import {createEffectPlayer} from '../../api/audio/effects.js';
const scores=new Map();
function score(name){if(scores.has(name))return scores.get(name);const events=[],add=(channel,sample,duration,frequency,wave,gain)=>events.push({id:events.length+1,channel,sample,duration,frequency,wave,gain,seed:91+events.length});let frames=10000;
  if(name==='music'){frames=192000;for(let i=0;i<16;i++){add(0,i*12000,8500,[147,220,294,196,165,247,330,220][i%8],'triangle',1800);add(1,i*12000,2000,i%2?1400:65,i%2?'noise':'square',1400);}}
  else if(name==='shot'){add(0,0,3000,180,'saw',2500);add(1,0,2200,1600,'noise',1300);}
  else if(name==='damage'){add(0,0,7000,72,'triangle',4000);add(1,0,3500,600,'noise',2400);}
  else{add(0,0,4000,550,'triangle',3500);add(0,4000,6000,825,'triangle',3500);}
  const result=createSound2D({frames,events});scores.set(name,result);return result;
}
export class ArenaAudio {
  enabled=false;context=null;player=null;generation=0;
  async start(tick){const generation=++this.generation;if(!this.enabled)return;try{if(!this.context){this.context=new AudioContext();this.player=createEffectPlayer(this.context,{maxVoices:10,maxBuffers:4});}await this.context.resume();if(generation!==this.generation||!this.enabled)return;this.player.stopAll();this.player.play(score('music'),{loop:true,gain:.5,offset:(tick%240)/60});}catch{this.enabled=false;}}
  stop(){this.generation++;this.player?.stopAll();}
  events(events){if(!this.enabled||!this.player)return;for(const e of events)if(e.type==='shot'||e.type==='damage'||e.type==='pickup')this.player.play(score(e.type),{gain:e.source==='player'||e.target==='player'?1:.3});}
}
