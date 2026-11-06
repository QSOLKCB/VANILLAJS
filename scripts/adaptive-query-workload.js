// SPDX-License-Identifier: Apache-2.0
// Source-pinned OPT-REDUCE workload: serial brute force vs serial grid vs
// adaptive dispatch. One process, no Worker/threads/parallelism; no timing gate.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {arch,cpus,platform,release} from 'node:os';
import {AdaptiveCircleQueries} from '../modules/adaptive-circles/index.js';
import {CuboidStream} from '../modules/cuboid-stream/index.js';
import {nextRandom} from '../modules/integer-math/index.js';

const REPEATS=7, WARMUP=2, PROBES=400, COUNTS=[14,26,58,128];
const SOURCE='QSOLKCB/GAMES@7e0a9019d07b491cffc9b698fa51acdb843c49cc';
const ORIGIN='QSOLKCB/CorpoWars3d@8e86066686a575402ee2818378f1ec9323fb9ee6';
const candidateFile=new URL('../modules/adaptive-circles/index.js',import.meta.url);
const sourceSHA256=createHash('sha256').update(readFileSync(candidateFile)).digest('hex');
function fixture(count){
  let seed=83+count;
  const random=()=>{seed=nextRandom(seed);return seed/4294967296;};
  const circles=Array.from({length:count},(_,i)=>({
    id:i+1,x:(random()-.5)*3000,y:(random()-.5)*3000,radius:5+random()*12
  }));
  const rays=Array.from({length:PROBES},(_,i)=>({
    origin:[(random()-.5)*2800,(random()-.5)*2800],
    displacement:[(random()-.5)*450,(random()-.5)*450],
    ignoreIds:i%13===0?[1,2]:[]
  }));
  return {circles,rays};
}
function trial(fix,mode){
  // The index is constructed inside the timed region for all strategies.
  const start=performance.now();
  const threshold=mode==='grid'?1:mode==='brute'?16384:32;
  const index=new AdaptiveCircleQueries(fix.circles,{cellSize:128,gridMin:threshold});
  const digest=createHash('sha256');
  let candidates=0,gridQueries=0,bruteQueries=0;
  for(const ray of fix.rays){
    const {hit,mode:used,tested}=index.castSegment(ray.origin,ray.displacement,{ignoreIds:ray.ignoreIds});
    if(used==='grid')gridQueries++;else bruteQueries++;
    candidates+=tested;
    // No floating tolerance: both modes share the same source narrowphase.
    digest.update(hit ? JSON.stringify([hit.id,hit.index,hit.time])+'\n' : 'none\n');
  }
  return {ms:performance.now()-start,digest:digest.digest('hex'),candidates,gridQueries,bruteQueries};
}
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
const records=[];
for(const count of COUNTS){
  const fix=fixture(count);
  // Paired alternating order reduces host/runner bias. No speed threshold.
  for(let i=0;i<WARMUP;i++)for(const mode of ['brute','grid','adaptive'])trial(fix,mode);
  const stats=Object.fromEntries(['brute','grid','adaptive'].map(m=>[m,[]]));
  for(let i=0;i<REPEATS;i++){
    const order=i%2?['adaptive','grid','brute']:['brute','grid','adaptive'];
    for(const mode of order)stats[mode].push(trial(fix,mode));
  }
  const reference=stats.brute[0].digest;
  for(const [mode,samples] of Object.entries(stats)){
    for(const v of samples)assert.equal(v.digest,reference,
      count+'-circle '+mode+' changed authoritative collision results');
  }
  const summaries=Object.fromEntries(Object.entries(stats).map(([mode,samples])=>[mode,{
    medianMs:median(samples.map(x=>x.ms)),
    samplesMs:samples.map(x=>x.ms),
    testedCandidates:samples[0].candidates,
    gridQueries:samples[0].gridQueries,
    bruteQueries:samples[0].bruteQueries
  }]));
  records.push({count,queries:PROBES,paritySHA256:reference,strategies:summaries});
}
// The renderer-oriented extraction has exact Float32 output and deterministic
// capacity; this bench records its work as *counts*, not fabricated GPU timings.
const stream=new CuboidStream({capacity:0});
for(let i=0;i<256;i++)stream.box(i,0,i%31,1,2,1,[.1,.2,.3],0,
  i<128?0.25:0.5);
const cuboids={count:stream.count,capacity:stream.capacity,
  growths:stream.growths,rotationEvaluations:stream.rotationEvaluations,
  sha256:createHash('sha256').update(new Uint8Array(stream.snapshot().buffer)).digest('hex')};
if(process.argv.includes('--check')){
  assert.equal(records.length,COUNTS.length);
  assert.equal(records[0].strategies.adaptive.gridQueries,0);
  assert.equal(records.at(-1).strategies.adaptive.gridQueries,PROBES);
  assert.equal(cuboids.count,256);
  assert.equal(cuboids.rotationEvaluations,4);
}
console.log(JSON.stringify({
 schemaVersion:1,sourcePins:{collision:SOURCE,cuboids:ORIGIN},
 candidateFile:'modules/adaptive-circles/index.js',candidateSHA256:sourceSHA256,
 environment:{node:process.version,platform:platform(),arch:arch(),
    release:release(),cpu:cpus()[0]?.model},
 protocol:{warmupPairs:WARMUP,measuredPairs:REPEATS,queriesPerTrial:PROBES,
  order:'alternating',execution:'one serial Node process; no workers',
  timingGate:false,scope:'index construction plus query execution; no GPU or physical RTX measurement'},
 records,cuboids
},null,2));
