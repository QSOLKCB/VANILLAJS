// CI-only browser checks against the allowlisted package.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BrassMachine, MAX_DETENTS} from '../demos/ancient-machine/machine.js';
export async function verifyMachine(browser, baseURL) {
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  const word=()=>page.locator('#word').textContent();
  const detents=()=>page.locator('#detents').textContent();
  const position=()=>page.evaluate(()=>({word:document.querySelector('#word').textContent,
    detents:document.querySelector('#detents').textContent,subTick:document.querySelector('#subtick').textContent,
    crank:document.querySelector('#crank-arm').getAttribute('transform'),cam:document.querySelector('#cam').getAttribute('transform'),
    lanes:[...document.querySelectorAll('.register-label output')].map(n=>n.textContent)}));
  const restore=async data=>page.locator('#replay-file').setInputFiles({name:'replay.json',mimeType:'application/json',buffer:Buffer.from(typeof data==='string'?data:JSON.stringify(data))});
  const load=async seed=>{await page.locator('#seed').fill(seed);await page.locator('#load').click();};
  await page.goto(baseURL);await page.locator('.machine-link').click();assert.match(page.url(),/\/VANILLAJS\/demos\/ancient-machine\/index.html$/);
  // Link clicks can return after navigation commits but before module execution.
  // The word/counter are static HTML; only load waits for the module-built SVG.
  await page.waitForLoadState('load');
  assert.equal(await word(),'0x1234');assert.equal(await detents(),'000000');assert.equal(await page.locator('.drum-digit').count(),64);
  assert.equal(await page.locator('.bit-strip i').count(),96);assert.equal(await page.locator('#machine').isVisible(),true);
  assert.equal(await page.locator('#back').isDisabled(),true);
  await load('10000');assert.equal(await word(),'0x1234');assert.match(await page.locator('#message').textContent(),/hexadecimal/);
  await load('0x1234');await page.locator('#crank').click();assert.equal(await detents(),'000001');
  assert.equal(await page.locator('[data-register="capture"] output').textContent(),'0x1234');
  for(let i=0;i<6;i++)await page.locator('#step').click();assert.equal(await word(),'0x1234');
  assert.equal(await page.locator('[data-register="output"] output').textContent(),'0xEB79');
  const pending=await position();await page.locator('#step').click();assert.equal(await word(),'0xEB79');assert.equal(await page.locator('#turns').textContent(),'00001');
  await page.locator('#back').click();assert.deepEqual(await position(),pending);
  await page.locator('#turn').click();assert.equal(await detents(),'000015');assert.equal(await word(),'0xEB79');
  assert.equal(await page.locator('[data-register="output"] output').textContent(),'0xADDE');
  await page.locator('#back').click();await page.screenshot({path:'browser-artifacts/brass-engine.png',fullPage:true});
  for(const [seed,period]of [['0005','4'],['0063','2'],['1477','1']]){
    await page.locator(`[data-seed="${seed}"]`).click();assert.equal(await page.locator('#period').textContent(),'PERIOD '+period);
  }
  await page.locator('#turn').click();assert.equal(await word(),'0x1477');assert.equal(await page.locator('#turns').textContent(),'00001');
  await load('1234');await page.locator('#rate').selectOption('15');
  await page.locator('#motor').click();await page.waitForFunction(()=>Number(document.querySelector('#detents').textContent)>=2);
  await page.locator('#motor').click();const frozen=await position();await page.waitForTimeout(220);assert.deepEqual(await position(),frozen);
  assert.equal(await page.locator('#status').textContent(),'PAUSED');
  // Save/load the actual downloaded JSON, preserving a deliberately fractional position.
  const replay=new BrassMachine({seed:0x1234,detents:13,subTick:12}).exportReplay();await restore(replay);
  await page.waitForFunction(()=>document.querySelector('#subtick').textContent==='12 / 30');const restored=await position();
  const downloadPromise=page.waitForEvent('download');await page.locator('#save').click();const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),'omi-brass-replay.json');const saved=JSON.parse(await readFile(await download.path(),'utf8'));assert.deepEqual(saved,replay);
  await page.locator('#turn').click();await restore(saved);await page.waitForFunction(()=>document.querySelector('#detents').textContent==='000013');assert.deepEqual(await position(),restored);
  await page.waitForTimeout(200);assert.deepEqual(await position(),restored);
  for(const invalid of ['{', {...replay,word:0}, {...replay,schemaVersion:2}, {...replay,extra:true}, ' '.repeat(16385)]){
    await restore(invalid);await page.waitForFunction(()=>document.querySelector('#message').classList.contains('error'));
    assert.match(await page.locator('#message').textContent(),/Replay rejected/);assert.deepEqual(await position(),restored);
  }
  await page.locator('#reduced-motion').check();assert.equal(await page.locator('#crank-arm').getAttribute('transform'),'rotate(225)');
  await page.locator('#reduced-motion').uncheck();assert.ok(Math.abs(Number((await page.locator('#crank-arm').getAttribute('transform')).slice(7,-1))-243)<1e-9);
  // Keyboard controls are discrete and require fresh presses after cancellation.
  await load('1234');await page.locator('#crank').focus();await page.keyboard.down('ArrowRight');assert.equal(await detents(),'000001');
  await page.keyboard.press('Escape');await page.keyboard.down('ArrowRight');assert.equal(await detents(),'000001');await page.keyboard.up('ArrowRight');
  await page.keyboard.press('ArrowRight');assert.equal(await detents(),'000002');await page.keyboard.press('ArrowLeft');assert.equal(await detents(),'000001');
  await page.keyboard.press('Enter');assert.equal(await detents(),'000009');
  await page.keyboard.down('Space');await page.waitForFunction(()=>document.querySelector('#status').textContent==='RUNNING');
  await page.keyboard.press('Escape');const stopped=await position();await page.keyboard.down('Space');await page.keyboard.up('Space');await page.waitForTimeout(180);assert.deepEqual(await position(),stopped);
  await page.keyboard.press('Space');assert.equal(await page.locator('#status').textContent(),'RUNNING');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.locator('#status').textContent(),'PAUSED');
  await page.locator('#step').focus();await page.keyboard.down('Space');const keyboardStep=await position();
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.down('Space');await page.keyboard.up('Space');assert.deepEqual(await position(),keyboardStep);
  const step=await page.locator('#step').boundingBox();await page.mouse.move(step.x+step.width/2,step.y+step.height/2);await page.mouse.down();
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();assert.deepEqual(await position(),keyboardStep);
  await page.locator('#motor').click();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});
  assert.equal(await page.locator('#status').textContent(),'PAUSED');const hidden=await position();await page.waitForTimeout(180);assert.deepEqual(await position(),hidden);
  await restore(new BrassMachine({detents:MAX_DETENTS-1,subTick:29}).exportReplay());await page.waitForFunction(()=>document.querySelector('#detents').textContent==='524279');
  await page.locator('#motor').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='COUNTER FULL');
  assert.equal(await page.locator('#motor').isDisabled(),true);assert.equal(await detents(),'524280');await page.locator('#back').click();assert.equal(await detents(),'524279');
  await page.locator('#reset').click();assert.equal(await detents(),'000000');assert.equal(await word(),'0x1234');
  await page.locator('nav a').first().click();
  // Returning to OMI can commit the navigation before its link layout is
  // ready. Wait for the actual destination load, not an arbitrary delay.
  await page.waitForURL(/\/omi-lab\/index\.html$/);
  await page.waitForLoadState('load');
  assert.match(page.url(),/omi-lab/);
  const returnLink=page.locator('.machine-link');
  assert.equal(await returnLink.isVisible(),true,'Brass Engine return link is visible');
  // The OMI atlas may be doing expensive canvas work; a pointer click can
  // time out waiting for an otherwise visible link to be geometrically stable.
  // Focus + Enter tests genuine keyboard navigation, never a forced click.
  await returnLink.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/ancient-machine\/index\.html$/);
  assert.match(page.url(),/ancient-machine/);
  const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
  mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(baseURL+'demos/ancient-machine/index.html');
  assert.equal(await mobile.locator('#reduced-motion').isChecked(),true);await mobile.locator('#crank').tap();assert.equal(await mobile.locator('#detents').textContent(),'000001');
  await mobile.locator('#turn').tap();assert.equal(await mobile.locator('#word').textContent(),'0xEB79');await mobile.locator('#back').tap();
  await mobile.locator('#motor').tap();await mobile.waitForFunction(()=>Number(document.querySelector('#detents').textContent)>8);await mobile.locator('#motor').tap();
  await mobile.locator('#seed').fill('0005');await mobile.locator('#load').tap();await mobile.locator('#turn').tap();
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Brass Engine controls fit 390 px');
  await mobile.screenshot({path:'browser-artifacts/brass-engine-mobile.png',fullPage:true});
  await mobile.setViewportSize({width:320,height:700});assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Brass Engine controls fit 320 px');
  assert.deepEqual(errors,[]);await Promise.all([page.close(),mobile.close()]);
  console.log('Brass Engine: visible SVG, eight staged detents, exact words, reverse, short periods, fixed point, motor pause, fractional JSON download/restore, malformed replay rejection, keyboard repeat/late pointer cancellation, blur/hidden, counter limit, reduced motion and 390/320 px touch-emulated layouts passed.');
}
