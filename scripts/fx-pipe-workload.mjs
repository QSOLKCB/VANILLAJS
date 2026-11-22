// SPDX-License-Identifier: Apache-2.0
// FX-PIPE-001: paired CPU graphics preparation; not browser GC/GPU/FPS evidence.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {FxGraphicsPipe} from '../modules/fx-pipe/index.js';
import {SCALE} from '../modules/integer-math/index.js';

const COUNTS=[64,256,512],Q=SCALE;
const matrices=[
  [Q,0,0,0,0,Q,0,0,0,0,Q,0],
  [0,-Q,0,Q,Q,0,0,0,0,0,Q,0],
  [46341,-46341,0,12893,46341,46341,0,-10583,0,0,Q,0],
  [2*Q,Q/2,0,-Q,0,Q,0,0,0,0,Q,0]
];
const indices=[0,1,2,0,2,3];
function classic(count,frame){
  const m=matrices[frame%matrices.length],out=[];
  for(let i=0;i<count;i++){
    const x=(i%32-16)*9893,y=((i/32|0)-8)*14551,z=-4*Q,w=2*Q,h=Q;
    const corners=[[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z]];
    for(const v of indices){
      const p=corners[v];
      for(let a=0;a<3;a++){
        const j=a*4;
        out.push((Math.trunc((m[j]*p[0]+m[j+1]*p[1]+m[j+2]*p[2])/Q)+m[j+3])/Q);
      }
      out.push(189/255,73/255,18/255);
    }
  }
  return new Float32Array(out);
}
function retained(pipe,count,frame){
  pipe.reset().setTransform(matrices[frame%matrices.length]);
  for(let i=0;i<count;i++){
    const x=(i%32-16)*9893,y=((i/32|0)-8)*14551;
    pipe.appendQuadXY(x,y,-4*Q,2*Q,Q,189,73,18);
  }
  return pipe.view();
}
const checksum=data=>data[0]+data[data.length-1]+data[data.length-6];
const median=a=>[...a].sort((x,y)=>x-y)[a.length>>1];
const observations=[];
for(const count of COUNTS){
  const pipe=new FxGraphicsPipe(count*6);
  for(let i=0;i<12;i++){
    const baseline=classic(count,i),candidate=retained(pipe,count,i);
    assert.deepEqual(Buffer.from(candidate.buffer,candidate.byteOffset,candidate.byteLength),
      Buffer.from(baseline.buffer),'exact Float32 vertex parity');
  }
  const original=()=>{
    let sum=0;
    for(let frame=0;frame<80;frame++)sum+=checksum(classic(count,frame));
    return sum;
  };
  const stream=()=>{
    let sum=0;
    for(let frame=0;frame<80;frame++)sum+=checksum(retained(pipe,count,frame));
    return sum;
  };
  for(let i=0;i<2;i++)assert.equal(original(),stream(),'warmup parity');
  const expected=original(),samples={original:[],stream:[]};
  for(let trial=0;trial<7;trial++){
    for(const mode of trial%2?['stream','original']:['original','stream']){
      const start=performance.now(),value=mode==='stream'?stream():original();
      samples[mode].push(performance.now()-start);
      assert.equal(value,expected,'paired checksum parity');
    }
  }
  observations.push({quads:count,vertices:count*6,framesPerTrial:80,
    retainedBytes:pipe.retainedBytes,parity:true,
    medianMs:{original:median(samples.original),stream:median(samples.stream)},
    samplesMs:samples});
}
console.log(JSON.stringify({kind:'qsol.vanillajs.fx-pipe-001.cpu.v1',
  environment:{node:process.version,platform:process.platform,arch:process.arch},
  scope:'CPU affine geometry preparation only; no browser GC pause, GPU execution or FPS improvement claim',
  method:{trials:7,warmupPairs:2,order:'alternating',timingGate:false},
  observations},null,2));
