// SPDX-License-Identifier: Apache-2.0
// Packaged Chromium checks through public controls/imports; no simulation setter.
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {starterPack} from '../demos/arcade-combat-lab/packs.js';
import {checkArcadeUpgrade} from './arcade-upgrade-check.mjs';
const fixture=()=>{
  const p=starterPack(),c=p.entries.find(e=>e.id==='combat').data;
  c.actors[0].health=3000;c.actors[1].health=1;
  for(const mode of ['run','arena']){
    const s=p.entries.find(e=>e.id===mode).data;s.solids=[];s.platforms=[];s.pickups=[];
    s.spawn={x:1000,y:400};s.exit={x:1000,y:400};
    s.encounters=Array.from({length:3},()=>({trigger:0,spawns:[{actor:'scout',x:1400,y:400}]}));
  }return p;
};
export async function verifyArcadeCombat(browser,baseURL) {
  const context=await browser.newContext({viewport:{width:1280,height:1000},hasTouch:true});
  const page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!r.url().startsWith(new URL(baseURL).origin)&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});
  page.setDefaultTimeout(20000);
  const snapshot=()=>page.evaluate(()=>window.arcadeFoundry.snapshot());
  const importPack=async pack=>{
    await page.locator('.workshop').evaluate(e=>e.open=true);
    await page.locator('#import-pack').setInputFiles({name:'pack.json',mimeType:'application/json',buffer:Buffer.from(typeof pack==='string'?pack:JSON.stringify(pack))});
    await page.waitForFunction(()=>document.querySelector('#pack-note').textContent.startsWith('Accepted'));
  };
  const download=async id=>{const pending=page.waitForEvent('download');await page.locator(id).click();return readFile(await (await pending).path(),'utf8');};
  try {
    await page.goto(baseURL+'demos/arcade-combat-lab/index.html');
    await page.waitForFunction(()=>document.documentElement.dataset.labReady==='arcade-combat');
    assert.equal(await page.locator('#status').textContent(),'READY');
    const pixels=await page.locator('#scene').evaluate(c=>{const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<data.length;i+=4)if(data[i]+data[i+1]+data[i+2]>180)n++;return n;});
    assert.ok(pixels>15000,'original stage and sprites must be visible');
    await mkdir('browser-artifacts',{recursive:true});await page.screenshot({path:'browser-artifacts/arcade-combat-desktop.png',fullPage:true});
    await page.locator('#run').click();await page.keyboard.down('d');await page.waitForFunction(()=>window.arcadeFoundry.snapshot().combat.actors[0].x>1200);
    await page.keyboard.up('d');await page.keyboard.press('Space');await page.waitForFunction(()=>window.arcadeFoundry.snapshot().combat.actors[0].y>700);
    await page.keyboard.down('j');await page.waitForFunction(()=>window.arcadeFoundry.snapshot().combat.nextProjectile>2);await page.keyboard.up('j');
    await page.keyboard.press('Escape');const stopped=await snapshot();await page.waitForTimeout(150);assert.deepEqual(await snapshot(),stopped);
    // Repeat suppression across a physical held-key pause/resume boundary.
    await page.locator('#run').click();await page.keyboard.down('d');await page.waitForTimeout(120);await page.keyboard.press('Escape');
    await page.locator('#run').click();await page.keyboard.down('d');await page.waitForTimeout(250);const coast=(await snapshot()).combat.actors[0].x;
    await page.waitForTimeout(180);assert.equal((await snapshot()).combat.actors[0].x,coast);await page.keyboard.up('d');
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.locator('#status').textContent(),'PAUSED');
    await page.locator('#restart').click();assert.equal((await snapshot()).tick,0);
    // Native standard-gamepad adapter: neutral arming, input and disconnect pause.
    await page.evaluate(()=>{window.testPad={index:0,id:'test-standard',mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({value:0,pressed:false}))};navigator.getGamepads=()=>[window.testPad];});
    await page.locator('#run').click();await page.waitForFunction(()=>window.arcadeFoundry.snapshot().tick>=4);await page.evaluate(()=>window.testPad.axes[0]=1);
    await page.waitForFunction(()=>window.arcadeFoundry.snapshot().combat.actors[0].x>1000);
    await page.evaluate(()=>window.testPad.connected=false);await page.waitForFunction(()=>document.querySelector('#status').textContent==='PAUSED');
    for(const mode of ['run','arena']) {
      await page.locator('[data-mode="'+mode+'"]').click();await importPack(fixture());
      await page.locator('#run').click();await page.keyboard.down(mode==='run'?'j':'k');
      await page.waitForFunction(()=>window.arcadeFoundry.snapshot().score>0);
      const damaged=await snapshot();assert.ok(damaged.combat.actors.some(a=>a.team===1&&a.health===0));
      await page.waitForFunction(()=>window.arcadeFoundry.snapshot().status==='complete');await page.keyboard.up(mode==='run'?'j':'k');
      assert.equal((await snapshot()).cleared,3);assert.equal((await snapshot()).score,450);
      await page.screenshot({path:'browser-artifacts/arcade-combat-'+mode+'-complete.png',fullPage:true});
      const replay=await download('#export-replay'),saved=await download('#export-snapshot');
      const prior=await snapshot();await page.locator('#restart').click();
      await page.locator('#import-replay').setInputFiles({name:'replay.json',mimeType:'application/json',buffer:Buffer.from(replay)});
      await page.waitForFunction(()=>document.querySelector('#replay-message').textContent.startsWith('Restored'));assert.deepEqual(await snapshot(),prior);
      await page.locator('#import-replay').setInputFiles({name:'snapshot.json',mimeType:'application/json',buffer:Buffer.from(saved)});
      await page.waitForTimeout(80);assert.deepEqual(await snapshot(),prior);
      const bad=JSON.parse(saved);bad.state.score++;
      await page.locator('#import-replay').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});
      await page.waitForFunction(()=>document.querySelector('#replay-message').textContent.startsWith('Rejected'));assert.deepEqual(await snapshot(),prior);
      const defeat=fixture(),c=defeat.entries.find(e=>e.id==='combat').data;c.actors[0].health=1;c.actors[1].health=100;
      await importPack(defeat);await page.locator('#run').click();await page.waitForFunction(()=>window.arcadeFoundry.snapshot().status==='game-over');
      assert.equal((await snapshot()).combat.actors[0].health,0);
    }
    await importPack(starterPack('neon'));const packText=await download('#export-pack');await importPack(packText);
    const before=await snapshot(),bytes=await page.evaluate(()=>window.arcadeFoundry.pack());
    for(const invalid of ['{"kind":"unsupported"}',' '.repeat(32769)]){
      await page.locator('#import-pack').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(invalid)});
      await page.waitForFunction(()=>document.querySelector('#pack-note').textContent.startsWith('Rejected'));assert.deepEqual(await snapshot(),before);assert.equal(await page.evaluate(()=>window.arcadeFoundry.pack()),bytes);
    }
    await page.locator('#edit-health').fill('150');await page.locator('#edit-health').dispatchEvent('change');await page.locator('#apply-pack').click();
    assert.equal((await snapshot()).combat.actors[0].health,150);
    // Real touch events, including cancellation, at a narrow viewport.
    await page.setViewportSize({width:320,height:800});await page.locator('.workshop').evaluate(e=>e.open=false);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'320px layout overflow');
    await page.locator('#run').click();await page.locator('[data-input="2"]').scrollIntoViewIfNeeded();
    const rect=await page.locator('[data-input="2"]').boundingBox(),cdp=await context.newCDPSession(page);
    const x=(await snapshot()).combat.actors[0].x;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width/2,y:rect.y+rect.height/2}]});
    await page.waitForFunction(x=>window.arcadeFoundry.snapshot().combat.actors[0].x>x+100,x);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.waitForTimeout(100);
    const released=(await snapshot()).combat.actors[0].x;await page.waitForTimeout(150);assert.equal((await snapshot()).combat.actors[0].x,released);
    await page.keyboard.press('Escape');await page.screenshot({path:'browser-artifacts/arcade-combat-mobile.png',fullPage:true});
    await page.setViewportSize({width:1280,height:1000});
    await page.locator('#sound').click();await page.locator('#run').click();
    await page.waitForFunction(()=>window.arcadeFoundry.audioStats()?.voices>0);await page.locator('#pause').click();
    assert.equal(await page.evaluate(()=>window.arcadeFoundry.audioStats().voices),0);
    const stats=await page.evaluate(()=>window.arcadeFoundry.renderStats());assert.ok(stats.hits>stats.builds);
    // The entire packaged dependency graph is served from the installed worker.
    await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
    await page.reload(); // Existing worker deliberately claims only new navigations.
    await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
    await context.setOffline(true);await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.labReady==='arcade-combat');
    await page.locator('[data-mode="arena"]').click();await page.locator('#run').click();await page.waitForFunction(()=>window.arcadeFoundry.snapshot().tick>5);
    await page.locator('#pause').click();assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    console.log('Arcade Combat Foundry: both modes, keyboard/jump/projectiles, actual damage, three completed encounters, defeat, pack authoring/export/reimport/rejection, exact replay/snapshot restoration, gamepad lifecycle, real touch cancellation, 320px layout, procedural audio stop, retained geometry and offline worker reload passed.');
  }catch(error){console.error('Arcade browser failure context:',await page.evaluate(()=>({status:document.querySelector('#status')?.textContent,packNote:document.querySelector('#pack-note')?.textContent,snapshot:window.arcadeFoundry?.snapshot()})),errors);throw error;}
  finally {await context.close();}
  await checkArcadeUpgrade(browser,baseURL);
}
