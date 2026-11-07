// SPDX-License-Identifier: Apache-2.0
// OPT paired workload: old per-query A* versus a pinned-grid pooled workspace.
// The run measures cold workspace creation separately; all paths and expanded
// counts must match, with no noisy performance threshold or hardware claim.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {cpus,platform,arch,release} from 'node:os';
import {performance} from 'node:perf_hooks';
import {NavigationGrid,findPath} from '../modules/navigation/index.js';
import {PooledPathfinder} from '../modules/navigation-pool/index.js';

const SOURCE_Q='QSOLKCB/QwakeTF@46367b7b946b0254aa7cbdbb4a454735b81e3052';
const SOURCE_V='QSOLKCB/VANILLAJS@88c72367391286f8fcd95c6ded078144e84f1e43';
const repeats=7,warmups=2;
const hash=values=>createHash('sha256').update(JSON.stringify(values)).digest('hex');
const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
const trials=[];
for(const size of [24,48]){
  const blocked=[];
  for(let x=8;x<size-1;x+=8)for(let z=0;z<size;z++)
    if(z!==((x/8)%2?size-3:2))blocked.push([x,z]);
  const grid=new NavigationGrid({width:size,height:size,blocked});
  const starts=[];
  for(let z=0;z<size;z++)for(let x=0;x<size;x++)
    if(grid.walkable([x,z]))starts.push([x,z]);
  const goal=[size-2,size-2],pool=new PooledPathfinder(grid);
  for(const units of [1,24,96]){
    const workload=starts.slice(0,units),out={baseline:[],pooled:[]};
    const run=mode=>{
      const t=performance.now(),routes=[];
      for(const start of workload)
        routes.push(mode==='pooled'?
          pool.findPath(start,goal,{maxExpanded:65536}):
          findPath(grid,start,goal,{maxExpanded:65536}));
      const elapsedMs=performance.now()-t;
      return {elapsedMs,sha256:hash(routes),
        expanded:routes.reduce((n,r)=>n+r.expanded,0),
        found:routes.filter(r=>r.status==='found').length};
    };
    for(let i=0;i<warmups;i++){run('baseline');run('pooled');}
    for(let i=0;i<repeats;i++){
      const order=i%2===0?['baseline','pooled']:['pooled','baseline'];
      for(const mode of order)out[mode].push(run(mode));
    }
    const expected=out.baseline[0];
    for(const [mode,records] of Object.entries(out))for(const record of records){
      assert.equal(record.sha256,expected.sha256,size+'/'+units+'/'+mode+': path drift');
      assert.equal(record.expanded,expected.expanded,size+'/'+units+'/'+mode+': work drift');
    }
    const coldStart=performance.now();
    const coldPool=new PooledPathfinder(grid);
    const coldBuildMs=performance.now()-coldStart;
    const coldRun=coldPool.findPath(workload[0],goal,{maxExpanded:65536});
    assert.deepEqual(coldRun,findPath(grid,workload[0],goal,{maxExpanded:65536}));
    trials.push({
      grid:[size,size],queries:units,coldPoolBuildMs,
      sha256:expected.sha256,expanded:expected.expanded,found:expected.found,
      paths:Object.fromEntries(Object.entries(out).map(([mode,samples])=>[mode,{
        medianMs:median(samples.map(x=>x.elapsedMs)),
        samplesMs:samples.map(x=>x.elapsedMs)
      }]))
    });
  }
}
assert.equal(trials.length,6);
const moduleBytes=readFileSync(new URL('../modules/navigation-pool/index.js',import.meta.url));
const report={
  schemaVersion:1,kind:'qsol.vanillajs.qwaketf-navigation-pool.workload.v1',
  sourcePins:{donor:SOURCE_Q,reference:SOURCE_V,
    candidateModuleSHA256:createHash('sha256').update(moduleBytes).digest('hex')},
  environment:{node:process.version,platform:platform(),arch:arch(),
    release:release(),cpu:cpus()[0]?.model},
  protocol:{warmups,repeats,alternatingOrder:true,
    scope:'serial A* path queries; cold mask-build timing shown separately',
    trustedReference:'existing navigation.findPath return objects',
    timingGate:false,workers:0,gpu:'not measured'},trials
};
if(process.argv.includes('--check')){
  for(const x of trials){
    assert.equal(x.paths.baseline.samplesMs.length,repeats);
    assert.equal(x.paths.pooled.samplesMs.length,repeats);
    assert.ok(x.coldPoolBuildMs>=0);
  }
}
console.log(JSON.stringify(report,null,2));
