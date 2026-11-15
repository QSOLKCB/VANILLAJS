// SPDX-License-Identifier: Apache-2.0
// Bounded Outruin-derived PCM voices. No automatic device creation or simulation clock.
import {isSound2D,AUDIO2D_RATE} from '../../modules/audio2d/index.js';
export function createEffectPlayer(context,{destination=context?.destination,maxVoices=12,maxBuffers=32}={}){
  if(!context||typeof context.createBuffer!=='function'||typeof context.createGain!=='function'||typeof context.createBufferSource!=='function'||!destination)throw new TypeError('Audio context and destination required');
  for(const n of [maxVoices,maxBuffers])if(!Number.isInteger(n)||n<1||n>64)throw new RangeError('Resource budget must be 1–64');
  const buffers=new Map(),voices=new Map();let disposed=false,nextId=1;
  const check=()=>{if(disposed)throw new Error('Effect player disposed');};
  function release(id){const v=voices.get(id);if(!v)return false;voices.delete(id);
    if(v.source)v.source.onended=null;try{v.source?.stop();}catch{}
    for(const n of [v.source,v.gain,v.pan])try{n?.disconnect();}catch{}
    return true;
  }
  function buffer(score){
    if(buffers.has(score)){const b=buffers.get(score);buffers.delete(score);buffers.set(score,b);return b;}
    const pcm=score.renderAll(),b=context.createBuffer(1,pcm.length,AUDIO2D_RATE),data=b.getChannelData(0);
    for(let i=0;i<pcm.length;i++)data[i]=pcm[i]/32768;
    if(buffers.size===maxBuffers)buffers.delete(buffers.keys().next().value);buffers.set(score,b);return b;
  }
  return Object.freeze({play(score,{when=context.currentTime,offset=0,pan=0,gain=1,loop=false}={}){
    check();if(!isSound2D(score))throw new TypeError('Authentic createSound2D result required');
    if(!Number.isFinite(when)||when<0||!Number.isFinite(offset)||offset<0||!Number.isFinite(pan)||Math.abs(pan)>1||!Number.isFinite(gain)||gain<0||gain>2||typeof loop!=='boolean')throw new RangeError('Invalid voice options');
    const duration=score.frames/AUDIO2D_RATE;
    if(context.state!=='running')return null;
    const seek=offset+Math.max(0,context.currentTime-when);
    if(!loop&&seek>=duration)return null;
    const b=buffer(score);if(voices.size===maxVoices)release(voices.keys().next().value);
    const id=Object.freeze({voice:nextId++}),v={source:null,gain:null,pan:null};voices.set(id,v);
    try{
      const source=v.source=context.createBufferSource(),level=v.gain=context.createGain();
      source.buffer=b;source.loop=loop;level.gain.value=gain;source.connect(level);
      if(context.createStereoPanner){const p=v.pan=context.createStereoPanner();p.pan.value=pan;level.connect(p);p.connect(destination);}else level.connect(destination);
      source.onended=()=>release(id);source.start(Math.max(context.currentTime,when),loop?seek%duration:seek);return id;
    }catch(error){release(id);throw error;}
  },stop(id){check();return release(id);},stopAll(){for(const id of [...voices.keys()])release(id);},
  dispose(){if(disposed)return;for(const id of [...voices.keys()])release(id);buffers.clear();disposed=true;},
  snapshot:()=>Object.freeze({voices:voices.size,buffers:buffers.size,maxVoices,maxBuffers,disposed})});
}
