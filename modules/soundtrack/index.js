// SPDX-License-Identifier: Apache-2.0
// Multi-phrase integer PCM sequencing, generalised from SubHunt v0.2.0.
import {createSound2D,AUDIO2D_RATE} from '../audio2d/index.js';
const brands=new WeakSet();
const integer=(n,min,max,label)=>{if(!Number.isSafeInteger(n)||n<min||n>max)throw new RangeError(label);return n;};
/** Owned audio2d phrases; <=8 phrases, <=64 seconds, integer samples per tick. */
export function createSoundtrack({phrases,tickRate=60}={}){
  integer(tickRate,1,AUDIO2D_RATE,'tickRate');
  if(AUDIO2D_RATE%tickRate)throw new RangeError('tickRate must divide 48000');
  if(!Array.isArray(phrases)||phrases.length<1||phrases.length>8)throw new RangeError('1 to 8 phrases required');
  const samplesPerTick=AUDIO2D_RATE/tickRate;
  const sounds=Array.from(phrases,p=>{
    if(!p||typeof p!=='object'||Array.isArray(p)||!Number.isSafeInteger(p.frames)||!Array.isArray(p.events))throw new TypeError('phrase requires frames and events');
    const sound=createSound2D(p);if(sound.frames%samplesPerTick)throw new RangeError('phrase must end on a tick boundary');return sound;
  });
  const starts=[];let frames=0;for(const sound of sounds){starts.push(frames);frames+=sound.frames;}
  const locate=sample=>{let phrase=sounds.length-1;while(starts[phrase]>sample)phrase--;return {phrase,offsetSamples:sample-starts[phrase]};};
  const result=Object.freeze({frames,sampleRate:AUDIO2D_RATE,tickRate,samplesPerTick,phraseCount:sounds.length,loopTicks:frames/samplesPerTick,
    position(tick){
      integer(tick,0,Number.MAX_SAFE_INTEGER,'tick');
      // Reduce before multiplication, avoiding precision loss even at MAX_SAFE_INTEGER ticks.
      const cycleSample=(tick%(frames/samplesPerTick))*samplesPerTick;
      return Object.freeze({...locate(cycleSample),cycleSample});
    },
    phraseFrames(index){integer(index,0,sounds.length-1,'phrase');return sounds[index].frames;},
    score(index){integer(index,0,sounds.length-1,'phrase');return {frames:sounds[index].frames,events:sounds[index].eventSummary()};},
    renderPhrase(index){integer(index,0,sounds.length-1,'phrase');return sounds[index].renderAll();},
    renderRange(start,count){
      integer(start,0,frames,'start');integer(count,0,frames-start,'count');const pcm=new Int16Array(count);
      let written=0;
      while(written<count){const {phrase,offsetSamples}=locate(start+written),size=Math.min(count-written,sounds[phrase].frames-offsetSamples);pcm.set(sounds[phrase].renderRange(offsetSamples,size),written);written+=size;}
      return pcm;
    },
    wav(){
      const pcm=this.renderRange(0,frames),bytes=new Uint8Array(44+frames*2),v=new DataView(bytes.buffer);
      const ascii=(offset,s)=>{for(let i=0;i<s.length;i++)v.setUint8(offset+i,s.charCodeAt(i));};
      ascii(0,'RIFF');v.setUint32(4,36+frames*2,true);ascii(8,'WAVE');ascii(12,'fmt ');
      v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,AUDIO2D_RATE,true);
      v.setUint32(28,AUDIO2D_RATE*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);ascii(36,'data');v.setUint32(40,frames*2,true);
      for(let i=0;i<pcm.length;i++)v.setInt16(44+i*2,pcm[i],true);return bytes;
    }
  });
  brands.add(result);return result;
}
export function isSoundtrack(value){return brands.has(value);}
