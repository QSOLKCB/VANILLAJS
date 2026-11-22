// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {SCALE} from '../modules/integer-math/index.js';
import {FxGraphicsPipe,FX_PIPE_MAX_VERTICES,FX_PIPE_FORMAT} from '../modules/fx-pipe/index.js';
const I=[SCALE,0,0,0,0,SCALE,0,0,0,0,SCALE,0];
const Q=[0,1,2,0,2,3],S=BigInt(SCALE);
const bytes=data=>Buffer.from(new Float32Array(data).buffer);
function oracle(m,positions,rgb,indices){
  const out=[];
  for(const index of indices){
    const p=positions[index];
    for(let a=0;a<3;a++){
      const j=a*4,raw=(BigInt(m[j])*BigInt(p[0])+BigInt(m[j+1])*BigInt(p[1])+
        BigInt(m[j+2])*BigInt(p[2]))/S+BigInt(m[j+3]);
      out.push(Number(raw)/SCALE);
    }
    for(const color of rgb)out.push(color/255);
  }
  return new Float32Array(out);
}
const rect=(x,y,z,w,h)=>[[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z]];
test('FX pipe exports its versioned identity and starts empty with bounded retained storage',()=>{
  assert.equal(FX_PIPE_FORMAT,'qsol.vanillajs.fx-pipe.v1');
  const p=new FxGraphicsPipe(12);
  assert.equal(p.vertexCount,0);assert.equal(p.view().length,0);
  assert.equal(p.retainedBytes,12*6*4);
  for(const bad of [0,1,2,4,-3,65535,65533,FX_PIPE_MAX_VERTICES+3,NaN,'12'])
    assert.throws(()=>new FxGraphicsPipe(bad),RangeError);
  assert.equal(new FxGraphicsPipe(FX_PIPE_MAX_VERTICES).capacityVertices,FX_PIPE_MAX_VERTICES);
});
test('single triangle and two-triangle sprite preserve independent BigInt Q16 oracle bytes',()=>{
  const pipe=new FxGraphicsPipe(12);
  const triangle=[[0,0,-SCALE],[-SCALE,0,-SCALE],[0,SCALE,-SCALE]];
  pipe.appendTriangleXYZRGB(...triangle.flat(),255,64,0);
  const q=rect(-SCALE,-SCALE,-2*SCALE,2*SCALE,2*SCALE);
  pipe.appendQuadXY(-SCALE,-SCALE,-2*SCALE,2*SCALE,2*SCALE,24,72,200);
  const expected=new Float32Array([...oracle(I,triangle,[255,64,0],[0,1,2]),
    ...oracle(I,q,[24,72,200],Q)]);
  assert.deepEqual(bytes(pipe.view()),bytes(expected));
  assert.equal(pipe.vertexCount,9);
  assert.equal(pipe.usedFloats,54);
});
test('rotation, nonuniform scale, shear and translation use one exact truncation',()=>{
  const pipe=new FxGraphicsPipe(24);
  const transforms=[
    [0,-SCALE,0,3*SCALE,SCALE,0,0,-2*SCALE,0,0,SCALE,0],
    [2*SCALE,SCALE/2,0,-SCALE,0,3*SCALE,0,0,0,0,SCALE,0],
    [46341,-46341,0,114321,46341,46341,0,-79532,0,0,SCALE,-2*SCALE]
  ];
  for(const m of transforms){
    pipe.reset().setTransform(m);
    const quad=rect(-5*SCALE,-2*SCALE,-3*SCALE,7*SCALE,4*SCALE);
    pipe.appendQuadXY(...quad[0],7*SCALE,4*SCALE,200,100,19);
    assert.deepEqual(bytes(pipe.view()),bytes(oracle(m,quad,[200,100,19],Q)));
    const triangles=[[SCALE,0,0],[0,SCALE,0],[-SCALE,2*SCALE,0]];
    pipe.appendTriangleXYZRGB(...triangles.flat(),11,15,255);
    const full=new Float32Array([...oracle(m,quad,[200,100,19],Q),
      ...oracle(m,triangles,[11,15,255],[0,1,2])]);
    assert.deepEqual(bytes(pipe.view()),bytes(full));
  }
});
test('transform copies input and preserves accepted matrix on preflight rejection',()=>{
  const p=new FxGraphicsPipe(6),m=Int32Array.from([SCALE,0,0,SCALE,0,SCALE,0,0,0,0,SCALE,0]);
  p.setTransform(m);m[3]=100*SCALE;
  p.appendQuadXY(0,0,-SCALE,SCALE,SCALE,255,255,255);
  assert.equal(p.view()[0],1,'caller mutation cannot change stored matrix');
  const before=bytes(p.view());
  assert.throws(()=>p.setTransform([SCALE,0,0,0,0,SCALE,0,0,0,0,SCALE]),RangeError);
  assert.throws(()=>p.setTransform(Object.assign([...I],{extra:1})),RangeError);
  const accessor=[...I];Object.defineProperty(accessor,'0',{get(){throw Error('getter invoked');}});
  assert.throws(()=>p.setTransform(accessor),TypeError);
  assert.deepEqual(bytes(p.view()),before);
  p.reset().resetTransform().appendTriangleXYZRGB(0,0,0,SCALE,0,0,0,SCALE,0,0,0,0);
  assert.equal(p.view()[0],0);
});
test('preflight overflow, malformed inputs and a full buffer leave published bytes unchanged',()=>{
  const p=new FxGraphicsPipe(6).appendQuadXY(0,0,-SCALE,SCALE,SCALE,1,2,3);
  const baseline=bytes(p.view());
  assert.throws(()=>p.appendTriangleXYZRGB(0,0,0,0,0,0,0,0,0,1,2,3),/budget/);
  assert.equal(p.vertexCount,6);assert.deepEqual(bytes(p.view()),baseline);
  p.reset();
  const bad=[
    ()=>p.appendQuadXY(0,0,0,-SCALE,SCALE,1,2,3),
    ()=>p.appendQuadXY(4096*SCALE,0,0,SCALE,SCALE,1,2,3),
    ()=>p.appendQuadXY(0,0,0,SCALE,SCALE,256,2,3),
    ()=>p.appendQuadXY(0,0,0,SCALE,SCALE,1.2,2,3),
    ()=>p.appendQuadXY(NaN,0,0,SCALE,SCALE,1,2,3),
    ()=>p.appendTriangleXYZRGB(0,0,0,0,0,0,0,0,Infinity,1,2,3)
  ];
  for(const fn of bad){assert.throws(fn);assert.equal(p.vertexCount,0);assert.equal(p.view().length,0);}
  // The fourth projected corner exceeds output bounds despite individually
  // admissible raw coordinates; it must never publish a partial sprite.
  p.setTransform([8*SCALE,8*SCALE,8*SCALE,0,0,SCALE,0,0,0,0,SCALE,0]);
  assert.throws(()=>p.appendQuadXY(4090*SCALE,4090*SCALE,0,0,0,1,2,3),/transformed/);
  assert.equal(p.vertexCount,0);
});
test('full reset reuses the Float32 backing store and excludes stale tails',()=>{
  const p=new FxGraphicsPipe(18),storage=p.view().buffer;
  for(const n of [3,1,0,2,3]){
    p.reset();
    for(let i=0;i<n;i++)p.appendQuadXY(i*SCALE,0,-SCALE,SCALE,SCALE,5,25,255);
    assert.equal(p.view().buffer,storage);
    assert.equal(p.vertexCount,n*6);
    assert.equal(p.view().length,n*36);
  }
});
test('bounded seeded mixed-frame batches retain exact independent output bytes',()=>{
  const p=new FxGraphicsPipe(512*6);
  const m=[SCALE,0,0,0,0,SCALE,0,0,0,0,SCALE,0];
  for(let frame=0;frame<9;frame++){
    m[3]=frame*137;
    p.reset().setTransform(m);
    const expected=[];
    for(let i=0;i<512;i++){
      const x=((i%32)-16)*10011,y=((i/32|0)-8)*17777,z=-3*SCALE;
      p.appendQuadXY(x,y,z,2*SCALE,SCALE,127,201,17);
      expected.push(...oracle(m,rect(x,y,z,2*SCALE,SCALE),[127,201,17],Q));
    }
    assert.deepEqual(bytes(p.view()),bytes(expected),'frame '+frame);
  }
});
