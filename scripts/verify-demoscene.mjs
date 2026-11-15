// SPDX-License-Identifier: Apache-2.0
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {machineRemembers} from '../demos/demoscene-lab/preset.js';
import {DemoWorld} from '../demos/demoscene-lab/world.js';
import {portableDemo,demoHash} from './demoscene-package.mjs';
const evidence=JSON.parse(await readFile(new URL('../evidence/DEMOSCENE-001/execution.json',import.meta.url),'utf8'));
const project=machineRemembers(),world=new DemoWorld(project),{receipt,report}=await portableDemo(project);
assert.deepEqual(receipt,evidence.source,'Demoscene source/audio receipt is stale; reproduce evidence for the changed production');
assert.equal(report.totalUncompressedBytes,evidence.byteBudget.totalUncompressedBytes);
const sameRuntime=evidence.runtime.node===process.version&&evidence.runtime.platform===process.platform&&evidence.runtime.arch===process.arch;
for(const cut of evidence.fullTimeline.cuts){
  const actual=world.commands(cut.sample);
  assert.deepEqual(actual,new DemoWorld(project).commands(cut.sample));
  if(sameRuntime)assert.equal(demoHash(JSON.stringify(actual)),cut.commandSha256);
}
assert.deepEqual(world.geometry(2880000).geometry.counts,{triangles:0,lines:0,points:0});
assert.equal(evidence.fullTimeline.frames,3000);assert.equal(evidence.audio.samples,2880000);
console.log('Verified Demoscene source/asset closure and full-minute PCM/WAV receipt; '+(sameRuntime?'same-runtime sampled command identities':'fresh command parity (archive uses a different runtime)')+'.');
