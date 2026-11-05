// SPDX-License-Identifier: Apache-2.0
// Exact-output geometry workload; noisy CPU preparation timings are observations,
// never CI performance gates. Frozen v1.0.0 builder bodies remain independent.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {boxVertices,ringVertices} from '../modules/render-webgl/index.js';

function referenceBox(center,size,color){
  const corners=[];
  for(let i=0;i<8;i++)corners.push(center.map((v,k)=>v+size[k]*((i>>k&1)-.5)));
  const faces=[[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]],shades=[.7,.9,.58,1,.8,.65],data=[];
  faces.forEach((f,i)=>{for(const k of [0,1,2,0,2,3])data.push(...corners[f[k]],...color.map(x=>x*shades[i]));});
  return data;
}
function referenceRing(position,radius,color,segments=48){
  const data=[];
  for(let i=0;i<segments;i++)for(const j of [i,i+1]){
    const a=j/segments*Math.PI*2;
    data.push(position[0]+Math.cos(a)*radius,position[1]+Math.sin(a)*radius,position[2],...color);
  }
  return data;
}
const cases=[
  {name:'dynamic-boxes',kind:'box',count:4500},
  {name:'target-rings-24',kind:'ring',segments:24,count:2500},
  {name:'checkpoint-rings-32',kind:'ring',segments:32,count:2500},
  {name:'impact-rings-16',kind:'ring',segments:16,count:2500},
  {name:'default-rings-48',kind:'ring',segments:48,count:2500},
  {name:'custom-rings-17',kind:'ring',segments:17,count:2500}
];
function args(spec,i){
  const point=[((i%89)-44)*.031,((i%23)-11)*.057,-i*.0047],color=[.14+(i%13)*.023,.33+(i%7)*.037,.59];
  return spec.kind==='box'?[point,[.12+(i%9)*.04,.2,.3],color]:
    [point,.31+(i%11)*.017,color,spec.segments];
}
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
function oracle(spec){
  const hash=createHash('sha256');let values=0;
  for(let i=0;i<128;i++){
    const input=args(spec,i),expected=spec.kind==='box'?referenceBox(...input):referenceRing(...input);
    const actual=spec.kind==='box'?boxVertices(...input):ringVertices(...input);
    assert.deepStrictEqual(actual,expected,spec.name+' output '+i);
    const f32=new Float32Array(actual),old=new Float32Array(expected);
    const bytes=new Uint8Array(f32.buffer);
    assert.deepStrictEqual(bytes,new Uint8Array(old.buffer),spec.name+' Float32 parity '+i);
    hash.update(bytes);values+=actual.length;
  }
  return {sampleFloatValues:values,sha256:hash.digest('hex')};
}
function run(spec,optimized){
  const fn=spec.kind==='box'?(optimized?boxVertices:referenceBox):(optimized?ringVertices:referenceRing);
  let checksum=0;
  for(let i=0;i<spec.count;i++){
    const data=fn(...args(spec,i));
    checksum+=data[i%data.length]; // Force each allocation/result to be consumed.
  }
  assert.ok(Number.isFinite(checksum));
  return checksum;
}
const workloads=cases.map(spec=>{
  const parity=oracle(spec);
  for(let i=0;i<2;i++){run(spec,false);run(spec,true);}
  const samples={baseline:[],optimized:[]};let checksums=[];
  for(let i=0;i<7;i++){
    for(const optimized of i%2?[true,false]:[false,true]){
      const start=performance.now(),sum=run(spec,optimized),elapsedMs=performance.now()-start;
      samples[optimized?'optimized':'baseline'].push(elapsedMs);
      checksums.push({optimized,sum});
    }
  }
  const baseline=checksums.filter(x=>!x.optimized).map(x=>x.sum),optimized=checksums.filter(x=>x.optimized).map(x=>x.sum);
  assert.deepStrictEqual(optimized,baseline,'result-checksum parity across paired trials');
  return {name:spec.name,iterationsPerTrial:spec.count,parity,medianMs:{baseline:median(samples.baseline),optimized:median(samples.optimized)},samplesMs:samples};
});
if(process.argv.includes('--check')){
  assert.equal(workloads.length,6);
  assert.ok(workloads.every(w=>w.parity.sampleFloatValues>0),'non-empty geometry receipts');
}
console.log(JSON.stringify({schemaVersion:1,baseline:'VANILLAJS v1.0.0 frozen source functions',
  adaptation:'OPT-INV-001; no approximate arithmetic',
  environment:{runtime:process.version,platform:process.platform,arch:process.arch},
  protocol:{warmupPairs:2,measuredPairs:7,order:'alternating',timingGate:false,scope:'isolated CPU geometry generation; excludes GPU, compositing and full frame'},
  workloads},null,2));
