// SPDX-License-Identifier: Apache-2.0
import {int32, vector3, add, subtract} from '../integer-math/index.js';

function identifier(value) {
  int32(value, 'id');
  if (value < 1) throw new RangeError('id must be positive');
  return value;
}
export function createIntegerBody({id, position = [0, 0, 0], halfSize = [32768, 32768, 32768], velocity = [0, 0, 0]}) {
  const body = {id: identifier(id), position: vector3(position), halfSize: vector3(halfSize), velocity: vector3(velocity)};
  if (body.halfSize.some(v => v <= 0)) throw new RangeError('half sizes must be positive');
  for (let k = 0; k < 3; k++) { add(body.position[k], body.halfSize[k]); subtract(body.position[k], body.halfSize[k]); }
  return body;
}
export function createIntegerScene(boxes = []) {
  if (!Array.isArray(boxes) || boxes.length > 4096) throw new RangeError('expected at most 4096 static boxes');
  const result = Array.from(boxes, box => {
    const id = identifier(box.id), min = vector3(box.min), max = vector3(box.max);
    if (min.some((v, k) => v >= max[k])) throw new RangeError('box must have positive volume');
    return Object.freeze({id, min: Object.freeze(min), max: Object.freeze(max)});
  }).sort((a, b) => a.id - b.id);
  if (new Set(result.map(b => b.id)).size !== result.length) throw new RangeError('duplicate static box id');
  return Object.freeze(result);
}
const overlapsAxis = (body, box, k) => body.position[k] + body.halfSize[k] > box.min[k] && body.position[k] - body.halfSize[k] < box.max[k];
const overlap = (body, box) => [0, 1, 2].every(k => overlapsAxis(body, box, k));

/** Compile/copy static geometry once. Axis sweeps follow X, Y, Z in that order.
 * Touching is allowed. Initial penetration is rejected. Bodies do not collide
 * with each other; no rotation, slopes, impulses, or moving platforms. */
export class IntegerCollider {
  #boxes;
  constructor(boxes = []) { this.#boxes = createIntegerScene(boxes); }
  get boxes() { return this.#boxes; }
  validate(body) {
    const result = createIntegerBody(body);
    if (this.#boxes.some(box => overlap(result, box))) throw new RangeError('body starts inside static geometry');
    return result;
  }
  move(body, displacement) {
    const result = this.validate(body), delta = vector3(displacement), contacts = [];
    // Reject an unrepresentable requested endpoint even if an obstacle would stop it.
    for (let k = 0; k < 3; k++) {
      const end = add(result.position[k], delta[k]);
      add(end, result.halfSize[k]); subtract(end, result.halfSize[k]);
    }
    for (let axis = 0; axis < 3; axis++) {
      const d = delta[axis];
      if (d === 0) continue;
      let allowed = d, hit = null;
      for (const box of this.#boxes) {
        if (![0, 1, 2].every(k => k === axis || overlapsAxis(result, box, k))) continue;
        const gap = d > 0 ? box.min[axis] - (result.position[axis] + result.halfSize[axis])
          : box.max[axis] - (result.position[axis] - result.halfSize[axis]);
        const reaches = d > 0 ? gap >= 0 && gap <= allowed : gap <= 0 && gap >= allowed;
        if (reaches && (hit === null || gap !== allowed || box.id < hit.id)) { allowed = gap; hit = box; }
      }
      result.position[axis] = add(result.position[axis], allowed);
      if (hit) {
        result.velocity[axis] = 0;
        contacts.push({boxId: hit.id, axis, normal: d > 0 ? -1 : 1});
      }
    }
    return {body: result, contacts};
  }
}
