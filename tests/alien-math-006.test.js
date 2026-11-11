// SPDX-License-Identifier: Apache-2.0
// Node checks are conformance/admission evidence, never a replacement for Lean CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),sha=x=>createHash('sha256').update(x).digest('hex');
test('ALIEN-MATH-006 source-bound admission and adversarial audit tests',()=>{
  execFileSync('python3',['-m','unittest','discover','-s','tests','-p','test_alien_math_006.py'],{cwd:root,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},stdio:'pipe'});
});
test('ALIEN-MATH-006 production output equals frozen independent finite oracle',()=>{
  const input=readFileSync(new URL('fixtures/alien-math-006-input.json',import.meta.url));
  const expected=JSON.parse(readFileSync(new URL('fixtures/alien-math-006-oracle.json',import.meta.url)));
  assert.equal(sha(input),expected.inputSHA256);
  const result=execFileSync(process.execPath,['scripts/alien-math-006-bridge.mjs'],{cwd:root});
  assert.equal(sha(result),expected.sha256);assert.equal(result.toString().trimEnd().split('\n').length,expected.observations);
});
