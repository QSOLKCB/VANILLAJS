// SPDX-License-Identifier: Apache-2.0
// Explicit Web Audio presentation; the caller owns gesture, pause and focus policy.
import {isSoundtrack} from '../../modules/soundtrack/index.js';
export function createSoundtrackPlayer(context,track){
  if(!isSoundtrack(track))throw new TypeError('createSoundtrack result required');
  for(let i=0;i<track.phraseCount;i++)if(track.phraseFrames(i)<track.sampleRate/4)throw new RangeError('playback phrases must be at least 250 ms');
  if(!context||typeof context.createBuffer!=='function'||typeof context.createBufferSource!=='function')throw new TypeError('AudioContext required');
  const cache=new Map(),voices=new Set();let anchor=null,next=null,started=0,resyncs=0,disposed=false,lastTick=null;
  function stop(){for(const v of voices){v.onended=null;v.stop();v.disconnect();}voices.clear();anchor=null;next=null;}
  function buffer(index){
    if(!cache.has(index)){const pcm=track.renderPhrase(index),b=context.createBuffer(1,pcm.length,track.sampleRate),out=b.getChannelData(0);for(let i=0;i<pcm.length;i++)out[i]=pcm[i]/32768;cache.set(index,b);}
    return cache.get(index);
  }
  function schedule(b,when,offset){
    const v=context.createBufferSource();v.buffer=b;v.connect(context.destination);
    v.onended=()=>{voices.delete(v);v.disconnect();};
    try{v.start(when,offset);}catch(error){v.disconnect();throw error;}
    voices.add(v);started++;
  }
  return Object.freeze({
    sync(tick,enabled=true){
      if(disposed)throw new Error('player disposed');
      const pos=track.position(tick),previousTick=lastTick;lastTick=tick;
      if(!enabled||context.state!=='running'){stop();return;}
      try{
        // Device time affects presentation only, never notes or the caller's tick.
        if(anchor&&(tick<previousTick||Math.abs((tick-anchor.tick)/track.tickRate-(context.currentTime-anchor.time))>.12)){stop();resyncs++;}
        if(!anchor){
          const b=buffer(pos.phrase);anchor={tick,time:context.currentTime+.025};schedule(b,anchor.time,pos.offsetSamples/track.sampleRate);
          next={phrase:(pos.phrase+1)%track.phraseCount,time:anchor.time+(track.phraseFrames(pos.phrase)-pos.offsetSamples)/track.sampleRate};
        }
        // Bounded lookahead also supports short and unequal phrases without overlapping lanes.
        let budget=track.phraseCount+2;
        while(next.time<=context.currentTime+.5&&budget-->0){
          schedule(buffer(next.phrase),next.time,0);next={time:next.time+track.phraseFrames(next.phrase)/track.sampleRate,phrase:(next.phrase+1)%track.phraseCount};
        }
      }catch(error){stop();throw error;}
    },
    stop,
    dispose(){stop();cache.clear();disposed=true;},
    snapshot:()=>({active:!!anchor,voices:voices.size,cachedPhrases:cache.size,started,resyncs,tick:lastTick,disposed})
  });
}
