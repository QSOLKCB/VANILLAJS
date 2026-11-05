import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {foundryFixture} from './integer-fixture.js';
import {foundryState, verifyFoundry} from '../demos/integer-foundry/world.js';
const game = foundryFixture(), replay = verifyFoundry(game);
assert.equal(replay.match, true);
const sha256 = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const evidence = {schema: 'vanillajs-integer-evidence/1', scale: 65536, tickHz: 120,
  fixture: 'integer-foundry-four-cells', ticks: game.engine.tick, complete: game.complete,
  cells: game.cells, engineChecksumFNV1a: replay.checksum,
  fullStateSHA256: sha256(foundryState(game)), inputSHA256: sha256(game.frames), replayMatch: replay.match};
if (process.argv.includes('--check')) assert.deepEqual(evidence, JSON.parse(await readFile(new URL('../docs/INTEGER_EVIDENCE.json', import.meta.url), 'utf8')));
console.log(JSON.stringify(evidence, null, 2));
