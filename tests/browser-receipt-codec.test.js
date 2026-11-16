// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {identity} from '../scripts/browser-dependencies.mjs';
import {encodeReceipt,decodeReceipt} from '../scripts/browser-receipt-codec.mjs';

function receipt(){
  const runtime=Array.from({length:800},(_,i)=>({path:`modules/example-${i}/index.js`,sha256:'a'.repeat(64),gitBlob:'b'.repeat(40)}));
  const results=Object.fromEntries(['home','render','play','worlds','research','donor','editor'].map(group=>{
    const inputs={runtime,requirements:[],shared:[],tests:[{path:`scripts/browser-${group}.js`,sha256:'c'.repeat(64)}],environment:{node:'22',browser:'fixture'}};
    return [group,{status:'PASS',executed:true,fingerprint:identity(inputs),inputs}];
  }));
  return {kind:'qsol.browser.execution.v3',repository:'QSOLKCB/VANILLAJS',run:'123',provenance:{schema:1},results};
}
test('compact receipt fits existing wire limit and preserves all seven execution inputs',()=>{
  const original=receipt(),encoded=encodeReceipt(original);
  assert.ok(Buffer.byteLength(JSON.stringify(original))>524288);
  assert.ok(Buffer.byteLength(JSON.stringify(encoded))<524288);
  assert.deepEqual(decodeReceipt(JSON.parse(JSON.stringify(encoded))),original);
  assert.equal(decodeReceipt(original),original,'legacy reader semantics unchanged');
});
test('tampered blocks, references, fingerprints and unknown fields fail closed',()=>{
  const mutations=[
    e=>e.extra=true,
    e=>e.blocks[Object.keys(e.blocks)[0]][0].sha256='d'.repeat(64),
    e=>e.receipt.results.home.inputRefs.runtime='0'.repeat(64),
    e=>e.receipt.results.home.fingerprint='0'.repeat(64),
    e=>e.receipt.results.home.status='FAIL',
    e=>e.receipt.results.home.executed=false,
    e=>e.receipt.results.home.inputs={},
    e=>e.receipt.results.unknown=e.receipt.results.home,
    e=>e.blocks[identity('unused')]='unused',
    e=>e.receipt.results={},
    e=>{e.receipt.results.home.inputRefs=JSON.parse('{"__proto__":"'+Object.keys(e.blocks)[0]+'"}');},
  ];
  for(const mutate of mutations){const e=encodeReceipt(receipt());mutate(e);assert.throws(()=>decodeReceipt(e),/invalid compact receipt/);}
});
test('bounded decoder rejects wire and expansion amplification',()=>{
  const large=receipt();large.padding='x'.repeat(524288);
  assert.throws(()=>encodeReceipt(large),/encoded size/);
  const value='x'.repeat(450000),inputs=Object.fromEntries(Array.from({length:20},(_,i)=>['input'+i,value]));
  const expanded={kind:'qsol.browser.execution.v3',results:{home:{status:'PASS',executed:true,fingerprint:identity(inputs),inputs}}};
  assert.throws(()=>encodeReceipt(expanded),/expanded size/);
});
