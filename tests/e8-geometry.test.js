// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {generateE8Roots,projectE8RootPoints} from '../experiments/e8-geometry/index.js';

test('E8 roots enumerate 112 integer and 128 half-integer vectors exactly',()=>{
  const roots=generateE8Roots();
  assert.equal(roots.length,240);
  assert.equal(new Set(roots.map(r=>r.join(','))).size,240);
  for(let i=0;i<roots.length;i++){
    const root=roots[i];
    assert.equal(root.length,8);
    assert.equal(root.reduce((sum,x)=>sum+x*x,0),2);
    if(i<112)assert.ok(root.every(x=>x===0||Math.abs(x)===1));
    else{
      assert.ok(root.every(x=>Math.abs(x)===.5));
      assert.equal(root.filter(x=>x<0).length%2,0);
    }
  }
});
test('authored 3D point atlas is finite, deterministic and detached from callers',()=>{
  const a=projectE8RootPoints(),b=projectE8RootPoints();
  assert.equal(a.length,240*6);
  assert.deepEqual(a,b);
  assert.ok(a.every(Number.isFinite));
  const hash=createHash('sha256').update(new Uint8Array(a.buffer)).digest('hex');
  assert.match(hash,/^[a-f0-9]{64}$/);
  a.fill(99);assert.deepEqual(projectE8RootPoints(),b);
  assert.notDeepEqual(projectE8RootPoints({scale:2}),b);
  assert.throws(()=>projectE8RootPoints({scale:0}),RangeError);
  assert.throws(()=>projectE8RootPoints({scale:Infinity}),RangeError);
  assert.throws(()=>projectE8RootPoints({scale:1001}),RangeError);
});
