// SPDX-License-Identifier: Apache-2.0
import {createMaterialGrid, MATERIAL} from '../../modules/material-grid/index.js';

/** Original lab fixtures. Every grain, pool and baffle is ordinary editable grid data. */
export function createChamber(name) {
  const grid = createMaterialGrid(96, 54, 1701);
  const {sand, water, stone} = MATERIAL;
  if (name === 'empty') return grid;
  if (name !== 'hoppers' && name !== 'spillway') throw new TypeError('Unknown chamber');
  for (let x = 0; x < grid.width; x++) {
    // A common collection basin, with the changing waterline visible above the bed.
    const bed = 51 - Math.floor(Math.abs(x - 48) / 13);
    for (let y = bed; y < grid.height; y++) grid.paint(x, y, stone);
    for (let y = 46; y < bed; y++) grid.paint(x, y, water);
    if (name === 'hoppers') {
      const left = x < 48;
      const distance = Math.abs(x - (left ? 23 : 72));
      const floor = 25 - Math.floor(distance / 2);
      const surface = left ? 5 + Math.floor(distance / 3) : 9;
      for (let y = surface; y < floor; y++) grid.paint(x, y, left ? sand : water);
      if (distance > 2) {
        grid.paint(x, floor, stone);
        grid.paint(x, floor + 1, stone);
      }
      if (x >= 27 && x <= 44) grid.paint(x, 31 + Math.floor((x - 27) / 3), stone);
      if (x >= 51 && x <= 68) grid.paint(x, 31 + Math.floor((68 - x) / 3), stone);
    } else {
      const shelf = 25 + Math.floor(x / 6);
      if (x < 54) {
        for (let y = 9; y < shelf; y++) grid.paint(x, y, water);
        grid.paint(x, shelf, stone);
      }
      if (x === 54) for (let y = 20; y <= shelf; y++) grid.paint(x, y, stone);
      if (x > 64) {
        const surface = 31 + Math.floor(Math.abs(80 - x) / 2);
        for (let y = surface; y < bed; y++) grid.paint(x, y, sand);
      }
    }
  }
  return grid;
}
