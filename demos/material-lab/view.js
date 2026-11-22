// SPDX-License-Identifier: Apache-2.0
import {MATERIAL} from '../../modules/material-grid/index.js';

const tones = [
  [[20, 34, 38], [28, 47, 50], [20, 34, 38]],
  [[219, 152, 74], [245, 187, 99], [255, 214, 134]],
  [[49, 150, 162], [67, 167, 176], [118, 214, 207]],
  [[84, 96, 97], [98, 108, 108], [145, 151, 139]]
];

export function chamberView(canvas, grid) {
  const {width, height} = grid;
  const ctx = canvas.getContext('2d', {alpha: false});
  const pixels = document.createElement('canvas');
  pixels.width = width;
  pixels.height = height;
  const pixelContext = pixels.getContext('2d', {alpha: false});
  const image = pixelContext.createImageData(width, height);
  const cells = new Uint8Array(width * height);
  const scale = Math.floor(Math.min(canvas.width / width, canvas.height / height));
  const left = Math.floor((canvas.width - width * scale) / 2);
  const top = Math.floor((canvas.height - height * scale) / 2);

  function locate(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) * canvas.width / rect.width - left) / scale);
    const y = Math.floor(((clientY - rect.top) * canvas.height / rect.height - top) / scale);
    return x >= 0 && x < width && y >= 0 && y < height ? {x, y} : null;
  }

  function draw(cursor, radius) {
    grid.copyCells(cells);
    for (let i = 0; i < cells.length; i++) {
      const value = cells[i], x = i % width, y = Math.floor(i / width);
      let tone = ((x * 13 + y * 7 + (x ^ y)) % 5) < 2 ? 1 : 0;
      if (value === MATERIAL.air) tone = x % 8 === 0 && y % 8 === 0 ? 1 : 0;
      else if (y === 0 || cells[i - width] !== value) tone = 2;
      const rgb = tones[value][tone], offset = i * 4;
      image.data[offset] = rgb[0];
      image.data[offset + 1] = rgb[1];
      image.data[offset + 2] = rgb[2];
      image.data[offset + 3] = 255;
    }
    pixelContext.putImageData(image, 0, 0);
    ctx.fillStyle = '#0d191b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pixels, left, top, width * scale, height * scale);
    if (cursor) {
      ctx.strokeStyle = '#fff1d2';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(left + (cursor.x + 0.5) * scale, top + (cursor.y + 0.5) * scale,
        (radius + 0.5) * scale, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }
  return {locate, draw};
}
