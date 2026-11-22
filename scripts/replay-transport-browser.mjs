// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {extname, join, resolve} from 'node:path';
import {exportReplayReceipt, sealReplayReceipt} from '../modules/replay-audit/index.js';
import {replayExamples} from '../demos/replay-audit-lab/scenarios.js';
import {CHUNK_BYTES} from '../api/replay/wire.js';

const {chromium} = createRequire(import.meta.url)('playwright');
const root = resolve(import.meta.dirname, '..'), dist = join(root, 'dist');
const manifest = await readFile(join(dist, 'manifest.json'));
const files = new Set(JSON.parse(manifest).files.map(f => f.path));
files.add('manifest.json');
const prefix = '/VANILLAJS/', mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json'};
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname, file = path.slice(prefix.length);
  if (path === '/favicon.ico') { res.writeHead(204).end(); return; }
  if (!path.startsWith(prefix) || !files.has(file)) { res.writeHead(404).end(); return; }
  try { const bytes = await readFile(join(dist, file)); res.writeHead(200, {'Content-Type':mime[extname(file)] ?? 'application/octet-stream'}).end(bytes); }
  catch { res.writeHead(500).end(); }
});
await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
async function stopOrigin() {
  if (!server.listening) return;
  const closed = new Promise(ok => server.close(ok));
  server.closeAllConnections();
  await closed;
}
const origin = 'http://127.0.0.1:' + server.address().port, base = origin + prefix;
const lab = base + 'demos/replay-link-lab/index.html', errors = [], browsers = [];
const sha = data => createHash('sha256').update(data).digest('hex');
async function cachedClient() {
  const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    args:['--allow-loopback-in-peer-connection']});
  browsers.push(browser);
  const context = await browser.newContext({acceptDownloads:true});
  context.on('request', req => {
    if (/^https?:/.test(req.url()) && new URL(req.url()).origin !== origin) errors.push('External HTTP request');
  });
  context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
  // Observe the native connection for getStats(). All signalling and data stay on WebRTC.
  await context.addInitScript(() => {
    const native = RTCPeerConnection.prototype.setLocalDescription;
    RTCPeerConnection.prototype.setLocalDescription = function(...args) {
      globalThis.observedReplayPeer = this;
      return native.apply(this, args);
    };
  });
  const warm = await context.newPage();
  await warm.goto(base + 'demos/creator-hub/index.html');
  await warm.getByRole('link', {name:'Replay Exchange', exact:true}).click();
  await warm.waitForFunction(() => document.documentElement.dataset.offlineWorker === 'registered');
  const reg = await warm.evaluateHandle(() => navigator.serviceWorker.getRegistration());
  await warm.waitForFunction(r => r.active?.state === 'activated', reg, {timeout:120000});
  assert.equal(await reg.evaluate(r => r.scope), base);
  await reg.dispose();
  const page = await context.newPage();
  await warm.close();
  return page;
}
async function state(page, wanted) {
  await page.waitForFunction(w => [w, 'failed'].includes(document.querySelector('#status').dataset.state), wanted, {timeout:40000});
  const current = await page.locator('#status').getAttribute('data-state');
  assert.equal(current, wanted, await page.locator('#status').textContent());
}
async function code(page) {
  await page.waitForFunction(() => document.querySelector('#local').value || document.querySelector('#status').dataset.state === 'failed');
  const text = await page.locator('#local').inputValue();
  assert.ok(text.length > 0, await page.locator('#status').textContent());
  return text;
}
async function pair(sender, receiver) {
  await sender.locator('#pair').click();
  await receiver.locator('#remote').fill(await code(sender));
  await receiver.locator('#pair').click();
  await sender.locator('#remote').fill(await code(receiver));
  await sender.locator('#connect').click();
  await Promise.all([state(sender, 'open'), state(receiver, 'open')]);
  const selected = await receiver.evaluate(async () => {
    const stats = await globalThis.observedReplayPeer.getStats();
    const transport = Array.from(stats.values()).find(row => row.type === 'transport' && row.selectedCandidatePairId);
    const pair = stats.get(transport.selectedCandidatePairId);
    const local = stats.get(pair.localCandidateId), remote = stats.get(pair.remoteCandidateId);
    return {local:local.candidateType, remote:remote.candidateType, protocol:local.protocol};
  });
  assert.equal(selected.local, 'host');
  assert.equal(selected.remote, 'host');
  return selected;
}
async function save(page) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#save').click()]);
  return readFile(await download.path(), 'utf8');
}
const reset = (a, b) => Promise.all([a.locator('#reset').click(), b.locator('#reset').click()]);
try {
  // Separate processes, profiles and worker caches, all hosted on this one runner.
  const sender = await cachedClient(), receiver = await cachedClient();
  await stopOrigin();
  for (const [page, url] of [[sender, lab], [receiver, lab + '#receiver']]) {
    const response = await page.goto(url);
    assert.equal(response.status(), 200);
    assert.equal(response.fromServiceWorker(), true);
  }
  const build = await receiver.locator('#build').inputValue();
  const route = await pair(sender, receiver);
  await sender.locator('#send').click();
  await Promise.all([state(sender, 'acknowledged'), state(receiver, 'verified')]);
  const integer = await save(receiver);
  assert.equal(integer, exportReplayReceipt(await sealReplayReceipt({...replayExamples().integer, build})));

  await reset(sender, receiver);
  await pair(sender, receiver);
  // A real source edit yields a multi-packet tape distinct from the built-in racing case.
  const racing = await sender.evaluate(async build => {
    const {replayExamples} = await import('../replay-audit-lab/scenarios.js');
    const {exportReplayReceipt, sealReplayReceipt} = await import('../../modules/replay-audit/index.js');
    const plan = replayExamples().racing;
    plan.frames[8].steer = 0.25;
    return exportReplayReceipt(await sealReplayReceipt({...plan, build}));
  }, build);
  assert.ok(Buffer.byteLength(racing) > CHUNK_BYTES);
  await sender.locator('#source').selectOption('file');
  const setFile = text => sender.locator('#file').setInputFiles({name:'racing.json',mimeType:'application/json',buffer:Buffer.from(text)});
  await setFile(JSON.stringify({...JSON.parse(racing), traceSha256:'0'.repeat(64)}));
  await sender.locator('#send').click();
  await sender.waitForFunction(() => document.querySelector('#status').textContent.includes('mismatch'));
  assert.equal(await save(receiver), integer);
  await setFile(racing);
  await sender.locator('#send').click();
  await Promise.all([state(sender, 'acknowledged'), state(receiver, 'verified')]);
  assert.equal(await save(receiver), racing);

  const out = join(root, 'browser-artifacts/replay-transport-001');
  await mkdir(out, {recursive:true});
  // Only the verified ledger is shareable. Keep pairing codes out of evidence.
  await receiver.locator('.ledger').screenshot({path:join(out,'receiver.png')});
  await reset(sender, receiver);
  await receiver.locator('#build').fill('a'.repeat(40));
  await pair(sender, receiver);
  await sender.locator('#send').click();
  await state(receiver, 'failed');
  assert.match(await receiver.locator('#status').textContent(), /build/);
  assert.equal(await save(receiver), racing);
  assert.deepEqual(errors, []);
  const evidence = {source:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    chromium:browsers[0].version(), processCount:browsers.length, originStopped:true, route,
    manifestSha256:sha(manifest), integerSha256:sha(integer), racingSha256:sha(racing),
    racingBytes:Buffer.byteLength(racing), racingChunks:Math.ceil(Buffer.byteLength(racing)/CHUNK_BYTES),
    wrongBuildRejected:true, priorReceiptPreserved:true};
  await writeFile(join(out, 'acceptance.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(evidence);
} finally {
  await Promise.all(browsers.map(browser => browser.close()));
  await stopOrigin();
}
