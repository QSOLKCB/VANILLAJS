// SPDX-License-Identifier: Apache-2.0
// Paired, exact-output, CPU geometry assembly observations. Not an FPS gate.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {boxVertices,ringVertices} from '../modules/render-webgl/index.js';

const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const scenes=[
  {name:'many-moving-targets',frames:100,objects:80},
  {name:'moderate-activity',frames:120,objects:16},
  {name:'idle-no-dynamic-objects',frames:120,objects:0}
];
function build(scene,stream){
  let sink=0,hash=createHash('sha256'),floatValues=0;
  for(let frame=0;frame<scene.frames;frame++){
    const vertices=[],lines=[];
    for(let i=0;i<scene.objects;i++){
      const center=[Math.sin(frame*.023+i),Math.cos(i*.13),-i*.37];
      const size=[.07+i*.001,.3,.14],color=[.3,(i%17)/17,.8];
      if(stream){
        boxVertices(center,size,color,vertices);
        ringVertices(center,.25+i*.005,color,[16,24,32,48][i%4],lines);
      }else{
        vertices.push(...boxVertices(center,size,color));
        lines.push(...ringVertices(center,.25+i*.005,color,[16,24,32,48][i%4]));
      }
    }
    const bytes=new Float32Array([...vertices,...lines]);
    if(frame===0)hash.update(new Uint8Array(bytes.buffer));
    floatValues+=bytes.length;
    sink+=vertices.length+lines.length;
  }
  assert.ok(Number.isFinite(sink));
  return {sink,floatValues,firstFrameSha256:hash.digest('hex')};
}
const workloads=scenes.map(scene=>{
  const baseline=build(scene,false),optimized=build(scene,true);
  assert.deepStrictEqual(optimized,baseline,scene.name+' count/hash parity');
  for(let i=0;i<2;i++){build(scene,false);build(scene,true);}
  const samples={baseline:[],optimized:[]};
  for(let i=0;i<7;i++)for(const stream of i%2?[true,false]:[false,true]){
    const begin=performance.now();const result=build(scene,stream),ms=performance.now()-begin;
    assert.deepStrictEqual(result,baseline);
    samples[stream?'optimized':'baseline'].push(ms);
  }
  return {name:scene.name,frames:scene.frames,objectsPerFrame:scene.objects,identity:baseline,
    medianMs:{baseline:median(samples.baseline),optimized:median(samples.optimized)},samplesMs:samples};
});
if(process.argv.includes('--check')){
  assert.equal(workloads.length,3);
  assert.ok(workloads.every(w=>w.identity.floatValues>=0));
}
console.log(JSON.stringify({schemaVersion:1,donors:['QSOLKCB/RUNE','QSOLKCB/GALAXY'],
  environment:{runtime:process.version,platform:process.platform,arch:process.arch},
  protocol:{warmupPairs:2,measuredPairs:7,order:'alternating',timingGate:false,
    scope:'CPU geometry assembly and Float32 conversion, not WebGL draw, GC, GPU or FPS'},
  workloads},null,2));
