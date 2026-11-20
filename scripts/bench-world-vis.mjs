// SPDX-License-Identifier: Apache-2.0
// WORLD-VIS-001 CPU-only diagnostic, never a physical GPU benchmark or CI gate.
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createWorldVisStudy,WORLD_CAMERAS,viewCamera} from '../demos/world-vis-lab/world.js';
import {selectRetainedView} from '../modules/world-vis/index.js';
if(process.argv.length!==2)throw TypeError('usage: node scripts/bench-world-vis.mjs');
const {world}=createWorldVisStudy(),ids=Object.keys(WORLD_CAMERAS),iterations=240;
const times={on:[],off:[]},hashes={on:createHash('sha256'),off:createHash('sha256')};
for(let i=0;i<iterations;i++){
  const camera=viewCamera(ids[i%ids.length],1.6);
  // Alternate order across pairs to reduce systematic warming bias.
  const modes=i%2===0?['on','off']:['off','on'];
  for(const mode of modes){
    const start=performance.now();
    const p=selectRetainedView(world,camera,{cull:mode==='on',lod:'high'});
    times[mode].push(performance.now()-start);
    hashes[mode].update(JSON.stringify(p.rows.map(x=>[x.id,x.vertices])));
    if(mode==='off')assert.equal(p.selected,world.batches);
  }
}
const pct=(xs,q)=>{const sorted=[...xs].sort((a,b)=>a-b);return Number(sorted[Math.floor((sorted.length-1)*q)].toFixed(4));};
const report={kind:'qsol.vanillajs.world-vis-001.cpu-diagnostic.v1',
  world:{batches:world.batches,sourceBytes:world.sourceBytes,highTriangles:world.highTriangles},
  matchedCameraQueries:iterations,
  selectorMs:{cullingOn:{p50:pct(times.on,.5),p95:pct(times.on,.95)},
    cullingOff:{p50:pct(times.off,.5),p95:pct(times.off,.95)}},
  rowOrderSHA256:{cullingOn:hashes.on.digest('hex'),cullingOff:hashes.off.digest('hex')},
  conclusion:'CPU selection diagnostic ONLY. GPU time, VRAM and FPS not measured; no speedup claim.'};
console.log(JSON.stringify(report,null,2));
