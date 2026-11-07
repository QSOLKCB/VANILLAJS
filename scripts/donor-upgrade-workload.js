// SPDX-License-Identifier: Apache-2.0
// Serial, source-bound CPU observations; not hardware GPU timings or game FPS.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {FixedClock} from '../modules/time/index.js';
import {leadIntercept} from '../modules/lead-solver/index.js';

const REPEATS=7,WARMUPS=2;
const sha=raw=>createHash('sha256').update(raw).digest('hex');
const median=x=>[...x].sort((a,b)=>a-b)[Math.floor(x.length/2)];
function pacing(){
  const output=[];
  for(const hz of [30,59,60,61,75,120,144]){
    const clock=new FixedClock({step:1/120,snapTolerance:.0005});
    for(let tick=0;tick<hz*60;tick++)clock.advance(1/hz,()=>{});
    assert.ok(Math.abs(clock.ticks-7200)<=1,'steady '+hz+' Hz drift');
    output.push([hz,clock.ticks]);
  }
  const rounded=new FixedClock({step:1/60,snapTolerance:.0005});
  for(let i=0;i<3600;i++)rounded.advance((i%3===0?16.6:16.7)/1000,()=>{});
  assert.equal(rounded.ticks,3600);
  return {counts:output,roundedTicks:rounded.ticks};
}
function interception(){
  let solutions=0,abstentions=0,maxResidual=0;
  const first=[];
  for(let i=0;i<4000;i++){
    const shooterPosition=[0,0,0],targetPosition=[100+i%201,(i%37)-18,(i%29)-14],
      targetVelocity=[i%5===0?150:(i%17)-8,(i%19)-9,(i%13)-6],
      shooterVelocity=[(i%7)-3,0,0];
    const shot=leadIntercept({shooterPosition,shooterVelocity,targetPosition,targetVelocity,
      projectileSpeed:60,inheritance:(i%3)/2,maxTime:30});
    if(!shot){abstentions++;continue;}
    solutions++;
    const arrival=shooterPosition.map((x,k)=>x+shot.launchVelocity[k]*shot.time);
    const residual=Math.hypot(...arrival.map((x,k)=>x-shot.interceptPoint[k]));
    const scale=Math.max(1,Math.hypot(...shot.interceptPoint));
    assert.ok(residual/scale<=1e-8,'invalid projectile intercept');
    maxResidual=Math.max(maxResidual,residual/scale);
    if(first.length<20)first.push([i,shot.time,shot.interceptPoint]);
  }
  assert.ok(solutions>0&&abstentions>0);
  return {solutions,abstentions,maxResidual,first};
}
const measure=(name,run)=>{
  const samplesMs=[];let reference=null,signature=null,summary;
  for(let i=0;i<WARMUPS+REPEATS;i++){
    const start=performance.now(),result=run(),duration=performance.now()-start;
    const hash=sha(JSON.stringify(result));
    if(reference!==null)assert.equal(hash,reference,name+' changed under identical inputs');
    reference=hash;
    if(i>=WARMUPS)samplesMs.push(duration);
    summary=result;
    signature=hash;
  }
  return {name,sha256:signature,samplesMs,medianMs:median(samplesMs),
    ...(name==='frame-pacing'?{tickCounts:summary.counts,roundedTicks:summary.roundedTicks}:
      {solutions:summary.solutions,abstentions:summary.abstentions,
        maxRelativeResidual:summary.maxResidual})};
};
const workloads=[measure('frame-pacing',pacing),measure('moving-target-intercept',interception)];
const hashes=Object.fromEntries(['time','lead-solver'].map(name=>{
  const path='modules/'+name+'/index.js';
  return [path,sha(readFileSync(new URL('../'+path,import.meta.url)))];
}));
const report={
  schemaVersion:1,kind:'qsol.vanillajs.donor-upgrade.cpu.v1',
  baseline:'e82d51be222d99951d70509468eaae8f3efc9fcd',
  sourceSHA256:hashes,
  protocol:{execution:'serial single Node process',warmups:WARMUPS,
    samples:REPEATS,gpu:'not measured',timingGate:false},
  workloads
};
if(process.argv.includes('--check')){
  assert.equal(workloads.length,2);
  assert.ok(workloads.every(x=>x.samplesMs.length===7));
}
console.log(JSON.stringify(report,null,2));
