// SPDX-License-Identifier: Apache-2.0
// CHIP-AUDIO-001: a deterministic, original SID-style ADSR -> Paula-style PCM mixer.
// An audio architecture study, NOT a cycle-accurate SID/Paula emulator.
// No AudioContext, DOM, DMA, I/O, timers, ambient randomness or runtime dependencies.
export const CHIP_AUDIO_FORMAT='qsol.vanillajs.chip-audio.v1';
export const CHIP_AUDIO_RATE=48000;
export const CHIP_AUDIO_CHANNELS=4;
export const CHIP_AUDIO_MAX_FRAMES=8*CHIP_AUDIO_RATE;
// Nominal PAL/NTSC Paula audio clocks. Playback step = clock / (period * 48000).
export const PAULA_CLOCK=Object.freeze({pal:3546895,ntsc:3579545});
export const PAULA_PAN=Object.freeze(['left','right','right','left']);
// Nominal C64 SID ADSR rate durations, in milliseconds. The *shape* below is
// explicitly linear and sample-indexed, rather than a claim about SID counters.
const ATTACK_MS=Object.freeze([2,8,16,24,38,56,68,80,100,250,500,800,1000,3000,5000,8000]);
const DECAY_RELEASE_MS=Object.freeze(ATTACK_MS.map(x=>x*3));
const MAX_EVENTS=128,MAX_SAMPLE_LENGTH=65536,MAX_TOTAL_SOURCE_SAMPLES=262144;
const waves=Object.freeze(['square','saw','triangle','noise']);
const owned=new WeakSet();
const integer=(n,lo,hi,label)=>{if(!Number.isSafeInteger(n)||n<lo||n>hi)throw RangeError(label+' out of range');return n;};
const plain=(v,keys,label)=>{
  if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw TypeError(label+' must be a plain object');
  const descriptors=Object.getOwnPropertyDescriptors(v),own=Reflect.ownKeys(descriptors);
  if(own.some(k=>typeof k!=='string'||!keys.includes(k)||!Object.hasOwn(descriptors[k],'value')||!descriptors[k].enumerable))
    throw TypeError(label+' has unknown or accessor fields');
};
/** Build one bounded signed 8-bit original PCM wavetable. Returns an owned copy. */
export function makeChipWave(options={}){
  plain(options,['wave','frames','seed','duty'],'wave options');
  const {wave,frames=32,seed=1,duty=128}=options;
  if(!waves.includes(wave))throw RangeError('unsupported chip wave');
  integer(frames,8,4096,'wave frames');integer(seed,0,4294967295,'seed');integer(duty,1,255,'duty');
  let n=seed||0x9e3779b9;
  const pcm=new Int8Array(frames);
  for(let i=0;i<frames;i++){
    switch(wave){
      case 'square':pcm[i]=Math.floor(i*256/frames)<duty?127:-128;break;
      case 'saw':pcm[i]=Math.trunc(i*255/(frames-1))-128;break;
      case 'triangle':pcm[i]=Math.trunc((1-Math.abs(2*(i/(frames-1))-1))*255)-128;break;
      case 'noise':n^=n<<13;n^=n>>>17;n^=n<<5;pcm[i]=((n>>>24)&255)-128;break;
    }
  }
  return pcm;
}
function sourcePCM(v){
  if(!(v instanceof Int8Array)&&!(Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype))throw TypeError('PCM must be signed 8-bit array');
  if(v.length<1||v.length>MAX_SAMPLE_LENGTH)throw RangeError('PCM length outside budget');
  if(Array.isArray(v)){
    if(Reflect.ownKeys(v).length!==v.length+1)throw TypeError('PCM must be dense');
    for(let i=0;i<v.length;i++){
      const d=Object.getOwnPropertyDescriptor(v,i);
      if(!d||!Object.hasOwn(d,'value'))throw TypeError('PCM contains a hole or accessor');
      integer(d.value,-128,127,'PCM byte');
    }
  }
  return Int8Array.from(v); // Private copy: caller mutation cannot affect playback.
}
function validateEvent(v,frames){
  plain(v,['id','channel','start','duration','gate','period','volume','attack','decay','sustain','release','sample','loop'],'event');
  const id=integer(v.id,1,65535,'event id'),channel=integer(v.channel,0,3,'channel');
  const start=integer(v.start,0,frames-1,'start'),duration=integer(v.duration,1,frames-start,'duration');
  const gate=integer(v.gate,1,duration,'gate');
  const period=integer(v.period,124,65535,'period'),volume=integer(v.volume,0,64,'volume');
  const attack=integer(v.attack,0,15,'attack'),decay=integer(v.decay,0,15,'decay');
  const sustain=integer(v.sustain,0,15,'sustain'),release=integer(v.release,0,15,'release');
  if(typeof v.loop!=='boolean')throw TypeError('loop must be boolean');
  return {id,channel,start,duration,gate,period,volume,attack,decay,sustain,release,loop:v.loop,pcm:sourcePCM(v.sample)};
}
const stageFrames=ms=>Math.max(1,Math.round(ms*CHIP_AUDIO_RATE/1000));
// ADSR here is intentionally a *linear envelope approximation*, not the SID's
// clocked exponential decay or its re-gating anomaly.
function heldLevel(e,n){
  const a=stageFrames(ATTACK_MS[e.attack]),s=e.sustain*17;
  if(n<a)return Math.floor((n+1)*255/a);
  const d=stageFrames(DECAY_RELEASE_MS[e.decay]);
  if(n<a+d)return 255-Math.floor((255-s)*(n-a+1)/d);
  return s;
}
function envelope(e,n){
  if(n<e.gate)return heldLevel(e,n);
  const releaseFrames=stageFrames(DECAY_RELEASE_MS[e.release]),elapsed=n-e.gate;
  if(elapsed>=releaseFrames)return 0;
  // Release begins at the actually attained gate-off level, including a
  // premature gate-off during attack or decay, not always at peak amplitude.
  return Math.floor(heldLevel(e,e.gate-1)*(releaseFrames-elapsed-1)/releaseFrames);
}
function eventSample(e,n,clock){
  const local=n-e.start;
  if(local<0||local>=e.duration||e.volume===0)return 0;
  const level=envelope(e,local);if(level===0)return 0;
  // Multiplication is exact within Number.MAX_SAFE_INTEGER for <=8 s.
  const sampleIndex=Math.floor(local*clock/(e.period*CHIP_AUDIO_RATE));
  if(!e.loop&&sampleIndex>=e.pcm.length)return 0;
  const byte=e.pcm[e.loop?sampleIndex%e.pcm.length:sampleIndex];
  // Two full-volume channels per side fit in 16-bit PCM without gain pumping.
  return Math.trunc(byte*e.volume*level*2/255);
}
/** Create a bounded, sample-indexed stereo PCM score.
 * A 4x 8-bit voice engine with 6-bit volume and 0/3:L, 1/2:R hard panning.
 * Absolute sample addressing makes repeated / split renderRange results identical.
 */
