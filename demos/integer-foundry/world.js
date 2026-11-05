// SPDX-License-Identifier: Apache-2.0
import {IntegerEngine, integerChecksum} from '../../modules/integer-engine/index.js';
import {fromRatio as q} from '../../modules/integer-math/index.js';
export const MAX_TICKS = 36000;
export const CELLS = Object.freeze([[7, 3], [13, 5], [19, 7], [25, 7]].map(([x, y]) => Object.freeze([q(x), q(y), 0])));
export function createFoundry() {
  const box = (id, x0, y0, x1, y1) => ({id, min: [q(x0), q(y0), q(-2)], max: [q(x1), q(y1), q(2)]});
  return {engine: new IntegerEngine({seed: 83, boxes: [box(1, -2, -2, 30, 0), box(2, -2, 0, -1, 12), box(3, 29, 0, 30, 12),
    box(4, 5, 0, 9, 2), box(5, 11, 0, 15, 4), box(6, 17, 0, 21, 6), box(7, 23, 0, 27, 6)],
    bodies: [{id: 1, position: [q(1), 49152, 0], halfSize: [24576, 49152, 24576], velocity: [0, 0, 0]}]}),
    grounded: false, cells: 0, complete: false, frames: []};
}
export function stepFoundry(game, {move = 0, jump = false} = {}) {
  if (![-1, 0, 1].includes(move) || typeof jump !== 'boolean') throw new TypeError('invalid foundry input');
  if (game.complete || game.engine.tick >= MAX_TICKS) return false;
  const body = game.engine.bodies[0], vy = jump && game.grounded ? 14080 : Math.max(-16384, body.velocity[1]);
  const result = game.engine.step([{id: 1, velocity: [move * 4096, vy, 0], acceleration: [0, -384, 0]}]);
  game.grounded = result.contacts.some(c => c.axis === 1 && c.normal === 1);
  const p = game.engine.bodies[0].position;
  for (let i = 0; i < CELLS.length; i++) {
    if (Math.abs(p[0] - CELLS[i][0]) <= 49152 && Math.abs(p[1] - CELLS[i][1]) <= 81920) game.cells |= 1 << i;
  }
  game.complete = game.cells === 15;
  game.frames.push({move, jump});
  return true;
}
export function foundryState(game) {
  return {engine: game.engine.snapshot(), grounded: game.grounded, cells: game.cells, complete: game.complete};
}
export function verifyFoundry(game) {
  const replay = createFoundry();
  for (const frame of game.frames) stepFoundry(replay, frame);
  return {match: JSON.stringify(foundryState(replay)) === JSON.stringify(foundryState(game)),
    ticks: replay.engine.tick, checksum: integerChecksum(replay.engine)};
}
