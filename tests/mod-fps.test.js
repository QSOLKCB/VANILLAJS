// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFPSPack,FPSPackSlot,canonicalFPS,compileFPSArena} from '../modules/mod-fps/index.js';
import {starterFPSPack} from '../demos/block-arena-lab/packs.js';
const data=(m,key)=>m.entries.find(e=>e.id===key).data;
test('two original inert packs export/reimport identically; geometry and ramps are shared owned snapshots',()=>{for(const index of [0,1]){const p=validateFPSPack(starterFPSPack(index));assert.equal(validateFPSPack(p.bytes).bytes,p.bytes);assert.equal(compileFPSArena(p),p.solids);assert.ok(p.solids.some(s=>s.id.startsWith('ramp-')));assert.throws(()=>p.geometry.blocks.push({}));assert.throws(()=>p.solids[0].box.min[0]=99);}});
test('geometry, support, spawn clearance, bounds, weapons and wave budgets reject atomically',()=>{
  const slot=new FPSPackSlot(starterFPSPack()),before=slot.pack,registry=slot.list();
  const bad=[m=>data(m,'geometry').blocks[0].x=100,m=>data(m,'geometry').blocks[0].x=.1,m=>data(m,'geometry').blocks[0].w=-1,
    m=>data(m,'geometry').ramps[0].d=.5,m=>data(m,'spawns').player=[-6,0,-3],m=>data(m,'spawns').player=[0,2,0],m=>data(m,'spawns').bots[0]=data(m,'spawns').player.slice(),
    m=>data(m,'arsenal').weapons[0].damage=NaN,m=>data(m,'arsenal').weapons[1].archetype='precision',m=>data(m,'waves').rosters[0]=Array(9).fill('scout'),m=>data(m,'bots').types[0].weapon='unknown',m=>data(m,'settings').rules.durationTicks=36001];
  for(const change of bad){const m=starterFPSPack();change(m);assert.throws(()=>slot.replace(m));assert.equal(slot.pack,before);assert.deepEqual(slot.list(),registry);}
});
test('malformed, cyclic, executable, accessor, oversized and unsafe content cannot enter the slot',()=>{
  const slot=new FPSPackSlot(starterFPSPack()),bytes=slot.pack.bytes;
  const cycle=starterFPSPack();cycle.entries[0].data.self=cycle;const fn=starterFPSPack();fn.entries[0].data.execute=()=>{};
  const getter=starterFPSPack();Object.defineProperty(getter.entries[0].data,'title',{get(){throw Error('executed');},enumerable:true});
  for(const source of ['{',' '.repeat(32769),cycle,fn,getter,'{"__proto__":{}}',canonicalFPS({...starterFPSPack(),unexpected:true})]){assert.throws(()=>slot.replace(source));assert.equal(slot.pack.bytes,bytes);}
});
