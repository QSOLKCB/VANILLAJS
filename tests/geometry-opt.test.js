// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {boxVertices,ringVertices} from '../modules/render-webgl/index.js';

// Independent frozen v1.0.0 references: do not route through the optimized code.
function referenceBox(center,size,color){
  const corners=[];
  for(let i=0;i<8;i++)corners.push(center.map((v,k)=>v+size[k]*((i>>k&1)-.5)));
  const faces=[[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]],shades=[.7,.9,.58,1,.8,.65],data=[];
  faces.forEach((f,i)=>{for(const k of [0,1,2,0,2,3])data.push(...corners[f[k]],...color.map(x=>x*shades[i]));});
  return data;
}
function referenceRing(position,radius,color,segments=48){
  const data=[];
  for(let i=0;i<segments;i++)for(const j of [i,i+1]){
    const a=j/segments*Math.PI*2;
    data.push(position[0]+Math.cos(a)*radius,position[1]+Math.sin(a)*radius,position[2],...color);
  }
  return data;
}
function assertExact(actual,expected,label){
  assert.deepStrictEqual(actual,expected,label+' preserves JS-number values, NaN and signed zero');
  const out=new Float32Array(actual),oracle=new Float32Array(expected);
  assert.deepStrictEqual(
    Buffer.from(out.buffer,out.byteOffset,out.byteLength),
    Buffer.from(oracle.buffer,oracle.byteOffset,oracle.byteLength),
    label+' preserves every uploaded float32 byte'
  );
}
test('OPT boxes preserve original face order, shading and bitwise float32 values',()=>{
  const samples=[
    [[0,0,0],[1,2,3],[.25,.5,.75]],
    [[-0,-0,0],[0,-0,0],[-0,1,-1]],
    [[Math.PI,-1e-100,1e100],[1e-100,1e100,1],[-1,.58,.8]],
    [new Float32Array([.11,-.22,.33]),new Float32Array([.4,.5,.6]),new Float32Array([.7,.8,.9])],
    [[2,-3,4],[3,5,7],[.1,.2,.3,.4]], // Preserve legacy unconstrained color lengths.
  ];
  for(let i=0;i<samples.length;i++)assertExact(boxVertices(...samples[i]),referenceBox(...samples[i]),'box '+i);
  for(let i=0;i<128;i++){
    const center=[(i-64)*.053,Math.sin(i),-(i+1)*.019];
    const size=[.001+i*.1,.2+i*.03,1+i*.001];
    const color=[i/128,(i%9)/9,(i%13)/13];
    assertExact(boxVertices(center,size,color),referenceBox(center,size,color),'box stress '+i);
  }
});
test('OPT ring table preserves exact endpoints, typed inputs, custom tessellation and invalid zero counts',()=>{
  const positions=[[0,0,0],[-0,Math.PI,-0],[1e100,1e-100,-1],new Float32Array([.7,.8,.9])];
  const colors=[[1,.4,-0],new Float32Array([.3,.4,.5])];
  for(const segments of [0,1,2,2.5,7,16,17,24,32,48,60,96]){
    for(const position of positions)for(const color of colors){
      for(const radius of [-1,-0,0,.55,1e-100,1e100]){
        const label='ring '+segments+' / '+radius;
        assertExact(ringVertices(position,radius,color,segments),referenceRing(position,radius,color,segments),label);
      }
    }
  }
});
test('OPT ring reuse does not retain caller state or alter cross-call results',()=>{
  const position=[1,2,3],color=[.4,.7,.9];
  for(const n of [16,24,32,48]){
    const a=ringVertices(position,.35,color,n);
    a.fill(999);position[0]=8;color[2]=0.17;
    assertExact(ringVertices(position,.7,color,n),referenceRing(position,.7,color,n),'ring cache ownership '+n);
  }
});
