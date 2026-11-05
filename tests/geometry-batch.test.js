// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {boxVertices,ringVertices} from '../modules/render-webgl/index.js';

// Black-box parity against the existing public default allocation path.
// Includes offsets and Float32 GPU upload bytes, not just vertex counts.
function checkBytes(a,b){
  const fa=new Float32Array(a),fb=new Float32Array(b);
  assert.deepStrictEqual(Buffer.from(fa.buffer),Buffer.from(fb.buffer));
}
test('direct append keeps the original face/ring order and preserves the target identity',()=>{
  const a={center:[-0,1.25,-3.5],size:[.2,4,7],color:[.7,.2,.4]};
  const b={center:[8,-2,1],size:[.75,.1,2],color:[.1,.3,.6]};
  const ring={center:[1.5,2,-3],radius:.55,color:[.9,.7,.44]};
  const legacy=[
    ...boxVertices(a.center,a.size,a.color),
    ...ringVertices(ring.center,ring.radius,ring.color,24),
    ...boxVertices(b.center,b.size,b.color),
    ...ringVertices([0,-0,3],-0,[.4,.6,.8],32)
  ];
  const target=[93,-0,77],prefix=target.slice();
  assert.equal(boxVertices(a.center,a.size,a.color,target),target);
  assert.equal(ringVertices(ring.center,ring.radius,ring.color,24,target),target);
  assert.equal(boxVertices(b.center,b.size,b.color,target),target);
  assert.equal(ringVertices([0,-0,3],-0,[.4,.6,.8],32,target),target);
  assert.deepStrictEqual(target.slice(0,prefix.length),prefix);
  assert.deepStrictEqual(target.slice(prefix.length),legacy);
  checkBytes(target.slice(prefix.length),legacy);
});
test('streamed FPS-style dynamic groups reproduce legacy concatenation for varying worlds',()=>{
  for(let frame=0;frame<160;frame++){
    const legacyVertices=[],legacyLines=[],vertices=[],lines=[];
    const count=frame%17;
    for(let i=0;i<count;i++){
      const center=[Math.sin(frame+i),Math.cos(i),-(frame+i)*.025];
      const size=[.07+.03*i,.2,.18],color=[.3,(i%8)/8,.9];
      legacyVertices.push(...boxVertices(center,size,color));
      boxVertices(center,size,color,vertices);
      const segments=[16,24,32,48,17][i%5],radius=.08+frame*.002;
      legacyLines.push(...ringVertices(center,radius,color,segments));
      ringVertices(center,radius,color,segments,lines);
    }
    assert.deepStrictEqual(vertices,legacyVertices,'frame '+frame+' vertices');
    assert.deepStrictEqual(lines,legacyLines,'frame '+frame+' lines');
    checkBytes(vertices,legacyVertices);checkBytes(lines,legacyLines);
  }
});
test('custom segment count and empty geometry do not clear existing append data',()=>{
  const out=[1,2,3];
  ringVertices([0,0,0],1,[.2,.3,.4],0,out);
  assert.deepStrictEqual(out,[1,2,3]);
  ringVertices([0,0,0],1,[.2,.3,.4],2.5,out);
  assert.deepStrictEqual(out.slice(3),ringVertices([0,0,0],1,[.2,.3,.4],2.5));
});
