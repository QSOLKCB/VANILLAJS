// SPDX-License-Identifier: Apache-2.0
import {createSound2D} from '../../../modules/audio2d/index.js';
import {createSoundtrack} from '../../../modules/soundtrack/index.js';
import {createSoundtrackPlayer,createEffectPlayer} from '../../../api/audio/index.js';
const STATIONS=['cannon','flak','missile','rail'];
// Bluewater Watch: Spooky-derived score, re-voiced in E minor with naval alarm pulses.
// Tuples are [eighth-note onset, eighth-note length, frequency in integer Hz].
const MARCH_THEME = [
  [[0,2,294],[2,1,294],[3,1,349],[4,2,440],[6,2,392],[8,2,349],[10,1,330],[11,1,349],[12,3,294]],
  [[0,2,349],[2,1,392],[3,1,440],[4,3,523],[8,2,466],[10,2,440],[12,3,392]],
  [[0,2,440],[2,1,440],[3,1,523],[4,2,587],[6,2,523],[8,2,466],[10,1,440],[11,1,392],[12,3,349]],
  [[0,2,330],[2,2,349],[4,2,392],[6,2,330],[8,2,277],[10,2,330],[12,3,440]],
  [[0,2,587],[2,1,523],[3,1,440],[4,2,349],[6,2,440],[8,2,392],[10,1,349],[11,1,330],[12,3,294]],
  [[0,2,466],[2,1,440],[3,1,392],[4,3,349],[8,2,392],[10,2,440],[12,3,523]],
  [[0,2,440],[2,1,349],[3,1,440],[4,2,587],[6,2,659],[8,2,698],[10,1,659],[11,1,587],[12,2,554],[14,1,440]],
  [[0,2,392],[2,2,330],[4,2,277],[6,2,330],[8,2,440],[10,2,349],[12,4,294]]
];
export function makeScore(station='cannon'){
  if(!STATIONS.includes(station))throw new TypeError('Unknown soundtrack station');
  const arrangement=STATIONS.indexOf(station),beat=24000,eighth=12000;
  const roots=[147,175,175,110,147,117,147,110],fifths=[220,262,262,165,220,175,220,165];
  return createSoundtrack({tickRate:60,phrases:MARCH_THEME.map((melody,phrase)=>{
    const events=[];let id=1;
    const note=(channel,sample,duration,frequency,gain,wave,seed=0)=>events.push({id:id++,channel,sample,duration,frequency,gain,wave,seed});
    // Bass drum downbeats alternate with a short pitched marching-bass response.
    for(let b=0;b<8;b++){
      note(0,b*beat,8500,station==='flak'?38:46,b%2===0?3300:2100,'triangle');
      note(0,b*beat+eighth,9500,b%2?fifths[phrase]:roots[phrase],station==='cannon'?1050:1500,'triangle');
      // A field snare with quiet ghost strokes and accented backbeats.
      const hit=b*beat;note(1,hit,b===7?2300:station==='flak'?4300:3000,1800,b%2?1900:900,'noise',13013+phrase*131+b*17+arrangement*997);
      if(b===7){
        // The turnaround roll ends before the next phrase's downbeat.
        for(let roll=1;roll<8;roll++)note(1,hit+roll*3000,2300,2200,650+roll*130,'noise',phaseSeed(phrase,roll,arrangement));
      }else if(station==='missile'||b===3||b===6){
        note(1,hit+12000,2200,2200,station==='missile'?850:500,'noise',phaseSeed(phrase,b,arrangement));
        if(station==='missile'&&b%2)note(1,hit+18000,1800,2400,550,'noise',phaseSeed(phrase,b+8,arrangement));
      }
    }
    for(const [onset,length,pitch] of melody){
      const sample=onset*eighth,duration=length*eighth-1400;
      // Saw/square fundamentals plus a quieter horn harmony make a brass-like call.
      const navalPitch=Math.round(pitch*1.12246);
      const lead=station==='cannon'?Math.round(navalPitch/2):station==='rail'?navalPitch*2:navalPitch;
      note(2,sample,duration,lead,station==='rail'?950:station==='missile'?1500:1250,station==='rail'?'triangle':station==='flak'?'saw':'square');
      const harmony=phrase===7&&onset===12?147:(onset<8?roots[phrase]:fifths[phrase]);
      note(3,sample+400,Math.max(1,duration-800),station==='missile'?harmony*2:harmony,650,'triangle');
    }
    return {frames:192000,events};
  })});
}
function phaseSeed(phrase,stroke,arrangement){return (47047+phrase*65537+stroke*977+arrangement*1597)>>>0;}
export function makeEffect(type,variant=0){
  const specs={cannon:[.15,100,5500],m2:[.23,70,7600],rail:[.8,180,8000],bolt:[.3,800,2400],flak:[.7,44,8500],missile:[.8,75,7000],battery:[.95,32,10500],
    impact:[.85,43,7700],impact105:[1.8,30,10000],breach:[.3,95,4500],clear:[.65,523,4000],reload:[.26,950,2300],hot:[.25,330,2400],lost:[.9,65,4000]};
  const [duration,freq,gain]=specs[type]||specs.impact,frames=Math.round(duration*48000),tone=['clear','hot','lost'].includes(type),v=(variant>>>0)%4;
  const events=[];let id=1;
  const add=(channel,sample,length,frequency,volume,wave)=>events.push({id:id++,channel,sample,duration:Math.max(1,Math.min(length,frames-sample)),frequency:Math.round(frequency),gain:Math.round(volume),wave,seed:13013+v*977+id*79});
  if(tone){add(0,0,frames,freq,gain,'triangle');add(1,Math.floor(frames*.25),Math.floor(frames*.7),freq*(type==='clear'?1.5:.75),gain*.45,'triangle');}
  else{
    // Crack, falling body, debris tail and reflected report occupy separate lanes.
    add(0,0,Math.floor(frames*.28),freq+v*3,gain,'noise');
    const low=Math.max(30,freq+v*2);add(1,0,Math.floor(frames*.17),low*1.8,gain*.65,'triangle');
    add(1,Math.floor(frames*.17),Math.floor(frames*.65),low,gain*.45,'triangle');
    add(2,Math.floor(frames*.16),Math.floor(frames*.8),1800+v*130,gain*.2,'noise');
    add(3,Math.floor(frames*.37),Math.floor(frames*.42),low,gain*.16,'noise');
    if(type==='reload'||type==='bolt'){events.length=0;add(0,0,2800,1600+v*80,2500,'noise');add(0,6000,4000,850,3500,'noise');add(1,6100,1900,410,1100,'square');}
  }
  return createSound2D({frames,events});
}
// Playback is presentation only. Device failure never changes saved preferences.
export function createAudio(onFailure=()=>{}){
  let context=null,player=null,effects=null,active=null,failed=false,unlocking=null;const sounds=new Map();
  function stop(){try{player?.stop();}catch{}try{effects?.stopAll();}catch{}}
  function fail(error){failed=true;stop();try{onFailure(error);}catch{}}
  async function unlock(){try{if(!context){const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)throw Error('Audio unavailable');context=new C();}if(!effects)effects=createEffectPlayer(context,{maxVoices:16,maxBuffers:32});await context.resume();failed=false;}catch(error){fail(error);}}
  return {
    unlock(){if(!unlocking)unlocking=unlock().finally(()=>unlocking=null);return unlocking;},stop,
    sync(tick,enabled,station='cannon'){if(!context||failed)return;try{if(active!==station){player?.stop();player=createSoundtrackPlayer(context,makeScore(station));active=station;}if(enabled)player.sync(tick);else player.stop();}catch(error){fail(error);}},
    event(event,enabled){if(!enabled||failed||context?.state!=='running')return;const type=event.type==='kill'?'impact':event.type==='collateral'?'clear':event.type;if(type==='ready')return;try{if(!sounds.has(type))sounds.set(type,makeEffect(type));effects.play(sounds.get(type),{gain:.55,pan:Number.isFinite(event.x)?Math.max(-.8,Math.min(.8,(event.x-576)/576)):0});}catch(error){fail(error);}},
    musicWav:(station='cannon')=>makeScore(station).wav(),
    snapshot:()=>({failed,state:context?.state??'unavailable',music:player?.snapshot()??null,effects:effects?.snapshot()??null})
  };
}
