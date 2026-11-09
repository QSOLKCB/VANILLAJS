// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import * as q from '../modules/qfloat/index.js';
import * as i from '../modules/integer-math/index.js';

test('QFloat exact input and deliberate pretty-but-quantized decimal',()=>{
  const a=q.fromDecimal('0.1'),b=q.fromDecimal('0.2'),sum=a.add(b);
  assert.equal(a.raw,6553);
  assert.equal(b.raw,13107);
  assert.equal(sum.raw,19660);
  assert.equal(sum.exact(),'0.2999877929687500');
  assert.equal(sum.approx(3),'0.300');
  assert.equal(q.fromDecimal('-32768').raw,i.INT_MIN);
  assert.equal(q.fromDecimal('32767.9999847412109375').raw,i.INT_MAX);
  assert.equal(q.fromDecimal('0.0000152587890625').raw,1);
  assert.equal(q.fromDecimal('-0').raw,0);
  assert.equal(q.fromDecimal('0.0000000000000001').raw,0);
  assert.equal(q.fromDecimal('0.1').raw,q.fromFraction(1,10).raw);
  assert.equal(q.fromRaw(i.INT_MIN).exact(),'-32768.0000000000000000');
});
test('arithmetic always delegates to existing exact kernel',()=>{
  const a=q.fromDecimal('4.5'),b=q.fromDecimal('2.25');
  assert.equal(a.add(b).raw,i.add(a.raw,b.raw));
  assert.equal(a.subtract(b).raw,i.subtract(a.raw,b.raw));
  assert.equal(a.multiply(b).raw,i.multiply(a.raw,b.raw));
  assert.equal(a.divide(b).raw,i.divide(a.raw,b.raw));
  assert.equal(q.fromDecimal('4').sqrt().raw,i.sqrt(q.fromDecimal('4').raw));
  assert.equal(a.compare(b),1);
  assert.equal(b.compare(a),-1);
  assert.equal(a.compare(a),0);
  assert.equal(q.fromRaw(i.INT_MAX).number,i.INT_MAX/65536);
});
test('invalid values and silent floating coercion fail closed',()=>{
  for(const s of ['1e2','01.2','+1','1.',' .1','0.12345678901234567',
    '32768','-32768.0000152587890625','100000','Infinity','NaN',1])
    assert.throws(()=>q.fromDecimal(s));
  assert.throws(()=>q.fromRaw(1.25),RangeError);
  assert.throws(()=>q.fromRaw(i.INT_MAX).add(q.fromRaw(1)),RangeError);
  assert.throws(()=>q.fromDecimal('1').divide(q.fromRaw(0)),RangeError);
  const a=q.fromDecimal('0.5');
  assert.ok(Object.isFrozen(a));
  assert.throws(()=>a+1,/implicit QFloat/);
  assert.throws(()=>Number(a),/implicit QFloat/);
  assert.throws(()=>Math.sin(a),/implicit QFloat/);
  assert.throws(()=>a.approx(30),RangeError);
  assert.throws(()=>a.add(1),TypeError);
});
test('serialization is integer-tagged and canonical',()=>{
  const original=q.fromDecimal('1.25');
  const encoded=JSON.parse(JSON.stringify(original));
  assert.deepEqual(encoded,{kind:'qsol.qfloat.q16.v1',raw:81920});
  assert.equal(q.fromJSON(encoded).raw,81920);
  assert.throws(()=>q.fromJSON({...encoded,x:2}),TypeError);
  assert.throws(()=>q.fromJSON({kind:encoded.kind,raw:NaN}),RangeError);
  const point=q.point(q.fromDecimal('1.25'),q.fromDecimal('-2.5'));
  const next=point.translate(q.fromDecimal('3.5'),q.fromDecimal('2'));
  assert.deepEqual(point.raw,[81920,-163840]);
  assert.deepEqual(next.raw,[311296,-32768]);
  assert.ok(Object.isFrozen(point));
  assert.throws(()=>q.point(1,2),TypeError);
});
test('ten thousand mixed signed QFloat arithmetic operations retain kernel parity',()=>{
  let rng=83;
  for(let n=0;n<10000;n++){
    rng=i.nextRandom(rng);
    const a=(rng%65536)-32768;
    rng=i.nextRandom(rng);
    const b=(rng%65536)-32768;
    const x=q.fromRaw(a),y=q.fromRaw(b);
    assert.equal(x.add(y).raw,i.add(a,b));
    assert.equal(x.subtract(y).raw,i.subtract(a,b));
    assert.equal(x.multiply(y).raw,i.multiply(a,b));
    if(b!==0)assert.equal(x.divide(y).raw,i.divide(a,b));
    assert.equal(q.fromJSON(JSON.parse(JSON.stringify(x))).raw,a);
  }
});