export function createChipAudio(options={}){
  plain(options,['frames','clock','filter','events'],'score options');
  const {frames=CHIP_AUDIO_RATE,clock='pal',filter='off',events=[]}=options;
  integer(frames,1,CHIP_AUDIO_MAX_FRAMES,'frames');
  if(!Object.hasOwn(PAULA_CLOCK,clock))throw RangeError('PAL/NTSC clock required');
  if(filter!=='off'&&filter!=='led-approx')throw RangeError('filter must be off or led-approx');
  if(!Array.isArray(events)||Object.getPrototypeOf(events)!==Array.prototype||events.length>MAX_EVENTS||
    Reflect.ownKeys(events).length!==events.length+1)throw RangeError('events must be a bounded dense array');
  const ids=new Set(),lanes=[[],[],[],[]];let samples=0;
  for(let i=0;i<events.length;i++){
    const d=Object.getOwnPropertyDescriptor(events,i);
    if(!d||!Object.hasOwn(d,'value'))throw TypeError('event accessor/hole');
    const e=validateEvent(d.value,frames);
    if(ids.has(e.id))throw RangeError('duplicate event id');ids.add(e.id);
    samples+=e.pcm.length;if(samples>MAX_TOTAL_SOURCE_SAMPLES)throw RangeError('total source PCM budget exceeded');
    lanes[e.channel].push(e);
  }
  for(const lane of lanes){
    lane.sort((a,b)=>a.start-b.start||a.id-b.id);
    for(let i=1;i<lane.length;i++)if(lane[i-1].start+lane[i-1].duration>lane[i].start)
      throw RangeError('overlapping events on a single Paula channel');
  }
  const clockHz=PAULA_CLOCK[clock];
  const result=Object.freeze({format:CHIP_AUDIO_FORMAT,version:1,sampleRate:CHIP_AUDIO_RATE,frames,channels:CHIP_AUDIO_CHANNELS,clock,filter,eventCount:ids.size,
    eventSummary(){return lanes.flatMap(lane=>lane.map(e=>Object.freeze({id:e.id,channel:e.channel,start:e.start,duration:e.duration,
      gate:e.gate,period:e.period,volume:e.volume,attack:e.attack,decay:e.decay,sustain:e.sustain,
      release:e.release,loop:e.loop,sampleLength:e.pcm.length}))).sort((a,b)=>a.start-b.start||a.channel-b.channel||a.id-b.id);},
    renderRange(start,count){
      integer(start,0,frames,'start');integer(count,0,frames-start,'count');
      const pcm=new Int16Array(count*2);if(!count)return pcm;
      // Approximate LED low-pass is a deterministic one-pole integer IIR.
      // Replaying the prefix reconstitutes its state for arbitrary ranges.
      const begin=filter==='off'?start:0;
      const cursors=lanes.map(lane=>{let i=0;while(i<lane.length&&lane[i].start+lane[i].duration<=begin)i++;return i;});
      let lowL=0,lowR=0;
      for(let n=begin;n<start+count;n++){
        let l=0,r=0;
        for(let ch=0;ch<4;ch++){
          const lane=lanes[ch];let i=cursors[ch];
          while(i<lane.length&&n>=lane[i].start+lane[i].duration)i++;
          cursors[ch]=i;
          if(i<lane.length&&n>=lane[i].start){const sample=eventSample(lane[i],n,clockHz);
            if(ch===0||ch===3)l+=sample;else r+=sample;}
        }
        if(filter==='led-approx'){
          // Not the precise analogue characteristics of any Amiga model.
          const dl=l-lowL,dr=r-lowR;
          lowL+=dl>=0?Math.ceil(dl/4):Math.floor(dl/4);
          lowR+=dr>=0?Math.ceil(dr/4):Math.floor(dr/4);
          l=lowL;r=lowR;
        }
        if(n>=start){const at=(n-start)*2;pcm[at]=Math.max(-32768,Math.min(32767,l));pcm[at+1]=Math.max(-32768,Math.min(32767,r));}
      }
      return pcm;
    },
    renderAll(){return this.renderRange(0,frames);},
    wav(){
      const pcm=this.renderAll(),dataBytes=pcm.byteLength,bytes=new Uint8Array(44+dataBytes),v=new DataView(bytes.buffer);
      const ascii=(pos,s)=>{for(let i=0;i<s.length;i++)v.setUint8(pos+i,s.charCodeAt(i));};
      ascii(0,'RIFF');v.setUint32(4,36+dataBytes,true);ascii(8,'WAVE');ascii(12,'fmt ');
      v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);
      v.setUint32(24,CHIP_AUDIO_RATE,true);v.setUint32(28,CHIP_AUDIO_RATE*4,true);
      v.setUint16(32,4,true);v.setUint16(34,16,true);ascii(36,'data');v.setUint32(40,dataBytes,true);
      for(let i=0;i<pcm.length;i++)v.setInt16(44+2*i,pcm[i],true);
      return bytes;
    }
  });
  owned.add(result);return result;
}
export function isChipAudio(value){return owned.has(value);}
