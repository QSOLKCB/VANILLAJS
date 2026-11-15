// SPDX-License-Identifier: Apache-2.0
import {createEffectPlayer,createSoundtrackPlayer} from '../../../api/audio/index.js';
import {composeTrack,FX,ENGINES} from './score.js';
export class Audio{
  constructor(){this.track=composeTrack();this.enabled=false;this.failed=false;this.context=null;this.player=null;this.effects=null;this.band=-1;this.engine=null;this.lastSiren=-120;}
  async enable(value){this.enabled=value;if(!value){this.stop();return;}this.failed=false;
    try{if(!this.context){const Context=globalThis.AudioContext??globalThis.webkitAudioContext;if(!Context)throw new Error('Audio unavailable');this.context=new Context();this.player=createSoundtrackPlayer(this.context,this.track);this.effects=createEffectPlayer(this.context,{maxVoices:10,maxBuffers:24});}await this.context.resume();}catch{this.fail();}
  }
  fail(){this.failed=true;this.stop();}
  stopDriving(){try{this.player?.stop();}catch{}try{if(this.engine)this.effects?.stop(this.engine);}catch{}this.band=-1;this.engine=null;this.lastSiren=-120;}
  stop(){this.stopDriving();try{this.effects?.stopAll();}catch{}}
  tick(s){if(!this.enabled||this.failed||this.context?.state!=='running')return;
    try{for(const event of s.events)if(FX[event.type])this.effects.play(FX[event.type],{pan:event.pan??0});}catch{this.fail();}
  }
  frame(s,playing){if(!this.enabled||this.failed){this.stop();return;}
    if(!playing){if(['cleared','won','lost'].includes(s.mode))this.stopDriving();else this.stop();return;}
    if(this.context?.state!=='running')return;
    try{this.player.sync(s.tick);const band=Math.min(9,Math.floor(s.car.speed/11));if(band!==this.band){if(this.engine)this.effects.stop(this.engine);this.engine=this.effects.play(ENGINES[band],{loop:true,gain:.65});this.band=band;}
      if(s.mode==='contact'&&s.tick-this.lastSiren>=90){this.effects.play(FX.siren,{gain:.7});this.lastSiren=s.tick;}
    }catch{this.fail();}
  }
  snapshot(){return {enabled:this.enabled,failed:this.failed,state:this.context?.state??'unavailable',music:this.player?.snapshot()??null,effects:this.effects?.snapshot()??null};}
}
