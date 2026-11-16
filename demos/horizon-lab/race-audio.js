// SPDX-License-Identifier: Apache-2.0
// Explicit gesture-owned device adapter; simulation state only controls presentation.
import {createVehicleVoice,defaultVehicleSound,validateVehicleSound} from '../../modules/vehicle-audio/index.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const FRAMES=2048,RATE=48000,LOOKAHEAD=.075,MAX_SOURCES=4;
/** Extract bounded sound controls from the actual vehicle3d snapshot, without mutation. */
export function vehicleSoundControls(state,input={},mass=1200){
  if(!state||!Array.isArray(state.wheels)||state.wheels.length!==4||!Array.isArray(state.velocity)||state.velocity.length!==3)throw TypeError('Vehicle snapshot required');
  if(!Number.isFinite(mass)||mass<500||mass>4000)throw RangeError('Vehicle mass out of bounds');
  let load=0,slip=0;
  for(const wheel of state.wheels){
    if(!Number.isFinite(wheel.load)||!Number.isFinite(wheel.slip)||typeof wheel.grounded!=='boolean')throw TypeError('Finite wheel feedback required');
    if(wheel.grounded){load+=Math.max(0,wheel.load);slip=Math.max(slip,wheel.slip);}
  }
  const speed=Math.hypot(...state.velocity),throttle=input.throttle??0,brake=input.brake??state.brake;
  if(![speed,state.rpm,throttle,brake].every(Number.isFinite))throw TypeError('Finite engine feedback required');
  return {rpm:clamp(state.rpm,0,18000),throttle:clamp(throttle,0,1),load:clamp(load/(mass*9.81),0,1),slip:clamp(slip/2,0,1),brake:clamp(brake,0,1),speed:clamp(speed,0,250),gear:state.gear};
}
/**
 * start() belongs in an explicit user gesture; update() cannot create/resume a
 * device. The caller calls stop() on pause, blur, hidden tab and graphics loss.
 * Preference survives stop(); another gesture/start is required to play again.
 * No timers, worker, remote assets, shared global context or automatic playback.
 */
export class RaceAudio {
  #profile;#voice;#factory;#context=null;#gain=null;#sources=new Set();#next=null;#active=false;#enabled=false;#disposed=false;#generation=0;#error='';#started=0;#resyncs=0;#stateListener=null;
  constructor(profile=defaultVehicleSound(),{contextFactory=()=>new AudioContext()}={}){
    this.#profile=validateVehicleSound(profile);this.#voice=createVehicleVoice(this.#profile);if(typeof contextFactory!=='function')throw TypeError('Context factory required');this.#factory=contextFactory;
  }
  get enabled(){return this.#enabled;}
  get context(){return this.#context;}
  async start(){
    if(this.#disposed)return false;
    const generation=++this.#generation;this.#enabled=true;this.#error='';
    try{
      if(!this.#context){
        const context=this.#factory();this.#context=context;
        this.#gain=context.createGain();this.#gain.gain.value=0;this.#gain.connect(context.destination);
        this.#stateListener=()=>{if(this.#active&&context.state!=='running')this.#fail(Error('Audio device interrupted; enable sound again to retry.'));};
        context.addEventListener?.('statechange',this.#stateListener);
      }
      await this.#context.resume();
      if(this.#disposed||generation!==this.#generation||!this.#enabled)return false;
      if(this.#context.state!=='running')throw Error('Audio device did not resume');
      this.#cancel();this.#active=true;this.#gain.gain.setValueAtTime(0,this.#context.currentTime);this.#gain.gain.linearRampToValueAtTime(1,this.#context.currentTime+.025);return true;
    }catch(error){if(generation===this.#generation)this.#fail(error);return false;}
  }
  update(state,input={},mass=1200){
    if(this.#disposed||!this.#enabled||!this.#active)return;
    if(this.#context.state!=='running'){this.#fail(Error('Audio device interrupted; enable sound again to retry.'));return;}
    try{
      const controls=vehicleSoundControls(state,input,mass),now=this.#context.currentTime;
      if(this.#next===null)this.#next=now+.01;
      else if(this.#next<now){this.#cancel();this.#active=true;this.#next=now+.01;this.#gain.gain.setValueAtTime(1,now);this.#resyncs++;}
      let budget=MAX_SOURCES;
      while(this.#next<now+LOOKAHEAD&&budget-->0&&this.#sources.size<MAX_SOURCES){
        const pcm=this.#voice.render(controls,FRAMES),buffer=this.#context.createBuffer(1,FRAMES,RATE),source=this.#context.createBufferSource();
        this.#sources.add(source);buffer.getChannelData(0).set(pcm);source.buffer=buffer;source.connect(this.#gain);
        source.onended=()=>{this.#sources.delete(source);source.onended=null;try{source.disconnect();}catch{}};
        source.start(this.#next);this.#next+=FRAMES/RATE;this.#started++;
      }
    }catch(error){this.#fail(error);}
  }
  #cancel(){
    this.#active=false;this.#next=null;
    if(this.#gain){try{this.#gain.gain.cancelScheduledValues(this.#context.currentTime);this.#gain.gain.setValueAtTime(0,this.#context.currentTime);}catch{}}
    for(const source of this.#sources){source.onended=null;try{source.stop();}catch{}try{source.disconnect();}catch{}}
    this.#sources.clear();this.#voice.reset();
  }
  #closeDevice(){
    if(this.#context){this.#context.removeEventListener?.('statechange',this.#stateListener);try{this.#gain?.disconnect();}catch{}try{const closing=this.#context.close();closing?.catch(()=>{});}catch{}}
    this.#gain=null;this.#context=null;
  }
  #fail(error){this.#generation++;this.#cancel();this.#enabled=false;this.#error=error instanceof Error?error.message:'Audio unavailable';this.#closeDevice();}
  stop(){this.#generation++;this.#cancel();}
  disable(){this.stop();this.#enabled=false;}
  setProfile(value){const profile=validateVehicleSound(value),voice=createVehicleVoice(profile),active=this.#active;this.#cancel();this.#profile=profile;this.#voice=voice;if(active){this.#active=true;this.#gain.gain.setValueAtTime(1,this.#context.currentTime);}}
  dispose(){
    if(this.#disposed)return;this.disable();this.#disposed=true;
    this.#closeDevice();
  }
  snapshot(){return Object.freeze({enabled:this.#enabled,active:this.#active,disposed:this.#disposed,voices:this.#sources.size,maxVoices:MAX_SOURCES,started:this.#started,resyncs:this.#resyncs,error:this.#error,stream:this.#voice.snapshot()});}
}
