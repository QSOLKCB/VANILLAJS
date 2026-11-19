// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {verifyDreamline} from './browser-dreamline.js';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {machineRemembers} from '../demos/demoscene-lab/preset.js';
import {verifyDemosceneWorkbench} from './browser-demoscene-workbench.js';
import {checkEditorStartup} from './editor-startup-check.mjs';
import {checkDemosceneUpgrade} from './demoscene-upgrade-check.mjs';
import {createServer} from 'node:http';
import {portableDemo} from './demoscene-package.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function verifyDemoscene(browser,base){
  await verifyDreamline(browser,base);
  const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage(),errors=[],external=[];
  page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(new URL(base).origin)&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});
  const wait=()=>page.waitForFunction(()=>document.documentElement.dataset.labReady==='demoscene');
  const download=async id=>{const event=page.waitForEvent('download');await page.locator('#'+id).click();return readFile(await (await event).path());};
  const seek=sample=>page.evaluate(s=>__demoscene.seek(s),sample);
  try{
    await page.goto(base+'demos/demoscene-lab/index.html');await wait();await mkdir('browser-artifacts',{recursive:true});await page.screenshot({path:'browser-artifacts/demoscene-ready.png',fullPage:true});
    await page.locator('#start').click();await page.waitForFunction(()=>__demoscene.snapshot().sample>4800);await page.locator('#toggle').click();const paused=await page.evaluate(()=>__demoscene.snapshot().sample);await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>__demoscene.snapshot().sample),paused);
    const witnesses=[];
    for(const seconds of [4,18,30,42,55,60]){
      await seek(seconds*48000);const witness=await page.evaluate(sample=>{const p=__demoscene.player,r=p.draw(sample,{forceFresh:true}),gl=p.renderer.gl,pixels=new Uint8Array(p.canvas.width*p.canvas.height*4);gl.readPixels(0,0,p.canvas.width,p.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let bright=0,hash=2166136261;for(let i=0;i<pixels.length;i++){hash=Math.imul(hash^pixels[i],16777619);if(i%4===0&&pixels[i]+pixels[i+1]+pixels[i+2]>60)bright++;}return {sample,bright,pixelHash:hash,commands:JSON.stringify(r.commands),vertices:r.geometry.counts};},seconds*48000);
      assert.ok(seconds===60?witness.bright===0:witness.bright>200,'visible act / clean black ending '+seconds);witness.commandSha256=hash(witness.commands);delete witness.commands;witnesses.push(witness);
      await page.screenshot({path:`browser-artifacts/demoscene-${seconds}s.png`,fullPage:true});
    }
    assert.equal(new Set(witnesses.map(w=>w.commandSha256)).size,6);assert.equal(new Set(witnesses.map(w=>w.pixelHash)).size,6);await writeFile('browser-artifacts/demoscene-visual-witness.json',JSON.stringify(witnesses,null,2));
    await seek(2016000);const standard=await page.evaluate(()=>JSON.stringify(__demoscene.player.frame.commands));await page.locator('#quality').selectOption('low');await page.waitForFunction(()=>__demoscene.player.frame.quality==='low');assert.equal(await page.evaluate(()=>JSON.stringify(__demoscene.player.frame.commands)),standard);await page.locator('#quality').selectOption('standard');
    const project=await download('project-export');const wav=await download('wav-export');assert.equal(hash(wav),hash(machineRemembers().audio.wav()));const receipt=JSON.parse(await download('evidence-export'));assert.equal(receipt.wavSha256,hash(wav));assert.equal(receipt.projectSha256,hash(project));
    await page.locator('#toggle').click();const starts=await page.evaluate(()=>__demoscene.snapshot().starts),bytes=await page.evaluate(()=>__demoscene.snapshot().project);
    await page.locator('#project-import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Retry'));assert.equal(await page.evaluate(()=>__demoscene.snapshot().project),bytes);assert.equal(await page.evaluate(()=>__demoscene.snapshot().playing),true);assert.equal(await page.evaluate(()=>__demoscene.snapshot().starts),starts);
    await page.locator('#restart').click();await page.waitForFunction(s=>__demoscene.snapshot().starts>s,starts);assert.ok(await page.evaluate(()=>__demoscene.snapshot().stops>0));await page.locator('#mute').click();assert.equal(await page.locator('#mute').getAttribute('aria-pressed'),'true');
    await page.locator('#fullscreen').click();await page.waitForFunction(()=>!!document.fullscreenElement);await page.locator('#exit-fullscreen').click();await page.waitForFunction(()=>!document.fullscreenElement);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});assert.equal(await page.evaluate(()=>__demoscene.snapshot().playing),false);
    await page.locator('#project-import').setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:project});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Validated project'));assert.equal(await page.evaluate(()=>__demoscene.snapshot().project),bytes);
    assert.equal(await page.evaluate(()=>__demoscene.player.transport.muted),true,'valid import must preserve mute');assert.equal(await page.locator('#mute').getAttribute('aria-pressed'),'true');await page.locator('#toggle').click();await page.waitForFunction(()=>__demoscene.snapshot().playing);assert.equal(await page.evaluate(()=>__demoscene.player.transport.gain.gain.value),0);await page.locator('#toggle').click();
    // Playwright normally disables BFCache. Exercise the persisted lifecycle
    // explicitly; do not label this controlled event fixture a native cache hit.
    await seek(864000);await page.locator('#toggle').click();await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));assert.equal(await page.evaluate(()=>__demoscene.snapshot().playing),false);
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Restored from browser history'));await seek(1440000);await page.waitForFunction(()=>document.querySelector('#act-name').textContent==='GEOMETRY UNLEASHED');await page.locator('#toggle').click();await page.waitForFunction(()=>__demoscene.snapshot().sample>1444800);await page.locator('#toggle').click();
    await page.setViewportSize({width:375,height:850});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile horizontal overflow');await page.screenshot({path:'browser-artifacts/demoscene-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1100});
    const fx=await verifyDemosceneWorkbench(page,base);
    await page.goto(base+'demos/demoscene-lab/index.html');await wait();await page.locator('#project-import').setInputFiles({name:'fx.json',mimeType:'application/json',buffer:fx});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Validated project'));assert.equal(await page.evaluate(()=>__demoscene.snapshot().project),fx.toString());
    await page.goto(base+'demos/demoscene-lab/intro.html');await page.locator('#enabled').uncheck();await page.locator('#launch').click();await page.locator('#menu').waitFor({state:'visible'});await page.reload();await page.locator('#launch').click();await page.locator('#skip').click();await page.locator('#menu').waitFor({state:'visible'});
    await page.goto(base+'demos/demoscene-lab/index.html');await wait();
    await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await wait();await page.locator('#start').click();await page.waitForFunction(()=>__demoscene.snapshot().sample>4800);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    console.log('Demoscene: six visual states, full WAV hash, sample seek, audio cancellation, fullscreen, mobile, real Workbench roundtrip and offline playback PASS');
  }catch(error){await page.screenshot({path:'browser-artifacts/demoscene-failed.png',fullPage:true}).catch(()=>{});console.error('Demoscene browser failure',errors,await page.locator('#status').textContent().catch(()=>''));throw error;}finally{await context.close();}
  await checkDemosceneUpgrade(browser,base);
  await checkEditorStartup(browser,base);
  await checkPortableDemo(browser);
}
async function checkPortableDemo(browser){
  const {files}=await portableDemo(machineRemembers(1984)),server=createServer((req,res)=>{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html',bytes=files.get(path);if(!bytes){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':path.endsWith('.html')?'text/html':'application/json');res.end(bytes);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`,context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{await page.goto(base);await page.waitForFunction(()=>document.documentElement.dataset.labReady==='demoscene');assert.equal(await page.evaluate(()=>__demoscene.player.project.settings.seed),1984);await page.locator('#start').click();await page.waitForFunction(()=>__demoscene.snapshot().sample>4800);await page.locator('#toggle').click();await page.goto(base+'demos/demoscene-lab/intro.html');await page.locator('#enabled').uncheck();await page.locator('#launch').click();await page.locator('#menu').waitFor({state:'visible'});assert.deepEqual(errors,[]);}finally{await context.close();await new Promise(r=>server.close(r));}
  console.log('Demoscene portable generator: embedded validated seed, complete native runtime, playback and intro example PASS');
}
