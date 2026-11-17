// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRaceRoadDetails} from '../demos/horizon-lab/race-road-details.js';
import {starterRaceProject} from '../demos/horizon-lab/race-project.js';
import {createRaceSession} from '../demos/horizon-lab/race-model.js';
import {validateLitMaterial} from '../modules/render-lit/index.js';

test('roadside details are deterministic, bounded and never enter native physics',()=>{
  const input=starterRaceProject(),race=createRaceSession(input),before=race.world.physics.sampleSurface(0,0,2000),
    world=JSON.stringify(race.world.stats),project=JSON.stringify(race.project);
  const high=createRaceRoadDetails(race.road,'high',input.scenery.environment),
    same=createRaceRoadDetails(race.road,'high',input.scenery.environment),
    low=createRaceRoadDetails(race.road,'low',input.scenery.environment);
  assert.deepEqual(high,same,'same authored route gives exact Float32 bytes and stable batch order');
  assert.ok(high.postPairs>2&&high.warningSigns>=1,'coast race has roadside posts and turn chevrons');
  assert.ok(high.postPairs>=low.postPairs&&high.vertices>low.vertices);
  assert.ok(high.vertices>0&&high.vertices<=20000&&high.batches.length<=48);
  assert.deepEqual(race.world.physics.sampleSurface(0,0,2000),before);
  assert.equal(JSON.stringify(race.world.stats),world);
  assert.equal(JSON.stringify(race.project),project);
  assert.ok(high.batches.every(b=>b.detailKind&&b.id.startsWith('race-detail-')));
  let lastChunk=-1,lastKind=-1;
  for(const b of high.batches){
    const [, ,chunk,kind]=b.id.split('-'),index=['posts','reflectors','signs','ink'].indexOf(kind);
    assert.ok(Number(chunk)>=lastChunk);
    if(Number(chunk)===lastChunk)assert.ok(index>lastKind);else lastKind=-1;
    lastKind=index;lastChunk=Number(chunk);
    assert.equal(b.vertices.length%33,0);
    assert.ok(b.vertices.every(Number.isFinite));
    assert.ok(b.visibilityBounds.radius>0);
    assert.doesNotThrow(()=>validateLitMaterial(b.material));
    for(let i=0;i<b.vertices.length;i+=11){
      assert.ok(Math.abs(Math.hypot(b.vertices[i+3],b.vertices[i+4],b.vertices[i+5])-1)<1e-5);
      for(let c=6;c<=8;c++)assert.ok(b.vertices[i+c]>=0&&b.vertices[i+c]<=1);
    }
  }
});

test('decorative rendering preserves scene/world identity for each environment and profile',()=>{
  for(const environment of ['coast','alpine','dusk'])for(const profile of ['low','high']){
    const p=structuredClone(starterRaceProject());p.scenery.environment=environment;p.scenery.profile=profile;
    const race=createRaceSession(p),start=race.snapshot(),before=race.world.batches;
    const details=createRaceRoadDetails(race.road,profile,environment);
    assert.ok(details.batches.length>0);
    assert.deepEqual(race.snapshot(),start);
    assert.strictEqual(race.world.batches,before);
  }
});

test('malformed budgets and missing road methods are rejected',()=>{
  for(const value of [null,{}, {sample(){},length:5}])assert.throws(()=>createRaceRoadDetails(value));
  const race=createRaceSession(starterRaceProject());
  assert.throws(()=>createRaceRoadDetails(race.road,'ultra'));
  assert.throws(()=>createRaceRoadDetails(race.road,'high','unknown'));
});
