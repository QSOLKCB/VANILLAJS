// SPDX-License-Identifier: Apache-2.0
// Actual packaged browser interactions; no executable hooks added to the app.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
async function download(page,id){
  const pending=page.waitForEvent('download');await page.locator('#'+id).click();
  const item=await pending;assert.equal(await item.failure(),null);
  return readFile(await item.path());
}
const eventLog=async page=>JSON.parse(await download(page,'events'));
async function sequence(page){
  for(const op of ['pulse-0','pulse-1','shear','swap']){
    await page.locator('#operation').selectOption(op);await page.locator('#step').click();
  }
}
async function ready(page,base){
  await page.goto(base+'demos/quantum-game-lab/index.html');
  await page.waitForFunction(()=>document.getElementById('pack-status')?.textContent.startsWith('PASS'));
}
export async function verifyQuantumGameLab(browser,base){
  await mkdir('browser-artifacts',{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await ready(page,base);
    assert.equal(await page.locator('#state').textContent(),'0 0');
    const initial=JSON.parse(await page.locator('#manifest').inputValue());
    // Keyboard-operable native controls, including manual transitions.
    await page.locator('#step').focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#tick').textContent(),'1 / 32');
    await page.locator('#reset').click();await sequence(page);
    const canonical=await eventLog(page);
    assert.equal(canonical.events.length,4);
    assert.equal(canonical.events[3].id,'4:swap:21>12');
    const wav=await download(page,'wav');assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.length,96044);
    const receipt=JSON.parse(await download(page,'receipt'));
    assert.deepEqual(receipt.events,canonical.events);
    assert.equal(receipt.implementation.kind,'observed-asset-sha256');
    const bytes=await readFile('dist/modules/gf3/index.js');
    assert.equal(receipt.implementation.hashes['modules/gf3/index.js'],hash(bytes));
    const pack=await download(page,'export');
    await page.locator('#import').setInputFiles({name:'experiment.json',mimeType:'application/json',buffer:pack});
    await page.waitForFunction(()=>document.getElementById('tick').textContent==='0 / 32');
    assert.equal(await page.locator('#tick').textContent(),'0 / 32');
    assert.deepEqual(JSON.parse(await page.locator('#manifest').inputValue()),initial);
    await page.locator('#renderer').selectOption('table');await sequence(page);
    assert.deepEqual((await eventLog(page)).events,canonical.events,'render backend must not change event identities');
    assert.equal(await page.locator('#sky').isVisible(),false);
    await page.locator('#renderer').selectOption('canvas');
    // Invalid imports preserve the previous run and cannot start a new one.
    for(const buffer of [Buffer.from('{broken'),Buffer.from(JSON.stringify({...initial,script:'evil'})),Buffer.alloc(32769,32)]){
      await page.locator('#import').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer});
      await page.waitForFunction(()=>document.getElementById('pack-status').textContent.startsWith('REJECTED'));
      assert.equal(await page.locator('#step').isDisabled(),true);
      assert.equal(await page.locator('#export').isDisabled(),true);
      assert.deepEqual((await eventLog(page)).events,canonical.events);
    }
    await page.locator('#restore').click();
    await page.locator('#play').click();
    await page.waitForFunction(()=>document.getElementById('tick').textContent!=='0 / 32');
    await page.locator('#play').click();
    const stopped=await page.locator('#tick').textContent();
    await page.waitForTimeout(650);assert.equal(await page.locator('#tick').textContent(),stopped);
    await page.locator('#play').click();await page.waitForTimeout(60);
    assert.equal(await page.locator('#tick').textContent(),stopped,'resume must not consume suspended time');
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    assert.equal(await page.locator('#play').textContent(),'Play');
    const blurred=await page.locator('#tick').textContent();await page.waitForTimeout(300);assert.equal(await page.locator('#tick').textContent(),blurred);
    for(const dimension of ['3','4','2']){
      await page.locator('#dimension').selectOption(dimension);await page.locator('#step').click();
      assert.equal(await page.locator('#initial select').count(),Number(dimension));
      assert.match(await page.locator('#graph-status').textContent(),new RegExp('^'+3**Number(dimension)+' states'));
    }
    await page.screenshot({path:'browser-artifacts/qgame-desktop.png',fullPage:true});
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'QGAME layout overflow at '+width);
      await page.screenshot({path:`browser-artifacts/qgame-${width}.png`,fullPage:true});
    }
    assert.deepEqual(errors,[]);
    // Actual offline packaged execution after the existing integrity worker is ready.
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await context.setOffline(true);await page.reload();
    await page.waitForFunction(()=>document.getElementById('pack-status')?.textContent.startsWith('PASS'));
    await sequence(page);assert.deepEqual((await eventLog(page)).events,canonical.events);
    const offlineReceipt=JSON.parse(await download(page,'receipt'));
    assert.equal(offlineReceipt.implementation.kind,'observed-asset-sha256');
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
  // Missing graphics/audio and suspended audio are independent of state authority.
  for(const mode of ['absent','suspended','running']){
    const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await c.newPage(),failures=[];
    p.on('pageerror',e=>failures.push(e.message));
    try{
      await p.addInitScript(mode=>{
        HTMLCanvasElement.prototype.getContext=()=>null;
        Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});
        if(mode==='absent'){globalThis.AudioContext=undefined;globalThis.webkitAudioContext=undefined;}
        else globalThis.AudioContext=class{
          state=mode;destination={};resume(){return Promise.resolve();}
          createBuffer(_,length){return {getChannelData:()=>new Float32Array(length)};}
          createBufferSource(){return {connect(){},start(){},stop(){}};}
        };
      },mode);
      await ready(p,base);await p.locator('#sound').check();await sequence(p);
      const result=await eventLog(p);
      assert.deepEqual(result.events,JSON.parse(await readFile('tests/fixtures/qgame-math-001.json','utf8')).events.slice(0,4));
      assert.equal(await p.locator('#bodies tr').count(),2);assert.equal(await p.locator('#sky').isVisible(),false);
      if(mode!=='running')assert.match(await p.locator('#audio-status').textContent(),/unavailable|suspended/);
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.deepEqual(failures,[]);
    }finally{await c.close();}
  }
  console.log('QGAME-MATH-001: packaged desktop/mobile, 320/390px, keyboard, exact events, PCM download, imports, pause, graphics/audio fallbacks and offline replay passed.');
}
