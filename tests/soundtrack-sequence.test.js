// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSoundtrack,isSoundtrack} from '../modules/soundtrack/index.js';
import {SubHuntMusic} from '../demos/subhunt-lab/js/music.js';
const note=(frames,frequency=220)=>({frames,events:[{id:1,sample:0,duration:frames,channel:0,frequency,gain:2000,wave:'triangle'}]});
test('native soundtrack exactly preserves all three SubHunt v0.2.0 WAV receipts',()=>{
  const expected=['c764fe7f498ac40bb6dbb2856cbb906f021817736db4798bb7ecb2cad6834a3a','0f001c0ebe874adc3960d41867c177db62f1816eb41f5ff4753d70b7a90d080d','c5437b0634a46f90d3d4b4cd7e85a7951796310621b146df59e408b3f3c2c042'];
  expected.forEach((hash,mission)=>assert.equal(createHash('sha256').update(SubHuntMusic.wav(mission)).digest('hex'),hash));
});
test('unequal phrases concatenate correctly across boundaries with exact tick loop positions',()=>{
  const track=createSoundtrack({phrases:[note(1600),note(2400,330)]});
  assert.deepEqual(track.position(2),{phrase:1,offsetSamples:0,cycleSample:1600});
  assert.deepEqual(track.position(5),track.position(0));
  const large=Number.MAX_SAFE_INTEGER;
  assert.equal(track.position(large).cycleSample,Number(BigInt(large)*800n%4000n));
  const all=track.renderRange(0,4000),chunks=new Int16Array(4000);
  chunks.set(track.renderRange(0,777));chunks.set(track.renderRange(777,3223),777);assert.deepEqual(all,chunks);
  assert.deepEqual(all.slice(1600),track.renderPhrase(1));assert.equal(track.renderRange(4000,0).length,0);
  const wav=track.wav(),view=new DataView(wav.buffer);assert.equal(view.getUint32(40,true),8000);
  for(let i=0;i<4000;i++)assert.equal(view.getInt16(44+2*i,true),all[i]);
});
test('soundtrack owns inputs and rejects invalid clocks, holes, overlap, oversized loops and forged brands',()=>{
  const input=note(1600),track=createSoundtrack({phrases:[input]});input.events[0].frequency=900;
  const score=track.score(0);score.events[0].gain=0;assert.equal(track.score(0).events[0].frequency,220);assert.equal(track.score(0).events[0].gain,2000);
  assert.equal(isSoundtrack(track),true);assert.equal(isSoundtrack(Object.create(track)),false);
  for(const args of [{phrases:[]},{phrases:Array(9).fill(input)},{phrases:Array(1)},{phrases:[undefined]},{phrases:[note(1)]},{phrases:[input],tickRate:59},{phrases:[input],tickRate:0}])assert.throws(()=>createSoundtrack(args));
  assert.throws(()=>track.position(-1));assert.throws(()=>track.position(1.5));assert.throws(()=>track.renderRange(3999,2));
  assert.throws(()=>createSoundtrack({phrases:[{frames:1600,events:[...note(1600).events,{...note(1600).events[0],id:2}]}]}));
});
