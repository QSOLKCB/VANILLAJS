import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../modules/math/index.js';
const close=(a,b,e=1e-10)=>a.forEach((x,i)=>assert.ok(Math.abs(x-b[i])<e,`${a} ≠ ${b}`));
test('cross product and right-handed quaternion convention',()=>{
  close(m.cross([1,0,0],[0,1,0]),[0,0,1]);
  const q=m.integrateOrientation([0,0,0,1],[0,Math.PI/2,0],1);
  close(m.rotate(q,[0,0,-1]),[-1,0,0]);
  close(m.rotate(m.quatConjugate(q),m.rotate(q,[3,4,5])),[3,4,5]);
});
test('shortest quaternion interpolation handles equivalent opposite signs',()=>{
  close(m.quatInterpolate([0,0,0,1],[0,0,0,-1],.5),[0,0,0,1]);
});
test('view matrix maps the camera origin to zero and a forward point to -Z',()=>{
  const q=m.integrateOrientation([0,0,0,1],[.2,.7,-.4],1),p=[4,-2,8],v=m.viewMatrix(p,q);
  const transform=p=>[0,1,2].map(r=>v[r]*p[0]+v[4+r]*p[1]+v[8+r]*p[2]+v[12+r]);
  close(transform(p),[0,0,0],1e-6);close(transform(m.add(p,m.rotate(q,[0,0,-5]))),[0,0,-5],1e-6);
});
test('seeded random sequence repeats and stays in [0,1)',()=>{
  const a=m.seededRandom(83),b=m.seededRandom(83);
  for(let i=0;i<2000;i++){const x=a();assert.equal(x,b());assert.ok(x>=0&&x<1);}
});
test('invalid vector and zero quaternion fail at boundary',()=>{
  assert.throws(()=>m.finiteVector([1,NaN,2],3));assert.throws(()=>m.quatNormalize([0,0,0,0]));
});
