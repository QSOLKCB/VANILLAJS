// Development-only, reproducible search-work comparison. Not a frame-rate test.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {NavigationGrid,findPath,FlowFieldSearch} from '../modules/navigation/index.js';
const scenarios=[];
for(const size of [32,64]){
  const blocked=[];
  for(let x=8;x<size-1;x+=8)for(let z=0;z<size;z++)if(z!==((x/8)%2?size-3:2))blocked.push([x,z]);
  const grid=new NavigationGrid({width:size,height:size,blocked}),goal=[size-2,size-2],starts=[];
  for(let z=0;z<size;z++)for(let x=0;x<size;x++)if(grid.walkable([x,z]))starts.push([x,z]);
  const job=new FlowFieldSearch(grid,[goal]);let slices=0,maxSlice=0;
  while(job.status==='building'){const r=job.step(64);slices++;maxSlice=Math.max(maxSlice,r.processed);}
  for(const units of [1,24,128,512]){
    let astarExpanded=0,totalCost=0;
    for(const start of starts.slice(0,units)){
      const route=findPath(grid,start,goal,{maxExpanded:65536}),sample=job.result.sample(start);
      assert.equal(route.status,'found');assert.equal(sample.cost,route.cost);astarExpanded+=route.expanded;totalCost+=route.cost;
    }
    scenarios.push({size:[size,size],units,goal,astarExpanded,fieldExpanded:job.expanded,fieldBuildSlices:slices,maxSlice,fieldLookups:units,totalCost});
  }
}
const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const report={schemaVersion:1,version,runtime:process.version,metric:'Settled search cells; excludes setup, heap, sampling, traffic and rendering work.',
  scenario:'Uniform cardinal grid; walls every eight columns with alternating gaps at rows 2 and size-3; row-major starts; common goal at size-2,size-2; build budget 64.',scenarios};
if(process.argv.includes('--check')){
  const recorded=JSON.parse(await readFile(new URL('../docs/NAVIGATION_WORKLOAD.json',import.meta.url),'utf8'));
  for(const key of ['schemaVersion','version','metric','scenario','scenarios'])assert.deepEqual(report[key],recorded[key],`documented workload differs: ${key}`);
}
console.log(JSON.stringify(report,null,2));
