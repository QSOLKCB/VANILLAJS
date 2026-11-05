// SPDX-License-Identifier: Apache-2.0
import {SCALE, int32, uint32, vector3, add, nextRandom} from '../integer-math/index.js';
import {IntegerCollider} from '../integer-physics/index.js';

const SCHEMA = 'vanillajs-integer-engine/1';
function keys(object, required, optional = []) {
  if (!object || typeof object !== 'object' || Array.isArray(object) ||
      required.some(key => !Object.hasOwn(object, key)) ||
      Object.keys(object).some(key => !required.includes(key) && !optional.includes(key))) {
    throw new TypeError('invalid record fields');
  }
}
const copyBody = b => ({id: b.id, position: [...b.position], halfSize: [...b.halfSize], velocity: [...b.velocity]});

/** Deterministic kinematic world; all authoritative numerical state is integer.
 * Velocity = subunits/tick, acceleration = subunits/tick². +Y up, -Z forward.
 * Each successful step advances the RNG once, even with no commands/bodies. */
export class IntegerEngine {
  #collider; #bodies; #tick = 0; #random;
  constructor({boxes = [], bodies = [], seed = 1} = {}) {
    this.#collider = new IntegerCollider(boxes);
    if (!Array.isArray(bodies) || bodies.length > 256) throw new RangeError('expected at most 256 bodies');
    this.#bodies = Array.from(bodies, body => this.#collider.validate(body)).sort((a, b) => a.id - b.id);
    if (new Set(this.#bodies.map(b => b.id)).size !== bodies.length) throw new RangeError('duplicate body id');
    this.#random = uint32(seed, 'seed');
  }
  get tick() { return this.#tick; }
  get randomState() { return this.#random; }
  get boxes() { return this.#collider.boxes; }
  get bodies() { return this.#bodies.map(copyBody); }
  step(commands = []) {
    if (!Array.isArray(commands) || commands.length > this.#bodies.length) throw new RangeError('too many body commands');
    const byId = new Map(), ids = new Set(this.#bodies.map(b => b.id));
    for (const command of commands) {
      keys(command, ['id'], ['velocity', 'acceleration']);
      int32(command.id);
      if (!ids.has(command.id) || byId.has(command.id)) throw new RangeError('unknown or duplicate body command');
      byId.set(command.id, {
        velocity: Object.hasOwn(command, 'velocity') ? vector3(command.velocity) : null,
        acceleration: Object.hasOwn(command, 'acceleration') ? vector3(command.acceleration) : [0, 0, 0]
      });
    }
    const tick = add(this.#tick, 1), contacts = [];
    const next = this.#bodies.map(body => {
      const command = byId.get(body.id), velocity = (command?.velocity ?? body.velocity)
        .map((v, k) => add(v, command?.acceleration[k] ?? 0));
      const moved = this.#collider.move({...body, velocity}, velocity);
      contacts.push(...moved.contacts.map(contact => ({bodyId: body.id, ...contact})));
      return moved.body;
    });
    // Commit only after every command, endpoint and collision has succeeded.
    this.#bodies = next; this.#tick = tick; this.#random = nextRandom(this.#random);
    return {tick, random: this.#random, contacts};
  }
  snapshot() {
    return {schema: SCHEMA, scale: SCALE, tick: this.#tick, randomState: this.#random,
      boxes: this.boxes.map(b => ({id: b.id, min: [...b.min], max: [...b.max]})), bodies: this.bodies};
  }
  serialize() { return JSON.stringify(this.snapshot()); }
  static fromSnapshot(snapshot) {
    keys(snapshot, ['schema', 'scale', 'tick', 'randomState', 'boxes', 'bodies']);
    if (snapshot.schema !== SCHEMA || snapshot.scale !== SCALE) throw new RangeError('unsupported integer snapshot schema or scale');
    int32(snapshot.tick, 'tick');
    if (snapshot.tick < 0) throw new RangeError('negative tick');
    if (!Array.isArray(snapshot.boxes) || snapshot.boxes.length > 4096 || !Array.isArray(snapshot.bodies) || snapshot.bodies.length > 256) throw new TypeError('invalid scene arrays');
    for (const box of snapshot.boxes) keys(box, ['id', 'min', 'max']);
    for (const body of snapshot.bodies) keys(body, ['id', 'position', 'halfSize', 'velocity']);
    const engine = new IntegerEngine({...snapshot, seed: snapshot.randomState});
    engine.#tick = snapshot.tick;
    return engine;
  }
}

/** Bounded replay, from a full initial state; frame order is tick order. */
export function replayInteger(snapshot, frames) {
  if (!Array.isArray(frames) || frames.length > 100000) throw new RangeError('expected at most 100000 replay frames');
  const engine = IntegerEngine.fromSnapshot(snapshot);
  for (const commands of frames) engine.step(commands);
  return engine;
}

/** FNV-1a of canonical engine JSON. Diagnostic only, not a cryptographic proof. */
export function integerChecksum(engine) {
  const text = engine.serialize();
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
  return hash.toString(16).padStart(8, '0');
}
