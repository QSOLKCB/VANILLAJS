// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSoundtrack} from '../modules/soundtrack/index.js';
import {createSoundtrackPlayer} from '../api/audio/index.js';
const track=()=>createSoundtrack({phrases:[{frames:48000,events:[]},{frames:96000,events:[]}]});
function context(){return {state:'running',currentTime:0,destination:{},sources:[],createBuffer:(n,size)=>({getChannelData:()=>new Float32Array(size)}),createBufferSource(){const v={connect(){},disconnect(){this.disconnected=true;},start(time,offset){this.time=time;this.offset=offset;},stop(){this.stopped=true;}};this.sources.push(v);return v;}};}
test('browser adapter queues unequal phrases gaplessly, stops all voices and resumes at a frozen tick',()=>{
  const c=context(),p=createSoundtrackPlayer(c,track());p.sync(30);assert.equal(c.sources[0].offset,.5);
  c.currentTime=.25;p.sync(45);assert.equal(c.sources[1].time,.525);assert.equal(c.sources[1].offset,0);
  p.stop();assert.ok(c.sources.every(v=>v.stopped&&v.disconnected));assert.equal(p.snapshot().voices,0);
  c.currentTime=10;const before=c.sources.length;p.sync(45);assert.equal(c.sources[before].offset,.75);
  p.sync(45,false);assert.equal(p.snapshot().active,false);
});
test('device suspension, backwards seek and drift reanchor presentation; dispose releases caches',()=>{
  const c=context(),p=createSoundtrackPlayer(c,track());p.sync(30);c.currentTime=.1;p.sync(29);assert.equal(p.snapshot().resyncs,1);assert.ok(c.sources[0].stopped);
  c.currentTime=5;p.sync(29);assert.equal(p.snapshot().resyncs,2);
  c.state='suspended';p.sync(30);assert.equal(p.snapshot().active,false);
  p.dispose();assert.equal(p.snapshot().cachedPhrases,0);assert.throws(()=>p.sync(30),/disposed/);
});
test('player rejects counterfeit tracks and unbounded short-phrase scheduling',()=>{
  assert.throws(()=>createSoundtrackPlayer(context(),Object.create(track())));
  assert.throws(()=>createSoundtrackPlayer(null,track()));
  assert.throws(()=>createSoundtrackPlayer(context(),createSoundtrack({phrases:[{frames:800,events:[]}]})),/250 ms/);
  const c=context(),p=createSoundtrackPlayer(c,createSoundtrack({phrases:[{frames:12000,events:[]}]}));p.sync(0);assert.ok(p.snapshot().voices<=4);
});
test('a failed device start disconnects the voice and rolls back scheduling state',()=>{
  const c=context(),factory=c.createBufferSource;
  c.createBufferSource=function(){const v=factory.call(c);v.start=()=>{throw Error('device error');};return v;};
  const p=createSoundtrackPlayer(c,track());assert.throws(()=>p.sync(0),/device error/);assert.equal(p.snapshot().active,false);assert.equal(p.snapshot().voices,0);assert.ok(c.sources[0].disconnected);
});
