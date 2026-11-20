// SPDX-License-Identifier: Apache-2.0
// SENSE-001 source-only diagnostic: identical geometry, paired serial/indexed reads.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {createSightWorld,querySight} from '../modules/sensing/index.js';

const args=process.argv.slice(2);
if(args.length>1||(args.length&&args[0]!=='--check'))throw TypeError('usage: node scripts/sensing-workload.mjs [--check]');
let seed=1998;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
const blockers=Array.from({length:128},(_,i)=>{
  const x=Math.round((random()-.5)*360),z=Math.round((random()-.5)*360);
  return {id:'block-'+i,box:{min:[x,0,z],max:[x+2+random()*5,5+random()*5,z+2+random()*5]}};
});
const targets=Array.from({length:32},(_,i)=>({id:'target-'+i,
  position:[(random()-.5)*360,1.6,(random()-.5)*360]}));
const probes=Array.from({length:80},()=>({
  position:[(random()-.5)*300,1.6,(random()-.5)*300],direction:[random()-.5,0,random()-.5]
}));
const world=createSightWorld({blockers,targets}),settings={range:250,fov:Math.PI*1.5};
const hash=createHash('sha256');
let serialMs=0,indexedMs=0,rows=0;
for(const observer of probes){
  let begin=performance.now();
  const serial=querySight(world,observer,{...settings,backend:'serial'});
  serialMs+=performance.now()-begin;
  begin=performance.now();
  const indexed=querySight(world,observer,{...settings,backend:'indexed'});
  indexedMs+=performance.now()-begin;
  assert.deepEqual(indexed,serial,'indexed/serial outputs must exactly match');
  rows+=indexed.length;
  hash.update(JSON.stringify(indexed));
}
const report={kind:'qsol.vanillajs.sense-001.workload.v1',status:'PASS',
  scene:{blockers:blockers.length,targets:targets.length,observers:probes.length,returnedRows:rows},
  resultSHA256:hash.digest('hex'),
  diagnosticOnly:{serialWallMs:Number(serialMs.toFixed(3)),indexedWallMs:Number(indexedMs.toFixed(3))},
  note:'Measured local wall time is diagnostic only; neither backend is claimed faster. No physical GPU or device measurements.'};
console.log(JSON.stringify(report,null,2));
