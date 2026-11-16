// SPDX-License-Identifier: Apache-2.0
// Original continuous vehicle presentation synthesis. No device or simulation clock.
// Float64 phase/filter arithmetic -> mono Float32 PCM; same-runtime identity only.
export const VEHICLE_AUDIO_FORMAT='qsol.vanillajs.vehicle-audio.v1';
export const VEHICLE_AUDIO_BYTES=2048;
export const VEHICLE_AUDIO_MAX_FRAMES=8192;
const TAU=2*Math.PI;
const keys=['format','version','seed','cylinders','engineGain','exhaustGain','tyreGain','shiftGain','exhaustTone','smoothingMs'];
const controlKeys=['rpm','throttle','load','slip','brake','speed','gear'];
function record(value,allowed,label){
  if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw TypeError(label+' must be a plain record');
  const descriptors=Object.getOwnPropertyDescriptors(value),own=Reflect.ownKeys(descriptors);
  if(own.length!==allowed.length||own.some(k=>typeof k!=='string'||!allowed.includes(k)||!Object.hasOwn(descriptors[k],'value')))throw TypeError(label+' has missing, unknown or accessor fields');
}
function number(value,min,max,label){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw RangeError(label+' out of bounds');return value;}
function integer(value,min,max,label){number(value,min,max,label);if(!Number.isSafeInteger(value))throw TypeError(label+' must be an integer');return value;}
/** Strict owned immutable data. Gains are dimensionless, smoothingMs milliseconds. */
export function validateVehicleSound(value){
  record(value,keys,'vehicle sound');
  if(value.format!==VEHICLE_AUDIO_FORMAT||value.version!==1)throw TypeError('Unsupported vehicle sound format/version');
  return Object.freeze({format:VEHICLE_AUDIO_FORMAT,version:1,seed:integer(value.seed,0,4294967295,'seed'),cylinders:integer(value.cylinders,2,12,'cylinders'),
    engineGain:number(value.engineGain,0,.4,'engineGain'),exhaustGain:number(value.exhaustGain,0,.4,'exhaustGain'),tyreGain:number(value.tyreGain,0,.4,'tyreGain'),shiftGain:number(value.shiftGain,0,.4,'shiftGain'),
    exhaustTone:number(value.exhaustTone,.5,2,'exhaustTone'),smoothingMs:number(value.smoothingMs,5,120,'smoothingMs')});
}
export function defaultVehicleSound(){return {format:VEHICLE_AUDIO_FORMAT,version:1,seed:7331,cylinders:4,engineGain:.2,exhaustGain:.15,tyreGain:.14,shiftGain:.08,exhaustTone:1,smoothingMs:35};}
export function parseVehicleSound(source){if(typeof source!=='string'||new TextEncoder().encode(source).length>VEHICLE_AUDIO_BYTES)throw RangeError('Vehicle sound exceeds 2 KiB');return validateVehicleSound(JSON.parse(source));}
export function serializeVehicleSound(value){return JSON.stringify(validateVehicleSound(value));}
function controls(value){
  record(value,controlKeys,'vehicle sound input');
  return {rpm:number(value.rpm,0,18000,'rpm'),throttle:number(value.throttle,0,1,'throttle'),load:number(value.load,0,1,'load'),slip:number(value.slip,0,1,'slip'),brake:number(value.brake,0,1,'brake'),speed:number(value.speed,0,250,'speed'),gear:integer(value.gear,-1,12,'gear')};
}
function noiseAt(seed,sample){
  let n=(seed^Math.imul((sample>>>0)+1,0x9e3779b9))>>>0;
  n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;n=Math.imul(n,0x846ca68b);n^=n>>>16;
  return (n>>>0)/2147483648-1;
}
/**
 * A bounded, explicitly advanced stream, owned by one caller. render(input, frames)
 * holds the supplied controls for exactly frames samples (0..8192). RPM is rev/min,
 * speed absolute m/s; load/slip/brake/throttle normalized 0..1. Pass zero tyre load
 * and slip when airborne. A changed gear produces one 90 ms mechanical transient.
 * Sample smoothing, phase, noise and shift state cross buffer boundaries; splitting
 * identical input spans cannot change PCM. This is cosmetic, never vehicle physics.
 */
export function createVehicleVoice(value=defaultVehicleSound(),{sampleRate=48000}={}){
  const profile=validateVehicleSound(value);
  integer(sampleRate,22050,96000,'sampleRate');
  const blend=1-Math.exp(-1000/(sampleRate*profile.smoothingMs));
  let samples,phase,exhaustPhase,tyrePhase,noiseLow,shift,gear,smooth;
  function reset(){samples=0;phase=0;exhaustPhase=0;tyrePhase=0;noiseLow=0;shift=0;gear=null;smooth={rpm:0,throttle:0,load:0,slip:0,brake:0,speed:0};}
  reset();
  return Object.freeze({profile,sampleRate,reset,
    render(value,frames){
      const target=controls(value);integer(frames,0,VEHICLE_AUDIO_MAX_FRAMES,'frames');
      if(!Number.isSafeInteger(samples+frames))throw RangeError('Vehicle voice sample counter exhausted');
      const pcm=new Float32Array(frames);
      if(!frames)return pcm;
      if(gear!==null&&target.gear!==gear)shift=1;
      gear=target.gear;
      for(let i=0;i<frames;i++){
        for(const k of ['rpm','throttle','load','slip','brake','speed'])smooth[k]+=(target[k]-smooth[k])*blend;
        // Four-stroke firing rate; original harmonic voicing, not a recorded engine.
        const firing=smooth.rpm*profile.cylinders/120;
        phase=(phase+firing/sampleRate)%1;
        exhaustPhase=(exhaustPhase+firing*profile.exhaustTone/sampleRate)%1;
        tyrePhase=(tyrePhase+(780+Math.min(smooth.speed,80)*9)/sampleRate)%1;
        const noise=noiseAt(profile.seed,samples++);noiseLow+=(noise-noiseLow)*.08;
        const running=Math.min(1,smooth.rpm/300),power=.24+.5*smooth.throttle+.26*smooth.load;
        const engine=(Math.sin(TAU*phase)+.4*Math.sin(TAU*phase*2)+.18*Math.sin(TAU*phase*4))/1.58;
        const exhaust=(Math.sin(TAU*exhaustPhase)+.45*Math.sin(TAU*exhaustPhase*3))/1.45;
        const traction=smooth.load*Math.min(1,smooth.speed/8);
        const tyre=traction*(smooth.slip*(.55*(noise-noiseLow)+.45*Math.sin(TAU*tyrePhase))+.08*smooth.brake*noise);
        const transient=shift*(.7*noise+.3*Math.sin(TAU*phase*2));
        shift=Math.max(0,shift-1/(sampleRate*.09));
        const mixed=running*power*(profile.engineGain*engine+profile.exhaustGain*(.85*exhaust+.15*noiseLow))*(1-.2*shift)+profile.tyreGain*tyre+profile.shiftGain*transient;
        pcm[i]=Math.max(-.95,Math.min(.95,mixed));
      }
      return pcm;
    },
    snapshot:()=>Object.freeze({sampleRate,samples,phase,exhaustPhase,tyrePhase,noiseLow,shift,gear,controls:Object.freeze({...smooth})})
  });
}
