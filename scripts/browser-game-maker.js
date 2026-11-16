// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {extname} from 'node:path';
import {parseProject} from '../demos/game-maker-lab/game.js';
import {gardenSprite} from '../demos/game-maker-lab/starter.js';

function unzipStored(raw){
  const files=new Map();let pos=0;
  while(raw.readUInt32LE(pos)===0x04034b50){
    assert.equal(raw.readUInt16LE(pos+8),0,'export uses standard uncompressed ZIP');const size=raw.readUInt32LE(pos+18),nameBytes=raw.readUInt16LE(pos+26),extra=raw.readUInt16LE(pos+28),name=raw.subarray(pos+30,pos+30+nameBytes).toString();
    assert.ok(/^[a-zA-Z0-9._/-]+$/.test(name)&&!name.startsWith('/')&&!name.split('/').includes('..'));assert.equal(files.has(name),false);
    const start=pos+30+nameBytes+extra;assert.ok(start+size<=raw.length);files.set(name,raw.subarray(start,start+size));pos=start+size;
  }
  assert.equal(raw.readUInt32LE(pos),0x02014b50);assert.ok(files.size>15);return files;
}
async function workerReady(page,scope){
  await page.waitForFunction(async expected=>{const registrations=await navigator.serviceWorker.getRegistrations();return registrations.some(r=>r.scope===expected&&r.active?.state==='activated');},scope,{timeout:45000});
}
async function checkPortable(browser,files,expected){
  const manifest=JSON.parse(files.get('manifest.json').toString());
  for(const row of manifest.files){const bytes=files.get(row.path);assert.ok(bytes,row.path);assert.equal(bytes.length,row.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);}
  for(const name of ['LICENSE','NOTICE','ASSET_LICENSES.json','ENGINE_SOURCE.json','project.json','service-worker.js'])assert.ok(files.has(name));
  assert.deepEqual(parseProject(files.get('project.json').toString()),expected);assert.equal(files.has('demos/game-maker-lab/app.js'),false,'portable package excludes editor runtime');
  const prefix='/creator/exports/signal-garden/';let corrupt=false;
  const server=createServer((req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!pathname.startsWith(prefix))throw Error('prefix');const path=pathname.slice(prefix.length)||'index.html',bytes=files.get(path);if(!bytes)throw Error('missing');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)]??'text/plain');res.end(corrupt&&path==='project.json'?Buffer.from('{}'):bytes);}catch{res.writeHead(404);res.end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port+prefix;
  const context=await browser.newContext({viewport:{width:1000,height:800}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto(url);await page.waitForFunction(()=>document.documentElement.dataset.gameReady==='game-maker');assert.equal(await page.locator('#title').textContent(),expected.name);
    await page.locator('#play').click();await page.keyboard.down('KeyD');await page.waitForFunction(()=>__gameMakerPlayer.snapshot().state.status==='won');await page.keyboard.up('KeyD');assert.equal(await page.evaluate(()=>__gameMakerPlayer.snapshot().state.collected.length),1);
    await workerReady(page,url);await context.setOffline(true);const offline=await context.newPage(),response=await offline.goto(url);assert.equal(response.fromServiceWorker(),true);assert.equal(response.status(),200);await offline.waitForFunction(()=>document.documentElement.dataset.gameReady==='game-maker');assert.equal(await offline.evaluate(()=>navigator.serviceWorker.controller.scriptURL),url+'service-worker.js');
    await offline.locator('#play').click();await offline.keyboard.down('KeyD');await offline.waitForFunction(()=>__gameMakerPlayer.snapshot().state.status==='won');await offline.keyboard.up('KeyD');
    await offline.locator('#restart').click();assert.equal(await offline.evaluate(()=>__gameMakerPlayer.snapshot().state.tick),0);assert.deepEqual(errors,[]);
    // A fresh install receiving modified bytes must reject the offline package.
    await context.setOffline(false);corrupt=true;const broken=await browser.newContext(),p=await broken.newPage();
    try{await p.goto(url);await p.waitForFunction(()=>document.documentElement.dataset.gameReady==='game-maker');await p.waitForFunction(()=>document.documentElement.dataset.offlineWorker==='registered');await p.waitForFunction(async()=>{const all=await navigator.serviceWorker.getRegistrations();return all.length===0||all.every(r=>!r.active&&(!r.installing||r.installing.state==='redundant'));},null,{timeout:45000});assert.equal(await p.evaluate(()=>navigator.serviceWorker.controller),null,'tampered exported package gets no active offline authority');}
    finally{await broken.close();}
  }finally{await context.close();await new Promise(resolve=>server.close(resolve));}
}
export async function checkGameMaker(browser,base){
  const context=await browser.newContext({viewport:{width:1480,height:1100},hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);await mkdir('browser-artifacts',{recursive:true});
  const snapshot=()=>page.evaluate(()=>__gameMakerLab.snapshot());
  const download=async id=>{const pending=page.waitForEvent('download');await page.locator('#'+id).click();return readFile(await (await pending).path());};
  const cell=async(tool,column,row)=>{await page.locator('#tool').selectOption(tool);await page.locator('#cell-column').fill(String(column));await page.locator('#cell-row').fill(String(row));await page.locator('#paint-cell').click();};
  const play=()=>page.locator('#play').click();
  try{
    await page.goto(base+'demos/game-maker-lab/index.html');await page.waitForFunction(()=>document.documentElement.dataset.labReady==='game-maker-lab');assert.ok((await snapshot()).player);assert.equal(await page.locator('#graphics-fallback').isVisible(),false);
    const pixels=await page.locator('#game').evaluate(c=>{const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return [...p].filter((v,i)=>i%4!==3&&v>150).length;});assert.ok(pixels>200,'real native canvas paints original sprites and tiles');
    await page.screenshot({path:'browser-artifacts/game-maker-desktop.png',fullPage:true});
    // Actual original starter: terrain obstacle, two deliberate jumps, all signals.
    await page.locator('#sound').click();assert.equal((await snapshot()).player.sound,true);await play();await page.keyboard.down('KeyD');await page.waitForFunction(()=>__gameMakerLab.snapshot().player.state.body.x>8.35*256);await page.keyboard.press('Space');await page.waitForFunction(()=>__gameMakerLab.snapshot().player.graphics.voices>0);await page.waitForFunction(()=>__gameMakerLab.snapshot().player.state.body.x>13.7*256);await page.keyboard.press('Space');await page.waitForFunction(()=>__gameMakerLab.snapshot().player.state.body.x>21.4*256);await page.evaluate(()=>{const end=performance.now()+150;while(performance.now()<end){}});await page.waitForFunction(()=>__gameMakerLab.snapshot().player.state.status==='won');await page.keyboard.up('KeyD');assert.equal((await snapshot()).player.state.collected.length,3);assert.equal((await snapshot()).progress.tested,true);assert.equal((await snapshot()).player.graphics.particles,12,'catch-up after finishing emits the ending only once');
    await page.locator('#restart').click();await play();await page.keyboard.down('KeyD');await page.waitForFunction(()=>__gameMakerLab.snapshot().player.state.body.x>8.35*256);await page.keyboard.press('Space');await page.waitForFunction(()=>__gameMakerLab.snapshot().player.state.status==='lost');await page.keyboard.up('KeyD');
    // A complete keyboard tap in one browser task must survive the next frame.
    await page.locator('#restart').click();await play();await page.waitForFunction(()=>__gameMakerLab.snapshot().player.state.body.grounded);const ground=(await snapshot()).player.state.body.y;
    await page.evaluate(()=>{dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));dispatchEvent(new KeyboardEvent('keyup',{code:'Space',bubbles:true}));});await page.waitForFunction(y=>__gameMakerLab.snapshot().player.state.body.y>y+50,ground);
    await page.waitForFunction(()=>__gameMakerLab.snapshot().player.state.body.grounded);
    // Synthetic cancellation in a single task never becomes a queued jump.
    await page.evaluate(()=>{const b=document.querySelector('[data-game-action="jump"]');b.dispatchEvent(new PointerEvent('pointerdown',{pointerId:91,button:0,bubbles:true}));b.dispatchEvent(new PointerEvent('pointercancel',{pointerId:91,button:0,bubbles:true}));});await page.waitForTimeout(100);assert.equal((await snapshot()).player.state.body.y,ground);
    await page.evaluate(()=>{const b=document.querySelector('[data-game-action="jump"]');b.dispatchEvent(new PointerEvent('pointerdown',{pointerId:92,button:0,bubbles:true}));b.dispatchEvent(new PointerEvent('pointerup',{pointerId:92,button:0,bubbles:true}));});await page.waitForFunction(y=>__gameMakerLab.snapshot().player.state.body.y>y+50,ground);
    await page.keyboard.down('KeyD');await page.waitForFunction(()=>__gameMakerLab.snapshot().player.state.body.vx>0);await page.evaluate(()=>dispatchEvent(new Event('blur')));assert.equal((await snapshot()).player.running,false);assert.equal((await snapshot()).player.graphics.voices,0);const stopped=(await snapshot()).player.state.tick;await page.waitForTimeout(100);assert.equal((await snapshot()).player.state.tick,stopped);await play();await page.keyboard.down('KeyD');const x=(await snapshot()).player.state.body.x;await page.waitForTimeout(140);assert.ok((await snapshot()).player.state.body.x<=x+50,'held key repeats do not rearm after blur');await page.keyboard.up('KeyD');await page.keyboard.down('KeyD');await page.waitForFunction(x=>__gameMakerLab.snapshot().player.state.body.x>x+60,x);await page.keyboard.up('KeyD');await page.locator('#pause').click();
    // Canvas2D lifecycle events are dispatched explicitly: no GPU-reset claim.
    const beforeLoss=(await snapshot()).player.state;await page.locator('#game').evaluate(c=>c.dispatchEvent(new Event('contextlost')));assert.equal((await snapshot()).player.graphicsLost,true);await page.locator('#game').evaluate(c=>c.dispatchEvent(new Event('contextrestored')));assert.equal((await snapshot()).player.graphicsLost,false);assert.deepEqual((await snapshot()).player.state,beforeLoss);
    // Build an actually playable new stage from the empty template using forms.
    await page.locator('#empty').click();assert.equal(await page.locator('#play').isDisabled(),true);assert.equal(JSON.parse((await snapshot()).project).map.collision.some(Boolean),false);
    await page.locator('#lay-floor').click();await cell('spawn',2,10);await cell('collect',5,10);await cell('exit',8,10);assert.equal(await page.locator('#play').isEnabled(),true);
    const accepted=(await snapshot()).project;await cell('floor',2,10);assert.match(await page.locator('#status').textContent(),/Not applied/);assert.equal((await snapshot()).project,accepted,'solid paint cannot partially replace a spawn');
    await page.locator('#seed').fill('975');await page.locator('#generate').click();assert.equal(JSON.parse((await snapshot()).project).playerSprite.recipe.seed,975);
    await page.locator('#palette-index').selectOption('2');await page.locator('#palette-color').fill('#ff9966');await page.locator('#apply-palette').click();assert.deepEqual(JSON.parse((await snapshot()).project).playerSprite.recipe.palette[2],[255,153,102,255]);
    await page.locator('#sprite').focus();await page.keyboard.press('Enter');assert.equal(JSON.parse((await snapshot()).project).playerSprite.frames[0].pixels[0],2);
    await page.locator('#import-sprite').setInputFiles({name:'hero.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(gardenSprite(88)))});await page.waitForFunction(()=>document.querySelector('#status').textContent==='Validated sprite imported.');assert.equal(JSON.parse((await snapshot()).project).playerSprite.recipe.seed,88);
    await page.locator('#palette-target').selectOption('tiles');await page.locator('#palette-index').selectOption('3');await page.locator('#palette-color').fill('#62d8ba');await page.locator('#apply-palette').click();assert.deepEqual(JSON.parse((await snapshot()).project).map.tileset.recipe.palette[3],[98,216,186,255]);
    const paletteVersion=(await snapshot()).project;await page.locator('#undo').click();assert.notEqual((await snapshot()).project,paletteVersion);await page.locator('#redo').click();assert.equal((await snapshot()).project,paletteVersion);
    await page.getByText('Layers & camera',{exact:true}).click();await page.locator('#add-layer').click();await page.locator('#parallax').fill('.25');await page.locator('#apply-parallax').click();await page.locator('#tile-index').selectOption('2');await cell('tile',3,3);assert.equal(JSON.parse((await snapshot()).project).map.layers.at(-1).parallax,.25);assert.equal(JSON.parse((await snapshot()).project).map.layers.at(-1).cells[3*24+3],2);
    await page.locator('#camera-follow').uncheck();assert.equal(JSON.parse((await snapshot()).project).map.camera.follow,false);await page.locator('#camera-follow').check();
    await page.locator('#project-name').fill('My <signal> garden');await page.locator('#apply-name').click();await play();await page.keyboard.down('KeyD');await page.waitForFunction(()=>__gameMakerLab.snapshot().player.state.status==='won');await page.keyboard.up('KeyD');
    const projectBytes=await download('export-project'),authored=parseProject(projectBytes.toString()),stable=(await snapshot()).project;
    await page.locator('#import-project').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"format":"bad"}')});await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Not applied'));assert.equal((await snapshot()).project,stable);
    await page.locator('#import-project').setInputFiles({name:'authored.json',mimeType:'application/json',buffer:projectBytes});await page.waitForFunction(()=>document.querySelector('#status').textContent==='Validated project imported.');assert.equal((await snapshot()).project,stable);
    await page.getByText('Inspect or edit project JSON',{exact:true}).click();const malicious=JSON.parse(stable);malicious.script='globalThis.pwned=true';await page.locator('#project-json').fill(JSON.stringify(malicious));await page.locator('#apply-json').click();assert.equal((await snapshot()).project,stable);assert.equal(await page.evaluate(()=>globalThis.pwned),undefined);
    // An older asynchronous import cannot replace a newer explicit edit.
    await page.evaluate(()=>{const original=File.prototype.text;File.prototype.text=function(){File.prototype.text=original;return new Promise(resolve=>{globalThis.finishMakerImport=()=>original.call(this).then(resolve);});};});await page.locator('#import-project').setInputFiles({name:'late.json',mimeType:'application/json',buffer:projectBytes});await page.locator('#project-name').fill('Newer garden');await page.locator('#apply-name').click();await page.evaluate(()=>finishMakerImport());assert.equal(JSON.parse((await snapshot()).project).name,'Newer garden');await page.locator('#undo').click();assert.equal((await snapshot()).project,stable);
    const zip=await download('export-game');assert.equal((await snapshot()).progress.exported,true);await checkPortable(browser,unzipStored(zip),authored);
    await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});assert.equal((await snapshot()).project,stable,'back-forward restoration keeps accepted authoring');assert.equal((await snapshot()).player.graphics.disposed,false);assert.equal((await snapshot()).player.running,false);assert.equal((await snapshot()).player.state.tick,0);
    await page.setViewportSize({width:320,height:900});await page.emulateMedia({reducedMotion:'reduce'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'320px editor fits');await page.screenshot({path:'browser-artifacts/game-maker-mobile.png',fullPage:true});
    await page.locator('#restart').click();await play();await page.waitForFunction(()=>__gameMakerLab.snapshot().player.state.body.grounded);await page.locator('[data-game-action="jump"]').scrollIntoViewIfNeeded();await page.locator('[data-game-action="jump"]').tap();await page.waitForFunction(()=>__gameMakerLab.snapshot().player.state.body.vy>0);await page.locator('#pause').click();
    const idle=(await snapshot()).player.draws;await page.waitForTimeout(150);assert.equal((await snapshot()).player.draws,idle,'paused player does not continuously draw');
    await workerReady(page,base);await context.setOffline(true);const offline=await context.newPage(),response=await offline.goto(base+'demos/game-maker-lab/index.html');assert.equal(response.fromServiceWorker(),true);await offline.waitForFunction(()=>document.documentElement.dataset.labReady==='game-maker-lab');await offline.locator('#seed').fill('333');await offline.locator('#generate').click();assert.equal(await offline.evaluate(()=>JSON.parse(__gameMakerLab.snapshot().project).playerSprite.recipe.seed),333);const offlineDownload=offline.waitForEvent('download');await offline.locator('#export-game').click();const offlineFiles=unzipStored(await readFile(await (await offlineDownload).path()));assert.equal(parseProject(offlineFiles.get('project.json').toString()).playerSprite.recipe.seed,333,'portable game can be exported with networking disabled');assert.deepEqual(errors,[]);
  }finally{await context.close();}
  const failure=await browser.newContext(),broken=await failure.newPage();
  try{await broken.addInitScript(()=>HTMLCanvasElement.prototype.getContext=()=>null);await broken.goto(base+'demos/game-maker-lab/index.html');await broken.waitForFunction(()=>document.documentElement.dataset.labReady==='game-maker-lab');assert.equal(await broken.locator('#graphics-fallback').isVisible(),true);assert.equal(await broken.locator('#play').isDisabled(),true);await broken.locator('#project-name').fill('Data survives');await broken.locator('#apply-name').click();assert.equal(await broken.evaluate(()=>JSON.parse(__gameMakerLab.snapshot().project).name),'Data survives');}
  finally{await failure.close();}
  console.log('Game Maker: original game win/lose, empty-stage authoring, sprite/palette/layer/collision edits, real input/cancellation, native pixels, export package gameplay and nested offline reload, strict rejection, keyboard/touch/narrow layout, Canvas fallback and scoped integrity rejection PASS');
}
