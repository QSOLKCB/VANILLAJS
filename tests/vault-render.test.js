import test from 'node:test';
import assert from 'node:assert/strict';
import {VaultGeometry,captureVaultView,buildMechanisms,buildConsoles} from '../demos/clockwork-vault/view.js';
import {createVault,palette,exportVault,importVault} from '../demos/clockwork-vault/world.js';
import {referenceGeometry} from '../scripts/opt-render-reference.js';
import {viewWorkload,WORKLOADS,releaseForView} from '../scripts/opt-render-fixtures.js';
const flatten=g=>({vertices:[...g.mechanisms.vertices,...g.consoles.vertices],lines:[...g.mechanisms.lines,...g.consoles.lines]});

test('Cached geometry exactly preserves v1.0 vertices and order across all fixed workloads',()=>{
  for(const name of WORKLOADS){
    const cache=new VaultGeometry();
    for(const session of viewWorkload(name))assert.deepEqual(flatten(cache.update(session)),referenceGeometry(session),name);
  }
});
test('Camera, clock and pending crank states reuse geometry; latching invalidates only console glyphs',()=>{
  const s=createVault(),cache=new VaultGeometry(),first=cache.update(s),before=exportVault(s);
  s.ticks=100;s.mechanismTick=100;s.character.yaw=.3;s.character.position[0]=1;
  assert.equal(cache.update(s),first);
  s.locks[0].turn();for(let i=0;i<119;i++){s.locks[0].tick();assert.equal(cache.update(s),first);}
  s.locks[0].tick();const changed=cache.update(s);
  assert.equal(changed.mechanisms,first.mechanisms);assert.notEqual(changed.consoles,first.consoles);
  const restored=cache.update(importVault(before));assert.deepEqual(flatten(restored),referenceGeometry(createVault()));assert.notEqual(restored.consoles,first.consoles);
});
test('Gate and lift motion invalidate only mechanism geometry after progress is published',()=>{
  const s=createVault(),cache=new VaultGeometry();releaseForView(s,0);const first=cache.update(s);
  s.mechanismTick=90;const moving=cache.update(s);assert.equal(moving.consoles,first.consoles);assert.notEqual(moving.mechanisms,first.mechanisms);
  s.mechanismTick=180;const settled=cache.update(s);s.mechanismTick=900;assert.equal(cache.update(s),settled);
  for(let i=1;i<5;i++)releaseForView(s,i);const lower=cache.update(s);s.mechanismTick=1350;const upper=cache.update(s);
  assert.equal(lower.consoles,upper.consoles);assert.notEqual(lower.mechanisms,upper.mechanisms);
});
test('Cached results are immutable, owned, bounded to current slots and invalidated on clear',()=>{
  const cache=new VaultGeometry(),s=createVault(),a=cache.update(s);
  assert.throws(()=>a.mechanisms.vertices[0]=123,TypeError);assert.throws(()=>a.consoles.lines.push(123),TypeError);
  assert.throws(()=>a.consoles={vertices:[],lines:[]},TypeError);
  s.locks[0].lever(1);const b=cache.update(s);s.locks[0].undo();const again=cache.update(s);
  assert.notEqual(again.consoles,a.consoles);assert.deepEqual(again,a);assert.notEqual(b.consoles,again.consoles);
  cache.clear();assert.notEqual(cache.update(s).mechanisms,again.mechanisms);
  const captured=captureVaultView(s);s.locks[0].lever(1);
  assert.deepEqual({mechanisms:buildMechanisms(captured.mechanisms),consoles:buildConsoles(captured.consoles)},again);
});
test('Complete effective identity includes colours; failed capture does not publish a generation',()=>{
  const cache=new VaultGeometry(),s=createVault(),a=cache.update(s),light=palette.light[0];
  try{palette.light[0]=.4;const b=cache.update(s);assert.notDeepEqual(b,a);assert.deepEqual(flatten(b),referenceGeometry(s));}
  finally{palette.light[0]=light;}
  const restored=cache.update(s),lock=s.locks[0];s.locks[0]={snapshot(){throw new Error('read failed');}};
  assert.throws(()=>cache.update(s),/read failed/);s.locks[0]=lock;assert.equal(cache.update(s),restored);
});
