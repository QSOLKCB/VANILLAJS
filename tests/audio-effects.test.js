// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSound2D,isSound2D} from '../modules/audio2d/index.js';
import {createEffectPlayer} from '../api/audio/index.js';
function context(){const nodes=[],ctx={state:'running',currentTime:3,destination:{},buffers:0,nodes};const node=()=>{const n={connect(){},disconnect(){this.disconnected=true;},stop(){this.stopped=true;},start(...args){this.started=args;},gain:{value:1},pan:{value:0}};nodes.push(n);return n;};ctx.createBuffer=(ch,size)=>{ctx.buffers++;return {getChannelData:()=>new Float32Array(size)};};ctx.createGain=node;ctx.createBufferSource=node;ctx.createStereoPanner=node;return ctx;}
const sound=()=>createSound2D({frames:4800,events:[{id:1,sample:0,duration:4800,channel:0,frequency:220,wave:'triangle',gain:4000}]});
test('effect player authenticates owned scores, uses identity cache and releases all nodes',()=>{
  const ctx=context(),player=createEffectPlayer(ctx),score=sound();assert.equal(isSound2D(score),true);assert.equal(isSound2D({...score}),false);assert.throws(()=>player.play({...score}));
  const handle=player.play(score);player.play(score);assert.equal(ctx.buffers,1);player.play(sound());assert.equal(ctx.buffers,2);assert.equal(player.stop(handle),true);assert.equal(player.stop(handle),false);
  player.dispose();assert.ok(ctx.nodes.every(n=>n.disconnected));assert.equal(player.snapshot().voices,0);assert.equal(player.snapshot().buffers,0);assert.throws(()=>player.play(score));
});
test('effect budgets evict oldest voices and buffers; handles cannot cross players',()=>{
  const ctx=context(),p=createEffectPlayer(ctx,{maxVoices:2,maxBuffers:1}),q=createEffectPlayer(ctx);const first=p.play(sound()),foreign=q.play(sound());assert.equal(p.stop(foreign),false);
  p.play(sound());p.play(sound());assert.equal(p.stop(first),false);assert.equal(p.snapshot().voices,2);assert.equal(p.snapshot().buffers,1);p.stopAll();q.dispose();assert.ok(ctx.nodes.every(n=>n.disconnected));
});
test('late effect scheduling seeks or skips, suspended devices allocate nothing',()=>{
  const ctx=context(),p=createEffectPlayer(ctx),score=sound();assert.equal(p.play(score,{when:1}),null);assert.equal(ctx.buffers,0);
  const handle=p.play(score,{when:2.95});assert.ok(handle);assert.ok(Math.abs(ctx.nodes[0].started[1]-.05)<1e-9);
  ctx.state='suspended';assert.equal(p.play(score),null);assert.equal(p.snapshot().voices,1);p.dispose();
});
test('partial construction failures release independent nodes and invalid budgets/options reject',()=>{
  const ctx=context(),p=createEffectPlayer(ctx);ctx.createStereoPanner=()=>{throw new Error('device lost');};assert.throws(()=>p.play(sound()),/device lost/);assert.equal(p.snapshot().voices,0);assert.ok(ctx.nodes.every(n=>n.disconnected));
  for(const options of [{maxVoices:0},{maxBuffers:65},{maxVoices:NaN}])assert.throws(()=>createEffectPlayer(ctx,options));
  for(const options of [{when:NaN},{pan:2},{gain:-1},{offset:Infinity}])assert.throws(()=>p.play(sound(),options));p.dispose();
});
