// SPDX-License-Identifier: Apache-2.0
// Verify bytes downloaded through the actual authoring UI, including nested offline startup.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {extname} from 'node:path';
import {parseRaceProject} from '../demos/horizon-lab/race-project.js';
import {driveRaceWithKeyboard} from './browser-horizon-race.js';
function unzip(raw){
  const files=new Map();let at=0;
  while(raw.readUInt32LE(at)===0x04034b50){
    assert.equal(raw.readUInt16LE(at+8),0);const size=raw.readUInt32LE(at+18),length=raw.readUInt16LE(at+26),extra=raw.readUInt16LE(at+28),name=raw.subarray(at+30,at+30+length).toString(),start=at+30+length+extra;
    assert.ok(/^[a-zA-Z0-9._/-]+$/.test(name)&&!name.startsWith('/')&&!name.split('/').some(s=>['.','..',''].includes(s)));assert.equal(files.has(name),false);assert.ok(start+size<=raw.length);files.set(name,raw.subarray(start,start+size));at=start+size;
  }
  assert.equal(raw.readUInt32LE(at),0x02014b50);assert.ok(files.size>20);return files;
}
export async function checkHorizonExport(browser,base){
  const author=await browser.newContext(),page=await author.newPage();let files,expected;
  try{
    await page.goto(base+'demos/horizon-lab/race.html');await page.waitForFunction(()=>document.documentElement.dataset.labReady==='horizon-race');
    await page.locator('#quality').selectOption('low');await page.locator('#race-apply').click();expected=parseRaceProject(await page.evaluate(()=>__horizonRace.snapshot().project));
    const pending=page.waitForEvent('download');await page.locator('#race-export-game').click();files=unzip(await readFile(await (await pending).path()));
    assert.equal(await page.locator('#race-export-game').isEnabled(),true);
  }finally{await author.close();}
  const manifest=JSON.parse(files.get('manifest.json').toString());assert.equal(manifest.version,'horizon-race-v1');assert.equal(manifest.files.length,files.size-1);assert.equal(new Set(manifest.files.map(f=>f.path)).size,manifest.files.length);assert.deepEqual(manifest.files.map(f=>f.path).sort(),[...files.keys()].filter(p=>p!=='manifest.json').sort());
  for(const row of manifest.files){const bytes=files.get(row.path);assert.ok(bytes);assert.equal(bytes.length,row.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);}
  assert.deepEqual(parseRaceProject(files.get('project.json').toString()),expected);
  for(const name of ['LICENSE','NOTICE'])assert.deepEqual(files.get(name),await readFile(new URL('../'+name,import.meta.url)));
  for(const name of ['ASSET_LICENSES.json','ENGINE_SOURCE.json','service-worker.js'])assert.ok(files.has(name));
  assert.equal(files.has('demos/horizon-lab/race-app.js'),false);assert.equal(files.has('demos/horizon-lab/race-export.js'),false);
  const prefix='/creator/exports/sunward/';let corrupt=false;
  const server=createServer((req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!pathname.startsWith(prefix))throw Error('prefix');const name=pathname.slice(prefix.length)||'index.html',bytes=files.get(name);if(!bytes)throw Error('missing');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css'})[extname(name)]??'text/plain');res.end(corrupt&&name==='project.json'?Buffer.from('{}'):bytes);}catch{res.writeHead(404);res.end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port+prefix;
  const context=await browser.newContext({viewport:{width:800,height:900}}),race=await context.newPage(),errors=[];race.on('pageerror',e=>errors.push(e.message));
  try{
    await race.goto(url);await race.waitForFunction(()=>document.documentElement.dataset.labReady==='horizon-race');assert.equal(await race.locator('#race-title').textContent(),expected.name);
    const complete=await driveRaceWithKeyboard(race);assert.ok(complete,'the actual exported native player finishes through real input');
    await race.waitForFunction(async scope=>(await navigator.serviceWorker.getRegistrations()).some(r=>r.scope===scope&&r.active?.state==='activated'),url,{timeout:45000});
    await context.setOffline(true);const offline=await context.newPage();offline.on('pageerror',e=>errors.push(e.message));const response=await offline.goto(url);assert.equal(response.status(),200);assert.equal(response.fromServiceWorker(),true);await offline.waitForFunction(()=>document.documentElement.dataset.labReady==='horizon-race');assert.equal(await offline.evaluate(()=>navigator.serviceWorker.controller.scriptURL),url+'service-worker.js');
    await offline.locator('#race-start').click();await offline.keyboard.down('KeyW');await offline.waitForFunction(()=>__horizonRace.snapshot().player.position[2]<-17);await offline.keyboard.up('KeyW');await offline.locator('#race-pause').click();assert.equal(await offline.evaluate(()=>__horizonRace.snapshot().running),false);await offline.locator('#race-restart').click();assert.equal(await offline.evaluate(()=>__horizonRace.snapshot().ticks),0);assert.deepEqual(errors,[]);
    await context.setOffline(false);corrupt=true;const broken=await browser.newContext(),bad=await broken.newPage();
    try{bad.on('pageerror',e=>errors.push(e.message));await bad.goto(url);await bad.waitForFunction(()=>document.documentElement.dataset.labReady==='horizon-race');await bad.waitForFunction(()=>document.documentElement.dataset.offlineWorker==='registered');await bad.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistrations();return r.length===0||r.every(r=>!r.active&&(!r.installing||r.installing.state==='redundant'));},null,{timeout:45000});assert.equal(await bad.evaluate(()=>navigator.serviceWorker.controller),null,'tampered race package must not gain offline authority');}finally{await broken.close();}
    assert.deepEqual(errors,[]);
  }finally{await context.close();await new Promise(resolve=>server.close(resolve));}
  console.log('HORIZON portable race: real UI ZIP, full keyboard route, native runtime/source/licences, nested offline play/restart and tampered-install rejection PASS');
}
