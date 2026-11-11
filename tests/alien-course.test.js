// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {compileCourseQ16,crossesGateQ16,advanceCourseQ16} from '../modules/exact-course/index.js';
import {SAMPLE} from '../demos/alien-course-lab/sample.js';
import {SCALE} from '../modules/integer-math/index.js';
const exact={rounding:'exact',overflow:'reject'};
const compile=(s=SAMPLE,p=exact)=>compileCourseQ16(s,p);

test('exact decimal authoring produces checked Q16.16 aperture edges',()=>{
  const c=compile();
  assert.equal(c.kind,'qsol.vanillajs.alien-course.v1');
  assert.equal(c.gates.length,6);
  assert.deepEqual(c.gates[0],{id:'01',leftRaw:-7*SCALE,rightRaw:7*SCALE,
    bottomRaw:-1.5*SCALE,topRaw:7.5*SCALE,zRaw:-28*SCALE});
  assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.gates)&&Object.isFrozen(c.gates[0]));
});
test('multi-gate sweeps credit every ordered crossing but cannot skip a miss',()=>{
  const c=compile();
  assert.deepEqual(advanceCourseQ16(c,0,[0,3*SCALE,0],[0,3*SCALE,-100*SCALE]),
    {nextGate:2,crossed:2,finished:false});
  assert.deepEqual(advanceCourseQ16(c,0,[0,3*SCALE,0],[0,3*SCALE,-300*SCALE]),
    {nextGate:6,crossed:6,finished:true});
  assert.deepEqual(advanceCourseQ16(c,0,[0,3*SCALE,0],[20*SCALE,3*SCALE,-160*SCALE]),
    {nextGate:1,crossed:1,finished:false});
});
test('closed edge admission, reversed sweep and completed race',()=>{
  const c=compile(),gate=c.gates[0];
  assert.equal(crossesGateQ16(gate,[7*SCALE,3*SCALE,0],[7*SCALE,3*SCALE,-40*SCALE]),true);
  assert.equal(crossesGateQ16(gate,[7*SCALE+1,3*SCALE,0],[7*SCALE+1,3*SCALE,-40*SCALE]),false);
  assert.equal(crossesGateQ16(gate,[0,3*SCALE,-40*SCALE],[0,3*SCALE,0]),false);
  assert.deepEqual(advanceCourseQ16(c,6,[0,0,0],[0,0,0]),
    {nextGate:6,crossed:0,finished:true});
});
test('rounding/overflow always require deliberate valid policy',()=>{
  assert.throws(()=>compileCourseQ16(SAMPLE),TypeError);
  assert.throws(()=>compileCourseQ16(SAMPLE,{rounding:'exact'}),TypeError);
  assert.throws(()=>compileCourseQ16(SAMPLE,{rounding:'exact',overflow:'saturate'}),TypeError);
  const modified=structuredClone(SAMPLE);
  modified.gates[0].x='0.0000000000001';
  assert.throws(()=>compile(modified),RangeError);
  assert.equal(compile(modified,{rounding:'toward-zero',overflow:'reject'}).gates[0].id,'01');
});
test('fail closed on accessors, forgery, malformed IDs and unsafe raw points',()=>{
  const bad=structuredClone(SAMPLE);
  Object.defineProperty(bad.gates[0],'x',{get(){throw Error('getter must not run');}});
  assert.throws(()=>compile(bad),TypeError);
  const extra=structuredClone(SAMPLE);extra.gates[0].script='x';
  assert.throws(()=>compile(extra),TypeError);
  const duplicate=structuredClone(SAMPLE);duplicate.gates[1].id='01';
  assert.throws(()=>compile(duplicate),TypeError);
  const c=compile();
  assert.throws(()=>crossesGateQ16({...c.gates[0]},[0,0,0],[0,0,-1]),TypeError);
  assert.throws(()=>advanceCourseQ16({...c},0,[0,0,0],[0,0,-1]),TypeError);
  assert.throws(()=>advanceCourseQ16(c,-1,[0,0,0],[0,0,-1]),RangeError);
  assert.throws(()=>advanceCourseQ16(c,0,[NaN,0,0],[0,0,-1]),RangeError);
});
test('independent Python Fraction calculation agrees with compiled gates',()=>{
  const run=spawnSync('python3',['scripts/alien_course_oracle.py'],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const oracle=JSON.parse(run.stdout);
  assert.deepEqual(compile().gates,oracle.gates);
  assert.equal(oracle.sweepFirstTwo,2);
});

test('Pages course lab links to published docs instead of excluded dist/docs',async()=>{
  const {readFile}=await import('node:fs/promises');
  const html=await readFile(new URL('../demos/alien-course-lab/index.html',import.meta.url),'utf8');
  assert.match(html,/https:\/\/github\.com\/QSOLKCB\/VANILLAJS\/blob\/main\/docs\/ALIEN_COURSE_BRIDGE\.md/);
  assert.doesNotMatch(html,/href="\.\.\/\.\.\/docs\//);
});
