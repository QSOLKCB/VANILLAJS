// Packaged FPS scenarios. Native capture lifecycle; relative look deltas are
// explicit MouseEvents because headless CDP motion under lock produces warps.
import assert from 'node:assert/strict';
async function pixels(page){
  return page.locator('#fps-view').evaluate(canvas=>new Promise(resolve=>requestAnimationFrame(()=>{
    const gl=canvas.getContext('webgl'),data=new Uint8Array(canvas.width*canvas.height*4);
    gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);
    let bright=0,hash=2166136261;for(let i=0;i<data.length;i++){hash=Math.imul(hash^data[i],16777619);if(i%4===0 && data[i]+data[i+1]+data[i+2]>110)bright++;}
    resolve({bright,hash});
  })));
}
export async function verifyFps(browser,baseURL){
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));const url=baseURL+'demos/fps-lab/index.html';
  const value=id=>page.locator('#'+id).textContent().then(Number);
  await page.goto(baseURL);await page.locator('a.fps-link').click();assert.equal(page.url(),url);
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='READY');
  assert.ok((await pixels(page)).bright>500,'FPS Lab draws visible WebGL geometry');
  await page.locator('#launch').click();await page.screenshot({path:'browser-artifacts/fps-course.png',fullPage:true});
  await page.keyboard.down('Shift');await page.keyboard.down('w');await page.waitForFunction(()=>parseFloat(document.querySelector('#speed').textContent)>6.5);await page.keyboard.up('Shift');
  await page.waitForFunction(()=>Number(document.querySelector('#steps').textContent)>=4 && parseFloat(document.querySelector('#height').textContent)>.95);
  await page.keyboard.up('w');await page.waitForFunction(()=>parseFloat(document.querySelector('#speed').textContent)===0);
  await page.keyboard.down('Space');await page.waitForFunction(()=>parseFloat(document.querySelector('#height').textContent)>1.5);
  await page.waitForFunction(()=>document.querySelector('#stance').textContent==='GROUNDED');await page.keyboard.down('Space');await page.waitForTimeout(250);
  assert.equal(await value('jumps'),1,'held jump cannot repeat on landing');await page.keyboard.up('Space');
  await page.screenshot({path:'browser-artifacts/fps-course.png',fullPage:true});
  // Fresh-press cancellation applies to the new movement bindings as well.
  await page.keyboard.down('w');await page.waitForFunction(()=>parseFloat(document.querySelector('#speed').textContent)>3);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#status').textContent(),'PAUSED');
  await page.locator('#launch').click();await page.keyboard.down('w');await page.waitForTimeout(350);
  assert.equal(parseFloat(await page.locator('#speed').textContent()),0);await page.keyboard.up('w');
  await page.evaluate(()=>{
    globalThis.fpsMouseEvents=[];
    document.addEventListener('mousemove',e=>{if(globalThis.fpsMouseEvents.length<30)globalThis.fpsMouseEvents.push([e.movementX,e.movementY,e.isTrusted]);});
  });
  await page.locator('#fps-view').click();await page.waitForFunction(()=>document.pointerLockElement && document.querySelector('#hint').textContent.includes('active'));
  await page.waitForTimeout(150);
  const before=(await pixels(page)).hash;
  await page.evaluate(()=>document.pointerLockElement.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,movementX:60,movementY:-20})));
  await page.waitForTimeout(200);const aimed=(await pixels(page)).hash;
  if(aimed===before){
    console.log('FPS aim diagnostic',await page.evaluate(()=>({events:globalThis.fpsMouseEvents,status:document.querySelector('#status').textContent,
      elapsed:document.querySelector('#elapsed').textContent,locked:!!document.pointerLockElement,hint:document.querySelector('#hint').textContent,error:document.querySelector('#error').textContent})));
    await page.screenshot({path:'browser-artifacts/fps-aim-diagnostic.png',fullPage:true});
  }
  assert.notEqual(aimed,before,'relative look must visibly change the FPS camera');
  await page.waitForTimeout(250);assert.equal((await pixels(page)).hash,aimed,'FPS mouse stops without angular drift');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.pointerLockElement && document.querySelector('#status').textContent==='PAUSED');

  await page.locator('#choose-range').click();await page.locator('#launch').click();
  await page.evaluate(()=>{for(const type of ['keydown','keyup'])window.dispatchEvent(new KeyboardEvent(type,{code:'KeyF',bubbles:true,cancelable:true}));});
  await page.waitForFunction(()=>Number(document.querySelector('#hits').textContent)===1);assert.equal(await value('ammo'),7);
  await page.keyboard.down('f');await page.waitForFunction(()=>Number(document.querySelector('#ammo').textContent)===0);
  const emptyShots=await value('shots');assert.equal(emptyShots,8);await page.waitForTimeout(250);assert.equal(await value('shots'),emptyShots);
  await page.keyboard.press('r');await page.waitForFunction(()=>document.querySelector('#weapon-state').textContent==='RELOADING');
  await page.keyboard.press('Escape');const reloadTime=await page.locator('#reload-time').textContent();
  await page.waitForTimeout(300);assert.equal(await page.locator('#reload-time').textContent(),reloadTime);assert.equal(await value('ammo'),0);
  await page.locator('#launch').click();await page.keyboard.down('f');await page.waitForFunction(()=>Number(document.querySelector('#ammo').textContent)===8);
  await page.waitForTimeout(250);assert.equal(await value('shots'),emptyShots,'held F repeat cannot re-arm after resume');assert.equal(await value('reserve'),24);await page.keyboard.up('f');
  await page.locator('[data-plate="plate-2"]').click();assert.equal(await page.locator('#status').textContent(),'PAUSED');
  await page.locator('#shot-mode').selectOption('bolt');await page.locator('#launch').click();const priorHits=await value('hits');
  await page.locator('#fire').click();await page.waitForFunction(n=>Number(document.querySelector('#shots').textContent)>n,emptyShots);
  assert.equal(await value('hits'),priorHits,'bolt takes time to reach the plate');
  await page.waitForFunction(n=>Number(document.querySelector('#hits').textContent)>n,priorHits);assert.match(await page.locator('#aim-label').textContent(),/75 INTEGRITY/);
  await page.screenshot({path:'browser-artifacts/fps-range.png',fullPage:true});
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.locator('#status').textContent(),'PAUSED');
  await page.locator('#reset').click();assert.equal(await value('shots'),0);assert.equal(await value('ammo'),8);

  const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});mobile.on('pageerror',error=>errors.push(error.message));
  await mobile.goto(url);await mobile.locator('#choose-range').tap();await mobile.locator('#launch').tap();await mobile.locator('#fire').tap();
  await mobile.waitForFunction(()=>Number(document.querySelector('#hits').textContent)===1);
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'FPS mobile layout must not overflow');
  await mobile.screenshot({path:'browser-artifacts/fps-mobile.png',fullPage:true});
  await page.locator('#fps-view').evaluate(canvas=>canvas.getContext('webgl').getExtension('WEBGL_lose_context').loseContext());
  await page.locator('#error').waitFor({state:'visible'});assert.equal(await page.locator('#status').textContent(),'UNAVAILABLE');assert.equal(await page.locator('#launch').isDisabled(),true);
  const unsupported=await browser.newPage();await unsupported.addInitScript(()=>HTMLCanvasElement.prototype.getContext=()=>null);await unsupported.goto(url);
  await unsupported.locator('#error').waitFor({state:'visible'});assert.match(await unsupported.locator('#error').textContent(),/WebGL is unavailable/);
  assert.deepEqual(errors,[]);await Promise.all([page.close(),mobile.close(),unsupported.close()]);
  console.log('FPS Lab: render, sprint/stairs/jump, held-input cancellation, capture/no-spin, finite ammo/reload pause, traces/bolts, focus/reset, touch tap, layout and WebGL failures passed.');
}
