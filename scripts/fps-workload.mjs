// SPDX-License-Identifier: Apache-2.0
// Ordinary development measurements; not a CI reuse witness or GPU benchmark.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {FPSSession} from '../demos/block-arena-lab/replay.js';
import {starterFPSPack} from '../demos/block-arena-lab/packs.js';
import {arenaVisuals} from '../demos/block-arena-lab/render.js';
import {boxMeshBatch} from '../modules/geometry/index.js';
import {boxVertices} from '../modules/render-webgl/index.js';
import {verifyFPSSource} from './fps-source-identity.mjs';
const identity=await verifyFPSSource(),rows=[];
for(const arena of [0,1])for(const mode of ['skirmish','survival']){
  const samples=[];let baseline,session;
  for(let sample=0;sample<3;sample++){
    session=new FPSSession(starterFPSPack(arena),mode,'normal',2026);const start=performance.now();
    for(let tick=0;tick<1200&&session.world.status==='playing';tick++)session.advance([0,0,0,0,0,0]);
    samples.push(performance.now()-start);const state=session.world.snapshot();if(baseline)assert.deepEqual(state,baseline);else baseline=state;
  }
  rows.push({arena:session.pack.settings.title,mode,ticks:session.world.tick,status:session.world.status,packSha256:createHash('sha256').update(session.pack.bytes).digest('hex'),work:session.world.work,samplesMs:samples,medianMs:[...samples].sort((a,b)=>a-b)[1]});
}
const pack=new FPSSession(starterFPSPack()).pack,boxes=arenaVisuals(pack),reference=new Float32Array(boxes.flatMap(b=>boxVertices(b.center,b.size,b.color))),batch=boxMeshBatch(boxes);assert.deepEqual(batch,reference);
const frames=120;let referenceMs,retainedMs;
{const start=performance.now();for(let i=0;i<frames;i++)assert.equal(boxMeshBatch(boxes).length,batch.length);referenceMs=performance.now()-start;}
{const start=performance.now(),retained=boxMeshBatch(boxes);for(let i=0;i<frames;i++)assert.equal(retained.length,batch.length);retainedMs=performance.now()-start;}
console.log(JSON.stringify({kind:'qsol.vanillajs.fps-development-workload.v1',source:identity.source,node:process.version,platform:process.platform,arch:process.arch,simulation:rows,geometry:{boxes:boxes.length,vertices:batch.length/6,frames,referenceConstructions:frames,retainedConstructions:1,referenceMs,retainedMs,exactFloat32Parity:true},scope:'CPU observations on this host; excludes GPU, input sampling and audio; no frame-rate or speedup guarantee'},null,2));
