// SPDX-License-Identifier: Apache-2.0
// Play unmodified shipped content through legal commands; never manufacture wins.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PACK_FILES,parsePack} from '../demos/4x-game-lab/voidward/js/content.js';
import {createEngine} from '../demos/4x-game-lab/voidward/js/core.js';
import {campaigns} from '../demos/4x-game-lab/voidward/mods/registry.js';
for(const spec of campaigns.filter(c=>c.files)){
 const raw=Object.fromEntries(await Promise.all([...PACK_FILES,...spec.files].map(async n=>[n+'.txt',await fs.readFile(new URL(n+'.txt',spec.base),'utf8')]))),pack=parsePack(raw);
 test(`${spec.id}: both original campaign routes complete through legal orders`,()=>{
  for(const branch of [...new Set(pack.objectives.map(o=>o.branch).filter(Boolean))]){
   // Fixed winning witnesses discovered by the multi-seed sweep. Other seeds
   // include real losses; this test does not pretend the policy always wins.
   const seed=spec.id==='fallen-gates'&&branch==='restore'?2401:0;
   const e=createEngine(pack),s=e.createGame(seed,'standard',true,0);
   while(s.winner===null&&s.turn<pack.rules.turnLimit){
    const choice=e.objectives(s).find(o=>o.branch===branch&&o.status==='active');
    if(choice&&!s.progress.choices['0:route'])e.command(s,{type:'chooseObjective',id:choice.id});
    e.ai(s,0);if(s.winner===null)e.endTurn(s);e.validateState(s);
   }
   assert.equal(s.winner,0,`${branch}: ${s.victory} at turn ${s.turn}`);
   assert.ok(e.objectives(s).some(o=>o.branch===branch&&o.victory&&o.status==='complete'),`${branch} needs an actual completed final objective`);
   assert.ok(s.turn>=pack.scenario.minVictoryTurn);assert.ok(s.turn<=pack.rules.turnLimit);
   assert.deepEqual(e.deserialize(e.serialize(s)),s,'completed campaign progress survives save admission');
  }
 });
}
