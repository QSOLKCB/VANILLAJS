// SPDX-License-Identifier: Apache-2.0
import {createSound2D} from '../../modules/audio2d/index.js';
import {createEffectPlayer} from '../../api/audio/effects.js';
const scores=new Map();
export function foundryScore(name) {
  if(scores.has(name))return scores.get(name);
  const events=[],add=(channel,sample,duration,frequency,wave,gain,seed=19)=>events.push({id:events.length+1,channel,sample,duration,frequency,wave,gain,seed});
  let frames=12000;
  if(['forge','pulse'].includes(name)) {
    frames=192000;const notes=name==='forge'?[220,330,294,440,220,196,330,294]:[262,392,349,524,392,349,294,196];
    for(let i=0;i<16;i++) {
      add(0,i*12000,10000,notes[i%8],'triangle',2200);
      add(1,i*12000,8000,i%4<2?55:73,'square',1500);
      add(2,i*12000,i%2?2200:4500,i%2?180:60,i%2?'noise':'triangle',i%2?1600:4000,i+17);
      add(3,i*12000+6000,800,1600,'noise',900,i+71);
    }
  } else if(name==='shot') {frames=5000;add(0,0,2700,220,'saw',2800);add(1,0,4000,2000,'noise',1800);}
  else if(name==='hit') {add(0,0,8000,78,'triangle',7500);add(1,0,4200,360,'noise',5000);}
  else if(name==='knockout') {add(0,0,12000,49,'saw',6500);add(1,0,8000,100,'noise',4000);}
  else if(name==='pickup') {add(0,0,4000,440,'triangle',5000);add(0,4000,8000,660,'triangle',5000);}
  else throw new RangeError('unknown sound');
  const score=createSound2D({frames,events});scores.set(name,score);return score;
}
export class FoundryAudio {
  context=null;player=null;enabled=false;generation=0;
  async start(music,tick) {
    const generation=++this.generation;
    if(!this.enabled)return;
    try {
      if(!this.context){this.context=new AudioContext();this.player=createEffectPlayer(this.context,{maxVoices:12,maxBuffers:8});}
      await this.context.resume();if(generation!==this.generation||!this.enabled)return;
      this.player.stopAll();this.player.play(foundryScore(music),{loop:true,gain:.55,offset:(tick%240)/60});
    }catch {this.enabled=false;}
  }
  events(events) {if(!this.enabled||!this.player)return;for(const e of events){
    const name=e.type==='hit'&&e.damage?'hit':['shot','knockout','pickup'].includes(e.type)?e.type:null;
    if(name)this.player.play(foundryScore(name),{gain:e.source===1||e.actor===1?1:.65});
  }}
  stop(){this.generation++;this.player?.stopAll();}
}
