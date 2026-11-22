// SPDX-License-Identifier: Apache-2.0
// Reproducible isolated CPU geometry assembly benchmark, not a GPU/GC/FPS claim.
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {boxVertices} from '../modules/render-webgl/index.js';
import {BoxVertexStream,BOX_STREAM_FLOATS} from '../modules/render-packing/index.js';

const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
const rows=[];
for(const count of [64,256,512]){
  const boxes=Array.from({length:count},(_,i)=>({
    p:[(i%25)*.15,1+(i%7)*.05,-i*.017],
    s:[.1,.2+i*.00001,.15],c:[(i%5)/5,.45,.8]
  }));
  const stream=new BoxVertexStream(count);
  const old=new Float32Array(boxes.flatMap(b=>boxVertices(b.p,b.s,b.c)));
  for(const b of boxes)stream.append(b.p,b.s,b.c);
  assert.deepEqual(Buffer.from(stream.view().buffer),Buffer.from(old.buffer),'input byte parity');
  const original=()=>{
    let sum=0;
    for(let frame=0;frame<80;frame++){
      const vertices=[];
      for(const box of boxes)boxVertices(box.p,box.s,box.c,vertices);
      const packed=new Float32Array(vertices);sum+=packed[0]+packed.at(-1);
    }
    return sum;
  };
  const reuse=()=>{
    let sum=0;
    for(let frame=0;frame<80;frame++){
      stream.reset();
      for(const box of boxes)stream.append(box.p,box.s,box.c);
      const view=stream.view();sum+=view[0]+view.at(-1);
    }
    return sum;
  };
  for(let i=0;i<2;i++){assert.equal(original(),reuse());}
  const samples={original:[],stream:[]};
  for(let trial=0;trial<7;trial++)
    for(const key of trial%2?['stream','original']:['original','stream']){
      const start=performance.now(),value=key==='stream'?reuse():original();
      samples[key].push(performance.now()-start);
      assert.equal(value,reuseChecksum(count,boxes));
    }
  rows.push({boxes:count,framesPerTrial:80,verticesPerFrame:count*36,
    originalFloatValuesPerFrame:count*BOX_STREAM_FLOATS,streamRetainedBytes:stream.view().buffer.byteLength,
    float32ByteParity:true,medianMs:{original:median(samples.original),stream:median(samples.stream)},
    samplesMs:samples});
}
function reuseChecksum(count,boxes){
  // Both modes use the same first and final vertex every frame, and the inputs
  // do not depend on the draw schedule.
  const first=boxVertices(boxes[0].p,boxes[0].s,boxes[0].c)[0];
  const last=new Float32Array(boxVertices(boxes[count-1].p,boxes[count-1].s,boxes[count-1].c)).at(-1);
  return 80*(Math.fround(first)+last);
}
assert.ok(rows.every(r=>r.float32ByteParity&&r.streamRetainedBytes===r.boxes*BOX_STREAM_FLOATS*4));
console.log(JSON.stringify({kind:'qsol.vanillajs.render-packing-workload.v1',node:process.version,
  platform:process.platform,arch:process.arch,protocol:{warmupPairs:2,measuredPairs:7,
    order:'alternating',timingGate:false,scope:'CPU geometry assembly and Float32 conversion only; not browser GC, GPU completion or FPS'},
  rows},null,2));
