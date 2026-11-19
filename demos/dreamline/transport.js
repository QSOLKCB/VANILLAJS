// SPDX-License-Identifier: Apache-2.0
import {RATE,FRAMES} from './music.js';
export class DreamTransport {
  constructor(pcm){this.pcm=pcm;this.offset=0;this.running=false;this.generation=0;this.muted=false;}
  clock(){return this.silent?performance.now()/1000:this.context.currentTime;}
  sample(){return this.running?Math.min(FRAMES,this.offset+Math.max(0,Math.floor((this.clock()-this.anchor)*RATE))):this.offset;}
  pause(){this.offset=this.sample();this.running=false;this.generation++;
    if(this.source){this.source.stop();this.source.disconnect();this.source=null;}}
  async play(silent=false){
    if(this.running||this.offset===FRAMES)return;
    const token=++this.generation;
    if(!silent){
      this.context??=new AudioContext({sampleRate:RATE});
      await this.context.resume();
      if(token!==this.generation)return;
      if(!this.buffer){
        this.buffer=this.context.createBuffer(2,FRAMES,RATE);
        for(let ch=0;ch<2;ch++){const dest=this.buffer.getChannelData(ch);for(let i=0;i<FRAMES;i++)dest[i]=this.pcm[2*i+ch]/32768;}
        this.gain=this.context.createGain();this.gain.connect(this.context.destination);this.mute(this.muted);
      }
      this.source=this.context.createBufferSource();this.source.buffer=this.buffer;this.source.connect(this.gain);
      this.source.start(0,this.offset/RATE);
    }
    this.silent=silent;this.anchor=this.clock();this.running=true;
  }
  seek(n){if(!Number.isSafeInteger(n)||n<0||n>FRAMES)throw RangeError('Invalid sample');
    const resume=this.running;this.pause();this.offset=n;return resume?this.play(this.silent):Promise.resolve();}
  mute(value){this.muted=value;if(this.gain)this.gain.gain.value=value?0:1;}
  dispose(){this.pause();return this.context?.close();}
}
