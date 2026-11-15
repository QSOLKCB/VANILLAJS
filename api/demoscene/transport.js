// SPDX-License-Identifier: Apache-2.0
import {demoSample,DEMO_RATE,DEMO_SAMPLES} from '../../modules/demo-timeline/index.js';
/** Browser adapter. The context clock estimates canonical sample position;
 * device resampling, output latency and speakers are explicitly noncanonical.
 */
export class SampleAudioTransport {
  constructor(audio,{contextFactory=()=>new AudioContext({sampleRate:DEMO_RATE})}={}){
    if(audio.frames!==DEMO_SAMPLES||audio.sampleRate!==DEMO_RATE)throw new TypeError('60 second 48 kHz soundtrack required');
    this.audio=audio;this.contextFactory=contextFactory;this.context=null;this.source=null;this.buffer=null;this.gain=null;this.offset=0;this.anchor=0;this.playing=false;this.generation=0;this.muted=false;this.starts=0;this.stops=0;
  }
  get sample(){return this.playing?Math.min(DEMO_SAMPLES,this.offset+Math.max(0,Math.floor((this.context.currentTime-this.anchor)*DEMO_RATE))):this.offset;}
  stopNode(){if(this.source){const node=this.source;this.source=null;node.onended=null;node.stop();node.disconnect();this.stops++;}}
  pause(){this.offset=this.sample;this.playing=false;++this.generation;this.stopNode();return this.offset;}
  seek(sample){demoSample(sample);const resume=this.playing;this.pause();this.offset=sample;return resume&&sample<DEMO_SAMPLES?this.play():Promise.resolve();}
  async play(){
    if(this.playing)return;const token=++this.generation;
    if(!this.context){this.context=this.contextFactory();this.gain=this.context.createGain();this.gain.connect(this.context.destination);this.gain.gain.value=this.muted?0:.7;}
    await this.context.resume();if(token!==this.generation)return;
    if(!this.buffer){const pcm=this.audio.renderRange(0,DEMO_SAMPLES);this.buffer=this.context.createBuffer(1,DEMO_SAMPLES,DEMO_RATE);const channel=this.buffer.getChannelData(0);for(let i=0;i<pcm.length;i++)channel[i]=pcm[i]/32768;}
    if(this.offset===DEMO_SAMPLES)this.offset=0;
    this.stopNode();const source=this.context.createBufferSource();source.buffer=this.buffer;source.connect(this.gain);this.source=source;this.anchor=this.context.currentTime;this.playing=true;source.onended=()=>{if(this.source!==source)return;this.offset=DEMO_SAMPLES;this.playing=false;this.source=null;source.disconnect();};
    source.start(0,this.offset/DEMO_RATE);this.starts++;
  }
  async restart(){this.pause();this.offset=0;await this.play();}
  mute(value){this.muted=Boolean(value);if(this.gain)this.gain.gain.value=this.muted?0:.7;}
  async dispose(){this.pause();if(this.context)await this.context.close();this.context=null;this.buffer=null;}
}
