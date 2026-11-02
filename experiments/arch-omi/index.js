// SPDX-License-Identifier: Apache-2.0
// ARCH OMI reference: Brian Thorne. Independently implemented finite-word
// experiment; source pins, encoding choices and limits: docs/ARCH_OMI.md.
export const OMICRON = 0x5a3c;
export const VERTICES = Object.freeze(['FS', 'GS', 'RS', 'US']);
export const EDGES = Object.freeze([[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]].map(Object.freeze));
// Each face is opposite the vertex with the same index; entries index EDGES.
export const FACES = Object.freeze([[3,4,5],[1,2,5],[0,2,4],[0,1,3]].map(Object.freeze));

function integer(value, max, name) {
  if (!Number.isInteger(value) || value < 0 || value > max) throw new RangeError(`${name} must be an integer 0..${max}`);
  return value;
}
function nibbles(values, length) {
  if (!Array.isArray(values) || values.length !== length) throw new TypeError(`expected ${length} nibbles`);
  return Array.from(values, value => integer(value, 15, 'nibble'));
}
const word = value => integer(value, 65535, 'word');
const rotate = (value, shift) => ((value << shift) | (value >>> (16 - shift))) & 0xffff;

/** Our encoding: FS, GS, RS, US occupy bits 15..12, 11..8, 7..4, 3..0. */
export function packState(values) {
  return nibbles(values, 4).reduce((packed, value) => (packed << 4) | value, 0);
}
export function unpackState(value) {
  word(value);
  return [12,8,4,0].map(shift => (value >>> shift) & 15);
}
export function xor16(value, mask) { return word(value) ^ word(mask); }

/** Pinned OMI delta law, fixed C=0x5A3C. All arithmetic stays within 16 bits. */
export function delta16(value) {
  word(value);
  return (rotate(value, 1) ^ rotate(value, 3) ^ rotate(value, 14) ^ OMICRON) & 0xffff;
}
/** XOR the three observed edge nibbles around each face. Zero means closure. */
export function faceResiduals(observedEdges) {
  const values = nibbles(observedEdges, 6);
  return FACES.map(face => face.reduce((parity, edge) => parity ^ values[edge], 0));
}
export function tetrahedron(value) {
  const vertices = unpackState(value), edges = EDGES.map(([a,b]) => vertices[a] ^ vertices[b]);
  return {vertices, edges, residuals: faceResiduals(edges)};
}
/** States exclude the repeated closing state. A budget result is not a cycle. */
export function orbit16(value, maxSteps = 8) {
  word(value);
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 65536) throw new RangeError('maxSteps must be 1..65536');
  const states = []; let next = value;
  for (let i = 0; i < maxSteps; i++) {
    states.push(next); next = delta16(next);
    if (next === value) return {status: 'closed', states, period: states.length, next};
  }
  return {status: 'budget', states, period: null, next};
}
