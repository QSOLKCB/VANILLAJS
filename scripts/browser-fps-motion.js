// Additive packaged-app scenarios for stance changes and moving target recipes.
import assert from 'node:assert/strict';
export async function verifyFpsMotion(browser,baseURL){
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const url=baseURL+'demos/fps-lab/index.html';await page.goto(url);
  await page.locator('#choose-lowpass').click();await page.locator('#launch').click();
  await page.keyboard.down('w');
  await page.waitForFunction(()=>parseFloat(document.querySelector('#elapsed').textContent)>2 && parseFloat(document.querySelector('#speed').textContent)===0);
  assert.match(await page.locator('#goal').textContent(),/01 \/ DUCK/);assert.equal(await page.locator('#body-height').textContent(),'1.80 m');
  await page.keyboard.down('c');await page.waitForFunction(()=>document.querySelector('#goal').textContent.includes('02 / STAND'));
  await page.keyboard.up('w');await page.keyboard.up('c');
  await page.waitForFunction(()=>document.querySelector('#stance').textContent.includes('LOW CEILING'));
  assert.equal(await page.locator('#body-height').textContent(),'1.08 m');assert.equal(parseFloat(await page.locator('#height').textContent()),0);
  await page.screenshot({path:'browser-artifacts/fps-low-passage.png',fullPage:true});
  await page.keyboard.press('Escape');await page.locator('#launch').click();
  await page.waitForFunction(()=>document.querySelector('#stance').textContent.includes('LOW CEILING'));
  await page.keyboard.down('w');await page.waitForFunction(()=>document.querySelector('#stance').textContent==='GROUNDED');await page.keyboard.up('w');
  await page.waitForFunction(()=>parseFloat(document.querySelector('#speed').textContent)===0);
  assert.equal(await page.locator('#body-height').textContent(),'1.80 m');
  // A held C must be re-pressed after cancellation, even after resuming in open space.
  await page.keyboard.down('c');await page.waitForFunction(()=>document.querySelector('#body-height').textContent==='1.08 m');
  await page.keyboard.press('Escape');await page.locator('#launch').click();await page.keyboard.down('c');
  await page.waitForFunction(()=>document.querySelector('#body-height').textContent==='1.80 m');await page.keyboard.up('c');
  await page.locator('#reset').click();assert.equal(await page.locator('#body-height').textContent(),'1.80 m');

  await page.locator('#choose-tracking').click();assert.equal(await page.locator('#shot-mode').inputValue(),'bolt');
  await page.locator('#launch').click();await page.waitForFunction(()=>parseFloat(document.querySelector('#elapsed').textContent)>1.5);
  assert.ok(Number(await page.locator('#target-x').textContent())>3);
  await page.keyboard.press('Escape');const frozen=[await page.locator('#target-x').textContent(),await page.locator('#elapsed').textContent()];
  await page.waitForTimeout(250);assert.deepEqual([await page.locator('#target-x').textContent(),await page.locator('#elapsed').textContent()],frozen);
  // Near its turn, a directly aligned bolt reaches the moving plate after a delay.
  await page.locator('[data-plate="plate-1"]').click();await page.locator('#launch').click();await page.keyboard.press('f');
  await page.waitForFunction(()=>Number(document.querySelector('#shots').textContent)===1);
  assert.equal(Number(await page.locator('#hits').textContent()),0);
  await page.waitForFunction(()=>Number(document.querySelector('#hits').textContent)===1);
  await page.screenshot({path:'browser-artifacts/fps-tracking-range.png',fullPage:true});
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  assert.equal(await page.locator('#status').textContent(),'PAUSED');
  await page.locator('#reset').click();assert.equal(await page.locator('#target-x').textContent(),'0.00');
  await page.locator('#shot-mode').selectOption('trace');await page.locator('#launch').click();await page.keyboard.press('f');
  await page.waitForFunction(()=>Number(document.querySelector('#hits').textContent)===1);

  const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});mobile.on('pageerror',error=>errors.push(error.message));
  await mobile.goto(url);await mobile.locator('#choose-lowpass').tap();await mobile.locator('#launch').tap();
  await mobile.locator('.controls summary').tap();await mobile.locator('[data-action="crouch"]').focus();
  await mobile.keyboard.down('Space');await mobile.waitForFunction(()=>document.querySelector('#body-height').textContent==='1.08 m');
  assert.equal(Number(await mobile.locator('#jumps').textContent()),0,'activating the crouch button must not also jump');
  await mobile.keyboard.up('Space');await mobile.waitForFunction(()=>document.querySelector('#body-height').textContent==='1.80 m');
  await mobile.locator('.controls summary').tap();await mobile.locator('#choose-tracking').tap();await mobile.locator('#launch').tap();
  await mobile.waitForFunction(()=>Number(document.querySelector('#target-x').textContent)>1);
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'four-recipe mobile layout must not overflow');
  await mobile.screenshot({path:'browser-artifacts/fps-motion-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);await Promise.all([page.close(),mobile.close()]);
  console.log('FPS motion: low-ceiling entry, crouch/headroom/stand, held-C cancellation, moving plates, pause/blur/reset, delayed moving bolt hit, instant trace, on-screen keyboard control and 390 px touch-emulated layout passed.');
}
