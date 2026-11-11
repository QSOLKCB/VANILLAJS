// SPDX-License-Identifier: Apache-2.0
// Exercise the distributed game through real controls; no application test hooks.
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
async function replay(page){
  const pending=page.waitForEvent('download');await page.locator('#export-replay').click();
  const item=await pending;assert.equal(await item.failure(),null);
  return JSON.parse(await readFile(await item.path(),'utf8'));
}
async function importReplay(page,data){
  const buffer=Buffer.isBuffer(data)?data:Buffer.from(JSON.stringify(data));
  await page.locator('#import-replay').setInputFiles({name:'sector.json',mimeType:'application/json',buffer});
}
export async function verify4XLab(browser,base){
  await mkdir('browser-artifacts',{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:1080}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(base+'demos/4x-game-lab/index.html');
    await page.waitForFunction(()=>document.getElementById('turn')?.textContent==='1');
    assert.equal(await page.locator('.star').count(),16);
    assert.equal(await page.locator('#colonies').textContent(),'1');
    const initial=await replay(page);assert.equal(initial.seed,731);assert.deepEqual(initial.commands,[]);
    // Selection prepares an order; keyboard activation commits it.
    await page.locator('.star[data-system="1"]').focus();await page.keyboard.press('Enter');
    assert.deepEqual(await replay(page),initial);
    await page.locator('#survey').focus();await page.keyboard.press('Enter');
    await page.locator('#colonize').click();
    assert.equal(await page.locator('#colonies').textContent(),'2');
    await page.locator('#system-select').selectOption('0');await page.locator('#build').click();
    assert.equal(await page.locator('#actions').textContent().then(s=>s.includes('0')),true);
    assert.equal(await page.locator('#mine').isDisabled(),true);
    await page.locator('#end-turn').click();assert.equal(await page.locator('#turn').textContent(),'2');
    await page.locator('#mine').click();assert.equal(await page.locator('#mine').isDisabled(),true);
    await page.locator('#end-turn').click();
    await page.locator('#system-select').selectOption('1');await page.locator('#fleet-source').selectOption('0');
    await page.locator('#fleet-ships').fill('1');await page.locator('#send').click();
    await page.locator('#lab').click();await page.locator('#end-turn').click();
    await page.locator('#research-field').selectOption('industry');await page.locator('#research-button').click();
    const saved=await replay(page);
    assert.deepEqual(saved.commands.map(c=>c.type),['survey','colonize','build','endTurn','mine','endTurn','send','lab','endTurn','research']);
    assert.equal(await page.locator('#turn').textContent(),'4');
    const ore=await page.locator('#ore').textContent(),science=await page.locator('#science').textContent();
    // Reset and reconstruct accepted commands, rather than trust serialized state.
    await page.locator('#new-game').click();assert.equal(await page.locator('#turn').textContent(),'1');
    await importReplay(page,saved);
    await page.waitForFunction(()=>document.getElementById('turn').textContent==='4');
    assert.deepEqual(await replay(page),saved);
    assert.equal(await page.locator('#ore').textContent(),ore);assert.equal(await page.locator('#science').textContent(),science);
    for(const data of [Buffer.from('{broken'),{...saved,script:'rejected'}, {...saved,commands:[{type:'send',from:0,to:15,count:999999}]},Buffer.alloc(131073,32)]){
      await importReplay(page,data);
      await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('REJECTED'));
      assert.deepEqual(await replay(page),saved,'invalid import must preserve the accepted game');
    }
    // Seed zero is valid; fractional seeds do not replace a run.
    await page.locator('#seed').fill('0');await page.locator('#new-game').click();
    assert.equal((await replay(page)).seed,0);
    await page.locator('#seed').fill('1.5');await page.locator('#new-game').click();
    assert.equal((await replay(page)).seed,0);
    await importReplay(page,saved);await page.waitForFunction(()=>document.getElementById('turn').textContent==='4');
    await page.screenshot({path:'browser-artifacts/4x-desktop.png',fullPage:true});
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'4X overflow at '+width);
      await page.locator('.star[data-system="1"]').click();
      assert.equal(await page.locator('.star[data-system="1"]').getAttribute('aria-pressed'),'true');
      await page.screenshot({path:`browser-artifacts/4x-${width}.png`,fullPage:true});
    }
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await context.setOffline(true);await page.reload();
    await page.waitForFunction(()=>document.getElementById('turn')?.textContent==='1');
    await importReplay(page,saved);await page.waitForFunction(()=>document.getElementById('turn').textContent==='4');
    assert.deepEqual(await replay(page),saved);
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
  // Touch-sized controls work without Canvas/WebGL/WebGPU or an animation loop.
  const touch=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await touch.newPage();
  const failures=[];p.on('pageerror',e=>failures.push(e.message));
  try{
    await p.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;});
    await p.goto(base+'demos/4x-game-lab/index.html');
    await p.waitForFunction(()=>document.getElementById('turn')?.textContent==='1');
    await p.locator('.star[data-system="1"]').tap();await p.locator('#survey').tap();await p.locator('#colonize').tap();
    assert.equal(await p.locator('#colonies').textContent(),'2');
    await p.evaluate(()=>window.dispatchEvent(new Event('blur')));
    assert.equal(await p.locator('#turn').textContent(),'1','turn-based game never advances on focus changes');
    assert.deepEqual(failures,[]);
  }finally{await touch.close();}
  console.log('4X Game Lab: packaged keyboard/touch exploration, colony, economy, research, fleet orders, atomic replay import, seed bounds, 320/390px and offline reconstruction passed.');
}
