// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ExactRational as R} from '../modules/exact-rational/index.js';
import {ExactPoint2, ExactBox2, point2, orientation2, pointOnSegment, segmentRelation,
  boxFromCorners, boxRelation} from '../modules/exact-geometry/index.js';
import {D4_ELEMENTS as G, composeD4, inverseD4, determinantD4, transformPoint2,
  transformBox2, squaredDistance2} from '../modules/exact-d4/index.js';
const q=(n,d=1)=>new R(BigInt(n),BigInt(d));
const p=(x,y)=>point2(q(x),q(y));
const coords=a=>[a.x.toString(),a.y.toString()];
const eq=(a,b)=>assert.deepEqual(coords(a),coords(b));

test('all 64 products and 512 associativity triples; identity, inverses and D4 presentation',()=>{
  assert.equal(G.length,8);assert.equal(new Set(G).size,8);assert.ok(Object.isFrozen(G));
  for(const a of G){
    assert.equal(composeD4('e',a),a);assert.equal(composeD4(a,'e'),a);
    assert.equal(composeD4(a,inverseD4(a)),'e');assert.equal(composeD4(inverseD4(a),a),'e');
    assert.equal(inverseD4(inverseD4(a)),a);
    for(const b of G){
      assert.ok(G.includes(composeD4(a,b)));
      assert.equal(determinantD4(composeD4(a,b)),determinantD4(a)*determinantD4(b));
      for(const c of G)assert.equal(composeD4(composeD4(a,b),c),composeD4(a,composeD4(b,c)));
    }
  }
  assert.equal(composeD4('r3','r'),'e');assert.equal(composeD4('s','s'),'e');
  assert.equal(composeD4('s',composeD4('r','s')),'r3');
  assert.notEqual(composeD4('r','s'),composeD4('s','r')); // negative order control
});

test('named actions fix convention; composition acts right first, including inverse recovery',()=>{
  const a=p(2,3),expected=[[2,3],[-3,2],[-2,-3],[3,-2],[2,-3],[3,2],[-2,3],[-3,-2]];
  G.forEach((g,i)=>eq(transformPoint2(g,a),p(...expected[i])));
  for(const a of [p(0,0),p(2,3),point2(q(-4,7),q(2,9))])for(const g of G){
    eq(transformPoint2(inverseD4(g),transformPoint2(g,a)),a);
    for(const h of G)eq(transformPoint2(composeD4(g,h),a),transformPoint2(g,transformPoint2(h,a)));
  }
});

test('rational bounds: transforms are total, distance reduces before admission and rejects overflow',()=>{
  const m=(1n<<256n)-1n,a=point2(q(m),q(-m)),b=point2(q(-m),q(m));
  for(const g of G){eq(transformPoint2(inverseD4(g),transformPoint2(g,a)),a);assert.throws(()=>squaredDistance2(transformPoint2(g,a),transformPoint2(g,b)),RangeError);}
  assert.equal(squaredDistance2(a,a).toString(),'0');
  assert.equal(squaredDistance2(p(0,0),p(3,4)).toString(),'25');
  assert.equal(squaredDistance2(point2(q(1,3),q(1,4)),p(0,0)).toString(),'25/144');
  // Wide intermediate denominator cancels completely before the 256-bit check.
  const near=point2(q(m-1n,m),q(0));
  assert.equal(squaredDistance2(near,near).toString(),'0');
  assert.throws(()=>squaredDistance2(point2(q(1,m),q(0)),p(0,0)),RangeError);
  // Difference is 1 although both input denominators are 255-bit.
  const d=(1n<<254n)-1n;
  assert.equal(squaredDistance2(point2(q(d+1n,d),q(0)),point2(q(1n,d),q(0))).toString(),'1');
});

test('reject malformed elements, forged brands, proxies and shadow getters without coercion',()=>{
  let reads=0;
  for(const g of [null,undefined,0,1n,{},[],new String('r'),'R','r4','__proto__',{toString(){reads++;return 'r';}}]){
    for(const f of [()=>composeD4(g,'e'),()=>composeD4('e',g),()=>inverseD4(g),()=>determinantD4(g),()=>transformPoint2(g,p(0,0)),()=>transformBox2(g,boxFromCorners(p(0,0),p(1,1)))])assert.throws(f,TypeError);
  }
  const forged=Object.create(ExactPoint2.prototype,{x:{get(){reads++;return q(1);}},y:{value:q(2)}});
  for(const a of [null,undefined,{},forged,new Proxy(p(1,2),{})]){
    assert.throws(()=>transformPoint2('e',a),TypeError);
    assert.throws(()=>squaredDistance2(a,p(0,0)),TypeError);assert.throws(()=>squaredDistance2(p(0,0),a),TypeError);
  }
  for(const b of [null,{},Object.create(ExactBox2.prototype),new Proxy(boxFromCorners(p(0,0),p(1,1)),{})])assert.throws(()=>transformBox2('e',b),TypeError);
  assert.equal(reads,0);assert.ok(Object.isFrozen(transformPoint2('r',p(1,2))));
});

