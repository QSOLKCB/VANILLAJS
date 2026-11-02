import assert from 'node:assert/strict';
import {referenceDelta} from './omi-oracle.js';
export async function verifyOmi(browser, baseURL) {
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
  const word=()=>page.locator('#word').textContent();
  async function load(value){await page.locator('#seed').fill(value);await page.locator('#load').click();}
  await page.goto(baseURL);await page.locator('.omi-link').click();assert.match(page.url(),/\/VANILLAJS\/demos\/omi-lab\/index.html$/);
  assert.equal(await word(),'0x1234');assert.equal(await page.locator('#period').textContent(),'8');assert.equal(await page.locator('#bits button').count(),16);
  await load('10000');assert.equal(await word(),'0x1234');assert.match(await page.locator('#message').textContent(),/hexadecimal/);await load('1234');
  await page.locator('[data-bit="0"]').click();assert.equal(await word(),'0x1235');await page.locator('[data-bit="0"]').click();
  await page.locator('#fault').click();assert.equal(await page.locator('#closure').textContent(),'2 / 4 faces close');assert.equal(await page.locator('#faces button.bad').count(),2);assert.equal(await word(),'0x1234');await page.locator('#fault').click();
  const edges=await page.locator('.edge-label').allTextContents();await page.locator('#common').click();assert.equal(await word(),'0xEDCB');assert.deepEqual(await page.locator('.edge-label').allTextContents(),edges);await page.locator('#common').click();
  await page.locator('#xor-mask').fill('GGGG');await page.locator('#xor').click();assert.equal(await word(),'0x1234');
  await page.locator('#xor-mask').fill('5A3C');await page.locator('#xor').click();assert.equal(await word(),'0x4808');await page.locator('#xor').click();assert.equal(await word(),'0x1234');
  await page.locator('#step').click();assert.equal(await word(),'0xEB79');assert.equal(await page.locator('#delta-steps').textContent(),'1');
  for(const [seed,period]of [['0005','4'],['0063','2'],['1477','1']]){await load(seed);assert.equal(await page.locator('#period').textContent(),period);}
  // A fixed word still advances its step counter; the partial census can pause.
  await page.locator('#run').click();await page.waitForFunction(()=>Number(document.querySelector('#delta-steps').textContent)>=1,null,{timeout:15000});
  await page.locator('#pause').click();assert.equal(await word(),'0x1477');assert.equal(await page.locator('#survey-status').textContent(),'BUILDING');
  const partial=await page.locator('#survey-count').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('#survey-count').textContent(),partial);
  await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#survey-status').textContent==='COMPLETE',null,{timeout:20000});await page.locator('#pause').click();
  for(const [id,value]of [['count-1','8'],['count-2','56'],['count-4','4,032'],['count-8','61,440'],['unique','65,536'],['return-eight','65,536'],['closed-faces','262,144'],['edge-patterns','4,096']])assert.equal(await page.locator('#'+id).textContent(),value);
  assert.match(await page.locator('#finding').textContent(),/4,096 words return sooner/);
  const rendered=await page.locator('#atlas').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,256,256).data;return [...d.slice(0,3)];});assert.deepEqual(rendered,[181,230,162]);
  await load('1234');await page.screenshot({path:'browser-artifacts/omi-lab.png',fullPage:true});
  const atlas=page.locator('#atlas');await atlas.scrollIntoViewIfNeeded();const b=await atlas.boundingBox();
  await page.mouse.click(b.x+(0x77+.5)*b.width/256,b.y+(0x14+.5)*b.height/256);assert.equal(await word(),'0x1477');
  await page.keyboard.press('ArrowRight');assert.equal(await word(),'0x1478');
  await page.keyboard.press('ArrowDown');assert.equal(await word(),'0x1578');
  await page.keyboard.down('Space');const afterPress=await word();assert.equal(Number.parseInt(afterPress,16),referenceDelta(0x1578));
  await page.keyboard.press('Escape');await page.keyboard.down('Space');assert.equal(await word(),afterPress);
  await page.keyboard.up('Space');await page.keyboard.down('Space');assert.equal(Number.parseInt(await word(),16),referenceDelta(Number.parseInt(afterPress,16)));await page.keyboard.up('Space');
  const beforeGesture=await word();await page.mouse.move(b.x+20,b.y+20);await page.mouse.down();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();assert.equal(await word(),beforeGesture);
  await page.locator('#reset').click();assert.equal(await page.locator('#survey-count').textContent(),'0 / 65,536');assert.equal(await word(),'0x1234');
  await page.locator('#run').click();await page.waitForFunction(()=>document.querySelector('#survey-progress').value>1000,null,{timeout:15000});
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});
  assert.equal(await page.locator('#status').textContent(),'PAUSED');const hiddenCount=await page.locator('#survey-count').textContent();await page.waitForTimeout(200);assert.equal(await page.locator('#survey-count').textContent(),hiddenCount);
  await atlas.dispatchEvent('contextlost');assert.match(await page.locator('#canvas-error').textContent(),/context was lost/);await load('1234');await page.locator('#step').click();assert.equal(await word(),'0xEB79');
  const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(baseURL+'demos/omi-lab/index.html');await mobile.locator('#run').tap();await mobile.waitForFunction(()=>document.querySelector('#survey-status').textContent==='COMPLETE',null,{timeout:20000});await mobile.locator('#pause').tap();
  await mobile.locator('#seed').fill('0005');await mobile.locator('#load').tap();await mobile.locator('#common').tap();assert.equal(await mobile.locator('#word').textContent(),'0xFFFA');await mobile.locator('#common').tap();
  await mobile.locator('#atlas').scrollIntoViewIfNeeded();const mb=await mobile.locator('#atlas').boundingBox();
  await mobile.touchscreen.tap(mb.x+(0x34+.5)*mb.width/256,mb.y+(0x12+.5)*mb.height/256);assert.equal(await mobile.locator('#word').textContent(),'0x1234');
  await mobile.locator('#seed').fill('0005');await mobile.locator('#load').tap();
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'OMI controls fit 390 px');await mobile.screenshot({path:'browser-artifacts/omi-lab-mobile.png',fullPage:true});
  const unsupported=await browser.newPage();unsupported.on('pageerror',e=>errors.push(e.message));await unsupported.addInitScript(()=>HTMLCanvasElement.prototype.getContext=()=>null);
  await unsupported.goto(baseURL+'demos/omi-lab/index.html');assert.match(await unsupported.locator('#canvas-error').textContent(),/Canvas 2D is unavailable/);
  await unsupported.locator('#step').click();assert.equal(await unsupported.locator('#word').textContent(),'0xEB79');await unsupported.locator('#run').click();
  await unsupported.waitForFunction(()=>document.querySelector('#survey-status').textContent==='COMPLETE',null,{timeout:20000});
  assert.deepEqual(errors,[]);await Promise.all([page.close(),mobile.close(),unsupported.close()]);
  console.log('OMI Lab: exact word vectors, invalid edits, bits, face fault/common-mask limits, all 65,536 states, minimal periods, fixed-point step count, atlas pointer/keyboard, fresh press, pause/blur/hidden/reset, Canvas failure and 390 px touch-emulated layout passed.');
}
