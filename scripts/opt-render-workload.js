// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {cpus,platform,arch,release} from 'node:os';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {VaultGeometry} from '../demos/clockwork-vault/view.js';
import {referenceGeometry} from './opt-render-reference.js';
import {viewWorkload,WORKLOADS,FRAME_COUNT} from './opt-render-fixtures.js';

function run(name,reuse){
  const cache=new VaultGeometry(),capacities=new Map(),previous=new Map();
  const counts={frames:0,builds:0,uploads:0,floatValues:0,storageAllocations:0,capacityBytes:0};let sink=0;
  for(const session of viewWorkload(name)){
    const groups=reuse?Object.entries(cache.update(session)):[['all',referenceGeometry(session)]];
    for(const [id,g]of groups){
      if(reuse&&previous.get(id)===g)continue;counts.builds++;
      for(const type of ['vertices','lines']){
        const data=new Float32Array(g[type]),key=id+type;
        if(!reuse||data.byteLength>(capacities.get(key)??0)){counts.storageAllocations++;capacities.set(key,data.byteLength);}
        if(data.length){counts.uploads++;counts.floatValues+=data.length;sink+=data[0];}
      }
      previous.set(id,g);
    }
    counts.frames++;
  }
  counts.capacityBytes=[...capacities.values()].reduce((a,b)=>a+b,0);assert.ok(Number.isFinite(sink));return counts;
}
function parity(name){
  const cache=new VaultGeometry(),digest=createHash('sha256');
  for(const session of viewWorkload(name)){
    const old=referenceGeometry(session),next=cache.update(session);
    for(const type of ['vertices','lines']){
      const actual=[...next.mechanisms[type],...next.consoles[type]];
      assert.deepEqual(actual,old[type],name+' '+type);
      const f=new Float32Array(actual);digest.update(new Uint8Array(f.buffer));
    }
  }
  return digest.digest('hex');
}
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const workloads=WORKLOADS.map(name=>{
  const outputSha256=parity(name);
  for(let i=0;i<2;i++){run(name,false);run(name,true);}
  const samples={baseline:[],optimized:[]};let baseline,optimized;
  for(let i=0;i<7;i++)for(const reuse of i%2?[true,false]:[false,true]){
    const start=performance.now(),counts=run(name,reuse),ms=performance.now()-start;
    samples[reuse?'optimized':'baseline'].push(ms);if(reuse)optimized=counts;else baseline=counts;
  }
  assert.equal(baseline.frames,FRAME_COUNT);assert.equal(optimized.frames,FRAME_COUNT);
  assert.ok(optimized.floatValues<=baseline.floatValues,name+' must not add uploaded values');
  if(name!=='changing-both')assert.ok(optimized.floatValues<baseline.floatValues,name+' must eliminate repeated construction/uploads');
  assert.ok(optimized.storageAllocations<baseline.storageAllocations,name+' must reduce storage allocation calls');
  assert.equal(optimized.capacityBytes,baseline.capacityBytes,'split groups retain the same peak Float32 storage for these fixtures');
  return {name,outputSha256,baseline,optimized,samplesMs:samples,medianMs:{baseline:median(samples.baseline),optimized:median(samples.optimized)}};
});
if(process.argv.includes('--check')){
  const recorded=JSON.parse(readFileSync(new URL('../docs/OPT_RENDER_LOCAL.json',import.meta.url),'utf8'));
  const deterministic=items=>items.map(({name,outputSha256,baseline,optimized})=>({name,outputSha256,baseline,optimized}));
  assert.deepEqual(deterministic(workloads),deterministic(recorded.workloads),'rendering output/work-count regression');
}
console.log(JSON.stringify({schemaVersion:1,source:'QSOLKCB/OPT@7556dd36acd53ed3ed538fd03b1db44e5c1ec869',
  baseline:'QSOLKCB/VANILLAJS@a9d40685135a3480b4ccaad4e03607be833b05ec',
  environment:{runtime:process.version,platform:platform(),arch:arch(),release:release(),cpu:cpus()[0]?.model},
  protocol:{frames:FRAME_COUNT,warmupPairs:2,measuredPairs:7,order:'alternating',timingGate:false,
    scope:'CPU model creation, signatures, geometry construction, Float32 conversion; no GPU or frame-rate claim'},workloads},null,2));
