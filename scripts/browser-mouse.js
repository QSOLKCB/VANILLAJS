// Real Pointer Lock input against the packaged labs; no simulation test hooks.
import assert from 'node:assert/strict';
async function picture(page,selector){
  return page.locator(selector).evaluate(canvas=>new Promise(resolve=>requestAnimationFrame(()=>{
    const gl=canvas.getContext('webgl'),pixels=new Uint8Array(canvas.width*canvas.height*4);
    gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let hash=2166136261;for(const byte of pixels)hash=Math.imul(hash^byte,16777619);resolve(hash);
  })));
}
export async function verifyMouseLook(browser,baseURL){
  for(const lab of ['flight','interaction']){
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const selector=lab==='flight'?'#flight':'#range-view';
    await page.goto(baseURL+(lab==='flight'?'':'demos/interaction-lab/index.html'));
    await page.waitForFunction(()=>document.querySelector('#status').textContent==='READY');
    if(lab==='flight')await page.locator('#choose-arena').click();
    await page.locator('#launch').click();const canvas=page.locator(selector),box=await canvas.boundingBox();
    await page.evaluate(()=>{
      globalThis.mouseEvidence=[];
      for(const name of ['mousemove','pointermove','pointerlockchange'])document.addEventListener(name,event=>{
        if(globalThis.mouseEvidence.length<30)globalThis.mouseEvidence.push({type:name,x:event.movementX,y:event.movementY,locked:!!document.pointerLockElement});
      });
    });
    await canvas.click();await page.waitForFunction(()=>document.pointerLockElement instanceof HTMLCanvasElement && document.querySelector('#hint,#flight-hint').textContent.includes('active'));
    if(lab==='interaction')assert.equal(await page.locator('#shots').textContent(),'0','capture click must not fire');
    const before=await picture(page,selector);
    await page.mouse.move(box.x+box.width/2+60,box.y+box.height/2-25,{steps:6});
    await page.waitForTimeout(250);const aimed=await picture(page,selector);
    console.log(lab,'mouse event evidence',await page.evaluate(()=>({events:globalThis.mouseEvidence,status:document.querySelector('#status').textContent})));
    assert.notEqual(aimed,before,`${lab}: relative mouse motion must turn the view`);
    await page.waitForTimeout(350);assert.equal(await picture(page,selector),aimed,`${lab}: view must stop when mouse stops`);
    if(lab==='flight')assert.equal(parseFloat(await page.locator('#spin').textContent()),0);
    if(lab==='interaction'){
      await page.mouse.down();await page.mouse.up();await page.waitForFunction(()=>Number(document.querySelector('#shots').textContent)>0);
      const shots=await page.locator('#shots').textContent();await page.waitForTimeout(350);assert.equal(await page.locator('#shots').textContent(),shots);
    }
    // Existing arrow-key flight still turns; a subsequent mouse sample takes over.
    await page.keyboard.down('ArrowLeft');await page.waitForTimeout(200);await page.keyboard.up('ArrowLeft');
    if(lab==='flight')assert.ok(parseFloat(await page.locator('#spin').textContent())>.1);
    await page.mouse.move(box.x+box.width/2+70,box.y+box.height/2-25,{steps:6});await page.waitForTimeout(200);
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
  console.log('Chromium mouse controls: both labs capture, aim, stop, preserve arrows/WASD, release on Escape/blur; mouse fire and denied-capture drag fallback passed.');
}
