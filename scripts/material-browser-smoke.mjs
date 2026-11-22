// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {extname, join, resolve} from 'node:path';
import {createChamber} from '../demos/material-lab/chambers.js';

const {chromium} = createRequire(import.meta.url)('playwright');
const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist'), out = join(root, 'browser-artifacts', 'material-001');
const manifest = await readFile(join(dist, 'manifest.json'));
const members = new Set(JSON.parse(manifest).files.map(file => file.path));
members.add('manifest.json');
const prefix = '/VANILLAJS/';
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json'};
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/favicon.ico') { res.writeHead(204).end(); return; }
  const name = path.slice(prefix.length);
  if (!path.startsWith(prefix) || !members.has(name)) { res.writeHead(404).end(); return; }
  try {
    const bytes = await readFile(join(dist, name));
    res.writeHead(200, {'Content-Type': types[extname(name)] ?? 'application/octet-stream'}).end(bytes);
  } catch { res.writeHead(500).end(); }
});
await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
const origin = 'http://127.0.0.1:' + server.address().port;
const base = origin + prefix;
async function stopServer() {
  if (!server.listening) return;
  const closed = new Promise(done => server.close(done));
  server.closeAllConnections();
  await closed;
}

let browser;
try {
  browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});
  const context = await browser.newContext({acceptDownloads: true, viewport: {width: 1280, height: 820}});
  const page = await context.newPage();
  const errors = [];
  let disconnected = false;
  context.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) errors.push(request.url());
  });
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(response.status() + ' ' + response.url()); });
  page.on('requestfailed', request => {
    // The registration helper probes the build manifest. It is intentionally online-only.
    if (!disconnected || request.url() !== base + 'manifest.json') errors.push('Failed ' + request.url());
  });
  await page.goto(base + 'demos/creator-hub/index.html');
  await page.getByRole('link', {name: 'Sediment Works'}).click();
  await page.waitForFunction(() => Number(document.querySelector('#sand-count')?.textContent) > 0);
  const field = page.locator('#field');
  const save = async () => {
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#save').click()]);
    return readFile(await download.path(), 'utf8');
  };
  const open = text => page.locator('#load').setInputFiles({name: 'chamber.json', mimeType: 'application/json', buffer: Buffer.from(text)});
  const waitStatus = prefix => page.waitForFunction(value => document.querySelector('#status').textContent.startsWith(value), prefix);

  assert.equal(await save(), createChamber('hoppers').snapshot());
  await page.locator('#chamber').selectOption('empty');
  await page.locator('#radius').selectOption('0');
  const rect = await field.boundingBox();
  await field.click({position: {x: rect.width * 12.5 / 96, y: rect.height * 10.5 / 54}});
  await page.locator('.materials label').filter({hasText: 'Water'}).click();
  await field.focus();
  await field.press('ArrowRight');
  await field.press('Space');
  assert.equal(await page.locator('#sand-count').textContent(), '1');
  assert.equal(await page.locator('#water-count').textContent(), '1');
  await page.locator('#step').click();
  const edited = await save(), snapshot = JSON.parse(edited);
  assert.equal(snapshot.tick, 1);
  assert.equal(snapshot.cells.slice(11 * 96 + 12, 11 * 96 + 14), 'sw');
  const [sand, water] = await field.evaluate(canvas => [125, 135].map(x =>
    Array.from(canvas.getContext('2d').getImageData(x, 115, 1, 1).data)));
  assert.ok(sand[0] > sand[1] && water[0] < water[1], 'canvas reflects both moved materials');

  await page.locator('#run').click();
  await page.waitForFunction(() => Number(document.querySelector('#tick').textContent) > 3);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  assert.equal(await page.locator('#run').textContent(), 'Run');
  await open(edited);
  await waitStatus('Opened snapshot at tick 1.');
  assert.equal(await save(), edited);
  await open(JSON.stringify({...snapshot, cells: '!' + snapshot.cells.slice(1)}));
  await waitStatus('Snapshot rejected.');
  assert.equal(await save(), edited);
  await page.locator('#step').click();
  await page.locator('#reset').click();
  assert.equal(await save(), edited, 'reset returns to the imported starting layout');

  // Keep the real file bytes pending while the user picks a different chamber.
  await page.evaluate(() => {
    const read = File.prototype.text;
    File.prototype.text = async function() {
      File.prototype.text = read;
      const text = await read.call(this);
      await new Promise(resolve => { globalThis.finishMaterialRead = resolve; });
      return text;
    };
  });
  await open(edited);
  await page.waitForFunction(() => !!globalThis.finishMaterialRead);
  await page.locator('#chamber').selectOption('spillway');
  await page.evaluate(() => globalThis.finishMaterialRead());
  assert.equal(await save(), createChamber('spillway').snapshot());

  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated',
    undefined, {timeout: 120000});
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  disconnected = true;
  await context.setOffline(true);
  await stopServer();
  const offlinePage = await page.reload();
  assert.equal(offlinePage.fromServiceWorker(), true);
  await page.locator('#step').click();
  const replay = createChamber('hoppers');
  replay.step();
  assert.equal(await save(), replay.snapshot());
  for (let i = 0; i < 13; i++) await page.locator('#step').click();
  await mkdir(out, {recursive: true});
  await page.screenshot({path: join(out, 'chamber.png'), fullPage: true});
  await page.setViewportSize({width: 375, height: 820});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile layout fits');
  assert.deepEqual(errors, []);
  const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
  const evidence = {
    source: git(['rev-parse', 'HEAD']), dirty: Boolean(git(['status', '--porcelain'])),
    chromium: browser.version(), manifestSha256: createHash('sha256').update(manifest).digest('hex'),
    savedTick: snapshot.tick, offlineTick: replay.tick, offlineFromServiceWorker: true
  };
  await writeFile(join(out, 'acceptance.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(evidence);
} finally {
  await browser?.close();
  await stopServer();
}
