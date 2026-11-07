// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {boxMeshBatch,StaticAABBIndex,classifyAABBPlane,classifyAABBFrustum} from '../modules/geometry/index.js';
import {castSegment} from '../modules/collision/index.js';

// Independent historical geometry builder, not the new batching implementation.
function boxVertices(center,size,color){
  const corners=[];for(let i=0;i<8;i++)corners.push(center.map((v,k)=>v+size[k]*((i>>k&1)-.5)));
  const faces=[[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]],shades=[.7,.9,.58,1,.8,.65],data=[];
  faces.forEach((f,i)=>{for(const k of [0,1,2,0,2,3])data.push(...corners[f[k]],...color.map(x=>x*shades[i]));});return data;
}
let s=0x34a16982;
function rand(){s=(Math.imul(s,1664525)+1013904223)>>>0;return s/0x100000000;}
const bytes=v=>Buffer.from(v.buffer,v.byteOffset,v.byteLength);
test('box batch preserves every frozen-reference Float32 upload byte',()=>{
  assert.deepEqual(boxMeshBatch([]),new Float32Array(0));
  for(const count of [1,2,7,37,201]){
    const list=Array.from({length:count},(_,i)=>({
      center:[rand()*13-6,rand()*7-3,-rand()*9],
      size:[rand()*2,.15+i/500,rand()*3],color:[rand(),rand(),rand()]
    }));
    list.push({center:[-0,-0,-0],size:[-0,.1,.3],color:[-0,1,.8]});
    const expected=new Float32Array(list.flatMap(b=>boxVertices(b.center,b.size,b.color)));
    const packed=boxMeshBatch(list);
    assert.deepEqual(bytes(packed),bytes(expected));
    const snapshot=Buffer.from(bytes(packed));
    list[0].center[0]=999;
    assert.deepEqual(bytes(packed),snapshot,'returned bytes must be independent of input');
  }
  for(const invalid of [[{}],[{center:[0,0,0],size:[1,1,1],color:[1,2]}],
    [{center:[NaN,0,0],size:[1,1,1],color:[1,2,3]}]])assert.throws(()=>boxMeshBatch(invalid));
  assert.throws(()=>boxMeshBatch(Array(16385).fill({center:[0,0,0],size:[1,1,1],color:[1,1,1]})),RangeError);
});
test('ternary plane/frustum rejects only certainly-outside finite boxes',()=>{
  const b={min:[-1,-1,-1],max:[1,1,1]};
  assert.equal(classifyAABBPlane(b,[1,0,0,3]),1);
  assert.equal(classifyAABBPlane(b,[1,0,0,-3]),-1);
  for(const offset of [-1,0,1])assert.equal(classifyAABBPlane(b,[1,0,0,offset]),0);
  assert.equal(classifyAABBFrustum(b,[[1,0,0,3],[0,-1,0,3]]),1);
  assert.equal(classifyAABBFrustum(b,[[1,0,0,3],[0,-1,0,-3]]),-1);
  assert.equal(classifyAABBFrustum(b,[[1,0,0,3],[0,-1,0,1]]),0);
  assert.throws(()=>classifyAABBPlane(b,[NaN,1,0,3]));
  assert.throws(()=>classifyAABBFrustum(b,[]),RangeError);
  assert.throws(()=>classifyAABBFrustum(b,[[1,0,0,-3],[NaN,0,0,0]]),TypeError);
  // Codex P2: the smallest positive subnormal rescales this same plane.
  const cornerBox={min:[.1,.1,.1],max:[.49,.49,.49]};
  const plane=[1,1,1,-1],tiny=plane.map(x=>x*Number.MIN_VALUE);
  assert.equal(classifyAABBPlane(cornerBox,plane),0);
  assert.equal(classifyAABBPlane(cornerBox,tiny),0,'subnormal scaling must not produce false culling');
  assert.equal(classifyAABBFrustum(cornerBox,[tiny]),0);
  assert.equal(classifyAABBPlane(cornerBox,[0,0,0,0]),0);
  const extremeBox={min:[1e308,8e-16,0],max:[1.1e308,9e-16,1]};
  const extremePlane=[-3*Number.MIN_VALUE,2,0,0];
  assert.equal(classifyAABBPlane(extremeBox,extremePlane),0,'nonzero subnormal quotient cannot authorize culling');
  assert.equal(classifyAABBFrustum(extremeBox,[extremePlane]),0);
  for(let i=0;i<1000;i++){
    const center=[rand()*20-10,rand()*20-10,rand()*20-10];
    const r=.01+rand()*3,box={min:center.map(x=>x-r),max:center.map(x=>x+r)};
    const plane=[rand()*2-1,rand()*2-1,rand()*2-1,rand()*20-10];
    const classification=classifyAABBPlane(box,plane);
    const corners=[];
    for(let mask=0;mask<8;mask++){
      const p=[0,1,2].map(k=>(mask>>k&1)?box.max[k]:box.min[k]);
      corners.push(plane[0]*p[0]+plane[1]*p[1]+plane[2]*p[2]+plane[3]);
    }
    if(classification===-1)assert.ok(corners.every(d=>d<=0));
    if(classification===1)assert.ok(corners.every(d=>d>=0));
  }
});
test('static spatial index matches canonical cast for 1,800 randomized rays',()=>{
  for(let round=0;round<9;round++){
    const boxes=Array.from({length:80},(_,i)=>{
      const center=[rand()*90-45,rand()*20-10,rand()*90-45],rad=.05+rand()*3;
      return {id:'item-'+String(i).padStart(3,'0'),box:{min:center.map(x=>x-rad),max:center.map(x=>x+rad)}};
    });
    const idx=new StaticAABBIndex(boxes);assert.equal(idx.size,80);
    for(let j=0;j<200;j++){
      const origin=[rand()*100-50,rand()*20-10,rand()*100-50];
      const delta=[rand()*100-50,rand()*30-15,rand()*100-50];
      const options={halfSize:(j%4)*.25,ignoreIds:j%7===0?['item-000','item-009']:[]};
      const expected=castSegment(origin,delta,boxes,options);
      const actual=idx.castSegment(origin,delta,options);
      assert.deepEqual(actual,expected,'indexed narrowphase must preserve full hit receipt');
      const indices=idx.candidates(origin,delta,options);
      assert.deepEqual(indices,[...new Set(indices)].sort((a,b)=>a-b));
      if(expected)assert.ok(indices.includes(expected.index),'broadphase may not drop hit');
    }
  }
  const a={id:'z',box:{min:[-1,-1,-2],max:[1,1,-1]}};
  const b={id:'a',box:{min:[-1,-1,-2],max:[1,1,-1]}};
  const idx=new StaticAABBIndex([a,b]);
  assert.equal(idx.castSegment([0,0,0],[0,0,-3]).id,'a','ties use canonical string IDs');
  a.box.min[2]=-500;
  assert.equal(idx.castSegment([0,0,0],[0,0,-3]).id,'a','source edits cannot mutate snapshot');
  assert.throws(()=>new StaticAABBIndex([a,b,a]),TypeError);
  assert.throws(()=>idx.candidates([1e10,0,0],[0,0,0]),TypeError);
  assert.deepEqual(new StaticAABBIndex([]).candidates([0,0,0],[1,0,0]),[]);
});


