// SPDX-License-Identifier: Apache-2.0
// Source-pinned finite conformance; not a universal JS refinement theorem.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {mulDiv, sqrt, INT_MIN, INT_MAX, SCALE} from '../modules/integer-math/index.js';

const source='modules/integer-math/index.js';
const pinned='d457b0154d9dfc8b50fd593b5e9dff75e1ea66b9';
const observed=execFileSync('git',['hash-object',source],{encoding:'utf8'}).trim();
assert.equal(observed,pinned,'mathematical proof does not target this source');
const bytes=readFileSync(source);
const digest=createHash('sha1').update(Buffer.concat([
  Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
assert.equal(digest,pinned,'reviewed source blob mismatch');
const text=bytes.toString('utf8');
assert.match(text,/function checkedQuotient\(/);
assert.match(text,/function productWords\(/);
assert.match(text,/function mulDiv\(/);
assert.doesNotMatch(text,/\bBigInt\s*\(/);
let accepted=0,rejected=0,zeros=0;
const lo=BigInt(INT_MIN),hi=BigInt(INT_MAX);
function check(a,b,d) {
  if (d===0) {assert.throws(()=>mulDiv(a,b,d),RangeError);rejected++;return;}
  const expected=BigInt(a)*BigInt(b)/BigInt(d);
  if(expected<lo||expected>hi) {
    assert.throws(()=>mulDiv(a,b,d),RangeError);
    rejected++;
  } else {
    const actual=mulDiv(a,b,d);
    assert.equal(actual,Number(expected),'mismatch for '+[a,b,d]);
    assert.equal(Object.is(actual,-0),false);
    if(actual===0)zeros++;
    accepted++;
  }
}
const edges=[INT_MIN,INT_MIN+1,-94906265,-65537,-65536,-65535,-2,-1,0,1,2,65535,65536,65537,94906265,INT_MAX-1,INT_MAX];
for(const a of edges)for(const b of edges)for(const d of edges)check(a,b,d);
let state=0x83a76122;
function next(){state=(Math.imul(state,1664525)+1013904223)>>>0;return state|0;}
for(let i=0;i<125000;i++)check(next(),next(),next()||1);
for(let i=0;i<125000;i++)check(next()%100000000,next()%100000000,(next()%100000000)||1);
let rootChecks=0;
function checkRoot(n){
  const r=BigInt(sqrt(n)),x=BigInt(n)*BigInt(SCALE);
  assert.ok(r*r<=x && x<(r+1n)*(r+1n));
  rootChecks++;
}
for(const n of [0,1,2,3,4,65535,65536,65537,INT_MAX])checkRoot(n);
for(let i=0;i<200000;i++)checkRoot(next()&INT_MAX);
assert.equal(mulDiv(-7,3,2),-10);
assert.throws(()=>mulDiv(INT_MIN,-1,1),RangeError);
assert.throws(()=>mulDiv(INT_MAX,INT_MAX,1),RangeError);
console.log(JSON.stringify({schema:'qsol.q16.formal-bridge.v1',source_blob:pinned,
  claim:'FINITE_CONFORMANCE_ONLY',accepted,rejected,canonical_zeros:zeros,
  root_checks:rootChecks},null,2));
