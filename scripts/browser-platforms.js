import assert from 'node:assert/strict';
export async function verifyPlatforms(browser,baseURL){
  const page=await browser.newPage({viewport:{width:1440,height:1200}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));const url=baseURL+'demos/fps-lab/index.html';
  await page.goto(url);await page.locator('#choose-lift').click();await page.locator('#launch').click();
  await page.waitForFunction(()=>parseFloat(document.querySelector('#height').textContent)>1);
  assert.equal(await page.locator('#support-name').textContent(),'lift');
  await page.keyboard.press('Escape');const frozen=[await page.locator('#height').textContent(),await page.locator('#platform-phase').textContent()];
  await page.waitForTimeout(250);assert.deepEqual([await page.locator('#height').textContent(),await page.locator('#platform-phase').textContent()],frozen);
  await page.locator('#launch').click();await page.waitForFunction(()=>document.querySelector('#platform-state').textContent==='CLEARANCE STOP');
  const stopped=await page.locator('#platform-phase').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('#platform-phase').textContent(),stopped);
  assert.equal(await page.locator('#status').textContent(),'RUNNING','interlock leaves player controls active');
  assert.equal(await page.locator('#body-height').textContent(),'1.80 m');await page.screenshot({path:'browser-artifacts/fps-clearance-lift.png',fullPage:true});
  await page.keyboard.down('c');await page.waitForFunction(()=>parseFloat(document.querySelector('#height').textContent)>=4.5);
  assert.equal(await page.locator('#body-height').textContent(),'1.08 m');
  await page.keyboard.down('w');await page.waitForFunction(()=>document.querySelector('#support-name').textContent==='upper-deck');await page.keyboard.up('c');
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='COMPLETE');await page.keyboard.up('w');
  assert.equal(await page.locator('#body-height').textContent(),'1.80 m');assert.equal(await page.locator('#rescues').textContent(),'0');

  await page.locator('#choose-shuttle').click();await page.locator('#launch').click();
  await page.waitForFunction(()=>parseFloat(document.querySelector('#platform-phase').textContent)>2.5);
  assert.equal(await page.locator('#support-name').textContent(),'shuttle');assert.ok(parseFloat(await page.locator('#speed').textContent())>3);
  await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('#support-name').textContent==='AIR');
  await page.waitForFunction(()=>document.querySelector('#support-name').textContent==='shuttle');assert.equal(await page.locator('#jumps').textContent(),'1');
  assert.equal(await page.locator('#rescues').textContent(),'0');await page.screenshot({path:'browser-artifacts/fps-shuttle.png',fullPage:true});
  await page.locator('#reverse-platform').click();assert.equal(await page.locator('#status').textContent(),'PAUSED');
  const phase=Number(await page.locator('#platform-phase').textContent());await page.locator('#launch').click();
  await page.waitForFunction(p=>Number(document.querySelector('#platform-phase').textContent)<p-.2,phase);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.locator('#status').textContent(),'PAUSED');
  await page.locator('#reset').click();assert.equal(await page.locator('#platform-phase').textContent(),'0.00');assert.equal(await page.locator('#rescues').textContent(),'0');

  const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(url);await mobile.locator('#choose-shuttle').tap();await mobile.locator('#launch').tap();
  await mobile.waitForFunction(()=>parseFloat(document.querySelector('#platform-phase').textContent)>2.2);
  assert.equal(await mobile.locator('#support-name').textContent(),'shuttle');
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'six-recipe layout must fit 390 px');
  await mobile.screenshot({path:'browser-artifacts/fps-platform-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);await Promise.all([page.close(),mobile.close()]);
  console.log('Platforms: lift carry, pause, clearance interlock, crouch recovery, complete deck transfer, shuttle jump/landing, reversal, blur/reset and 390 px touch-emulated layout passed.');
}
