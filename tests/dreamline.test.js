// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,projectFromText} from '../demos/dreamline/film.js';
import {roots,neighbors,projection,walk,support} from '../demos/dreamline/geometry.js';
import {physicalTake,poseIndex} from '../demos/dreamline/horizon.js';
import {fixture,synthesize,validateScore,FRAMES} from '../demos/dreamline/music.js';
import {DreamTransport} from '../demos/dreamline/transport.js';
test('240 roots, 6720 actual edges, finite projection and separate CRT support',()=>{
  assert.equal(roots.length,240);assert.equal(new Set(projection.map(p=>p.map(x=>x.toFixed(5)).join())).size,240);
  assert.ok(neighbors.every(row=>row.length===56));
  for(let i=1;i<walk.length;i++)assert.ok(neighbors[walk[i-1]].includes(walk[i]));
  assert.equal(new Set(Array.from({length:303},(_,i)=>support(i).join())).size,303);
});
test('real 60 Hz coastal take has cornering and wheel travel, indexed at 30 fps',()=>{
  for(let i=0;i<600;i++){assert.equal(poseIndex(i*1600),i);assert.equal(poseIndex(i*1600+1599),i);}
  const {poses}=physicalTake();assert.equal(poses.length,601);
  const end=poses.at(-1);assert.ok(end.progress.distance>300);assert.equal(end.progress.recoveries,0);
  assert.ok(poses.some(p=>p.player.position[0]>24));assert.ok(new Set(poses.map(p=>p.player.wheels[0].compression)).size>100);
});
test('bounded data-only edits, stereo render and terminal silence',()=>{
  assert.deepEqual(projectFromText(JSON.stringify(defaults)),defaults);
  for(const p of [{...defaults,source:'bad'},{...defaults,metal:'url(x)'},{...defaults,detail:0}])assert.throws(()=>projectFromText(JSON.stringify(p)));
  const s=fixture(),pcm=synthesize(s);
  assert.throws(()=>validateScore({...s,source:[s.source]}));
  assert.equal(pcm.length,2*FRAMES);assert.ok(pcm.subarray(-48000).every(x=>x===0));
  assert.ok(pcm.subarray(0,48000).some((v,i)=>i%2===0&&v!==pcm[i+1]));
  for(const notes of [[[-1,2,0,44]],[[0,2,8,44]],[[3,4,0,23],[0,2,0,23]]])assert.throws(()=>validateScore({...s,notes}));
});
test('direct silent seek and terminal transport do not wrap',async()=>{
  const t=new DreamTransport(null);await t.seek(FRAMES);await t.play(true);
  assert.equal(t.running,false);assert.equal(t.sample(),FRAMES);assert.throws(()=>t.seek(FRAMES+1));
  await t.seek(4000);await t.play(true);t.pause();assert.ok(t.sample()>=4000);
});
