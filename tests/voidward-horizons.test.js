// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PACK_FILES,parsePack} from '../demos/4x-game-lab/voidward/js/content.js';
import {createEngine} from '../demos/4x-game-lab/voidward/js/core.js';
import {campaigns} from '../demos/4x-game-lab/voidward/mods/registry.js';

const ids=['helix-accord','emberwake','glass-meridian'];
const base=new URL('../demos/4x-game-lab/voidward/mods/',import.meta.url);
const source=JSON.parse(await readFile(new URL('HORIZONS_PROVENANCE.json',base),'utf8'));

test('Horizons campaign files retain their pinned donor identities',async()=>{
  assert.equal(source.schema,'vanillajs-voidward-campaigns-v1');
  assert.equal(source.repository,'QSOLKCB/4XGAMES');
  assert.equal(source.commit,'382f458998cf3c28e82047f64709722761559034');
  assert.equal(source.license,'Apache-2.0');
  const actual=(await Promise.all(ids.map(async id=>(await readdir(new URL(id+'/',base))).map(name=>id+'/'+name)))).flat().sort();
  assert.deepEqual(actual,source.files.map(f=>f.path).sort(),'every imported data file has a source record');
  assert.equal(new Set(actual).size,63);
  for(const entry of source.files){
    assert.match(entry.path,/^(helix-accord|emberwake|glass-meridian)\/[a-z_]+\.txt$/);
    assert.equal(entry.source,'mods/'+entry.path);
    const bytes=await readFile(new URL(entry.path,base));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.path);
  }
});

for(const id of ids){
  const spec=campaigns.find(c=>c.id===id);
  const raw=Object.fromEntries(await Promise.all([...PACK_FILES,...spec.files].map(async name=>[
    name+'.txt',await readFile(new URL(name+'.txt',spec.base),'utf8')
  ])));
  const pack=parsePack(raw);
  test(`${id}: every authored faction starts, advances, and reloads reproducibly`,()=>{
    assert.equal(pack.scenario.playable.length,3);
    assert.equal(new Set(pack.objectives.map(o=>o.branch).filter(Boolean)).size,2);
    for(const player of pack.scenario.playable){
      for(const difficulty of ['relaxed','standard','veteran']){
        const engine=createEngine(pack),a=engine.createGame(0,difficulty,true,player),b=engine.createGame(0,difficulty,true,player);
        assert.equal(a.player,player);
        assert.equal(engine.validateState(a),true);
        for(let turn=0;turn<8;turn++){
          engine.ai(a,player);engine.endTurn(a);
          engine.ai(b,player);engine.endTurn(b);
          assert.equal(engine.serialize(a),engine.serialize(b));
          assert.equal(engine.validateState(a),true);
        }
        assert.deepEqual(engine.deserialize(engine.serialize(a)),a);
        const before=engine.serialize(a);
        assert.throws(()=>engine.command(a,{type:'move',fleet:-1,target:0}));
        assert.equal(engine.serialize(a),before,'rejected orders preserve accepted progress');
        const corrupted=JSON.parse(before);corrupted.player=999;
        assert.throws(()=>engine.deserialize(JSON.stringify(corrupted)));
        assert.equal(engine.serialize(a),before,'a failed load cannot mutate the active run');
      }
    }
  });
}
