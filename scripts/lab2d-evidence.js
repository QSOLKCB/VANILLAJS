// SPDX-License-Identifier: Apache-2.0
// Deterministic public 2D lab evidence. CPU time is an observation, not a gate.
// Run under hosted CI or the owner's workstation; no data leaves the machine.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createLab2D,stepLab2D,snapshotLab2D,LAB2D_MODES,rtsRoute2D}
  from '../demos/2d-lab/world.js';
import {createSound2D} from '../modules/audio2d/index.js';
import {TernaryGridStore2D} from '../modules/ternary-store2d/index.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceFiles=['modules/motion2d/index.js','modules/audio2d/index.js',
  'modules/ternary-store2d/index.js','demos/2d-lab/world.js'];
const pinned=Object.fromEntries(sourceFiles.map(name=>
  [name,sha(readFileSync(new URL('../'+name,import.meta.url)))]));
function scene(kind){
  let state=createLab2D(kind);
  for(let t=0;t<240;t++){
    const input={x:t%3-1,y:t%5===0?1:0,steer:t%13===0?1:0,
      throttle:1,fire:t%2===0,jump:t%40===0};
    state=stepLab2D(state,input);
  }
  return snapshotLab2D(state);
}
const scenes=LAB2D_MODES.map(kind=>{
  const a=scene(kind),b=scene(kind);
  assert.deepEqual(a,b,'2D source replay mismatch: '+kind);
  return {kind,sha256:sha(JSON.stringify(a)),tick:a.tick,
    final:{x:a.body.x,y:a.body.y,vx:a.body.vx,vy:a.body.vy,
      heading:a.body.heading},shotCount:a.shots.length};
});
const notes=[
  {id:1,channel:0,sample:0,duration:12000,frequency:220,wave:'triangle'},
  {id:2,channel:1,sample:12000,duration:8000,frequency:440,wave:'square'},
  {id:3,channel:2,sample:24000,duration:6000,frequency:160,wave:'noise',seed:17},
  {id:4,channel:3,sample:32000,duration:8000,frequency:660,wave:'saw'}];
const audio=createSound2D({frames:48000,events:notes});
const all=audio.renderAll(),sections=[0,37,4096,16000,48000];
const segmented=new Int16Array(all.length);
for(let i=0;i<sections.length-1;i++)
  segmented.set(audio.renderRange(sections[i],sections[i+1]-sections[i]),sections[i]);
assert.deepEqual(all,segmented,'audio block partition drift');
const audioReport={sampleRate:audio.sampleRate,frames:audio.frames,
  eventCount:audio.eventCount,wavSHA256:sha(audio.wav()),
  pcmSHA256:sha(Buffer.from(audio.wav().subarray(44))),
  chunkIdentical:true};
const rows=27,src={title:'THE FOUNDRY',name:'VANILLAJS',mode:'ternary-grid'};
const base=new TernaryGridStore2D();
base.put('data/demo.json',src);base.put('docs/note.txt','2D now, 3D later');
const expected=base.snapshot(),frozen=JSON.stringify(expected);
for(let i=0;i<30;i++)assert.deepEqual(base.snapshot(),expected);
const cached=base.cacheStats();
assert.equal(cached.builds,1);assert.ok(cached.hits>=30);
base.put('data/demo.json',src);const unchanged=base.cacheStats();
assert.equal(unchanged.builds,1);
const roundtrip=TernaryGridStore2D.fromSnapshot(expected);
assert.equal(JSON.stringify(roundtrip.snapshot()),frozen);
const storeReport={columns:rows,byteLength:expected.byteLength,
  rowCount:expected.rows.length,sha256:sha(frozen),
  cacheBuilds:unchanged.builds,cacheHits:unchanged.hits,
  unchangedWrites:unchanged.unchangedWrites};
function samplePerformance(label,fn){
  const results=[];
  for(let i=0;i<9;i++){
    const t=performance.now();fn();const elapsed=performance.now()-t;
    if(i>=2)results.push(elapsed);
  }
  return {label,samplesMs:results,medianMs:[...results].sort((a,b)=>a-b)[3]};
}
const perf={
  repeatedCache:samplePerformance('30 cached snapshot copies',()=>{
    for(let i=0;i<30;i++)base.snapshot();
  }),
  freshBuild:samplePerformance('30 new stores + snapshots',()=>{
    for(let i=0;i<30;i++){
      const s=new TernaryGridStore2D();s.put('data/demo.json',src);
      s.put('docs/note.txt','2D now, 3D later');
      assert.equal(JSON.stringify(s.snapshot()),frozen);
    }
  })
};
const strict={schemaVersion:1,kind:'qsol.vanillajs.lab2d.evidence.v1',
  model:'strict fixed tick + 48kHz integer PCM + 6-trit UTF8',
  sourceBaseline:'34040c330a4943d4b55104c78935a25b3ab94973',
  sourceSHA256:pinned,scenes,rtsRouteLength:rtsRoute2D().length,
  audio:audioReport,ternary:storeReport};
const report={strict,strictSHA256:sha(JSON.stringify(strict)),
  observations:{device:'hosted-or-owner CPU',hardwareGPU:'not measured',
    unit:'milliseconds',profile:'serial Node; 2 warmups; 7 trials; no time gate',
    cacheComparison:perf}};
if(process.argv.includes('--check')){
  assert.equal(scenes.length,4);
  assert.ok(strict.rtsRouteLength>0);
  assert.equal(storeReport.cacheBuilds,1);
  assert.equal(strict.audio.chunkIdentical,true);
  assert.ok(Object.values(perf).every(p=>p.samplesMs.length===7));
}
process.stdout.write(JSON.stringify(report,null,2)+'\n');
