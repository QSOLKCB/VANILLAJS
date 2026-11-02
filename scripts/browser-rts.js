import assert from 'node:assert/strict';
export async function verifyRts(browser,baseURL){
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],url=baseURL+'demos/rts-lab/index.html';
  page.on('pageerror',e=>errors.push(e.message));
  async function point(p,x,z){await p.locator('#rts-view').scrollIntoViewIfNeeded();const b=await p.locator('#rts-view').boundingBox();return {x:b.x+(x+.5)*b.width/24,y:b.y+(z+.5)*b.height/16};}
  async function clickCell(x,z,button='left'){const p=await point(page,x,z);await page.mouse.click(p.x,p.y,{button});}
  await page.goto(url);await page.waitForFunction(()=>document.querySelector('#roster button')&&document.querySelector('#rts-view').width>300);
  const visible=await page.locator('#rts-view').evaluate(c=>{const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<p.length;i+=4)if(p[i+1]>150&&p[i+1]>p[i])n++;return n;});
  assert.ok(visible>100,'map renders mint units and terrain');
  await clickCell(8,7);assert.equal(await page.locator('#order-result').textContent(),'BLOCKED');assert.equal(await page.locator('#order-count').textContent(),'0');
  await clickCell(21,8);assert.equal(await page.locator('#order-result').textContent(),'FOUND');assert.equal(await page.locator('#order-count').textContent(),'1');
  await page.screenshot({path:'browser-artifacts/rts-route.png',fullPage:true});
  await page.locator('#toggle-gate').click();assert.equal(await page.locator('#toggle-gate').getAttribute('aria-pressed'),'true');
  await page.locator('#launch').click();await page.waitForFunction(()=>Number(document.querySelector('#elapsed').textContent)>.5);
  // Cancel a held pointer at pause; its late release must not submit an order.
  const target=await point(page,4,12);await page.mouse.move(target.x,target.y);await page.mouse.down();await page.keyboard.press('Escape');await page.mouse.up();
  assert.equal(await page.locator('#order-count').textContent(),'1');assert.equal(await page.locator('#status').textContent(),'PAUSED');
  const frozen=await page.locator('#elapsed').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('#elapsed').textContent(),frozen);
  await page.locator('#launch').click();await page.waitForFunction(()=>document.querySelector('#arrived-count').textContent==='1 / 1');
  assert.equal(await page.locator('[data-unit="U1"]').getAttribute('data-cell'),'21,8');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.locator('#status').textContent(),'PAUSED');
  await page.locator('#reset').click();assert.equal(await page.locator('#elapsed').textContent(),'0.00');assert.equal(await page.locator('#order-count').textContent(),'0');
  // Keyboard cursor and fresh-key handling after pause.
  await page.locator('#rts-view').focus();await page.keyboard.press('ArrowLeft');await page.keyboard.press('Space');assert.equal(await page.locator('#order-count').textContent(),'1');
  assert.equal(await page.locator('#cursor-cell').textContent(),'CURSOR 20, 8');
  await page.keyboard.down('Space');const count=await page.locator('#order-count').textContent();await page.keyboard.press('Escape');await page.keyboard.down('Space');assert.equal(await page.locator('#order-count').textContent(),count);await page.keyboard.up('Space');
  await page.locator('#choose-squad').click();assert.equal(await page.locator('#selected-count').textContent(),'6 / 6');
  await clickCell(2,5);assert.equal(await page.locator('#selected-count').textContent(),'1 / 6');
  const a=await point(page,1,4),b=await point(page,4,8);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();assert.equal(await page.locator('#selected-count').textContent(),'6 / 6');
  await clickCell(21,8,'right');assert.equal(await page.locator('#order-count').textContent(),'1');
  await page.screenshot({path:'browser-artifacts/rts-squad.png',fullPage:true});await page.locator('#launch').click();
  await page.waitForFunction(()=>document.querySelector('#arrived-count').textContent==='6 / 6');
  const cells=await page.locator('#roster button').evaluateAll(elements=>elements.map(e=>e.dataset.cell));assert.equal(new Set(cells).size,6);
  await page.locator('#rts-view').dispatchEvent('contextlost');await page.waitForTimeout(100);assert.equal(await page.locator('#error').isVisible(),true);assert.equal(await page.locator('#launch').isDisabled(),true);
  const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(url);await mobile.locator('#choose-squad').tap();await mobile.locator('[data-unit="U1"]').tap();assert.equal(await mobile.locator('#selected-count').textContent(),'1 / 6');
  await mobile.locator('#select-all').tap();await mobile.locator('#tool-move').tap();const p=await point(mobile,21,8);await mobile.touchscreen.tap(p.x,p.y);
  assert.equal(await mobile.locator('#order-count').textContent(),'1');assert.equal(await mobile.locator('#selected-count').textContent(),'6 / 6');
  await mobile.locator('#launch').tap();await mobile.waitForFunction(()=>Number(document.querySelector('#elapsed').textContent)>1);
  await mobile.locator('#pause').tap();assert.equal(await mobile.locator('#status').textContent(),'PAUSED');
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'RTS mobile layout fits 390 px');await mobile.screenshot({path:'browser-artifacts/rts-mobile.png',fullPage:true});
  const unsupported=await browser.newPage();await unsupported.addInitScript(()=>HTMLCanvasElement.prototype.getContext=()=>null);await unsupported.goto(url);
  assert.match(await unsupported.locator('#error').textContent(),/Canvas 2D is unavailable/);assert.equal(await unsupported.locator('#launch').isDisabled(),true);
  assert.deepEqual(errors,[]);await Promise.all([page.close(),mobile.close(),unsupported.close()]);
  console.log('RTS: Canvas rendering, pointer/keyboard orders, blocked cells, gate rerouting, route/squad arrival, drag selection, pause cancellation, blur/reset, graphics failure and 390 px touch-emulated controls passed.');
}
