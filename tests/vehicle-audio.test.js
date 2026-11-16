// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {VEHICLE_AUDIO_FORMAT,VEHICLE_AUDIO_BYTES,VEHICLE_AUDIO_MAX_FRAMES,defaultVehicleSound,validateVehicleSound,parseVehicleSound,serializeVehicleSound,createVehicleVoice} from '../modules/vehicle-audio/index.js';
const driving={rpm:4200,throttle:.8,load:.9,slip:.1,brake:0,speed:32,gear:3};
const energy=pcm=>pcm.reduce((sum,x)=>sum+x*x,0)/pcm.length;
function render(profile,controls=driving){const voice=createVehicleVoice(profile);voice.render(controls,8192);return voice.render(controls,8192);}
test('vehicle sound is strict bounded owned versioned data, rejecting accessors without invocation',()=>{
  const draft=defaultVehicleSound(),accepted=validateVehicleSound(draft);assert.equal(accepted.format,VEHICLE_AUDIO_FORMAT);assert.ok(Object.isFrozen(accepted));draft.engineGain=.4;assert.equal(accepted.engineGain,.2);
  assert.deepEqual(parseVehicleSound(serializeVehicleSound(accepted)),accepted);assert.ok(new TextEncoder().encode(serializeVehicleSound(accepted)).length<VEHICLE_AUDIO_BYTES);
  for(const change of [p=>p.version=2,p=>p.format='remote',p=>p.seed=-1,p=>p.seed=2**32,p=>p.cylinders=3.5,p=>p.engineGain=.401,p=>p.exhaustGain=-.1,p=>p.tyreGain=Infinity,p=>p.shiftGain=NaN,p=>p.exhaustTone=0,p=>p.smoothingMs=1000,p=>p.script='run()',p=>delete p.seed,p=>p[Symbol('unknown')]=1]){const p=defaultVehicleSound();change(p);assert.throws(()=>validateVehicleSound(p));}
  let called=false;const getter=defaultVehicleSound();Object.defineProperty(getter,'engineGain',{get(){called=true;return .2;}});assert.throws(()=>validateVehicleSound(getter));assert.equal(called,false);
  assert.throws(()=>validateVehicleSound(Object.create(defaultVehicleSound())));assert.throws(()=>parseVehicleSound(' '.repeat(VEHICLE_AUDIO_BYTES)+serializeVehicleSound(accepted)));assert.throws(()=>parseVehicleSound('{bad'));
});
test('fixed profile and held inputs give identical PCM independent of chunk boundaries',()=>{
  const whole=createVehicleVoice(),split=createVehicleVoice(),input={...driving};
  const expected=whole.render(input,8192),actual=new Float32Array(8192);let offset=0;
  for(const count of [1,127,2048,7,4096,1913]){actual.set(split.render(input,count),offset);offset+=count;}
  assert.equal(offset,8192);assert.deepEqual(actual,expected);assert.deepEqual(split.snapshot(),whole.snapshot());assert.deepEqual(createVehicleVoice().render(driving,8192),expected);
  const changed={...driving,gear:4,rpm:3300};const next=whole.render(changed,8192),chunks=new Float32Array(8192);chunks.set(split.render(changed,3072));chunks.set(split.render(changed,5120),3072);assert.deepEqual(chunks,next);assert.deepEqual(split.snapshot(),whole.snapshot());
  whole.reset();assert.deepEqual(whole.render(driving,8192),expected);assert.equal(input.rpm,4200);
});
test('seeded source PCM has a pinned same-runtime regression identity, never a cross-device audio claim',()=>{
  const pcm=createVehicleVoice().render(driving,8192),hash=createHash('sha256').update(new Uint8Array(pcm.buffer)).digest('hex');
  assert.equal(hash,'99f075f135a8bb28b6e04a7f56cdd46af7e91a34eb94947c92af10356ba211bf');
  assert.notDeepEqual(render({...defaultVehicleSound(),seed:12}),render(defaultVehicleSound()));
});
test('RPM controls actual fundamental pitch; throttle/load, exhaust tone and tyre slip change audio',()=>{
  const engine={...defaultVehicleSound(),engineGain:.3,exhaustGain:0,tyreGain:0,shiftGain:0,smoothingMs:5};
  const crossings=pcm=>pcm.reduce((n,x,i)=>n+(i>0&&pcm[i-1]<0&&x>=0),0);
  const idle=render(engine,{...driving,rpm:1200}),fast=render(engine,{...driving,rpm:6000});assert.ok(crossings(fast)>crossings(idle)*4,'higher RPM changes periodic output frequency');
  assert.ok(energy(render(engine,{...driving,throttle:1,load:1}))>energy(render(engine,{...driving,throttle:0,load:0}))*8);
  const exhaust={...engine,engineGain:0,exhaustGain:.3};assert.notDeepEqual(render(exhaust),render({...exhaust,exhaustTone:1.5}));
  const tyres={...engine,engineGain:0,tyreGain:.3};assert.equal(energy(render(tyres,{...driving,slip:0})),0);assert.ok(energy(render(tyres,{...driving,slip:1}))>.001);assert.equal(energy(render(tyres,{...driving,slip:1,load:0})),0);assert.equal(energy(render(tyres,{...driving,slip:1,speed:0})),0);
  assert.ok(energy(render(tyres,{...driving,slip:0,brake:1}))>0,'braking has original friction feedback');
});
test('shift feedback occurs once per gear edge and decays through split buffers',()=>{
  const profile={...defaultVehicleSound(),engineGain:0,exhaustGain:0,tyreGain:0,shiftGain:.4},voice=createVehicleVoice(profile);
  assert.equal(energy(voice.render(driving,512)),0,'first gear is not a shift');
  const changed={...driving,gear:4};assert.ok(energy(voice.render(changed,2048))>0);assert.ok(voice.snapshot().shift>0);voice.render(changed,4096);assert.equal(voice.snapshot().shift,0);assert.equal(energy(voice.render(changed,2048)),0,'held gear never retriggers');
});
test('PCM, buffers, sample rate and input validation are bounded; rejected requests preserve stream state',()=>{
  for(const sampleRate of [22050,44100,48000,96000]){const voice=createVehicleVoice({...defaultVehicleSound(),engineGain:.4,exhaustGain:.4,tyreGain:.4,shiftGain:.4},{sampleRate});for(let gear=1;gear<5;gear++){const pcm=voice.render({...driving,rpm:18000,throttle:1,load:1,slip:1,brake:1,speed:250,gear},8192);assert.ok(pcm.every(x=>Number.isFinite(x)&&Math.abs(x)<=.95));}}
  for(const sampleRate of [0,22049,96001,NaN,44100.5])assert.throws(()=>createVehicleVoice(defaultVehicleSound(),{sampleRate}));
  const voice=createVehicleVoice();voice.render(driving,100);const before=voice.snapshot();
  for(const change of [v=>v.rpm=Infinity,v=>v.load=-1,v=>v.speed=251,v=>v.gear=13,v=>v.throttle=2,v=>v.slip=NaN,v=>v.code='x',v=>delete v.brake]){const input={...driving};change(input);assert.throws(()=>voice.render(input,100));assert.deepEqual(voice.snapshot(),before);}
  for(const count of [-1,1.5,NaN,VEHICLE_AUDIO_MAX_FRAMES+1]){assert.throws(()=>voice.render(driving,count));assert.deepEqual(voice.snapshot(),before);}
  assert.equal(voice.render({...driving,gear:4},0).length,0);assert.deepEqual(voice.snapshot(),before);
});