test('retained AABB candidate collection matches allocating reference for 2,400 sweeps',()=>{
  const rnd=(()=>{let s=0x9e3779b9;return ()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/0x100000000);})();
  for(let round=0;round<8;round++){
    const boxes=Array.from({length:112},(_,i)=>{
      const c=[(rnd()-.5)*400,(rnd()-.5)*200,(rnd()-.5)*400],r=.1+rnd()*10;
      return {id:'item-'+i,box:{min:c.map(x=>x-r),max:c.map(x=>x+r)}};
    });
    const idx=new StaticAABBIndex(boxes),buffer=[999,999],same=buffer;
    for(let j=0;j<300;j++){
      const origin=[(rnd()-.5)*440,(rnd()-.5)*240,(rnd()-.5)*440],
        delta=[(rnd()-.5)*180,(rnd()-.5)*100,(rnd()-.5)*180];
      const options={halfSize:(j%8)*.125};
      const expected=idx.candidates(origin,delta,options);
      assert.equal(idx.collectCandidates(origin,delta,buffer,options),same);
      assert.deepEqual(buffer,expected,'retained candidates must preserve exact indices and order');
      if(j%19===0){
        const hit=idx.castSegment(origin,delta,options);
        const reference=castSegment(origin,delta,boxes,options);
        assert.deepEqual(hit,reference,'reused candidate collection must not disturb indexed casts');
      }
    }
  }
});

test('retained AABB collection clears stale output and fails before modifying invalid callers',()=>{
  const boxes=[
    {id:'b',box:{min:[-1,-1,-2],max:[1,1,-1]}},
    {id:'a',box:{min:[-1,-1,-2],max:[1,1,-1]}},
    {id:'c',box:{min:[4,-1,-2],max:[6,1,-1]}}
  ];
  const index=new StaticAABBIndex(boxes),out=[999];
  assert.deepEqual(index.collectCandidates([0,0,0],[0,0,-3],out),[0,1]);
  assert.deepEqual(index.collectCandidates([0,0,0],[0,0,0],out),[]);
  assert.equal(index.collectCandidates([5,0,0],[0,0,-3],out),out);
  assert.deepEqual(out,[2]);
  out.push(999,999);
  assert.deepEqual(index.collectCandidates([0,0,0],[0,0,-3],out),[0,1]);
  for(const [origin,delta,options] of [
    [[Infinity,0,0],[0,0,0],{}],
    [[0,0,0],[1e10,0,0],{}],
    [[0,0,0],[0,0,0],{halfSize:-1}],
    [[0,0,0],[0,0,0],{halfSize:NaN}]
  ]){
    const before=[...out];
    assert.throws(()=>index.collectCandidates(origin,delta,out,options));
    assert.deepEqual(out,before,'invalid query must not discard prior output');
  }
  assert.throws(()=>index.collectCandidates([0,0,0],[0,0,0],{}),TypeError);
  const empty=new StaticAABBIndex([]),scratch=[9,8];
  assert.equal(empty.collectCandidates([0,0,0],[2,0,0],scratch),scratch);
  assert.deepEqual(scratch,[]);
  assert.deepEqual(empty.candidates([0,0,0],[2,0,0]),[]);
});
