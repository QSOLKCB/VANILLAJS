// SPDX-License-Identifier: Apache-2.0
import {nextRandom, uint32} from '../integer-math/index.js';

export const MATERIAL = Object.freeze({air: 0, sand: 1, water: 2, stone: 3});
export const MATERIAL_LIMITS = Object.freeze({
  width: 128, height: 96, brushRadius: 3, snapshotBytes: 16384, tick: 0xffffffff
});
export const MATERIAL_FORMAT = 'qsol.vanillajs.material-grid.v1';
const {air, sand, water} = MATERIAL;
const symbols = '.sw#';

function integer(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(name + ' must be an integer in [' + min + ', ' + max + ']');
  }
}

function makeGrid(width, height, seed, tick, encoded) {
  integer(width, 1, MATERIAL_LIMITS.width, 'width');
  integer(height, 1, MATERIAL_LIMITS.height, 'height');
  seed = uint32(seed, 'seed');
  tick = uint32(tick, 'tick');
  const size = width * height;
  if (encoded !== null && (typeof encoded !== 'string' || encoded.length !== size || /[^.sw#]/.test(encoded))) {
    throw new TypeError('Expected one material symbol per cell');
  }

  const cells = new Uint8Array(size);
  const moved = new Uint8Array(size);
  const counts = new Uint32Array(4);
  if (encoded === null) {
    counts[air] = size;
  } else {
    for (let i = 0; i < size; i++) {
      cells[i] = symbols.indexOf(encoded[i]);
      counts[cells[i]]++;
    }
  }

  function paint(x, y, material, radius = 0) {
    integer(x, 0, width - 1, 'column');
    integer(y, 0, height - 1, 'row');
    integer(material, 0, symbols.length - 1, 'material');
    integer(radius, 0, MATERIAL_LIMITS.brushRadius, 'brush radius');
    let changed = 0;
    for (let row = Math.max(0, y - radius); row <= Math.min(height - 1, y + radius); row++) {
      for (let col = Math.max(0, x - radius); col <= Math.min(width - 1, x + radius); col++) {
        if ((col - x) ** 2 + (row - y) ** 2 > radius ** 2) continue;
        const index = row * width + col;
        if (cells[index] === material) continue;
        counts[cells[index]]--;
        counts[material]++;
        cells[index] = material;
        changed++;
      }
    }
    return changed;
  }

  function transfer(from, x, y) {
    if (x < 0 || x >= width || y >= height) return false;
    const to = y * width + x;
    const displaced = cells[to];
    // Empty space can be reused. A sand/water exchange moves both occupants.
    if (displaced !== air && !(cells[from] === sand && displaced === water && !moved[to])) return false;
    cells[to] = cells[from];
    cells[from] = displaced;
    moved[to] = 1;
    moved[from] = displaced === air ? 0 : 1;
    return true;
  }

  function step() {
    if (tick === MATERIAL_LIMITS.tick) throw new RangeError('Material tick limit reached');
    moved.fill(0);
    let order = (seed + Math.imul(tick, 0x9e3779b9)) >>> 0;
    let transfers = 0;
    for (let y = height - 1; y >= 0; y--) {
      order = nextRandom(order);
      const scan = order >>> 31 ? 1 : -1;
      const start = scan === 1 ? 0 : width - 1;
      for (let x = start; x >= 0 && x < width; x += scan) {
        const index = y * width + x;
        const material = cells[index];
        if ((material !== sand && material !== water) || moved[index]) continue;
        const side = (order >>> (x % 31)) & 1 ? 1 : -1;
        if (transfer(index, x, y + 1) ||
            transfer(index, x + side, y + 1) || transfer(index, x - side, y + 1) ||
            (material === water && (transfer(index, x + side, y) || transfer(index, x - side, y)))) {
          transfers++;
        }
      }
    }
    tick++;
    return transfers;
  }

  function snapshot() {
    let encodedCells = '';
    for (const material of cells) encodedCells += symbols[material];
    return JSON.stringify({format: MATERIAL_FORMAT, width, height, seed, tick, cells: encodedCells});
  }

  return Object.freeze({
    width, height, seed, get tick() { return tick; },
    bufferBytes: cells.byteLength + moved.byteLength + counts.byteLength,
    paint, step, snapshot,
    population() { return {air: counts[0], sand: counts[1], water: counts[2], stone: counts[3]}; },
    copyCells(target) {
      if (!(target instanceof Uint8Array) || target.length !== size) {
        throw new TypeError('Expected a Uint8Array matching the grid area');
      }
      Uint8Array.prototype.set.call(target, cells);
    }
  });
}

/** Integer columns increase rightwards. Rows increase downwards with gravity. */
export function createMaterialGrid(width, height, seed = 1) {
  return makeGrid(width, height, seed, 0, null);
}

/** Admit inert ASCII JSON before allocating a replacement world. */
export function restoreMaterialGrid(text) {
  if (typeof text !== 'string' || text.length > MATERIAL_LIMITS.snapshotBytes || /[^\x00-\x7f]/.test(text)) {
    throw new RangeError('Expected a material snapshot of at most 16 KiB of ASCII JSON');
  }
  const data = JSON.parse(text);
  const keys = ['format', 'width', 'height', 'seed', 'tick', 'cells'];
  if (!data || data.format !== MATERIAL_FORMAT || Object.keys(data).length !== keys.length ||
      !keys.every(key => Object.hasOwn(data, key)) || typeof data.cells !== 'string') {
    throw new TypeError('Invalid material snapshot schema');
  }
  return makeGrid(data.width, data.height, data.seed, data.tick, data.cells);
}