// The frozen input domain is shared data; all expected arithmetic comes from Python matrices/Fraction.
test('independent Fraction matrix oracle: Cayley table and every transformed geometry observation',async()=>{
  const raw=await readFile(new URL('./fixtures/alien-math-004-input.json',import.meta.url));
  const spec=JSON.parse(raw),oracle=JSON.parse(await readFile(new URL('./fixtures/alien-math-004-oracle.json',import.meta.url),'utf8'));
  const sha=x=>createHash('sha256').update(x).digest('hex');
  assert.equal(sha(raw),oracle.inputSHA256);
  assert.deepEqual(G.map(a=>G.map(b=>composeD4(a,b))),oracle.cayley);
  assert.deepEqual(G.map(inverseD4),oracle.inverses);assert.deepEqual(G.map(determinantD4),oracle.determinants);
  const rows=spec.fixed.map(row=>row.map(v=>{const [n,d='1']=v.split('/');return new R(BigInt(n),BigInt(d));}));
  let state=spec.seed;const next=()=>state=(Math.imul(state,1664525)+1013904223)>>>0;
  for(let i=0;i<spec.generated;i++)rows.push(Array.from({length:8},()=>q(next()%81-40,next()%13+1)));
  const digest=createHash('sha256');let observations=0;
  const distance=(a,b)=>{try{return squaredDistance2(a,b).toString();}catch(e){if(e instanceof RangeError)return 'overflow';throw e;}};
  for(const [i,row] of rows.entries()){
    const points=Array.from({length:4},(_,j)=>point2(row[j*2],row[j*2+1]));
    const [a,b,c,d]=points,box=boxFromCorners(a,b),other=boxFromCorners(c,d);
    for(const g of G){
      const [u,v,w,z]=points.map(t=>transformPoint2(g,t)),tb=transformBox2(g,box),ob=transformBox2(g,other);
      const orientation=orientation2(u,v,w),segment=segmentRelation(u,v,w,z),relation=boxRelation(tb,ob),on=pointOnSegment(w,u,v),dist=distance(u,v);
      assert.equal(orientation,orientation2(a,b,c)===0?0:determinantD4(g)*orientation2(a,b,c));
      assert.equal(segment,segmentRelation(a,b,c,d));assert.equal(relation,boxRelation(box,other));
      assert.equal(on,pointOnSegment(c,a,b));assert.equal(tb.contains(w),box.contains(c));assert.equal(dist,distance(a,b));
      const bounds=[tb.x.lower,tb.x.upper,tb.y.lower,tb.y.upper].map(String);
      digest.update([i,g,...[u,v,w,z].flatMap(coords),orientation,on?1:0,segment,relation,tb.contains(w)?1:0,dist,...bounds].join('|')+'\n');observations++;
    }
  }
  assert.equal(observations,oracle.observations);assert.equal(digest.digest('hex'),oracle.sha256);
  assert.notEqual(sha(Buffer.concat([raw,Buffer.from(' ')])),oracle.inputSHA256); // changed domain rejected
});

test('closed box actions compose and invert exactly, including line/point boxes and extremes',()=>{
  const m=(1n<<256n)-1n;
  const bounds=b=>[b.x.lower,b.x.upper,b.y.lower,b.y.upper].map(String);
  for(const [a,b] of [[p(3,2),p(-1,5)],[p(0,0),p(0,0)],[p(0,-3),p(0,4)],
    [point2(q(-m),q(1,m)),point2(q(m),q(2,m))]]){
    const box=boxFromCorners(a,b);
    for(const g of G){
      const transformed=transformBox2(g,box);assert.ok(Object.isFrozen(transformed));
      assert.deepEqual(bounds(transformBox2(inverseD4(g),transformed)),bounds(box));
      for(const h of G)assert.deepEqual(bounds(transformBox2(composeD4(g,h),box)),bounds(transformBox2(g,transformBox2(h,box))));
    }
  }
});
