import assert from 'node:assert/strict';
export async function verifyFlow(browser,baseURL){
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],url=baseURL+'demos/rts-lab/index.html';page.on('pageerror',e=>errors.push(e.message));
  async function clickCell(x,z){await page.locator('#rts-view').scrollIntoViewIfNeeded();const b=await page.locator('#rts-view').boundingBox();await page.mouse.click(b.x+(x+.5)*b.width/24,b.y+(z+.5)*b.height/16);}
  await page.goto(url);await page.locator('#choose-flow').click();await page.locator('#field-budget').selectOption('1');await page.locator('#launch').click();
  await page.waitForFunction(()=>Number(document.querySelector('#field-expanded').textContent)>10);await page.keyboard.press('Escape');
  assert.equal(await page.locator('#field-state').textContent(),'BUILDING');const before=await page.locator('#field-expanded').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('#field-expanded').textContent(),before);
  // Replacing an incomplete destination cannot publish the old field later.
  await clickCell(21,9);assert.equal(await page.locator('#field-generation').textContent(),'2');assert.equal(await page.locator('#field-expanded').textContent(),'0');
  await clickCell(8,7);assert.equal(await page.locator('#field-generation').textContent(),'2');assert.match(await page.locator('#message').textContent(),/blocked/);
  await page.locator('#field-budget').selectOption('8');await page.locator('#toggle-gate').click();assert.equal(await page.locator('#field-state').textContent(),'BUILDING');assert.equal(await page.locator('#field-generation').textContent(),'3');
  await page.locator('#launch').click();await page.waitForFunction(()=>document.querySelector('#field-state').textContent==='READY');
  await page.screenshot({path:'browser-artifacts/rts-flow.png',fullPage:true});
  await page.waitForFunction(()=>document.querySelector('#arrived-count').textContent==='24 / 24');assert.equal(await page.locator('#selected-count').textContent(),'0 / 24');
  await page.locator('#reset').click();assert.equal(await page.locator('#field-expanded').textContent(),'0');assert.equal(await page.locator('#field-generation').textContent(),'1');
  await page.locator('#choose-evacuation').click();await page.locator('#toggle-exit').click();assert.equal(await page.locator('#field-generation').textContent(),'2');
  await page.locator('#launch').click();await page.waitForFunction(()=>document.querySelector('#field-state').textContent==='READY');await page.screenshot({path:'browser-artifacts/rts-evacuation.png',fullPage:true});
  await page.waitForFunction(()=>document.querySelector('#arrived-count').textContent==='36 / 36');assert.equal(await page.locator('#field-exits').textContent(),'0 / 36');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.locator('#status').textContent(),'PAUSED');
  // Returning to A* recipes must restore their controls and fresh state.
  await page.locator('#choose-squad').click();assert.equal(await page.locator('#flow-panel').isVisible(),false);assert.equal(await page.locator('#select-all').isVisible(),true);assert.equal(await page.locator('#selected-count').textContent(),'6 / 6');
  const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(url);await mobile.locator('#choose-evacuation').tap();await mobile.locator('#toggle-exit').tap();await mobile.locator('#launch').tap();
  await mobile.waitForFunction(()=>document.querySelector('#field-state').textContent==='READY');await mobile.locator('#pause').tap();await mobile.locator('#show-field').uncheck();
  assert.equal(await mobile.locator('#show-field').isChecked(),false);assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'four RTS tabs and flow controls fit 390 px');
  await mobile.screenshot({path:'browser-artifacts/rts-flow-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);await Promise.all([page.close(),mobile.close()]);
  console.log('Flow fields: incremental build/pause, replacement cancellation, blocked orders, gate rebuild, all 24/36 arrivals, exit closure, blur/reset, recipe switching and 390 px touch-emulated controls passed.');
}
