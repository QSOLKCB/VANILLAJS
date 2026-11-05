// SPDX-License-Identifier: Apache-2.0
import {int32, add} from '../integer-math/index.js';
const SECOND = 1000000;
const quotient = (a, b) => Number(BigInt(a) / BigInt(b));

/** Caller supplies whole microseconds. Simulation callbacks receive a tick, never dt. */
export class IntegerClock {
  #hz; #maxFrameUs; #maxSteps; #phase = 0; #ticks = 0; #paused = false; #advancing = false;
  constructor({hz = 120, maxFrameUs = 250000, maxSteps = 32} = {}) {
    int32(hz); int32(maxFrameUs); int32(maxSteps);
    if (hz < 1 || hz > 1000 || maxFrameUs < 1 || maxFrameUs > SECOND || maxSteps < 1 || maxSteps > 1000) {
      throw new RangeError('invalid integer clock limits');
    }
    this.#hz = hz; this.#maxFrameUs = maxFrameUs; this.#maxSteps = maxSteps;
  }
  get hz() { return this.#hz; }
  get ticks() { return this.#ticks; }
  get paused() { return this.#paused; }
  get phase() { return this.#phase; }
  setPaused(value) { this.#paused = Boolean(value); this.#phase = 0; }
  reset() {
    if (this.#advancing) throw new Error('cannot reset during an update');
    this.#phase = 0; this.#ticks = 0;
  }
  advance(elapsedUs, update) {
    int32(elapsedUs, 'elapsed microseconds');
    if (elapsedUs < 0 || typeof update !== 'function') throw new TypeError('expected nonnegative elapsed microseconds and update function');
    if (this.#advancing) throw new Error('recursive clock advance');
    let steps = 0, clampedUs = 0, discardedTicks = 0;
    if (!this.#paused) {
      clampedUs = Math.max(0, elapsedUs - this.#maxFrameUs);
      this.#phase += (elapsedUs - clampedUs) * this.#hz;
      this.#advancing = true;
      try {
        while (this.#phase >= SECOND && steps < this.#maxSteps && !this.#paused) {
          const tick = add(this.#ticks, 1);
          // Consume before callback: pausing inside it clears the remaining debt.
          this.#phase -= SECOND;
          update(tick);
          this.#ticks = tick; steps++;
        }
        discardedTicks = quotient(this.#phase, SECOND);
        this.#phase %= SECOND;
      } catch (error) {
        this.#phase = 0; this.#paused = true; throw error;
      } finally { this.#advancing = false; }
    }
    return {steps, phase: this.#phase, denominator: SECOND, clampedUs, discardedTicks};
  }
}
