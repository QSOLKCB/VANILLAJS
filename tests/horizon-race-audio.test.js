// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {RaceAudio,vehicleSoundControls} from '../demos/horizon-lab/race-audio.js';
import {defaultVehicleSound,createVehicleVoice} from '../modules/vehicle-audio/index.js';
const driving={rpm:4200,gear:3,brake:.2,velocity:[0,0,-30],wheels:Array.from({length:4},()=>({grounded:true,load:2943,slip:.5}))};
const input={throttle:.8,brake:.1};
function device(){
  const listeners=new Set(),sources=[],gains=[],context={state:'suspended',currentTime:2,destination:{},sources,gains,
    addEventListener(event,fn){assert.equal(event,'statechange');listeners.add(fn);},removeEventListener(event,fn){listeners.delete(fn);},
    change(state){this.state=state;for(const fn of listeners)fn();},
    createGain(){const gain={connect(){},disconnect(){this.disconnected=true;},gain:{value:0,setValueAtTime(value,time){this.value=value;this.time=time;},linearRampToValueAtTime(value,time){this.value=value;this.ramp=time;},cancelScheduledValues(){this.cancelled=true;}}};gains.push(gain);return gain;},
    createBuffer(channels,frames,rate){const pcm=new Float32Array(frames);return {duration:frames/rate,channels,rate,pcm,getChannelData(channel){assert.equal(channel,0);return pcm;}};},
    createBufferSource(){const source={connect(){},disconnect(){this.disconnected=true;},start(when){this.when=when;},stop(){this.stopped=true;}};sources.push(source);return source;},
    async resume(){this.state='running';},async close(){this.closed=true;this.state='closed';},
    advance(seconds){this.currentTime+=seconds;for(const source of sources)if(source.onended&&source.when+source.buffer.duration<=this.currentTime)source.onended();}};
  return context;
}
test('sound controls derive RPM, force-normalized contact load and slip from real state without mutation',()=>{
  const before=JSON.stringify(driving),controls=vehicleSoundControls(driving,input,1200);
  assert.deepEqual(controls,{rpm:4200,throttle:.8,load:1,slip:.25,brake:.1,speed:30,gear:3});assert.equal(JSON.stringify(driving),before);
  const airborne={...driving,wheels:driving.wheels.map(w=>({...w,grounded:false}))};assert.equal(vehicleSoundControls(airborne,input).load,0);assert.equal(vehicleSoundControls(airborne,input).slip,0);
  assert.throws(()=>vehicleSoundControls({...driving,rpm:NaN},input));assert.throws(()=>vehicleSoundControls(driving,input,0));
});
test('no autoplay: explicit start owns context; bounded contiguous buffers match pure synthesis',async()=>{
  const context=device();let created=0;const audio=new RaceAudio(defaultVehicleSound(),{contextFactory:()=>{created++;return context;}});
  audio.update(driving,input);assert.equal(created,0);assert.equal(audio.enabled,false);assert.equal(await audio.start(),true);assert.equal(created,1);audio.update(driving,input);
  assert.equal(context.sources.length,2);const expected=createVehicleVoice(),controls=vehicleSoundControls(driving,input);
  for(const source of context.sources){assert.deepEqual(source.buffer.pcm,expected.render(controls,2048));assert.equal(source.buffer.channels,1);assert.equal(source.buffer.rate,48000);}
  assert.equal(context.sources[1].when,context.sources[0].when+2048/48000);
  for(let i=0;i<120;i++){context.advance(1/60);audio.update(driving,input);assert.ok(audio.snapshot().voices<=audio.snapshot().maxVoices);}
  assert.ok(audio.snapshot().started>30);assert.equal(audio.snapshot().resyncs,0);audio.dispose();assert.equal(context.closed,true);assert.ok(context.sources.every(source=>source.disconnected));
});
test('pause, mute, focus stop and disposal cancel every scheduled tail and require another gesture',async()=>{
  for(const action of ['stop','disable','dispose']){const context=device(),audio=new RaceAudio(defaultVehicleSound(),{contextFactory:()=>context});await audio.start();audio.update(driving,input);audio[action]();
    assert.equal(audio.snapshot().voices,0);assert.equal(audio.snapshot().active,false);assert.ok(context.sources.every(source=>source.stopped&&source.disconnected));assert.equal(context.gains[0].gain.value,0);assert.equal(context.gains[0].gain.cancelled,true);
    const count=context.sources.length;audio.update(driving,input);assert.equal(context.sources.length,count);assert.equal(audio.enabled,action==='stop');
    if(action==='stop'){assert.equal(await audio.start(),true);audio.update(driving,input);assert.ok(context.sources.length>count);}else if(action==='dispose'){assert.equal(await audio.start(),false);audio.dispose();}
    audio.dispose();}
});
test('stop/dispose while resume is pending cannot re-enable a late device completion',async()=>{
  for(const action of ['stop','disable','dispose']){const context=device();let resolve;context.resume=()=>new Promise(done=>{resolve=()=>{context.state='running';done();};});const audio=new RaceAudio(defaultVehicleSound(),{contextFactory:()=>context});const start=audio.start();audio[action]();resolve();assert.equal(await start,false);audio.update(driving,input);assert.equal(context.sources.length,0);assert.equal(audio.snapshot().active,false);audio.dispose();}
});
test('a stale resume completion or rejection cannot cancel a newer successfully started voice',async()=>{
  for(const action of ['stop','disable'])for(const late of ['resolve','reject']){
    const context=device(),pending=[];context.resume=()=>new Promise((resolve,reject)=>pending.push({resolve:()=>{context.state='running';resolve();},reject:()=>reject(Error('old request failed'))}));
    const audio=new RaceAudio(defaultVehicleSound(),{contextFactory:()=>context}),first=audio.start();audio[action]();const newest=audio.start();pending[1].resolve();assert.equal(await newest,true);audio.update(driving,input);const accepted=audio.snapshot();assert.equal(accepted.active,true);assert.ok(accepted.voices>0);
    pending[0][late]();assert.equal(await first,false);assert.deepEqual(audio.snapshot(),accepted,'old operation cannot silence or replace the new stream');audio.dispose();
  }
});
test('device loss and scheduling failure cancel resources, report failure and allow explicit fresh retry',async()=>{
  for(const failure of ['interrupt','buffer','source-start','resume','gain']){const first=device(),second=device();let calls=0;
    if(failure==='resume')first.resume=async()=>{throw Error('device denied');};
    if(failure==='gain')first.createGain=()=>{throw Error('device lost');};
    const audio=new RaceAudio(defaultVehicleSound(),{contextFactory:()=>calls++?second:first});await audio.start();
    if(failure==='buffer')first.createBuffer=()=>{throw Error('device lost');};
    if(failure==='source-start')first.createBufferSource=()=>{const source={connect(){},disconnect(){this.disconnected=true;},start(){throw Error('device lost');},stop(){this.stopped=true;}};first.sources.push(source);return source;};
    audio.update(driving,input);if(failure==='interrupt')first.change('suspended');assert.equal(audio.enabled,false);assert.equal(audio.snapshot().voices,0);assert.ok(audio.snapshot().error);assert.equal(first.closed,true);assert.ok(first.sources.every(source=>source.stopped&&source.disconnected));
    assert.equal(await audio.start(),true);audio.update(driving,input);assert.equal(calls,2);assert.ok(second.sources.length>0);assert.equal(audio.snapshot().error,'');audio.dispose();}
});
test('accepted recipe edits replace queued audio, rejected edits retain accepted stream and playback',async()=>{
  const context=device(),audio=new RaceAudio(defaultVehicleSound(),{contextFactory:()=>context});await audio.start();audio.update(driving,input);const before=audio.snapshot();assert.throws(()=>audio.setProfile({...defaultVehicleSound(),engineGain:-1}));assert.deepEqual(audio.snapshot(),before);
  audio.setProfile({...defaultVehicleSound(),engineGain:.3});assert.equal(audio.snapshot().voices,0);assert.equal(audio.snapshot().active,true);assert.ok(context.sources.every(source=>source.stopped));audio.update(driving,input);assert.ok(audio.snapshot().voices>0);audio.dispose();
});
test('large render stalls resynchronize a bounded queue without replaying stale sound',async()=>{
  const context=device(),audio=new RaceAudio(defaultVehicleSound(),{contextFactory:()=>context});await audio.start();audio.update(driving,input);context.advance(3);audio.update({...driving,rpm:2000},input);assert.equal(audio.snapshot().resyncs,1);assert.ok(audio.snapshot().voices<=4);assert.ok(context.sources.at(-1).when>=context.currentTime);audio.dispose();
});
