/* SPDX-License-Identifier: Apache-2.0 */
import {createSoundtrack} from '../../../modules/soundtrack/index.js';
import {createSoundtrackPlayer} from '../../../api/audio/index.js';
  const RATE=48000, SAMPLES_PER_TICK=800;
  const THEMES=Object.freeze([
    Object.freeze({name:'Porcelain Patrol', stepTicks:15, roots:[110,131,87,98], melody:[0,2,4,2,1,3,4,2,0,2,3,4,2,1,3,2]}),
    Object.freeze({name:'Bubble Bank Boogie', stepTicks:12, roots:[131,98,110,87], melody:[0,4,2,3,1,4,2,0,3,2,4,1,2,4,3,1]}),
    Object.freeze({name:'The Last Plug', stepTicks:10, roots:[110,87,98,82], melody:[0,0,4,2,3,2,1,4,0,2,4,3,2,1,3,4]})
  ]);
  function integer(n,min,max,name) { if(!Number.isSafeInteger(n)||n<min||n>max) throw new RangeError(name); return n; }
  function position(mission,tick) {
    integer(mission,0,2,'mission'); integer(tick,0,Number.MAX_SAFE_INTEGER,'tick');
    const barTicks=THEMES[mission].stepTicks*16, bar=Math.floor(tick/barTicks);
    return {mission,bar,phrase:bar%4,barTicks,offsetSamples:(tick%barTicks)*SAMPLES_PER_TICK};
  }
  // Four original instrument lanes. All pitches, envelopes, offsets and noise seeds
  // are integers; no clock, ambient PRNG or gameplay random stream enters a score.
  function score(mission,phrase) {
    integer(mission,0,2,'mission'); integer(phrase,0,3,'phrase');
    const theme=THEMES[mission], step=theme.stepTicks*SAMPLES_PER_TICK, events=[];
    const rootHz=theme.roots[phrase], palette=[rootHz*2,Math.floor(rootHz*12/5),Math.floor(rootHz*8/3),rootHz*3,Math.floor(rootHz*18/5)];
    const add=(sample,duration,channel,frequency,gain,wave,seed=0)=>events.push({id:events.length+1,sample,duration,channel,frequency,gain,wave,seed});
    for(let i=0;i<16;i++) {
      const at=i*step;
      add(at,step-400,0,i%4===3?Math.floor(rootHz*3/2):rootHz,3600,'triangle');
      // A rest at the end leaves room for the next chord, rather than an endless arpeggio.
      if(i!==15) add(at,Math.floor(step*3/4),1,palette[theme.melody[(i+phrase*2)%16]],1600,mission===2?'square':'triangle');
      if(i%4===0) add(at,step*3,2,palette[(phrase+i/4)%5],1100,'saw');
      add(at,i%4===0?Math.floor(step/2):Math.floor(step/4),3,i%4===0?55:1800,i%4===0?4200:1000,i%4===0?'triangle':'noise',0x5ab000+mission*256+phrase*16+i);
    }
    return {frames:step*16,events};
  }

const tracks=THEMES.map((_,mission)=>createSoundtrack({phrases:Array.from({length:4},(_,phrase)=>score(mission,phrase))}));
function player(context){
  let selected=-1,adapter=null;
  return Object.freeze({
    sync(state,enabled){
      if(selected!==state.mission){adapter?.dispose();selected=state.mission;adapter=createSoundtrackPlayer(context,tracks[selected]);}
      adapter.sync(state.sectorTick,enabled&&state.status==='playing'&&state.transition===0);
    },
    stop(){adapter?.stop();},
    snapshot:()=>adapter?.snapshot()??{active:false,voices:0}
  });
}
export const SubHuntMusic=Object.freeze({THEMES,RATE,SAMPLES_PER_TICK,position,score,tracks,player,wav:mission=>tracks[mission].wav()});
