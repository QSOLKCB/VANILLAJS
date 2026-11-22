// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxVertexStream,BOX_STREAM_FLOATS,BOX_STREAM_MAX_BOXES} from '../modules/render-packing/index.js';
import {boxVertices} from '../modules/render-webgl/index.js';

// Independent historical geometry oracle, not a call through the new stream.
function oldBox(center,size,color){
  const corners=[];
  for(let i=0;i<8;i++)corners.push(center.map((v,k)=>v+size[k]*((i>>k&1)-.5)));
  const faces=[[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]];
  const shades=[.7,.9,.58,1,.8,.65],out=[];
  for(let face=0;face<6;face++)
    for(const j of [0,1,2,0,2,3])out.push(...corners[faces[face][j]],...color.map(v=>v*shades[face]));
  return out;
}
const bytes=a=>Buffer.from(new Float32Array(a).buffer);
function fixture(i){
  const center=[i%13===0?-0:((i%19)-8)*.0125,(i%17)*.13,-i*.1];
  const size=[i%9===0?0:.1+i*.001,.25,i*.003];
  const color=[(i%17)/17,.5,i%11===0?4:1];
  return {center,size,color};
}

test('box stream preserves every byte, shade and vertex order of independent historical geometry',()=>{
  const stream=new BoxVertexStream(256),expected=[];
  for(let i=0;i<256;i++){
    const {center,size,color}=fixture(i);
    if(i%2)stream.append(center,size,color);
    else stream.appendXYZRGB(...center,...size,...color);
    const old=oldBox(center,size,color);
    assert.deepEqual(bytes(boxVertices(center,size,color)),bytes(old),'legacy parity box '+i);
    expected.push(...old);
  }
  assert.equal(stream.boxCount,256);
  assert.equal(stream.vertexCount,256*36);
  assert.equal(stream.usedFloats,256*BOX_STREAM_FLOATS);
  assert.deepEqual(bytes(stream.view()),bytes(expected));
});

test('reset reuses one bounded backing store and never exposes stale tails',()=>{
  const stream=new BoxVertexStream(8),backing=stream.view().buffer;
  for(const count of [8,3,0,7,1,0,8]){
    stream.reset();
    const expected=[];
    for(let i=0;i<count;i++){
      const {center,size,color}=fixture(i);
      stream.append(center,size,color);expected.push(...oldBox(center,size,color));
    }
    assert.equal(stream.view().buffer,backing);
    assert.equal(stream.view().length,count*BOX_STREAM_FLOATS);
    assert.deepEqual(bytes(stream.view()),bytes(expected));
  }
  const first=stream.view();
  stream.reset();stream.append([0,0,0],[1,1,1],[.2,.4,.6]);
  assert.equal(first.buffer,stream.view().buffer,'views alias the same owned store');
});

test('invalid geometry, full stream and invalid capacities reject without partial writes',()=>{
  for(const value of [0,-1,1.1,Infinity,BOX_STREAM_MAX_BOXES+1,'8'])
    assert.throws(()=>new BoxVertexStream(value),RangeError);
  const stream=new BoxVertexStream(1);
  assert.throws(()=>stream.append([0,0], [1,1,1], [0,0,0]),TypeError);
  for(const c of [
    [NaN,0,0,1,1,1,1,1,1],
    [0,Infinity,0,1,1,1,1,1,1],
    [0,0,0,-1,1,1,1,1,1],
    [0,0,0,1,1,1,5,1,1],
    [1000001,0,0,1,1,1,1,1,1],
    [0,0,0,1,1,1,-.001,1,1]
  ])assert.throws(()=>stream.appendXYZRGB(...c),RangeError);
  assert.equal(stream.boxCount,0);
  stream.appendXYZRGB(0,0,0,1,1,1,1,1,1);
  const before=bytes(stream.view());
  assert.throws(()=>stream.appendXYZRGB(1,1,1,1,1,1,1,1,1),/full/);
  assert.equal(stream.boxCount,1);
  assert.deepEqual(bytes(stream.view()),before);
  stream.reset();assert.equal(stream.view().length,0);
  stream.appendXYZRGB(-0,0,0,0,0,0,0,0,0);
  assert.deepEqual(bytes(stream.view()),bytes(oldBox([-0,0,0],[0,0,0],[0,0,0])));
});

test('large capacity is fixed, a caller can preflight a full batch, and cold output starts empty',()=>{
  const max=new BoxVertexStream(BOX_STREAM_MAX_BOXES);
  assert.equal(max.capacityBoxes,4096);
  assert.equal(max.view().length,0);
  assert.equal(max.view().buffer.byteLength,4096*BOX_STREAM_FLOATS*4);
  const sample=fixture(25);max.append(sample.center,sample.size,sample.color);
  assert.equal(max.view().byteLength,BOX_STREAM_FLOATS*4);
});
