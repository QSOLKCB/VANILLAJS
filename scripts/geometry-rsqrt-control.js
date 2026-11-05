// SPDX-License-Identifier: Apache-2.0
// Research-only negative control, NOT a renderer or collision dependency.
// Evaluates historical Quake-style inverse sqrt for positive finite float32.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
const scratch=new ArrayBuffer(4),words=new Uint32Array(scratch),float=new Float32Array(scratch);
function quake(x){
  float[0]=x;
  words[0]=0x5f3759df-(words[0]>>>1);
  let y=float[0];
  return y*(1.5-(.5*x*y*y));
}
const native=x=>1/Math.sqrt(x);
const inputs=new Float32Array(50000);
for(let i=0;i<inputs.length;i++)inputs[i]=Math.fround(.0001+(i+1)*.001+(i%31)*.073);
let maxRelativeError=0;
for(const x of inputs){
  assert.ok(Number.isFinite(x)&&x>0);
  const approximate=quake(x),exact=native(x);
  assert.ok(Number.isFinite(approximate)&&approximate>0);
  maxRelativeError=Math.max(maxRelativeError,Math.abs((approximate-exact)/exact));
}
const run=fn=>{let sink=0;for(const x of inputs)sink+=fn(x);assert.ok(Number.isFinite(sink));return sink;};
for(let i=0;i<3;i++){run(quake);run(native);}
const samples={quake:[],native:[]};
for(let i=0;i<7;i++){
  for(const kind of i%2?['native','quake']:['quake','native']){
    const start=performance.now();
    run(kind==='native'?native:quake);
    samples[kind].push(performance.now()-start);
  }
}
const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
if(process.argv.includes('--check')){
  assert.ok(maxRelativeError>0&&maxRelativeError<.005,'the approximate control is distinct from exact inverse sqrt');
  assert.equal(samples.quake.length,7);assert.equal(samples.native.length,7);
}
console.log(JSON.stringify({
  schemaVersion:1,kind:'research-negative-control',
  baseline:'1/Math.sqrt(x)',candidate:'Quake 0x5f3759df + one Newton step',
  input:'50,000 positive finite Float32 values, fixed arithmetic sequence',
  environment:{runtime:process.version,platform:process.platform,arch:process.arch},
  protocol:{warmupPairs:3,measuredPairs:7,order:'alternating',timingGate:false,scope:'isolated JS numerical kernel'},
  maxRelativeError,samplesMs:samples,medianMs:{native:median(samples.native),quake:median(samples.quake)},
  verdict:'Neither method is a drop-in replacement for exact geometry or robust Math.hypot'
},null,2));
