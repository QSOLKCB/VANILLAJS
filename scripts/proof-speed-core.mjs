// SPDX-License-Identifier: Apache-2.0
// Paired, source-local benchmarks. Correctness admission is separate from timing.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {castSegment} from '../modules/collision/index.js';
import {StaticAABBIndex} from '../modules/geometry/index.js';
import {FrameGate} from '../modules/frame-gate/index.js';
import {createBulletLab,stepBulletLab,bulletReceipt} from '../demos/bullet-time-lab/world.js';
import {createArcadeLab,stepArcadeLab,arcadeReceipt} from '../demos/arcade-lab/world.js';

const hash=()=>createHash('sha256');
const round=n=>Math.round(n*1000)/1000;
const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
function random(seed){let s=seed>>>0;return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
export function collisionFixture({side=12,rayCount=300,travel=4,seed=17}={}){
  assert.ok(Number.isSafeInteger(side)&&side>=2&&side<=40);
  assert.ok(Number.isSafeInteger(rayCount)&&rayCount>=1&&rayCount<=5000);
  assert.ok(Number.isFinite(travel)&&travel>0&&travel<=150);
  const r=random(seed),boxes=[];
  for(let x=0;x<side;x++)for(let z=0;z<side;z++){
    const cx=x*2.5,cz=z*2.5,i=x*side+z;
    boxes.push({id:'block-'+String(i).padStart(4,'0'),box:{
      min:[cx-.35,0,cz-.35],max:[cx+.35,2,cz+.35]}});
  }
  const queries=[];
  for(let i=0;i<rayCount;i++){
    const origin=[round(r()*side*2.5),1,round(r()*side*2.5)],a=r()*Math.PI*2;
    queries.push({origin,displacement:[round(Math.cos(a)*travel),0,round(Math.sin(a)*travel)],
      options:{halfSize:i%11===0?.06:0,ignoreIds:i%17===0?['block-0000']:[]}});
  }
  return {kind:'collision',id:['grid',side,travel,rayCount,seed].join('-'),
    boxes,queries,index:new StaticAABBIndex(boxes)};
}
export function labFixture(mode,steps=720){
  assert.ok(['bullet','brick','bank'].includes(mode));
  assert.ok(Number.isSafeInteger(steps)&&steps>=1&&steps<=10000);
  const input=Array.from({length:steps},(_,i)=>mode==='bullet'?{
    move:i%139<33?1:i%139<87?-1:0,fire:i%3===0,focus:i%310<145,dodge:i%227===0
  }:{move:i%181<80?1:-1,launch:i%11===0});
  return {kind:'lab',id:mode+'-'+steps,mode,input};
}
export function frameFixture(frames=1300){
  assert.ok(Number.isSafeInteger(frames)&&frames>=1&&frames<=10000);
  return {kind:'frame',id:'retained-canvas-'+frames,
    frames:Array.from({length:frames},(_,i)=>({
      state:Math.floor(i/19),mode:Math.floor(i/113)%3,contextEpoch:Math.floor(i/307)}))};
}
export function fixtureSet(){return [
  collisionFixture({side:4,rayCount:500,travel:8,seed:19}),
  collisionFixture({side:32,rayCount:375,travel:2.5,seed:23}),
  collisionFixture({side:32,rayCount:375,travel:55,seed:31}),
  labFixture('bullet',1200),labFixture('brick',1200),labFixture('bank',1200),
  frameFixture(1800)
];}
function collisionRun(f,optimized,audit){
  const digest=hash();let hits=0,candidates=0;
  for(const {origin,displacement,options} of f.queries){
    const hit=optimized?f.index.castSegment(origin,displacement,options):
      castSegment(origin,displacement,f.boxes,options);
    hits+=Number(!!hit);
    if(audit){digest.update(JSON.stringify(hit));digest.update('\n');}
  }
  // Count candidates outside the measured path, not via duplicate hot queries.
  if(audit)for(const q of f.queries)
    candidates+=f.index.candidates(q.origin,q.displacement,q.options).length;
  return {checksum:audit?digest.digest('hex'):null,events:hits,
    work:audit?{referenceChecks:f.queries.length*f.boxes.length,conservativeCandidates:candidates}:null};
}
function labRun(f,optimized,audit){
  const isBullet=f.mode==='bullet',digest=hash();
  let state=isBullet?createBulletLab():createArcadeLab(f.mode);
  let events=0,referenceChecks=0,conservativeCandidates=0;
  for(const input of f.input){
    state=isBullet?stepBulletLab(state,input,optimized):stepArcadeLab(state,input,optimized);
    if(audit){
      const receipt=isBullet?bulletReceipt(state):arcadeReceipt(state);
      digest.update(JSON.stringify(receipt));digest.update('\n');
      events+=isBullet?state.events.length:Number(state.last==='BALL LOST');
      referenceChecks+=state.work.staticFull??state.work.full;
      conservativeCandidates+=state.work.staticCandidates??state.work.candidates;
    }
  }
  return {checksum:audit?digest.digest('hex'):null,events,
    work:audit?{referenceChecks,conservativeCandidates}:null};
}
function renderPixels(s){
  const buf=new Uint8Array(64*64),n=s.state*7+s.mode*31+s.contextEpoch*17;
  for(let i=0;i<buf.length;i++)buf[i]=(i*i+n*(i%11+1))&255;
  return buf;
}
function frameRun(f,optimized,audit){
  const digest=hash(),gate=new FrameGate();let frame=null,draws=0;
  for(const state of f.frames){
    const draw=()=>{frame=renderPixels(state);draws++;};
    if(optimized)gate.present({key:state.state+':'+state.mode,width:64,height:64,
      contextEpoch:state.contextEpoch},draw);
    else draw();
    if(audit)digest.update(frame);
  }
  return {checksum:audit?digest.digest('hex'):null,events:f.frames.length,
    work:audit?{referenceDraws:f.frames.length,actualDraws:draws}:null};
}
export function runFixture(f,optimized,{audit=false}={}){
  assert.equal(typeof optimized,'boolean');
  if(f.kind==='collision')return collisionRun(f,optimized,audit);
  if(f.kind==='lab')return labRun(f,optimized,audit);
  if(f.kind==='frame')return frameRun(f,optimized,audit);
  throw new RangeError('unknown benchmark fixture');
}
export function parity(f){
  const a=runFixture(f,false,{audit:true}),b=runFixture(f,true,{audit:true});
  assert.equal(a.checksum,b.checksum,f.id+' output divergence');
  assert.equal(a.events,b.events,f.id+' event divergence');
  return {fixture:f.id,kind:f.kind,outputSha256:a.checksum,events:a.events,
    referenceWork:a.work,optimizedWork:b.work};
}
export function negativeControl(f){
  const original=parity(f).outputSha256;
  if(f.kind==='collision'){
    f.queries[0]={origin:[f.boxes[0].box.min[0]+.1,1,f.boxes[0].box.min[2]+.1],
      displacement:[0,0,0],options:{halfSize:0,ignoreIds:[]}};
  }else if(f.kind==='lab') f.input[0]={...f.input[0],
    move:f.input[0].move===1?-1:1};
  else f.frames[0]={...f.frames[0],state:f.frames[0].state+1000};
  return original!==parity(f).outputSha256;
}
function timed(f,optimized){
  const start=performance.now();runFixture(f,optimized);return round(performance.now()-start);
}
export function measure(f,{pairs=9,warmups=2}={}){
  assert.ok(Number.isSafeInteger(pairs)&&pairs>=3&&pairs<=31);
  assert.ok(Number.isSafeInteger(warmups)&&warmups>=0&&warmups<=10);
  const oracle=parity(f);
  for(let i=0;i<warmups;i++){timed(f,false);timed(f,true);}
  const samplesMs={baseline:[],optimized:[]};
  for(let i=0;i<pairs;i++)for(const mode of i%2?[true,false]:[false,true])
    samplesMs[mode?'optimized':'baseline'].push(timed(f,mode));
  const baseline=median(samplesMs.baseline),optimized=median(samplesMs.optimized);
  return {...oracle,samplesMs,medianMs:{baseline,optimized},
    medianRatio:optimized>0?round(baseline/optimized):null,
    note:'CPU observations on this host, not guaranteed GPU/FPS or cross-host speedup'};
}
