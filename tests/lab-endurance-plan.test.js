// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {ENDURANCE_GROUPS,DEFAULT_ITERATIONS,endurancePlan,iterationSeed} from '../scripts/lab-endurance-plan.mjs';

test('four named browser groups cover eight distinct packaged labs',()=>{
  assert.deepEqual(Object.keys(ENDURANCE_GROUPS),['racing','combat','creator','visual']);
  const names=Object.values(ENDURANCE_GROUPS).flat();
  assert.equal(names.length,8);
  assert.equal(new Set(names).size,8);
  assert.ok(names.includes('horizon')&&names.includes('racing'));
  assert.equal(DEFAULT_ITERATIONS,1000);
});
test('CI defaults to exactly 1000 executed cycles per selected lab',()=>{
  for(const group of Object.keys(ENDURANCE_GROUPS)){
    const p=endurancePlan(['--group='+group]);
    assert.equal(p.iterations,1000);assert.equal(p.seed,7337);
    assert.deepEqual(p.labs,ENDURANCE_GROUPS[group]);
    assert.equal(Object.isFrozen(p),true);
  }
  assert.equal(endurancePlan(['--group=combat','--iterations=12','--seed=0']).iterations,12);
  assert.equal(endurancePlan(['--group=racing','--seed=4294967295']).seed,4294967295);
});
test('unknown groups, duplicate options, shell-like values and invalid counts fail closed',()=>{
  const bad=[
    [],['--group=missing'],['--group=racing','--group=racing'],
    ['--group=racing','--iterations=0'],['--group=racing','--iterations=1001'],
    ['--group=racing','--iterations=01'],['--group=racing','--iterations=1.5'],
    ['--group=racing','--seed=4294967296'],['--group=racing','--seed=-1'],
    ['--group=racing','--seed=2;curl'],['--group=racing','--out=/tmp'],
    ['--group=racing','--iterations=3','--iterations=3']
  ];
  for(const args of bad)assert.throws(()=>endurancePlan(args),undefined,JSON.stringify(args));
});
test('iteration seeds are stable and intentionally vary across repetition index',()=>{
  const values=Array.from({length:1000},(_,i)=>iterationSeed(7337,i));
  assert.equal(values.length,1000);
  assert.equal(new Set(values).size,1000);
  assert.deepEqual(values,Array.from({length:1000},(_,i)=>iterationSeed(7337,i)));
  for(const invalid of [[0,-1],[0,1000],[-1,0],[4294967296,0],[0,1.5]])
    assert.throws(()=>iterationSeed(...invalid));
});
