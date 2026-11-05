import assert from 'node:assert/strict';
import {foundryFixture} from './integer-fixture.js';
import {foundryState} from '../demos/integer-foundry/world.js';
export async function verifyIntegerFoundry(browser, baseURL) {
  const url = baseURL + 'demos/integer-foundry/index.html', errors = [];
  const page = await browser.newPage({viewport: {width: 1440, height: 1100}});
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url); await page.waitForFunction(() => document.querySelector('#foundry').width > 300);
  assert.equal(await page.locator('#error').isVisible(), false);
  const bright = await page.locator('#foundry').evaluate(canvas => new Promise(resolve => requestAnimationFrame(() => {
    const gl = canvas.getContext('webgl'), pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let n = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 140) n++;
    resolve(n);
  })));
  assert.ok(bright > 500, 'integer positions produce visible geometry');
  const fixture = foundryFixture();
  const replay = await page.evaluate(async frames => {
    const w = await import(new URL('./world.js', location.href).href), g = w.createFoundry();
    for (const frame of frames) w.stepFoundry(g, frame);
    return {state: w.foundryState(g), receipt: w.verifyFoundry(g)};
  }, fixture.frames);
  assert.deepEqual(replay.state, foundryState(fixture), 'packaged Chromium and Node full states agree');
  assert.equal(replay.receipt.match, true);
  await page.screenshot({path: 'browser-artifacts/integer-foundry.png', fullPage: true});
  await page.locator('#launch').click(); await page.keyboard.down('d');
  await page.waitForFunction(() => Number(document.querySelector('#position').textContent.split(' · ')[0]) > 115200);
  await page.keyboard.press('Escape');
  const frozen = await page.locator('#tick').textContent(), x = (await page.locator('#position').textContent()).split(' · ')[0];
  await page.waitForTimeout(150); assert.equal(await page.locator('#tick').textContent(), frozen);
  await page.locator('#launch').click(); await page.keyboard.down('d'); await page.waitForTimeout(150);
  assert.equal((await page.locator('#position').textContent()).split(' · ')[0], x, 'held repeat cannot resume motion');
  await page.keyboard.up('d'); await page.keyboard.down('d');
  await page.waitForFunction(old => Number(document.querySelector('#position').textContent.split(' · ')[0]) > Number(old), x);
  await page.keyboard.up('d');
  await page.keyboard.press('Space'); await page.waitForFunction(() => Number(document.querySelector('#position').textContent.split(' · ')[1]) > 64000);
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); assert.equal(await page.locator('#status').textContent(), 'PAUSED');
  await page.locator('#verify').click(); assert.match(await page.locator('#replay').textContent(), /REPLAY MATCH/);
  await page.locator('#reset').click(); assert.equal(await page.locator('#tick').textContent(), '000000');
  // A short jump press queues until the next integer tick; rendering cadence need not see it held.
  await page.locator('#launch').click(); await page.waitForFunction(() => Number(document.querySelector('#tick').textContent) > 1);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', {code: 'Space'}));
    window.dispatchEvent(new KeyboardEvent('keyup', {code: 'Space'}));
  });
  await page.waitForFunction(() => Number(document.querySelector('#position').textContent.split(' · ')[1]) > 64000);
  await page.locator('#pause').click();
  const mobile = await browser.newPage({viewport: {width: 390, height: 844}, hasTouch: true});
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(url); await mobile.locator('#launch').tap();
  const button = mobile.locator('[data-action="right"]');
  await button.dispatchEvent('pointerdown', {pointerId: 7, pointerType: 'touch', button: 0});
  await mobile.waitForFunction(() => Number(document.querySelector('#position').textContent.split(' · ')[0]) > 89600);
  await button.dispatchEvent('pointercancel', {pointerId: 7}); await mobile.locator('#pause').tap();
  const stopped = (await mobile.locator('#position').textContent()).split(' · ')[0];
  await mobile.locator('#launch').tap(); await mobile.waitForTimeout(100);
  assert.equal((await mobile.locator('#position').textContent()).split(' · ')[0], stopped);
  await mobile.locator('#pause').tap();
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.screenshot({path: 'browser-artifacts/integer-foundry-mobile.png', fullPage: true});
  await page.locator('#foundry').dispatchEvent('webglcontextlost');
  assert.equal(await page.locator('#launch').isDisabled(), true); assert.match(await page.locator('#error').textContent(), /context lost/);
  const unsupported = await browser.newPage(); await unsupported.addInitScript(() => HTMLCanvasElement.prototype.getContext = () => null);
  await unsupported.goto(url); assert.equal(await unsupported.locator('#launch').isDisabled(), true);
  assert.match(await unsupported.locator('#error').textContent(), /WebGL is unavailable/);
  assert.deepEqual(errors, []);
  await Promise.all([page.close(), mobile.close(), unsupported.close()]);
  console.log('Integer Foundry: packaged full-state replay parity, WebGL, movement/jump, pause, fresh-input, blur, reset, touch cancellation, mobile layout and graphics failure passed.');
}
