// Deterministic test driver, not shipped in the runtime package.
import {createFoundry, stepFoundry, CELLS} from '../demos/integer-foundry/world.js';
export function foundryFixture() {
  const game = createFoundry();
  for (let i = 0; i < 3000 && !game.complete; i++) {
    const target = CELLS.find((_, k) => !(game.cells & (1 << k)))[0];
    stepFoundry(game, {move: Math.sign(target - game.engine.bodies[0].position[0]), jump: game.grounded});
  }
  if (!game.complete) throw new Error('foundry fixture did not complete');
  return game;
}
