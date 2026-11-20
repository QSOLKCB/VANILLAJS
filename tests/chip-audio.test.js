// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createChipAudio,makeChipWave,PAULA_CLOCK,PAULA_PAN,isChipAudio,CHIP_AUDIO_RATE} from '../modules/chip-audio/index.js';
const event=(id,channel,more={})=>({id,channel,start:0,duration:4800,gate:2400,period:124,volume:64,
  attack:0,decay:0,sustain:15,release:0,loop:true,sample:new Int8Array([127]),...more});
const stereo=(pcm,ch)=>Array.from(pcm.filter((_,i)=>i%2===ch));
test('four Paula channels are hard-panned 0/3 left and 1/2 right',()=>{
  assert.deepEqual(PAULA_PAN,['left','right','right','left']);
  const left=createChipAudio({frames:4800,events:[event(1,0),event(2,3)]}).renderAll();
  const right=createChipAudio({frames:4800,events:[event(1,1),event(2,2)]}).renderAll();
  assert.ok(stereo(left,0).some(n=>n>0));assert.ok(stereo(right,1).some(n=>n>0));
  assert.ok(stereo(left,1).every(n=>n===0));assert.ok(stereo(right,0).every(n=>n===0));
  assert.equal(Math.max(...stereo(left,0)),32512);
});
test('six-bit volume 0..64 is linear and voices own copied 8-bit PCM',()=>{
  const pcm=new Int8Array([127]),score=createChipAudio({frames:4800,events:[event(1,0,{sample:pcm})]});
  pcm[0]=0;
  assert.ok(score.renderRange(100,1)[0]>0);
  const half=createChipAudio({frames:4800,events:[event(1,0,{volume:32})]});
  assert.equal(score.renderRange(800,1)[0],2*half.renderRange(800,1)[0]);
  assert.ok(createChipAudio({frames:100,events:[event(1,0,{duration:100,gate:50,volume:0})]}).renderAll().every(n=>n===0));
});
test('ADSR actually gates and releases from attained level, before or after full attack',()=>{
  const score=createChipAudio({frames:1800,events:[event(1,0,{duration:1800,gate:500,sustain:8,attack:6,decay:2,release:0})]});
  const x=score.renderAll();
  assert.equal(x[0],0);assert.ok(x[2*100]>x[0]);assert.ok(x[2*300]>x[2*100]);
  assert.ok(x[2*499]>x[0]);assert.ok(x[2*500]<x[2*499]);
  assert.equal(x[2*800],0);
  const sustain=createChipAudio({frames:2000,events:[event(1,0,{duration:2000,gate:1600,sustain:5,attack:0,decay:0})]}).renderAll();
  assert.equal(sustain[2*1000],127*64*5*17*2/255|0);
});
test('source sample period and non-looping playback enforce bounded alias and silence',()=>{
  const played=createChipAudio({frames:2000,clock:'ntsc',events:[event(1,0,{duration:2000,gate:1900,period:124,loop:false,sample:new Int8Array([127])})]});
  assert.ok(played.renderRange(1,1)[0]>0); // 0.60 source bytes per output frame
  assert.equal(played.renderRange(2,1)[0],0); // PCM index now advances to 1
  assert.equal(PAULA_CLOCK.pal,3546895);
});
test('split versus full ranges give exact PCM under both filter and stereo profile',()=>{
  const events=[event(10,0,{start:5,duration:650,gate:400,attack:2,sustain:7,sample:makeChipWave({wave:'triangle',frames:32})}),
    event(11,1,{start:120,duration:700,gate:620,period:250,volume:39,sample:makeChipWave({wave:'noise',frames:64,seed:42})}),
    event(12,2,{start:60,duration:710,gate:500,period:245,volume:30,sample:makeChipWave({wave:'square',frames:16})})];
  for(const filter of ['off','led-approx']){
    const score=createChipAudio({frames:900,events,filter}),whole=score.renderAll();
    for(const [start,count] of [[0,25],[25,50],[77,29],[400,120],[899,1]])
      assert.deepEqual(score.renderRange(start,count),whole.slice(start*2,(start+count)*2));
    assert.deepEqual(score.renderRange(0,0),new Int16Array());
  }
});
test('int8 waveforms and noise are repeatable but distinct across seeds',()=>{
  for(const wave of ['square','triangle','saw','noise']){
    const a=makeChipWave({wave,frames:64,seed:17});assert.equal(a.length,64);
    assert.deepEqual(a,makeChipWave({wave,frames:64,seed:17}));
  }
  assert.notDeepEqual(makeChipWave({wave:'noise',seed:17}),makeChipWave({wave:'noise',seed:18}));
});
test('WAV is exactly 48 kHz 2-channel 16-bit PCM with verified data layout',()=>{
  const score=createChipAudio({frames:384,events:[event(1,0,{duration:384,gate:200})]});
  assert.ok(isChipAudio(score));assert.equal(score.sampleRate,CHIP_AUDIO_RATE);
  const wav=score.wav(),v=new DataView(wav.buffer,wav.byteOffset,wav.byteLength);
  assert.equal(String.fromCharCode(...wav.slice(0,4)),'RIFF');
  assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint32(24,true),48000);
  assert.equal(v.getUint16(34,true),16);assert.equal(v.getUint32(40,true),384*4);
  assert.equal(wav.length,44+384*4);
  assert.equal(v.getInt16(44,true),score.renderRange(0,1)[0]);
});
test('event admission fails closed for overlap, invalid PCM, type confusion and bounds',()=>{
  assert.throws(()=>createChipAudio({frames:100,events:[event(1,0,{duration:100,gate:100}),event(2,0,{start:1,duration:20,gate:10})]}),/overlap/);
  assert.throws(()=>createChipAudio({frames:100,events:[event(1,0,{duration:100,gate:50}),event(1,1,{duration:100,gate:50})]}),/duplicate/);
  assert.throws(()=>createChipAudio({frames:100,events:[event(1,0,{duration:100,gate:50,sample:[128]})]}));
  assert.throws(()=>createChipAudio({frames:100,events:[event(1,0,{duration:100,gate:50,volume:65})]}));
  assert.throws(()=>createChipAudio({frames:100,events:[event(1,0,{duration:100,gate:50,period:100})]}));
  assert.throws(()=>createChipAudio({frames:100,events:[event(1,0,{duration:100,gate:50,release:16})]}));
  assert.throws(()=>createChipAudio({frames:100,events:[event(1,0,{duration:100,gate:50,sample:[,]})]}));
  assert.throws(()=>createChipAudio({frames:100,events:[event(1,0,{duration:100,gate:50,loop:0})]}));
  assert.throws(()=>createChipAudio({clock:'invalid'}));
  assert.throws(()=>createChipAudio({frames:384001}));
  const bad=event(1,0,{duration:100,gate:50}),a={...bad};let touched=false;
  Object.defineProperty(a,'sample',{get(){touched=true;return [127];},enumerable:true});
  assert.throws(()=>createChipAudio({frames:100,events:[a]}));assert.equal(touched,false);
});
test('score metadata is safe and does not expose private mutable PCM',()=>{
  const score=createChipAudio({frames:150,events:[event(2,1,{start:20,duration:130,gate:80}),event(1,0,{start:0,duration:150,gate:90})]});
  assert.deepEqual(score.eventSummary().map(e=>e.id),[1,2]);
  const meta=score.eventSummary()[0];assert.equal(meta.sampleLength,1);
  assert.equal(Object.hasOwn(meta,'pcm'),false);
  assert.ok(Object.isFrozen(meta));
  assert.equal(score.renderRange(150,0).length,0);
  assert.throws(()=>score.renderRange(150,1));
});
