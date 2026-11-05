// SPDX-License-Identifier: Apache-2.0
// Independent exact binary64 sign oracle: products and sums are computed in
// BigInt dyadic rational form, not rounded through the production classifier.
import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyAABBPlane,classifyAABBFrustum} from '../modules/geometry/index.js';

const view=new DataView(new ArrayBuffer(8));
const TWO52=1n<<52n,FRAC=TWO52-1n;
function decodeBinary64(x){
  view.setFloat64(0,x,false);
  const bits=(BigInt(view.getUint32(0,false))<<32n)|BigInt(view.getUint32(4,false));
  const exp=Number((bits>>52n)&2047n),fraction=bits&FRAC;
  const mantissa=(exp===0?fraction:TWO52+fraction)*(bits&(1n<<63n)?-1n:1n);
  return [mantissa,exp===0?-1074:exp-1023-52];
}
function exactSign(plane,point){
  const terms=[];
  for(let i=0;i<4;i++){
    let [m,e]=decodeBinary64(plane[i]);
    if(i!==3){
      const [n,f]=decodeBinary64(point[i]);
      m*=n;e+=f;
    }
    if(m)terms.push([m,e]);
  }
  if(terms.length===0)return 0;
  const minimum=Math.min(...terms.map(t=>t[1]));
  const total=terms.reduce((sum,[m,e])=>sum+(m<<BigInt(e-minimum)),0n);
  return total>0n?1:total<0n?-1:0;
}
function cornerSigns(box,plane){
  const signs=[];
  for(let mask=0;mask<8;mask++){
    const point=[0,1,2].map(k=>mask&(1<<k)?box.max[k]:box.min[k]);
    signs.push(exactSign(plane,point));
  }
  return signs;
}
let seed=0x13f00d;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;}
const exponents=[-1074,-1070,-1040,-1022,-700,-500,-100,-20,-1,0,1,20,100,500,700,1020];
const magnitude=()=>2**exponents[Math.floor(rand()*exponents.length)];
function signed(){const n=magnitude()*(.125+rand()*1.25);return rand()<.5?-n:n;}

test('binary64 exact corner oracle prevents false culling over adversarial exponent sweep',()=>{
  let checked=0,outside=0,inside=0,uncertain=0;
  for(let i=0;i<10000;i++){
    const min=[],max=[];
    for(let k=0;k<3;k++){
      const a=signed(),b=a+magnitude()*(.01+rand()*.9);
      min.push(a);max.push(b);
    }
    if(min.some((x,k)=>!Number.isFinite(x)||!Number.isFinite(max[k])||x>=max[k]))continue;
    const box={min,max},plane=[signed(),signed(),signed(),signed()];
    const signs=cornerSigns(box,plane),classification=classifyAABBPlane(box,plane);
    checked++;
    if(classification===-1){
      outside++;assert.ok(signs.every(x=>x===-1),'outside requires every exact corner negative');
    }else if(classification===1){
      inside++;assert.ok(signs.every(x=>x===1),'inside requires every exact corner positive');
    }else{
      uncertain++;
    }
  }
  assert.ok(checked>=1500 && outside>10 && inside>10 && uncertain>10,
    'exercise definite decisions and uncertain cases across the fixed exponent corpus');
});
test('Codex subnormal counterexamples straddle their plane in exact arithmetic',()=>{
  const first={min:[.1,.1,.1],max:[.49,.49,.49]};
  const small=[1,1,1,-1].map(x=>x*Number.MIN_VALUE);
  const second={min:[1e308,8e-16,0],max:[1.1e308,9e-16,1]};
  const mixed=[-3*Number.MIN_VALUE,2,0,0];
  for(const [box,plane] of [[first,small],[second,mixed]]){
    const signs=cornerSigns(box,plane);
    assert.ok(signs.includes(-1)&&signs.includes(1),'exact interval crosses the plane');
    assert.equal(classifyAABBPlane(box,plane),0);
    assert.equal(classifyAABBFrustum(box,[plane]),0);
  }
});
