// SPDX-License-Identifier: Apache-2.0
// REPLAY-AUDIT-001: host-only deterministic playthrough and CPU workload receipt.
// Performance here is a hosted diagnostic, never a physical-GPU FPS certification.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {mkdir,writeFile} from 'node:fs/promises';
import {replayExamples,BASE_BUILD} from '../demos/replay-audit-lab/scenarios.js';
import {sealReplayReceipt,verifyReplayReceipt} from '../modules/replay-audit/index.js';
if(process.argv.length!==3||process.argv[2]!=='--check')
 throw Error('usage: node scripts/replay-audit-workload.mjs --check');
const measures=[],replays=replayExamples();
for(const [name,source]of Object.entries(replays)){
 let expected=null,timings=[];
 for(let i=0;i<6;i++){
  const start=performance.now(),receipt=await sealReplayReceipt(source),
   elapsed=performance.now()-start;
  if(expected===null)expected=receipt;
  else assert.deepEqual(receipt,expected,name+' repeated-tape drift');
  if(i>0)timings.push(elapsed); // exclude warmup
 }
 const checked=await verifyReplayReceipt(expected,{expectedBuild:BASE_BUILD});
 assert.equal(checked.match,true,name+' independent verification');
 timings.sort((a,b)=>a-b);
 measures.push({model:name,declaredSourceBuild:BASE_BUILD,mode:expected.mode,
  ticks:expected.ticks,traceSha256:expected.traceSha256,finalSha256:expected.finalSha256,
  eventCount:expected.trace.reduce((n,t)=>n+t.events.length,0),
  measuredHostMilliseconds:{minimum:timings[0],median:timings[2],maximum:timings.at(-1)}});
}
const receipt={format:'qsol.vanillajs.replay-audit-001.host-workload.v1',
  checkoutSHA:process.env.GITHUB_SHA??null,runner:process.env.ImageVersion??'untrusted-local',
  node:process.version,platform:process.platform,arch:process.arch,
  kind:'untrusted-host-cpu-diagnostic',nativeGPUVerified:false,
  checks:['source-tape repeated execution equality','independent full tick verification',
    'trusted real FPS/air/vehicle/integer engine adapters'],models:measures};
await mkdir('browser-artifacts',{recursive:true});
await writeFile('browser-artifacts/replay-audit-workload.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
