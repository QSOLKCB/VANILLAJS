// SPDX-License-Identifier: Apache-2.0
// Observations, not performance promotion or mathematical proof.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cpus,platform,arch,release} from 'node:os';
import {performance} from 'node:perf_hooks';
import {Experiment,starterPack} from '../demos/quantum-game-lab/experiment.js';
import {referenceSound} from '../modules/symbolic-events/index.js';
import {transitionGraph} from '../modules/gf3/index.js';
const hash=x=>createHash('sha256').update(x).digest('hex');
const fixture=JSON.parse(await readFile('tests/fixtures/qgame-math-001.json','utf8'));
const paths=['modules/gf3/index.js','modules/symbolic-events/index.js','modules/mod-experiment/index.js',
  'modules/gf3-lattice/index.js','modules/mod-sdk/index.js','modules/orbital-physics/index.js',
  'modules/audio2d/index.js','modules/integer-time/index.js','modules/integer-math/index.js',
  'demos/quantum-game-lab/experiment.js','demos/quantum-game-lab/app.js',
  'demos/quantum-game-lab/index.html','demos/quantum-game-lab/style.css',
  'tests/qgame-math-001.test.js','tests/fixtures/qgame-math-001.json',
  'scripts/qgame_math_001_oracle.py','scripts/browser-qgame.js','scripts/qgame-math-evidence.mjs',
  'docs/QGAME_MATH_001.md','docs/QGAME_MATH_001_PROVENANCE.md','MODULES.json',
  'examples/qgame-math-001/ternary-constellation.json','scripts/browser-check.js',
  'scripts/browser-reuse-policy.json','scripts/build.js','scripts/verify-offline.js',
  '.github/workflows/qgame-math.yml'];
const sourceHashes=Object.fromEntries(await Promise.all(paths.map(async path=>[path,hash(await readFile(path))])));
function run(dimension){
  const session=new Experiment(starterPack(dimension)),graph=transitionGraph(session.compiled.operations);
  for(const event of fixture.events)session.step(event.operation);
  const wav=referenceSound(session.snapshot().events).wav();
  return {session,identity:hash(JSON.stringify({graph,events:session.snapshot().events})+hash(wav))};
}
const workloads=[];
for(const dimension of [2,4]){
  const measurements=[],identities=new Set();for(let i=0;i<3;i++)run(dimension);
  for(let i=0;i<15;i++){const start=performance.now(),result=run(dimension);measurements.push(performance.now()-start);identities.add(result.identity);}
  if(identities.size!==1)throw Error('workload output mismatch');
  const sorted=[...measurements].sort((a,b)=>a-b);
  workloads.push({dimension,states:3**dimension,transitions:32,substepsPerBody:256,pcmFrames:384000,
    repetitions:15,warmups:3,milliseconds:measurements,medianMilliseconds:sorted[7],outputSHA256:[...identities][0]});
}
const errors={};
for(const preset of ['gentle','swift']){
  const source=starterPack();source.entries[0].data.spatial=preset;const s=new Experiment(source);
  let maximumAbsoluteError=0,maximumScaledError=0;
  for(const [tick,event] of fixture.events.entries()){
    const actual=s.step(event.operation).bodies;
    actual.forEach((body,i)=>{
      for(const key of ['position','velocity','energy'])[body[key]].flat().forEach((x,j)=>{
        const y=[fixture.spatial[preset][tick][i][key]].flat()[j],error=Math.abs(x-y);
        maximumAbsoluteError=Math.max(maximumAbsoluteError,error);maximumScaledError=Math.max(maximumScaledError,error/(1+Math.abs(y)));
        if(error>fixture.tolerance.absolute+fixture.tolerance.relative*Math.abs(y))throw Error('Decimal comparison failed');
      });
    });
  }
  errors[preset]={maximumAbsoluteError,maximumScaledError};
}
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
console.log(JSON.stringify({kind:'qsol.qgame-evidence.v1',gitCommit:git('rev-parse','HEAD'),
  dirty:git('status','--porcelain').length!==0,sourceHashes,
  environment:{node:process.version,platform:platform(),architecture:arch(),kernel:release(),cpu:cpus()[0]?.model},
  reference:{finiteMatrices:81,invertibleMatrices:48,affineStates:3888,matrixProducts:6561,
    eventCount:32,pcmSHA256:fixture.pcmSHA256,numericalTolerance:fixture.tolerance,observedErrors:errors},
  workloads,claim:'Local bounded workload observations only; no baseline/candidate speedup, GPU, WASM, cross-runtime Float64 or quantum claim'},null,2));
