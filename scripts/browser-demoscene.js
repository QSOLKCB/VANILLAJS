// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {machineRemembers} from '../demos/demoscene-lab/preset.js';
import {checkDemosceneUpgrade} from './demoscene-upgrade-check.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function verifyDemoscene(browser,base){
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
    await page.locator('#fullscreen').click();await page.waitForFunction(()=>!!document.fullscreenElement);await page.evaluate(()=>document.exitFullscreen());await page.waitForFunction(()=>!document.fullscreenElement);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});assert.equal(await page.evaluate(()=>__demoscene.snapshot().playing),false);
    await page.locator('#project-import').setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:project});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Validated project'));assert.equal(await page.evaluate(()=>__demoscene.snapshot().project),bytes);
    await page.setViewportSize({width:375,height:850});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile horizontal overflow');await page.screenshot({path:'browser-artifacts/demoscene-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1100});
    // Real Workbench selection -> composition -> keyframe -> undo -> reimport.
    await page.goto(base+'demos/editor/index.html#visual-fx');await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='ready');await page.locator('#fx-add').click();await page.waitForFunction(()=>JSON.parse(__editorDemoscene).manifest.entries.some(e=>e.id.startsWith('node-')));const captured=await page.evaluate(()=>__editorDemoscene);
    await page.locator('#fx-effect').selectOption('radial');await page.locator('#fx-copies').fill('8');await page.locator('#fx-effect-apply').click();await page.locator('#fx-time').fill('18');await page.locator('#fx-key').click();await page.locator('#fx-preview-seek').click();assert.ok(!(await page.locator('#fx-status').textContent()).startsWith('Rejected'));await page.screenshot({path:'browser-artifacts/demoscene-workbench.png',fullPage:true});
    const fx=await download('fx-export');await page.locator('#fx-undo').click();await page.locator('#fx-redo').click();assert.equal(await page.evaluate(()=>__editorDemoscene),fx.toString());await page.locator('#fx-import').setInputFiles({name:'fx.json',mimeType:'application/json',buffer:fx});assert.notEqual(fx.toString(),captured);
    await page.goto(base+'demos/demoscene-lab/index.html');await wait();await page.locator('#project-import').setInputFiles({name:'fx.json',mimeType:'application/json',buffer:fx});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Validated project'));assert.equal(await page.evaluate(()=>__demoscene.snapshot().project),fx.toString());
    await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await wait();await page.locator('#start').click();await page.waitForFunction(()=>__demoscene.snapshot().sample>4800);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    console.log('Demoscene: six visual states, full WAV hash, sample seek, audio cancellation, fullscreen, mobile, real Workbench roundtrip and offline playback PASS');
  }catch(error){await page.screenshot({path:'browser-artifacts/demoscene-failed.png',fullPage:true}).catch(()=>{});console.error('Demoscene browser failure',errors,await page.locator('#status').textContent().catch(()=>''));throw error;}finally{await context.close();}
  await checkDemosceneUpgrade(browser,base);
}
