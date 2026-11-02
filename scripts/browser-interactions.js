// CI-only browser scenarios; no test tooling is shipped to the game.
import assert from 'node:assert/strict';
export async function verifyInteractions(browser,baseURL) {
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const url=baseURL+'demos/interaction-lab/index.html';
  const count=id=>page.locator('#'+id).textContent().then(Number);
  const fire=async()=>{
    const hits=await count('hits');await page.locator('#fire').click();
    await page.waitForFunction(n=>Number(document.querySelector('#hits').textContent)>n,hits);
  };
  await page.goto(baseURL);await page.locator('a.lab-link').click();assert.equal(page.url(),url);
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='READY');
  assert.equal(await page.locator('#error').isVisible(),false);
  const bright=await page.locator('canvas').evaluate(canvas=>new Promise(resolve=>requestAnimationFrame(()=>{
    const gl=canvas.getContext('webgl'),pixels=new Uint8Array(canvas.width*canvas.height*4);
    gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]+pixels[i+1]+pixels[i+2]>110)count++;
    resolve(count);
  })));
  assert.ok(bright>500,'Interaction Lab must render visible WebGL geometry');
  await page.locator('#launch').click();await fire();
  assert.equal(await page.locator('#outcome-badge').textContent(),'BLOCKED');
  assert.match(await page.locator('#receipt').textContent(),/shield-active/);
  await page.locator('#shields').uncheck();await fire();
  assert.equal(await count('applied'),1);assert.match(await page.locator('#receipt').textContent(),/hull-hit/);
  assert.match(await page.locator('#target-labels').textContent(),/75 HULL/);
  await page.screenshot({path:'browser-artifacts/interaction-space.png',fullPage:true});
  await page.locator('#reset').click();await page.locator('#launch').click();await page.keyboard.down('f');
  await page.waitForFunction(()=>Number(document.querySelector('#shots').textContent)>0);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#status').textContent(),'PAUSED');
  const frozenTime=await page.locator('#elapsed').textContent(),frozenShots=await count('shots'),frozenHits=await count('hits');
  await page.waitForTimeout(300);assert.equal(await page.locator('#elapsed').textContent(),frozenTime);
  assert.equal(await count('hits'),frozenHits);
  await page.keyboard.press('Escape');await page.keyboard.down('f');await page.waitForTimeout(400);
  assert.equal(await count('shots'),frozenShots,'auto-repeat must not restart cancelled firing');
  await page.keyboard.up('f');await page.keyboard.down('f');
  await page.waitForFunction(n=>Number(document.querySelector('#shots').textContent)>n,frozenShots);await page.keyboard.up('f');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.locator('#status').textContent(),'PAUSED');

  await page.locator('#choose-bench').click();assert.equal(await count('shots'),0);
  await page.locator('#launch').click();await fire();assert.match(await page.locator('#receipt').textContent(),/needs-ignition/);
  await page.locator('#ignition').check();await page.locator('#oxygen').uncheck();await fire();
  assert.match(await page.locator('#receipt').textContent(),/needs-oxygen/);
  await page.locator('#oxygen').check();await fire();assert.equal(await count('products'),1);
  assert.match(await page.locator('#outcome-reason').textContent(),/2H₂ \+ O₂ → 2H₂O/);
  await page.screenshot({path:'browser-artifacts/interaction-bench.png',fullPage:true});
  await page.locator('[data-target="neon"]').click();assert.equal(await page.locator('#status').textContent(),'PAUSED');
  await page.locator('#launch').click();await fire();assert.equal(await page.locator('#outcome-badge').textContent(),'RESISTED');
  assert.equal(await count('products'),1);
  await page.locator('[data-target="empty"]').click();await page.locator('#launch').click();await fire();
  assert.match(await page.locator('#receipt').textContent(),/empty-chamber/);
  await page.locator('#reset').click();assert.equal(await count('products'),0);assert.equal(await page.locator('#ignition').isChecked(),false);

  // Real touch event sequence in an emulated viewport, including a quick tap.
  const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
  mobile.on('pageerror',error=>errors.push(error.message));await mobile.goto(url);
  await mobile.locator('#choose-bench').tap();await mobile.locator('#launch').tap();await mobile.locator('#fire').tap();
  await mobile.waitForFunction(()=>Number(document.querySelector('#hits').textContent)===1);
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile layout must not overflow');
  await mobile.screenshot({path:'browser-artifacts/interaction-mobile.png',fullPage:true});
  // Use an actual mouse pointer for capture, then cancel the held control.
  await page.locator('#choose-space').click();await page.locator('#launch').click();
  const button=page.locator('#fire');await button.evaluate(el=>el.addEventListener('pointerdown',e=>el.dataset.pointerId=String(e.pointerId),{once:true}));
  const rect=await button.boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();
  await page.waitForFunction(()=>Number(document.querySelector('#shots').textContent)>=2);
  await button.dispatchEvent('pointercancel',{pointerId:Number(await button.getAttribute('data-pointer-id'))});
  await page.waitForTimeout(120); // Allow the throttled telemetry to catch up.
  const cancelled=await count('shots');await page.waitForTimeout(400);assert.equal(await count('shots'),cancelled);
  await page.mouse.up();
  await page.locator('canvas').evaluate(canvas=>canvas.getContext('webgl').getExtension('WEBGL_lose_context').loseContext());
  await page.locator('#error').waitFor({state:'visible'});assert.equal(await page.locator('#launch').isDisabled(),true);
  assert.equal(await page.locator('#status').textContent(),'UNAVAILABLE');

  const unsupported=await browser.newPage();await unsupported.addInitScript(()=>HTMLCanvasElement.prototype.getContext=()=>null);
  await unsupported.goto(url);await unsupported.locator('#error').waitFor({state:'visible'});
  assert.match(await unsupported.locator('#error').textContent(),/WebGL is unavailable/);
  assert.deepEqual(errors,[]);
  await Promise.all([page.close(),mobile.close(),unsupported.close()]);
  console.log('Interaction Lab: rendering, shields, all reaction outcomes, fresh-fire resume, pause/blur, target focus/reset, touch tap, pointer cancellation, mobile layout, context loss and unsupported WebGL passed.');
}
