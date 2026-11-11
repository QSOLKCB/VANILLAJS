// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {DataModRegistry,validateModManifest,MOD_PACK_KIND,
  MAX_ENTRIES,MAX_REQUIRES,MAX_PACKS} from '../modules/mod-sdk/index.js';
const manifest=(id,requires=[],entries=[])=>({
  kind:MOD_PACK_KIND,id,version:'1.0.0',requires,entries
});
const dependency=(id,version='1.0.0')=>({id,version});
const entry=(id,data)=>({id,kind:'data',data});
const clone=value=>structuredClone(value);

test('public example is data-only, detached, deeply frozen and can activate',async()=>{
  const json=JSON.parse(await readFile(new URL('../examples/mod-sdk-001/data-pack.json',import.meta.url),'utf8'));
  const normalized=validateModManifest(json);
  assert.equal(normalized.kind,MOD_PACK_KIND);
  assert.ok(Object.isFrozen(normalized)&&Object.isFrozen(normalized.entries));
  assert.ok(Object.isFrozen(normalized.entries[0].data));
  assert.ok(Object.isFrozen(normalized.entries[0].data.labels));
  json.entries[0].data.labels[0]='tampered';
  assert.equal(normalized.entries[0].data.labels[0],'cyan');
  assert.throws(()=>normalized.entries[0].data.labels.push('error'),TypeError);
  const registry=new DataModRegistry();
  registry.register(json);
  assert.deepEqual(registry.activate('retro-palette'),['retro-palette']);
  assert.equal(registry.activeEntries().length,1);
  assert.equal(registry.activeEntries()[0].entry.data.accent,'#62ebd1');
});
test('strict schema rejects versions, prototypes, extra fields and accessors',()=>{
  for(const bad of ['1.2','01.0.0','1.0.0+preview','1.0.1000',3]){
    const value=manifest('valid');value.version=bad;
    assert.throws(()=>validateModManifest(value),TypeError);
  }
  const extra=manifest('valid');extra.permissions=['execute'];
  assert.throws(()=>validateModManifest(extra),TypeError);
  const accessor=manifest('valid');
  Object.defineProperty(accessor,'id',{get(){throw Error('must not run getter');}});
  assert.throws(()=>validateModManifest(accessor),TypeError);
  class Fake extends Object{}
  const exotic=new Fake();
  Object.assign(exotic,manifest('valid'));
  assert.throws(()=>validateModManifest(exotic),TypeError);
  for(const id of ['a.b','../code','-no','UPPER','']){
    assert.throws(()=>validateModManifest(manifest(id)),TypeError);
  }
});
test('strict data admission rejects functions, symbols, cycles, getters and prototypes',()=>{
  const invalid=[()=>0,Symbol('x'),NaN,Infinity,1n,undefined];
  for(const value of invalid){
    assert.throws(()=>validateModManifest(manifest('valid',[],[entry('payload',value)])),
      /TypeError|RangeError/);
  }
  const cyclic={name:'circle'};cyclic.self=cyclic;
  assert.throws(()=>validateModManifest(manifest('valid',[],[entry('payload',cyclic)])),TypeError);
  const data={x:1};
  Object.defineProperty(data,'getter',{get(){throw Error('must not run getter');}});
  assert.throws(()=>validateModManifest(manifest('valid',[],[entry('payload',data)])),TypeError);
  const polluted=JSON.parse('{"__proto__":{"admin":true}}');
  assert.throws(()=>validateModManifest(manifest('valid',[],[entry('payload',polluted)])),TypeError);
  const special=manifest('valid',[],[entry('payload',new Date())]);
  assert.throws(()=>validateModManifest(special),TypeError);
  assert.equal({}.admin,undefined);
});
test('byte size, entry count, depth and array caps fail before registry mutation',()=>{
  const giant=manifest('max',[],[entry('long',{
    a:'🪐'.repeat(3000),b:'🪐'.repeat(3000),c:'🪐'.repeat(3000)
  })]);
  assert.throws(()=>validateModManifest(giant),RangeError);
  const tooMany=manifest('max',[],Array.from({length:MAX_ENTRIES+1},(_,i)=>entry('e'+i,{})));
  assert.throws(()=>validateModManifest(tooMany),TypeError);
  const tooManyReq=manifest('max',Array.from({length:MAX_REQUIRES+1},(_,i)=>dependency('r'+i)));
  assert.throws(()=>validateModManifest(tooManyReq),TypeError);
  let deep={value:0};for(let i=0;i<12;i++)deep={next:deep};
  assert.throws(()=>validateModManifest(manifest('max',[],[entry('deep',deep)])),RangeError);
  const sparse=manifest('max',[],[entry('data',[0,1,2])]);
  delete sparse.entries[0].data[1];
  assert.throws(()=>validateModManifest(sparse),TypeError);
});
test('duplicate entries, self dependencies and same-dependency duplicates reject',()=>{
  assert.throws(()=>validateModManifest(manifest('alpha',[],[entry('a',{}),entry('a',{})])),TypeError);
  assert.throws(()=>validateModManifest(manifest('alpha',[dependency('alpha')])),RangeError);
  assert.throws(()=>validateModManifest(manifest('alpha',[dependency('beta'),dependency('beta')])),RangeError);
});
test('untrusted script-like strings remain inert data; nothing executes',()=>{
  let invoked=false;
  const data={source:"eval('oops')",url:'javascript:alert(1)',label:'test'};
  const reg=new DataModRegistry();
  reg.register(manifest('inert',[],[entry('text',data)]));
  reg.activate('inert');
  assert.equal(reg.activeEntries()[0].entry.data.source,data.source);
  assert.equal(invoked,false);
  // This is deliberately NOT a script permission or execution sandbox.
});
test('out-of-order registration and dependency activation are atomic',()=>{
  const r=new DataModRegistry();
  r.register(manifest('app',[dependency('lib')]));
  assert.throws(()=>r.activate('app'),RangeError);
  assert.equal(r.activeEntries().length,0);
  r.register(manifest('lib',[],[entry('theme',{accent:'#13f'})]));
  assert.deepEqual(r.activate('app'),['lib','app']);
  assert.deepEqual(r.list().map(x=>[x.id,x.active]),[['app',true],['lib',true]]);
  assert.equal(r.get('lib').version,'1.0.0');
  assert.equal(r.get('missing'),null);
  assert.throws(()=>r.register(manifest('lib')),RangeError);
});
test('incompatible exact versions reject without partial activation',()=>{
  const r=new DataModRegistry();
  r.register(manifest('a',[dependency('b','2.0.0')]));
  r.register(manifest('b'));
  assert.throws(()=>r.activate('a'),/incompatible dependency/);
  assert.deepEqual(r.list().map(x=>x.active),[false,false]);
});
test('a late dependency cycle is rejected atomically',()=>{
  const r=new DataModRegistry();
  r.register(manifest('a',[dependency('b')]));
  assert.throws(()=>r.register(manifest('b',[dependency('a')])),/cycle/);
  assert.equal(r.get('b'),null);
  r.register(manifest('b'));
  assert.deepEqual(r.activate('a'),['b','a']);
});
test('active dependents block removal; deactivation preserves underlying libraries',()=>{
  const r=new DataModRegistry();
  r.register(manifest('base'));
  r.register(manifest('panel',[dependency('base')]));
  r.register(manifest('game',[dependency('panel')]));
  assert.deepEqual(r.activate('game'),['base','panel','game']);
  assert.throws(()=>r.deactivate('base'),/dependent/);
  assert.throws(()=>r.unregister('panel'),/deactivate/);
  r.deactivate('game');
  assert.throws(()=>r.deactivate('base'),/dependent/);
  r.deactivate('panel');
  r.deactivate('base');
  assert.throws(()=>r.unregister('base'),/dependent/);
  r.unregister('game');r.unregister('panel');r.unregister('base');
  assert.equal(r.list().length,0);
});
test('deterministic active entry order is qualified by containing mod ID',()=>{
  const r=new DataModRegistry();
  r.register(manifest('zeta',[],[entry('shared',{v:2})]));
  r.register(manifest('alpha',[],[entry('shared',{v:1})]));
  r.activate('zeta');r.activate('alpha');
  assert.deepEqual(r.activeEntries().map(e=>e.modId),['alpha','zeta']);
  assert.equal(r.activeEntries()[0].entry.data.v,1);
  assert.equal(r.activeEntries()[1].entry.data.v,2);
  assert.ok(Object.isFrozen(r.activeEntries()));
});
test('registration capacity is bounded',()=>{
  const r=new DataModRegistry();
  for(let i=0;i<MAX_PACKS;i++)r.register(manifest('mod'+i));
  assert.throws(()=>r.register(manifest('overflow')),RangeError);
  assert.equal(r.list().length,MAX_PACKS);
});
test('independent Python reference agrees on source-owned dependency graph',async()=>{
  const graph=JSON.parse(await readFile(new URL('./fixtures/mod-sdk-001-graph.json',import.meta.url),'utf8'));
  const reg=new DataModRegistry();
  for(const pack of graph.packs)reg.register({
    kind:MOD_PACK_KIND,id:pack.id,version:pack.version,requires:pack.requires,entries:[]
  });
  const result=reg.activate(graph.activate);
  const python=spawnSync('python3',['scripts/mod_sdk_001_oracle.py'],{encoding:'utf8'});
  assert.equal(python.status,0,python.stderr);
  const oracle=JSON.parse(python.stdout);
  assert.equal(oracle.schema,'qsol.mod-sdk-001.oracle.v1');
  assert.deepEqual(result,oracle.activation);
});
