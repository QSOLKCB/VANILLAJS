import test from 'node:test';
import assert from 'node:assert/strict';
import {TernaryGridStore2D,tritsForByte,byteFromTrits} from '../modules/ternary-store2d/index.js';
test('roundtrip text/json across deterministic 27-column radix-3 grid',()=>{
  const s=new TernaryGridStore2D();
  s.put('docs/readme.txt','Hello Ω\n');s.put('data/state.json',{z:[2,1,0],a:{ok:true}});
  const snapshot=s.snapshot(),restored=TernaryGridStore2D.fromSnapshot(snapshot);
  assert.deepEqual(restored.names(),['data/state.json','docs/readme.txt']);
  assert.deepEqual(restored.get('data/state.json'),{a:{ok:true},z:[2,1,0]});
  assert.equal(restored.get('docs/readme.txt'),'Hello Ω\n');
  assert.deepEqual(restored.snapshot(),snapshot);
  assert.ok(snapshot.rows.every(row=>row.length===27&&row.every(x=>[0,1,2].includes(x))));
});
test('insertion order and safe JSON key order cannot alter identity',()=>{
  const a=new TernaryGridStore2D(),b=new TernaryGridStore2D();
  a.put('x.json',{b:2,a:1});a.put('z.txt','Z');
  b.put('z.txt','Z');b.put('x.json',{a:1,b:2});
  assert.deepEqual(a.snapshot(),b.snapshot());
  assert.deepEqual(a.get('x.json'),{a:1,b:2});
});
test('strict UTF-8 and base3 cells reject truncated/forged snapshot',()=>{
  const s=new TernaryGridStore2D();s.put('a.txt','hello');
  const original=s.snapshot();
  for(const change of [
    x=>x.rows[0][0]=3,
    x=>x.rows.pop(),
    x=>{const row=x.rows.at(-1);row[row.length-1]=2;},
    x=>x.entries[0].offset=1,
    x=>x.entries[0].length=1,
    x=>x.schemaVersion=2,
    x=>x.extra=1,
    x=>x.rows[0].fill(2)
  ]){
    const altered=structuredClone(original);change(altered);
    assert.throws(()=>TernaryGridStore2D.fromSnapshot(altered));
  }
  assert.deepEqual(TernaryGridStore2D.fromSnapshot(original).snapshot(),original);
});
test('bounds, dangerous names, mutable aliases and invalid JSON fail closed',()=>{
  const s=new TernaryGridStore2D({maxBytes:20,columns:9});
  const invalid=['../leak.txt','/root.txt','dot..txt','bad.exe','a//b.json',
    'space file.txt','x/../x.txt'];
  for(const name of invalid)assert.throws(()=>s.put(name,'x'));
  for(const v of [Infinity,NaN,1.5,undefined,{x:Infinity},{x:()=>1},new Date(),
    [1,,3],JSON.parse('{"__proto__":2}')])assert.throws(()=>s.put('bad.json',v));
  s.put('safe.txt','OK');const original=s.snapshot();
  assert.throws(()=>s.put('large.txt','A'.repeat(21)));
  assert.deepEqual(s.snapshot(),original);
  assert.equal(s.delete('safe.txt'),true);
  assert.equal(s.get('safe.txt'),null);
});
test('encoded bytes can represent every possible 8-bit value without loss',()=>{
  const s=new TernaryGridStore2D({maxBytes:16384});
  // TextDecoder fatal means use Unicode roundtrip rather than arbitrary byte strings.
  const text=Array.from({length:256},(_,i)=>String.fromCharCode(i)).join('');
  s.put('latin.txt',text);
  assert.equal(TernaryGridStore2D.fromSnapshot(s.snapshot()).get('latin.txt'),text);
});

test('LUT matches independent base-3 oracle and rejects 473 unused codes',()=>{
  const reference=n=>{
    const six=[];for(let k=0;k<6;k++){six.push(n%3);n=Math.floor(n/3);}
    return six;
  };
  for(let byte=0;byte<256;byte++){
    const trits=tritsForByte(byte);
    assert.deepEqual(trits,reference(byte));assert.equal(byteFromTrits(trits),byte);
  }
  for(let code=256;code<729;code++){
    assert.throws(()=>byteFromTrits(reference(code)),/exceeds byte range/);
  }
  for(const b of [-1,256,1.5,NaN])assert.throws(()=>tritsForByte(b));
  for(const trits of [[0,1,2],[0,0,0,0,0,3],[-1,0,0,0,0,0],[0,0,NaN,0,0,0]])
    assert.throws(()=>byteFromTrits(trits));
});
test('invariant snapshot cache returns detached copies and rebuilds only on byte change',()=>{
  const store=new TernaryGridStore2D(),start=store.cacheStats();
  assert.equal(start.builds,0);
  store.put('a.txt','Hello');const first=store.snapshot(),stats1=store.cacheStats();
  assert.equal(stats1.builds,1);assert.equal(stats1.hits,0);
  first.rows[0][0]=2;first.entries[0].name='forged.txt';
  const second=store.snapshot();assert.equal(second.entries[0].name,'a.txt');
  assert.deepEqual(second,TernaryGridStore2D.fromSnapshot(second).snapshot());
  assert.equal(store.cacheStats().builds,1);
  const changed=store.cacheStats().invalidations;
  store.put('a.txt','Hello');assert.equal(store.cacheStats().invalidations,changed);
  assert.equal(store.cacheStats().unchangedWrites,1);
  assert.deepEqual(store.snapshot(),second);
  assert.equal(store.cacheStats().builds,1);
  assert.throws(()=>store.put('evil.txt',0));assert.equal(store.cacheStats().builds,1);
  assert.equal(store.delete('not-here.txt'),false);
  assert.equal(store.cacheStats().invalidations,changed);
  store.put('a.txt','Hello!');assert.equal(store.cacheStats().cached,false);
  assert.notDeepEqual(store.snapshot(),second);assert.equal(store.cacheStats().builds,2);
  store.delete('a.txt');assert.equal(store.cacheStats().cached,false);
  assert.equal(store.snapshot().byteLength,0);store.clear();
  assert.equal(store.cacheStats().builds,3);
});
