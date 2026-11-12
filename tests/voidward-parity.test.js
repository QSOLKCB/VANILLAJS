// SPDX-License-Identifier: Apache-2.0
// Reference receipts executed from QSOLKCB/4XGAMES at
// 030859385ac8929e066702ef8af0518663480653, Node 22.18.0. These hashes
// cover authoritative simulation only, not browser/audio floating-point output.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PACK_FILES,parsePack} from '../demos/4x-game-lab/voidward/js/content.js';
import {createEngine} from '../demos/4x-game-lab/voidward/js/core.js';
import {campaigns} from '../demos/4x-game-lab/voidward/mods/registry.js';
const reference={
  frontier:'6ef7362dfb1a9c333804546eb78c1270d0ed6e3140d8132abf73bc3577601424',
  'machine-dawn':'522875b4194e93a4a458e231a33417d31121a12e68a9b58d32aa683feacf4743',
  'grand-frontier':'57da430db73d470ef6010d0a5e66ae15c084cd4d847afa59a40130feaa31025d',
  'fallen-gates':'607ac197deec714c523975c4d7bbe22e658292e25e93a8a13a8adafc1e3adaec',
  'outer-rim':'08105d789a5880aaa6fa268aa2d9a839aba6d810f581da6e5a3c7dae019012b4'
};
// New campaign packs have separate source and admission tests; these receipts
// cover the five campaigns present at the original imported core revision.
for(const spec of campaigns.filter(c=>Object.hasOwn(reference,c.id)))test(`native module integration preserves pinned ${spec.id} simulation`,async()=>{
  const raw=Object.fromEntries(await Promise.all([...PACK_FILES,...(spec.files||[])].map(async n=>[n+'.txt',await fs.readFile(new URL(n+'.txt',spec.base),'utf8')])));
  const pack=parsePack(raw),engine=createEngine(pack,spec.hooks),state=engine.createGame(42,'standard',true,pack.scenario.playable.at(-1));
  for(let turn=0;turn<12&&state.winner===null;turn++){engine.ai(state,state.player);engine.endTurn(state);}
  engine.validateState(state);
  assert.equal(createHash('sha256').update(engine.serialize(state)).digest('hex'),reference[spec.id]);
});
