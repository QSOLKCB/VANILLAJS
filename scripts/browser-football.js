// SPDX-License-Identifier: Apache-2.0
// Real packaged Chromium flow. No test-only app hooks or predetermined goals.
import assert from 'node:assert/strict';
export async function checkFootball(browser,base){
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+'demos/football-manager/index.html');await page.waitForFunction(()=>document.documentElement.dataset.labReady==='football-manager');
  assert.equal(await page.locator('.club-card').count(),8);await page.screenshot({path:'browser-artifacts/football-clubs.png'});
  await page.getByRole('button',{name:'Manage SOLAR ATHLETIC',exact:true}).click();
  await page.locator('[data-tab="tactics"]').click();await page.locator('#formation').selectOption('four-three-three');await page.locator('#training-focus').selectOption('attack');await page.locator('#training-load').selectOption('2');
  await page.locator('[data-tab="squad"]').click();await page.getByRole('button',{name:'Assistant: pick a fit XI'}).click();
  await page.locator('[data-tab="scouting"]').click();await page.getByRole('button',{name:'Sign Sage Quinn',exact:true}).click();assert.match(await page.locator('#summary').textContent(),/Club balance/);
  await page.locator('[data-tab="overview"]').click();await page.screenshot({path:'browser-artifacts/football-clubhouse.png'});
  // Keep a pristine career to verify an abandoned match never advances it.
  const before=await page.evaluate(()=>localStorage.getItem('vanillajs.touchline.v1'));
  await page.locator('#play-match').click();await page.waitForFunction(()=>Number(document.documentElement.dataset.matchTick)>100);
  await page.locator('#pause').click();const tick=await page.getAttribute('html','data-match-tick');await page.waitForTimeout(250);assert.equal(await page.getAttribute('html','data-match-tick'),tick);
  await page.locator('#live-plan').selectOption('chase');await page.getByRole('button',{name:'Apply instructions',exact:true}).click();
  await page.locator('#sub-out').selectOption('1');const reserve=await page.locator('#sub-in option').evaluateAll(options=>options.find(o=>o.textContent.endsWith(' · DF'))?.value);assert.ok(reserve,'a fit reserve defender is available');await page.locator('#sub-in').selectOption(reserve);await page.locator('#substitute').click();assert.match(await page.locator('#substitute').textContent(),/1\/3/);
  await page.screenshot({path:'browser-artifacts/football-live.png'});
  const partialDownload=page.waitForEvent('download');await page.locator('#replay-export').click();const partial=await partialDownload;const partialPath=await partial.path();
  await page.locator('#leave-match').click();assert.equal(await page.evaluate(()=>localStorage.getItem('vanillajs.touchline.v1')),before);
  await page.locator('#file-input').setInputFiles(partialPath);await page.waitForSelector('#match-room:not([hidden])');await page.locator('#speed').selectOption('8');await page.waitForFunction(()=>document.querySelector('#match-status').textContent.includes('before full time'),{},{timeout:15000});
  assert.equal(await page.evaluate(()=>localStorage.getItem('vanillajs.touchline.v1')),before);await page.locator('#leave-match').click();
  await page.locator('#play-match').click();await page.locator('#speed').selectOption('8');
  await page.waitForFunction(()=>document.querySelector('#match-status').textContent.startsWith('Half time'),{},{timeout:25000});await page.locator('#pause').click();
  await page.waitForFunction(()=>document.documentElement.dataset.roundSettled==='true',{},{timeout:30000});assert.match(await page.locator('#match-status').textContent(),/Round complete/);
  await page.screenshot({path:'browser-artifacts/football-fulltime.png'});await page.locator('#leave-match').click();assert.equal(await page.getAttribute('html','data-career-round'),'1');
  await page.locator('[data-tab="league"]').click();assert.equal(await page.locator('#department table').first().locator('tbody tr').count(),8);
  // Reload exercises validated local persistence, including the full replay.
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.labReady==='football-manager');await page.locator('#resume').click();assert.equal(await page.getAttribute('html','data-career-round'),'1');
  // A bad mod cannot alter the career. Valid content opens new-career selection.
  await page.locator('[data-tab="workshop"]').click();const original=await page.locator('#mod-source').inputValue();await page.locator('#mod-source').fill('{"kind":"invalid","packs":[]}');await page.getByRole('button',{name:'Validate pack',exact:true}).click();assert.match(await page.locator('#notice').textContent(),/Unsupported/);
  await page.locator('#mod-source').fill(original);await page.getByRole('button',{name:'Validate pack',exact:true}).click();assert.match(await page.locator('#notice').textContent(),/Valid: 8 clubs/);
  await page.setViewportSize({width:390,height:844});await page.locator('[data-tab="overview"]').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'manager mobile layout overflows');await page.screenshot({path:'browser-artifacts/football-mobile.png'});
  // First install must finish, then a fresh offline navigation uses packaged bytes.
  await page.waitForFunction(()=>document.documentElement.dataset.offlineWorker==='registered');await page.evaluate(async()=>{await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('football offline install timeout')),20000))]);});await page.reload();assert.equal(await page.evaluate(()=>Boolean(navigator.serviceWorker.controller)),true);await context.setOffline(true);await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.labReady==='football-manager');await page.locator('#resume').click();assert.equal(await page.getAttribute('html','data-career-round'),'1');await context.setOffline(false);
  assert.deepEqual(errors,[]);console.log('Chromium Touchline: management, live commands, partial replay, abandoned match, full round, save/reload, mod validation, mobile and offline passed.');
 }catch(error){await page.screenshot({path:'browser-artifacts/football-failure.png',fullPage:true}).catch(()=>{});console.error('Football failure state',await page.evaluate(()=>({notice:document.querySelector('#notice')?.textContent,status:document.querySelector('#match-status')?.textContent,dataset:{...document.documentElement.dataset}})).catch(()=>({})));throw error;}finally{await context.close();}
}
