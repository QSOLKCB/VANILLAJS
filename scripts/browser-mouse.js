// Native capture/click lifecycle with synthetic relative look samples.
// Headless CDP mouse moves under lock produce paired cursor-warps, not device deltas.
import assert from 'node:assert/strict';
async function picture(page,selector){
  return page.locator(selector).evaluate(canvas=>new Promise(resolve=>requestAnimationFrame(()=>{
    const gl=canvas.getContext('webgl'),pixels=new Uint8Array(canvas.width*canvas.height*4);
    gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let hash=2166136261;for(const byte of pixels)hash=Math.imul(hash^byte,16777619);resolve(hash);
  })));
}
async function relativeLook(page,x,y){
  await page.evaluate(({x,y})=>{
    if(!document.pointerLockElement)throw new Error('mouse capture required');
    document.pointerLockElement.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,movementX:x,movementY:y}));
  },{x,y});
}
async function verifyReleasedFire(page,{held=false}={}){
  const before=Number(await page.locator('#shots').textContent());
  // Shots are presented on an 80 ms HUD cadence. The value already displayed
  // when mouseup returns can still describe a tick while the button was held.
  // Arm before the input and capture the first HUD update AFTER native release.
  await page.evaluate(()=>{
    const shots=document.querySelector('#shots');
    delete shots.dataset.releasedShots;delete shots.dataset.releasedTime;
    document.addEventListener('mouseup',()=>{
      const observer=new MutationObserver(()=>{
        observer.disconnect();
        shots.dataset.releasedShots=shots.textContent;
        shots.dataset.releasedTime=String(parseFloat(document.querySelector('#elapsed').textContent));
      });
      observer.observe(shots,{childList:true});
    },{once:true});
  });
  await page.mouse.down();
  if(held)await page.waitForFunction(n=>Number(document.querySelector('#shots').textContent)>=n+2,before);
  await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('#shots').dataset.releasedShots!==undefined);
  const released=await page.locator('#shots').evaluate(node=>({
    shots:Number(node.dataset.releasedShots),time:Number(node.dataset.releasedTime)
  }));
  assert.ok(released.shots>=before+(held?2:1),'captured tap/hold must actually fire');
  // More than one complete 0.25 s weapon cooldown in simulation time, even on
  // a slow renderer. Stuck primary input or a stale edge must still fail.
  await page.waitForFunction(time=>parseFloat(document.querySelector('#elapsed').textContent)>=time+.35,released.time);
  assert.equal(Number(await page.locator('#shots').textContent()),released.shots,
    `${held?'held':'tapped'} fire must stop after mouse release`);
}
export async function verifyMouseLook(browser,baseURL){
  for(const lab of ['flight','interaction']){
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const selector=lab==='flight'?'#flight':'#range-view';
    await page.goto(baseURL+(lab==='flight'?'':'demos/interaction-lab/index.html'));
    await page.waitForFunction(()=>document.querySelector('#status').textContent==='READY');
    if(lab==='flight')await page.locator('#choose-arena').click();
    await page.locator('#launch').click();const canvas=page.locator(selector);
    await canvas.click();await page.waitForFunction(()=>document.pointerLockElement instanceof HTMLCanvasElement && document.querySelector('#hint,#flight-hint').textContent.includes('active'));
    if(lab==='interaction')assert.equal(await page.locator('#shots').textContent(),'0','capture click must not fire');
    const before=await picture(page,selector);
    await relativeLook(page,60,-25);
    await page.waitForTimeout(250);const aimed=await picture(page,selector);
    assert.notEqual(aimed,before,`${lab}: relative mouse motion must turn the view`);
    await page.waitForTimeout(350);assert.equal(await picture(page,selector),aimed,`${lab}: view must stop when mouse stops`);
    if(lab==='flight')assert.equal(parseFloat(await page.locator('#spin').textContent()),0);
    if(lab==='interaction'){
      await verifyReleasedFire(page);
      await verifyReleasedFire(page,{held:true});
    }
    // Existing arrow-key flight still turns; a subsequent mouse sample takes over.
    await page.keyboard.down('ArrowLeft');await page.waitForTimeout(200);await page.keyboard.up('ArrowLeft');
    if(lab==='flight')assert.ok(parseFloat(await page.locator('#spin').textContent())>.1);
    await relativeLook(page,10,0);await page.waitForTimeout(200);
    if(lab==='flight')assert.equal(parseFloat(await page.locator('#spin').textContent()),0);
    await page.keyboard.down('w');await page.waitForTimeout(250);await page.keyboard.up('w');
    if(lab==='flight')assert.ok(parseFloat(await page.locator('#speed').textContent())>1);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>document.pointerLockElement===null && document.querySelector('#status').textContent==='PAUSED');
    const frozen=await page.locator('#elapsed').textContent();await page.waitForTimeout(300);assert.equal(await page.locator('#elapsed').textContent(),frozen);
    await page.locator('#launch').click();assert.equal(await page.evaluate(()=>document.pointerLockElement),null);
    await canvas.click();await page.waitForFunction(()=>document.pointerLockElement!==null);
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(()=>document.pointerLockElement===null && document.querySelector('#status').textContent==='PAUSED');
    assert.deepEqual(errors,[]);await page.close();
  }
  // Rejected capture uses moving drag deltas, never a held joystick command.
  const fallback=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  fallback.on('pageerror',error=>errors.push(error.message));
  await fallback.addInitScript(()=>HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.reject(new Error('capture denied for test')));
  await fallback.goto(baseURL);await fallback.locator('#choose-arena').click();await fallback.locator('#launch').click();
  const canvas=fallback.locator('#flight'),box=await canvas.boundingBox();
  await fallback.mouse.move(box.x+box.width/2,box.y+box.height/2);await fallback.mouse.down();
  await fallback.waitForFunction(()=>document.querySelector('#hint').textContent.includes('unavailable'));
  await fallback.mouse.move(box.x+box.width/2+50,box.y+box.height/2-20);await fallback.waitForTimeout(250);
  const held=await picture(fallback,'#flight');await fallback.waitForTimeout(300);
  assert.equal(await picture(fallback,'#flight'),held,'stationary held drag must not spin');
  await fallback.mouse.up();await fallback.waitForTimeout(200);assert.equal(await picture(fallback,'#flight'),held,'released drag must not spin');
  assert.equal(parseFloat(await fallback.locator('#spin').textContent()),0);
  await fallback.screenshot({path:'browser-artifacts/mouse-look-fallback.png',fullPage:true});
  assert.deepEqual(errors,[]);await fallback.close();
  console.log('Chromium mouse controls: native capture/click/Escape, synthetic relative aim/no-spin/blur, arrows/WASD and real denied-capture drag passed in both labs.');
}
