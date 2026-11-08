// SPDX-License-Identifier: Apache-2.0
// Executed proof-of-speed receipts. No preselected speedup acceptance threshold.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import {fixtureSet,parity,negativeControl,measure} from './proof-speed-core.mjs';
const args=process.argv.slice(2),check=args.includes('--check'),benchmark=args.includes('--measure');
if(check===benchmark||args.some(x=>!['--check','--measure','--out','proof-speed.json'].includes(x)))
  throw new Error('usage: node scripts/proof-speed.mjs --check | --measure [--out proof-speed.json]');
const outputIndex=args.indexOf('--out'),out=outputIndex>=0?args[outputIndex+1]:'proof-speed.json';
if(benchmark&&!/^[-a-zA-Z0-9_.]+\.json$/.test(out))throw new Error('output must be a local JSON filename');
function sha(bytes){return createHash('sha256').update(bytes).digest('hex');}
let head=null;try{head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}
if(process.env.GITHUB_SHA&&head!==process.env.GITHUB_SHA)
  throw new Error('checked-out HEAD differs from GITHUB_SHA');
const preflight=fixtureSet().map(parity);
for(const f of fixtureSet())if(!negativeControl(f))
  throw new Error('negative-control sensitivity failed: '+f.id);
if(check){
  console.log(JSON.stringify({kind:'qsol.vanillajs.proof-speed.preflight.v1',
    cases:preflight,negativeControlsPassed:preflight.length,commit:head}));
}else{
  const cases=fixtureSet().map(f=>measure(f,{pairs:9,warmups:2}));
  const source=await readFile(new URL('./proof-speed-core.mjs',import.meta.url));
  const report={kind:'qsol.vanillajs.proof-speed.observations.v1',
    timestamp:new Date().toISOString(),commit:head,
    runner:{platform:process.platform,arch:process.arch,node:process.version,
      cpu:os.cpus()[0]?.model??'unknown',logicalCpu:os.cpus().length,
      githubRunId:process.env.GITHUB_RUN_ID??null},
    method:{warmupPairs:2,measuredPairs:9,order:'AB,BA,AB,BA,...',
      correctness:'full per-tick gameplay states, complete collision hits or retained framebuffer bytes',
      timing:'wall-clock JavaScript CPU, no browser GPU timing, no automatic performance budget',
      indexLifecycle:'query-only medians are separate from seven explicit index build timing samples',
      sourceSha256:sha(source)},cases};
  const raw=JSON.stringify(report,null,2)+'\n';
  await writeFile(out,raw,{flag:'wx'});
  await writeFile('proof-speed.SHA256SUMS',sha(raw)+'  '+out+'\n',{flag:'wx'});
  console.log(JSON.stringify({report:out,sha256:sha(raw),
    cases:cases.map(x=>({fixture:x.fixture,ratio:x.medianRatio,
      referenceWork:x.referenceWork,optimizedWork:x.optimizedWork}))}));
}