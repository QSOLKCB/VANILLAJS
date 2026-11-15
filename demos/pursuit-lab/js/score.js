// SPDX-License-Identifier: Apache-2.0
// Outruin's eight-phrase arrangement recipe, with an original pursuit score.
import {createSoundtrack} from '../../../modules/soundtrack/index.js';
import {createSound2D} from '../../../modules/audio2d/index.js';
export function composeTrack(seed=1988){
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new RangeError('Seed must be uint32');
  const scale=[220,261,293,329,392,440,523,587],melody=[0,0,4,2,3,2,0,6,4,3,2,0,1,2,4,3],bass=[55,65,73,49];
  return createSoundtrack({phrases:Array.from({length:8},(_,phrase)=>{const events=[],frames=192000;
    const add=(sample,duration,channel,frequency,wave,gain)=>events.push({id:events.length+1,sample,duration,channel,frequency,wave,gain,seed:(seed^Math.imul(phrase+1,0x45d9f3b)^Math.imul(events.length+1,0x9e3779b9))>>>0});
    for(let i=0;i<16;i++){const start=i*12000,breakdown=phrase===4,fill=(phrase===3||phrase===7)&&i>11;
      if(!breakdown||i%4===0)add(start,7600,0,scale[melody[(i+phrase*2)%16]],phrase<4?'triangle':'square',breakdown?850:1300);
      add(start,9700,1,bass[(Math.floor(i/4)+Math.floor(phrase/2))%4],'saw',1150);
      add(start,i%4===2?4200:fill?1800:800,2,i%4===2?180:5200,'noise',i%4===2?2100:650);
      if(i%4===0||fill&&i%2===0){add(start,720,3,110,'triangle',3200);add(start+720,1440,3,65,'triangle',2700);add(start+2160,3800,3,42,'triangle',1800);}
    }return {frames,events};})});
}
const effect=(frequencies,wave='triangle',gain=6000,segment=2400)=>createSound2D({frames:frequencies.length*segment,events:frequencies.map((frequency,i)=>({id:i+1,sample:i*segment,duration:segment,channel:0,frequency,wave,gain,seed:(1988+Math.imul(i+1,313))>>>0}))});
export const FX=Object.freeze({impact:effect([120,80,50],'noise',8000,3000),crash:effect([100,80,60,40],'noise',9000,3500),turbo:effect([220,330,440,660,880],'saw',2400),sighted:effect([660,880,660,990],'square',2200,3600),clear:effect([329,392,440,523,659],'triangle',5000,5000),fail:effect([293,261,220,146],'saw',2600,6000),pass:effect([440,660],'triangle',1800,1200),siren:effect([660,660,880,880],'triangle',2200,6000)});
export const ENGINES=Object.freeze(Array.from({length:10},(_,band)=>effect(Array.from({length:12},(_,i)=>60+band*18+(i%3)*4),'saw',1300,1600)));
