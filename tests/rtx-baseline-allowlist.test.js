// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const script=new URL('../scripts/rtx5060ti-trusted.mjs',import.meta.url).pathname;
const invoke=args=>spawnSync(process.execPath,[script,...args],{
  encoding:'utf8',timeout:5000
});

test('trusted RTX harness keeps explicit allowlisted source comparison controls',()=>{
  const help=invoke(['--help']);
  assert.equal(help.status,0,help.stderr);
  assert.match(help.stdout,/--baseline/);
  for(const bad of ['f'.repeat(40),'0000000000000000000000000000000000000000']){
    const result=invoke(['--baseline',bad]);
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/not one of the pinned reviewed source commits/);
  }
});
