// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {Heightfield} from '../modules/terrain/index.js';
import {seededRandom} from '../modules/math/index.js';

const close=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps,
  'expected '+a+' close to '+b+' within '+eps);
const make=(heights=[0,2,3,7])=>new Heightfield({cellsX:1,cellsZ:1,heights});
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);

/** Independent Möller–Trumbore ray/triangle reference, not the grid-cut code. */
function bruteSegment(origin,delta,triangles){
  const hits=[];
  for(const [a,b,c] of triangles){
    const e1=sub(b,a),e2=sub(c,a),p=cross(delta,e2),det=dot(e1,p);
    if(Math.abs(det)<1e-11)continue;
    const inv=1/det,tvec=sub(origin,a),u=dot(tvec,p)*inv;
    if(u < -1e-10 || u > 1+1e-10)continue;
    const q=cross(tvec,e1),v=dot(delta,q)*inv;
    if(v < -1e-10 || u+v > 1+1e-10)continue;
    const t=dot(e2,q)*inv;
    if(t>=0&&t<=1)hits.push(t);
  }
  return hits.length?Math.min(...hits):null;
}

test('triangle sampler shares the exact mesh interpolation and +Y normals',()=>{
  const field=make();
  close(field.sample(.2,.2).height,1);
  close(field.sample(.8,.8).height,5.2);
  close(field.sample(1,1).height,7);
  close(field.sample(0,0).height,0);
  const a=field.sample(.2,.2),b=field.sample(.8,.8);
  assert.deepEqual(a.cell,[0,0]);assert.equal(a.triangle,0);assert.equal(b.triangle,1);
  const norm=a.normal;
  close(norm[0]/norm[1],-2);close(norm[2]/norm[1],-3);
  close(Math.hypot(...norm),1);
  for(const [i,tri] of field.triangleAt(0,0).entries()){
    for(const bary of [[.2,.3,.5],[.7,.2,.1],[.1,.7,.2]]){
      const p=[0,1,2].map(k=>tri.reduce((s,v,j)=>s+v[k]*bary[j],0));
      const sample=field.sample(p[0],p[2]);
      close(sample.height,p[1]);assert.equal(sample.triangle,i);
      assert.ok(sample.normal[1]>0);
    }
  }
  const tri=field.triangleAt(0,0);
  tri[0][0][1]=999;
  close(field.sample(0,0).height,0);
});

test('source height array is privately copied; boundary queries are deterministic',()=>{
  const heights=[1,2,3,4,5,6];
  const field=new Heightfield({cellsX:2,cellsZ:1,cellSize:2,
    originX:-4,originZ:8,heights});
  heights[0]=100;
  close(field.sample(-4,8).height,1);
  close(field.sample(0,10).height,6);
  assert.deepEqual(field.sample(0,10).cell,[1,0]);
  assert.equal(field.cellsX,2);assert.equal(field.cellsZ,1);assert.equal(field.cellSize,2);
  assert.throws(()=>field.sample(-4.00001,8),RangeError);
  assert.throws(()=>field.sample(0,10.00001),RangeError);
  assert.throws(()=>field.triangleAt(2,0),RangeError);
});

test('vertical sweep and clearance offset hit at the predicted point',()=>{
  const field=make(),start=[.25,10,.25],move=[0,-20,0];
  const hit=field.castSegment(start,move);
  close(hit.time,(10-1.25)/20);
  close(hit.point[1],hit.height);
  assert.equal(hit.startedInside,false);
  assert.ok(hit.normal[1]>0);
  const shell=field.castSegment(start,move,{verticalOffset:.75});
  close(shell.point[1],shell.height+.75);
  assert.ok(shell.time<hit.time);
  assert.equal(field.castSegment([.25,10,.25],[0,2,0]),null);
  assert.equal(field.castSegment([.25,10,.25],[0,0,0]),null);
  const below=field.castSegment([.25,1,.25],[0,5,0]);
  assert.equal(below.time,0);assert.equal(below.startedInside,true);
  assert.deepEqual(below.point,[.25,1,.25]);
});

test('grid cut catches a ridge even when both segment endpoints clear terrain',()=>{
  const field=new Heightfield({cellsX:2,cellsZ:1,heights:[0,8,0,0,8,0]});
  const from=[.2,2,.5],move=[1.6,0,0];
  assert.ok(field.sample(from[0],from[2]).height<from[1]);
  assert.ok(field.sample(from[0]+move[0],from[2]).height<from[1]);
  const hit=field.castSegment(from,move);
  assert.ok(hit && hit.time>0 && hit.time<1);
  close(hit.point[1],field.sample(hit.point[0],hit.point[2]).height);
});

test('diagonal cut catches an interior crest between clear endpoints',()=>{
  const field=make([0,8,8,0]),from=[.05,1,.05],move=[.90,0,.90];
  assert.ok(field.sample(from[0],from[2]).height<1);
  assert.ok(field.sample(.95,.95).height<1);
  const hit=field.castSegment(from,move);
  assert.ok(hit && hit.time>0 && hit.time<.5);
  close(hit.point[1],hit.height,1e-8);
});

test('bounded grid and finite motion reject invalid input before interpreting results',()=>{
  for(const args of [
    {cellsX:0,cellsZ:1,heights:[0,0]},
    {cellsX:129,cellsZ:1,heights:[]},
    {cellsX:1,cellsZ:1,cellSize:0,heights:[0,0,0,0]},
    {cellsX:1,cellsZ:1,heights:[0,0,0,Infinity]},
    {cellsX:1,cellsZ:1,heights:[0,0,0]},
    {cellsX:1,cellsZ:1,heights:[0,0,,0]},
    {cellsX:1,cellsZ:1,originX:1e12,heights:[0,0,0,0]}
  ])assert.throws(()=>new Heightfield(args));
  const field=make();
  assert.throws(()=>field.castSegment([1.1,2,.2],[-1,0,0]),RangeError);
  assert.throws(()=>field.castSegment([.2,2,.2],[1,0,0]),RangeError);
  assert.throws(()=>field.castSegment([.2,2,.2],[0,NaN,0]),TypeError);
  assert.throws(()=>field.castSegment([.2,2,.2],[0,0,0],{verticalOffset:-1}),RangeError);
  assert.throws(()=>field.castSegment([.2,2,.2],[0,Infinity,0]),TypeError);
});

test('seeded grid rays agree with independent brute-force triangle intersections',()=>{
  const random=seededRandom(421);
  const heights=Array.from({length:30},(_,i)=>Math.sin(i*1.7)*2+Math.cos(i*.37));
  const field=new Heightfield({cellsX:5,cellsZ:4,cellSize:2,originX:-5,originZ:7,heights});
  const mesh=[];
  for(let z=0;z<4;z++)for(let x=0;x<5;x++)mesh.push(...field.triangleAt(x,z));
  for(let i=0;i<300;i++){
    const a=[-5+random()*10,12,7+random()*8],b=[-5+random()*10,-12,7+random()*8];
    const delta=sub(b,a),expected=bruteSegment(a,delta,mesh);
    assert.notEqual(expected,null,'reference must cross heightfield');
    const hit=field.castSegment(a,delta);
    assert.ok(hit,'missing hit for ray '+i);
    close(hit.time,expected,1e-8);
    close(hit.point[1],field.sample(hit.point[0],hit.point[2]).height,1e-8);
    assert.ok(hit.normal[1]>0);
  }
});
