// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {boxMeshBatch,StaticAABBIndex} from '../modules/geometry/index.js';
import {boxVertices} from '../modules/render-webgl/index.js';
import {castSegment} from '../modules/collision/index.js';
import {projectE8RootPoints} from '../experiments/e8-geometry/index.js';

const boxes=Array.from({length:480},(_,i)=>{
  const x=(i%24)*2.25-26,z=Math.floor(i/24)*2.25-21;
  return {center:[x,.5,z],size:[1+(i%3)*.17,1,.7+(i%5)*.12],color:[.15+(i%7)*.07,.25+(i%11)*.05,.7]};
});
const colliders=boxes.map((b,i)=>({id:'b'+String(i).padStart(4,'0'),box:{
  min:b.center.map((c,k)=>c-b.size[k]/2),max:b.center.map((c,k)=>c+b.size[k]/2)
}}));
const rays=Array.from({length:128},(_,i)=>({
  origin:[((i*7)%53)-26,.5,((i*11)%49)-24],
  displacement:[((i*13)%41)-20,0,((i*17)%43)-21],halfSize:i%5===0?.07:0
}));
const legacy=()=>new Float32Array(boxes.flatMap(b=>boxVertices(b.center,b.size,b.color)));
const packed=()=>boxMeshBatch(boxes);
const baseline=legacy(),candidate=packed();
assert.deepStrictEqual(new Uint8Array(candidate.buffer),new Uint8Array(baseline.buffer),'exact GPU Float32 bytes');
const index=new StaticAABBIndex(colliders);
const expectedHits=rays.map(r=>castSegment(r.origin,r.displacement,colliders,{halfSize:r.halfSize}));
const actualHits=rays.map(r=>index.castSegment(r.origin,r.displacement,{halfSize:r.halfSize}));
assert.deepStrictEqual(actualHits,expectedHits,'complete hit receipts including original indices');
const counted=rays.map(r=>index.candidates(r.origin,r.displacement,{halfSize:r.halfSize}).length);
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
function geometryRun(optimized){
  let sum=0;
  for(let i=0;i<20;i++){
    const values=(optimized?packed:legacy)();
    sum+=values[(i*17)%values.length];
  }
  return sum;
}
function castRun(optimized){
  const idx=optimized?new StaticAABBIndex(colliders):null;let hits=0;
  for(const r of rays){
    const result=optimized?idx.castSegment(r.origin,r.displacement,{halfSize:r.halfSize}):
      castSegment(r.origin,r.displacement,colliders,{halfSize:r.halfSize});
    if(result)hits+=result.index+1;
  }
  return hits;
}
function pairs(fn){
  for(let i=0;i<2;i++){fn(false);fn(true);}
  const samples={baseline:[],optimized:[]},sums={baseline:[],optimized:[]};
  for(let i=0;i<7;i++)for(const optimized of i%2?[true,false]:[false,true]){
    const start=performance.now(),checksum=fn(optimized),elapsed=performance.now()-start;
    const key=optimized?'optimized':'baseline';samples[key].push(elapsed);sums[key].push(checksum);
  }
  assert.deepStrictEqual(sums.baseline,sums.optimized,'observed checksums must match');
  return {samplesMs:samples,medianMs:{baseline:median(samples.baseline),optimized:median(samples.optimized)}};
}
const atlas=projectE8RootPoints();
const receipt={schemaVersion:1,
  environment:{runtime:process.version,platform:process.platform,arch:process.arch},
  source:'VANILLAJS geometry-layer2; OPT/RUNE/GALAXY/QNTOY adaptation',
  contract:{exactFloat32Bytes:true,exactCastReceipts:true,timingGate:false,
    samples:7,warmupPairs:2,scope:'CPU static scene setup and pure static-ray queries; no GPU or FPS claim'},
  shapes:{boxes:boxes.length,verticesPerBox:36,sha256:createHash('sha256').update(new Uint8Array(candidate.buffer)).digest('hex'),timing:pairs(geometryRun)},
  spatial:{colliders:colliders.length,rays:rays.length,
    averageCandidates:counted.reduce((a,b)=>a+b,0)/rays.length,
    sha256:createHash('sha256').update(JSON.stringify(actualHits)).digest('hex'),
    timingIncludingIndexBuild:pairs(castRun)},
  proceduralE8:{roots:240,pointBytes:atlas.byteLength,
    sha256:createHash('sha256').update(new Uint8Array(atlas.buffer)).digest('hex')}
};
if(process.argv.includes('--check')){
  assert.ok(receipt.spatial.averageCandidates<receipt.spatial.colliders,
    'fixture should exercise actual candidate filtering');
  assert.equal(receipt.proceduralE8.pointBytes,240*6*4);
}
console.log(JSON.stringify(receipt,null,2));
