// SPDX-License-Identifier: Apache-2.0
// Optional bounded reversible GF(3) lattice rules. No quantum hardware,
// decoder, theorem, or physics claims: a finite software state transform.
const MAX_STATES = 65536;
const MAX_GATES = 4096;
const MAX_VISITS = 4194304;

function integer(value, lo, hi, name) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) ||
      value < lo || value > hi) throw new RangeError(name + ' outside accepted range');
  return value;
}
function residue(value) { const r = value % 3; return r < 0 ? r + 3 : r; }
function cyclic(value, modulus) {
  const r = value % modulus;
  return r < 0 ? r + modulus : r;
}
function validateGate(gate, species) {
  if (gate === null || typeof gate !== 'object' || Array.isArray(gate)) {
    throw new TypeError('gate must be an object');
  }
  if (gate.kind === 'SWAP') {
    integer(gate.left, 0, species - 1, 'SWAP left');
    integer(gate.right, 0, species - 1, 'SWAP right');
    if (gate.left === gate.right) throw new RangeError('SWAP indices must differ');
    if (Object.keys(gate).sort().join() !== 'kind,left,right') {
      throw new TypeError('unexpected SWAP field');
    }
  } else if (gate.kind === 'SUM') {
    integer(gate.control, 0, species - 1, 'SUM control');
    integer(gate.target, 0, species - 1, 'SUM target');
    if (gate.control === gate.target) throw new RangeError('SUM control must differ');
    integer(gate.weight, 1, 2, 'SUM weight');
    if (!Array.isArray(gate.displacement) || gate.displacement.length !== 2) {
      throw new TypeError('SUM displacement must be [dx,dy]');
    }
    integer(gate.displacement[0], -1048576, 1048576, 'dx');
    integer(gate.displacement[1], -1048576, 1048576, 'dy');
    if (Object.keys(gate).sort().join() !== 'control,displacement,kind,target,weight') {
      throw new TypeError('unexpected SUM field');
    }
  } else {
    throw new RangeError('unsupported GF(3) gate');
  }
}
function lane(source, count, name) {
  if (!Array.isArray(source) || source.length !== count) {
    throw new TypeError(name + ' must be a dense GF(3) array');
  }
  const result = new Array(count);
  for (let i = 0; i < count; i++) result[i] = integer(source[i], 0, 2, name + '[' + i + ']');
  return result;
}

/**
 * Apply first-listed-first SUM/SWAP to X/Z Pauli-style GF(3) state on a
 * periodic 2D lattice. Cell-major order: x, y, species.
 * SUM at cell r: X_target(r) += w*X_control(r+disp);
 *                Z_control(r+disp) -= w*Z_target(r).
 * Reverse the gate list and negate SUM weights for the inverse.
 */
export function transformGF3({gates, qudits, periods, state, inverse = false}) {
  integer(qudits, 2, 16, 'qudits');
  if (!Array.isArray(periods) || periods.length !== 2) {
    throw new TypeError('periods must have two positive integers');
  }
  const width = integer(periods[0], 1, 65536, 'periods[0]');
  const height = integer(periods[1], 1, 65536, 'periods[1]');
  const count = width * height * qudits;
  if (count > MAX_STATES) throw new RangeError('resident lattice too large');
  if (!Array.isArray(gates) || gates.length > MAX_GATES ||
      count * gates.length > MAX_VISITS) throw new RangeError('GF(3) work budget exceeded');
  if (typeof inverse !== 'boolean') throw new TypeError('inverse must be boolean');
  if (state === null || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('state must contain x and z arrays');
  }
  // Check all gates and both lanes before the first mutation.
  for (const gate of gates) validateGate(gate, qudits);
  const x = lane(state.x, count, 'x');
  const z = lane(state.z, count, 'z');
  for (let k = 0; k < gates.length; k++) {
    const gate = inverse ? gates[gates.length - 1 - k] : gates[k];
    if (gate.kind === 'SWAP') {
      for (let cell = 0; cell < width * height; cell++) {
        const a = cell * qudits + gate.left;
        const b = cell * qudits + gate.right;
        [x[a], x[b]] = [x[b], x[a]];
        [z[a], z[b]] = [z[b], z[a]];
      }
    } else {
      const w = inverse ? 3 - gate.weight : gate.weight;
      const dx = gate.displacement[0], dy = gate.displacement[1];
      for (let a = 0; a < width; a++) for (let b = 0; b < height; b++) {
        const base = (a * height + b) * qudits;
        const control = (cyclic(a + dx, width) * height +
                         cyclic(b + dy, height)) * qudits + gate.control;
        const target = base + gate.target;
        // Different species make source/destination disjoint for a SUM gate.
        x[target] = residue(x[target] + w * x[control]);
        z[control] = residue(z[control] - w * z[target]);
      }
    }
  }
  return {x, z};
}
