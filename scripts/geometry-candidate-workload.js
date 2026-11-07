// SPDX-License-Identifier: Apache-2.0
// OPT-INV / OPT-POOL evidence: same indexed broadphase, allocating candidates()
// versus explicit retained output array. No worker threads, no timing gate.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {arch,cpus,platform,release} from 'node:os';
import {StaticAABBIndex} from '../modules/geometry/index.js';

const REPEATS=7, WARMUPS=2;
let state=0xa11ccafe;
const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/0x100000000;};
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const report=[];
for(const count of [14,128,480]){
  const colliders=Array.from({length:count},(_,i)=>{
    const center=[(random()-.5)*400,(random()-.5)*120,(random()-.5)*400];
    const extent=1+random()*5;
    return {id:'collision-'+i,box:{min:center.map(x=>x-extent),max:center.map(x=>x+extent)}};
  });
  const queries=Array.from({length:240},(_,i)=>({
    origin:[(random()-.5)*440,(random()-.5)*160,(random()-.5)*440],
    delta:[(random()-.5)*210,(random()-.5)*90,(random()-.5)*210],
    options:{halfSize:i%9===0?.5:0}
  }));
  const index=new StaticAABBIndex(colliders),scratch=[];
  const run=mode=>{
    const digest=createHash('sha256'),t0=performance.now();
    let candidateCount=0;
    for(const query of queries){
      const indices=mode==='retained'?
        index.collectCandidates(query.origin,query.delta,scratch,query.options):
        index.candidates(query.origin,query.delta,query.options);
      candidateCount+=indices.length;
      digest.update(indices.join(',')+'\n');
    }
    return {ms:performance.now()-t0,digest:digest.digest('hex'),candidateCount};
  };
  for(let i=0;i<WARMUPS;i++){run('allocating');run('retained');}
  const samples={allocating:[],retained:[]};
  for(let i=0;i<REPEATS;i++){
    const modes=i%2===0?['allocating','retained']:['retained','allocating'];
    for(const mode of modes)samples[mode].push(run(mode));
  }
  const expected=samples.allocating[0];
  for(const [mode,observed] of Object.entries(samples)){
    for(const x of observed){
      assert.equal(x.digest,expected.digest,count+' candidate indices changed under '+mode);
      assert.equal(x.candidateCount,expected.candidateCount,
        count+' candidate totals drifted under '+mode);
    }
  }
  report.push({
    colliders:count,queries:queries.length,
    sha256:expected.digest,candidateCount:expected.candidateCount,
    strategies:Object.fromEntries(Object.entries(samples).map(([name,s])=>[name,{
      medianMs:median(s.map(x=>x.ms)),samplesMs:s.map(x=>x.ms)
    }]))
  });
}
const sourceBytes=readFileSync(new URL('../modules/geometry/index.js',import.meta.url));
const result={schemaVersion:1,kind:'qsol.vanillajs.qwaketf-geometry-candidate-workload.v1',
  sourcePins:{
    donor:'QSOLKCB/QwakeTF@46367b7b946b0254aa7cbdbb4a454735b81e3052',
    reference:'QSOLKCB/VANILLAJS@88c72367391286f8fcd95c6ded078144e84f1e43',
    candidateSHA256:createHash('sha256').update(sourceBytes).digest('hex')
  },
  environment:{node:process.version,platform:platform(),arch:arch(),
    release:release(),cpu:cpus()[0]?.model},
  protocol:{warmups:WARMUPS,pairedTrials:REPEATS,
    order:'alternating',execution:'serial single-threaded Node',
    scope:'index built once per scene, candidate traversal and digest included',
    timingGate:false,gpu:'not measured'},report};
if(process.argv.includes('--check')){
  assert.equal(report.length,3);
  assert.ok(report.every(x=>x.strategies.retained.samplesMs.length===REPEATS));
}
console.log(JSON.stringify(result,null,2));
