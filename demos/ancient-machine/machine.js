// SPDX-License-Identifier: Apache-2.0
// Demo-owned mechanism for Brian Thorne's pinned ARCH OMI delta law.
import {OMICRON, unpackState} from '../../experiments/arch-omi/index.js';

export const MAX_DETENTS = 0xffff * 8;
export const MOTOR_RATES = Object.freeze([60, 30, 15]); // 120 Hz ticks per detent
export const STAGES = Object.freeze([
  'Ready to capture', 'Capture the word', 'Rotate left · 1 bit',
  'Rotate left · 3 bits', 'Rotate right · 2 bits', 'XOR the first two lanes',
  'XOR the third lane', 'XOR OMICRON · ready to latch'
]);
const integer = (n, low, high, name) => {
  if (!Number.isInteger(n) || n < low || n > high) throw new RangeError(`Invalid ${name}.`);
  return n;
};
const speed = value => {
  if (!MOTOR_RATES.includes(value)) throw new RangeError('Invalid motor rate.');
  return value;
};
const rotateLeft = (word, n) => ((word << n) | (word >>> (16 - n))) & 0xffff;

// The cam exposes exactly these partial registers. The input stays latched
// throughout the seven preparation detents; only the eighth writes the result.
function registers(word, phase) {
  const capture = phase >= 1 ? word : null;
  const a = phase >= 2 ? rotateLeft(word, 1) : null;
  const b = phase >= 3 ? rotateLeft(word, 3) : null;
  const c = phase >= 4 ? rotateLeft(word, 14) : null;
  const mix = phase >= 6 ? a ^ b ^ c : phase >= 5 ? a ^ b : null;
  const output = phase >= 7 ? mix ^ OMICRON : null;
  return {capture, a, b, c, mix, output};
}
function cycle(word) { return registers(word, 7).output; }
function wordAt(seed, turns) {
  // Exhaustively checked Δ^8 = identity. Seeking never replays a long counter.
  let word = seed;
  for (let i = 0; i < turns % 8; i++) word = cycle(word);
  return word;
}

export class BrassMachine {
  #seed; #word; #detents; #subTick; #rate;
  constructor({seed = 0x1234, detents = 0, ticksPerDetent = 30, subTick = 0} = {}) {
    integer(seed, 0, 0xffff, '16-bit seed');
    integer(detents, 0, MAX_DETENTS, 'detent counter');
    speed(ticksPerDetent);
    integer(subTick, 0, ticksPerDetent - 1, 'motor position');
    if (detents === MAX_DETENTS && subTick !== 0) throw new RangeError('Counter is full.');
    this.#seed = seed; this.#detents = detents;
    this.#word = wordAt(seed, Math.floor(detents / 8));
    this.#rate = ticksPerDetent; this.#subTick = subTick;
  }
  snapshot() {
    const phase = this.#detents % 8;
    return {seed:this.#seed, word:this.#word, detents:this.#detents,
      turns:Math.floor(this.#detents / 8), phase, subTick:this.#subTick,
      ticksPerDetent:this.#rate, nibbles:unpackState(this.#word),
      registers:registers(this.#word, phase)};
  }
  // Manual movement aligns the motor to a detent. A rejected boundary move is
  // atomic, including the fractional position. A full turn preserves cam phase.
  move(amount = 1) {
    integer(amount, -8, 8, 'detent movement');
    if (amount === 0) throw new RangeError('Movement must be nonzero.');
    const target = this.#detents + amount;
    if (target < 0 || target > MAX_DETENTS) return false;
    if (amount > 0) {
      while (this.#detents < target) {
        if (this.#detents % 8 === 7) this.#word = registers(this.#word, 7).output;
        this.#detents++;
      }
    } else {
      this.#detents = target;
      this.#word = wordAt(this.#seed, Math.floor(target / 8));
    }
    this.#subTick = 0;
    return true;
  }
  // Exactly one 120 Hz simulation tick. No elapsed time or ambient clock here.
  tick() {
    if (this.#detents === MAX_DETENTS) return false;
    if (++this.#subTick === this.#rate) this.move(1);
    return true;
  }
  setRate(ticksPerDetent) {
    this.#rate = speed(ticksPerDetent); this.#subTick = 0;
  }
  receipts(limit = 8) {
    integer(limit, 1, 8, 'receipt limit');
    const turns = Math.floor(this.#detents / 8), rows = [];
    for (let turn = Math.max(1, turns - limit + 1); turn <= turns; turn++) {
      const input = wordAt(this.#seed, turn - 1);
      rows.push({turn, input, output:cycle(input)});
    }
    return rows;
  }
  exportReplay() {
    return {schemaVersion:1, machine:'omi-brass-1', seed:this.#seed,
      detents:this.#detents, ticksPerDetent:this.#rate, subTick:this.#subTick, word:this.#word};
  }
  static fromReplay(data) {
    const keys = ['schemaVersion', 'machine', 'seed', 'detents', 'ticksPerDetent', 'subTick', 'word'];
    if (!data || Object.getPrototypeOf(data) !== Object.prototype ||
        Object.keys(data).length !== keys.length || !keys.every(k => Object.hasOwn(data, k)) ||
        data.schemaVersion !== 1 || data.machine !== 'omi-brass-1') {
      throw new TypeError('Not a version 1 Brass Engine replay.');
    }
    integer(data.word, 0, 0xffff, 'replay word');
    const machine = new BrassMachine(data);
    if (machine.#word !== data.word) throw new RangeError('Replay word does not match its seed and counter.');
    return machine;
  }
}
