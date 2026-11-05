import test from 'node:test';
import assert from 'node:assert/strict';
import {foundryFixture} from '../scripts/integer-fixture.js';
import {createFoundry, stepFoundry, verifyFoundry, MAX_TICKS} from '../demos/integer-foundry/world.js';
import {IntegerEngine} from '../modules/integer-engine/index.js';

test('the complete foundry route recovers four cells and exactly replays', () => {
  const game = foundryFixture();
  assert.equal(game.engine.tick, 482); assert.equal(game.cells, 15); assert.equal(game.complete, true);
  assert.deepEqual(verifyFoundry(game), {match: true, ticks: 482, checksum: 'a558ddcd'});
  assert.equal(stepFoundry(game, {move: 1}), false); assert.equal(game.frames.length, 482);
  game.cells = 7; assert.equal(verifyFoundry(game).match, false, 'full game state must be compared, not only engine checksum');
});
test('grounding, jump edges, rejected commands and record limits are explicit', () => {
  const game = createFoundry(); stepFoundry(game); assert.equal(game.grounded, true);
  stepFoundry(game, {jump: true}); assert.equal(game.grounded, false);
  assert.equal(game.engine.bodies[0].velocity[1], 13696);
  stepFoundry(game, {jump: true}); assert.equal(game.engine.bodies[0].velocity[1], 13312, 'no double jump');
  const before = game.engine.serialize(); assert.throws(() => stepFoundry(game, {move: .1})); assert.equal(game.engine.serialize(), before);
  const snapshot = game.engine.snapshot(); snapshot.tick = MAX_TICKS; game.engine = IntegerEngine.fromSnapshot(snapshot);
  assert.equal(stepFoundry(game), false);
});
