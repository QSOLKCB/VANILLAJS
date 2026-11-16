// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {validateWeaponFeel} from '../modules/weapon-feel/index.js';
export async function verifyWeaponFeel(browser,base){
  const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage(),errors=[];
  const url=base+'demos/weapon-feel-lab/index.html';page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  // Only synthetic fixture noise from native headless capture is excluded; real
  // application movement and all explicit bounded MouseEvents remain untouched.
  await page.addInitScript(()=>document.addEventListener('mousemove',e=>{if(document.pointerLockElement&&e.isTrusted&&(Math.abs(e.movementX)>250||Math.abs(e.movementY)>250))e.stopImmediatePropagation();},true));
  const snapshot=()=>page.evaluate(()=>weaponFeelLab.snapshot());
  try{
    await mkdir('browser-artifacts',{recursive:true});await page.goto(url);await page.waitForFunction(()=>document.documentElement.dataset.labReady==='weapon-feel');
    assert.equal(await page.locator('#status').textContent(),'READY');assert.equal(await page.locator('[data-profile]').count(),3);await page.locator('#run').click();
    await page.keyboard.press('f');await page.waitForFunction(()=>weaponFeelLab.snapshot().hits===1);let s=await snapshot();assert.equal(s.shots,1);assert.ok(s.damage>0&&s.lastImpact);assert.deepEqual(s.aim.direction,[0,0,-1]);
    const pixels=await page.locator('#scene').evaluate(canvas=>new Promise(resolve=>requestAnimationFrame(()=>{const gl=canvas.getContext('webgl'),p=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,p);let bright=0;for(let i=0;i<p.length;i+=4)if(p[i]+p[i+1]+p[i+2]>120)bright++;resolve(bright);})));
    assert.ok(pixels>500,'actual WebGL range geometry');await page.screenshot({path:'browser-artifacts/weapon-feel-desktop.png',fullPage:true});
    await page.keyboard.press('q');await page.waitForFunction(()=>weaponFeelLab.snapshot().presentation.ads===1);s=await snapshot();assert.equal(s.presentation.fov,.65);assert.deepEqual(s.aim.direction,[0,0,-1]);
    // Both reselect inputs must preserve ADS target and UI state.
    await page.keyboard.press('1');await page.waitForTimeout(80);
    assert.equal((await snapshot()).presentation.ads,1);
    assert.equal(await page.locator('#ads').getAttribute('aria-pressed'),'true');
    await page.locator('[data-profile="0"]').click();
    assert.equal((await snapshot()).presentation.ads,1);
    assert.equal(await page.locator('#ads').getAttribute('aria-pressed'),'true');
    await page.keyboard.press('q');await page.waitForFunction(()=>weaponFeelLab.snapshot().presentation.ads===0);
    assert.equal(await page.locator('#ads').getAttribute('aria-pressed'),'false','next Q exits sights');
    await page.keyboard.press('q');await page.waitForFunction(()=>weaponFeelLab.snapshot().presentation.ads===1);
    await page.locator('[data-profile="1"]').click();
    assert.equal((await snapshot()).presentation.selected,1);
    assert.equal((await snapshot()).presentation.ads,0);
    assert.equal(await page.locator('#ads').getAttribute('aria-pressed'),'false','actual switch resets ADS');
    await page.locator('[data-profile="0"]').click();
    const position=s.player.position;await page.keyboard.down('w');await page.waitForFunction(z=>weaponFeelLab.snapshot().player.position[2]<z-.4,position[2]);await page.keyboard.up('w');
    await page.locator('#scene').click();await page.waitForFunction(()=>document.pointerLockElement?.id==='scene'&&document.querySelector('#scene').dataset.capture==='active');
    const immediate=await page.evaluate(()=>{const before=weaponFeelLab.snapshot();document.dispatchEvent(new MouseEvent('mousemove',{movementX:30,movementY:-8,bubbles:true}));const after=weaponFeelLab.snapshot();return {before,after};});
    assert.equal(immediate.after.tick,immediate.before.tick,'look updates without consuming a physics tick');assert.notEqual(immediate.after.aim.yaw,immediate.before.aim.yaw);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!weaponFeelLab.running());
    await page.locator('#reset').click();await page.locator('#moving').uncheck();await page.locator('#run').click();await page.keyboard.down('f');await page.waitForFunction(()=>weaponFeelLab.snapshot().shots===1);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const paused=await snapshot();
    await page.locator('#run').click();await page.keyboard.down('f');await page.waitForTimeout(450);assert.equal((await snapshot()).shots,paused.shots,'held key cannot re-arm after blur');await page.keyboard.up('f');
    await page.keyboard.press('r');await page.waitForFunction(()=>weaponFeelLab.snapshot().timer.reloadRemaining>0);await page.locator('#pause').click();const remaining=(await snapshot()).timer.reloadRemaining;await page.waitForTimeout(100);assert.equal((await snapshot()).timer.reloadRemaining,remaining);await page.locator('#run').click();await page.waitForFunction(()=>weaponFeelLab.snapshot().timer.ammo===8);await page.locator('#pause').click();

    await page.locator('#profile-0-recoil').fill('0.02');await page.locator('#profile-0-spread').fill('0.04');await page.locator('#profile-0-adsSeconds').fill('0.3');await page.locator('#apply').click();await page.waitForFunction(()=>document.querySelector('#recipe-status').textContent.startsWith('Accepted'));
    const accepted=await page.evaluate(()=>weaponFeelLab.recipe());let recipe=validateWeaponFeel(accepted);assert.equal(recipe.profiles[0].weapon.recoil,.02);assert.equal(recipe.profiles[0].weapon.spread,.04);assert.equal(recipe.profiles[0].view.adsSeconds,.3);
    const before=await snapshot();await page.locator('details summary').click();await page.locator('#recipe-json').fill('{"format":"script","script":"alert(1)"}');await page.locator('#apply-json').click();assert.match(await page.locator('#recipe-status').textContent(),/Rejected/);assert.equal(await page.evaluate(()=>weaponFeelLab.recipe()),accepted);assert.deepEqual(await snapshot(),before);
    const download=page.waitForEvent('download');await page.locator('#export').click();const text=await readFile(await(await download).path(),'utf8');assert.deepEqual(validateWeaponFeel(text),recipe);
    recipe=structuredClone(recipe);recipe.profiles[0].weapon.spread=0;recipe.profiles[0].weapon.recoil=.15;recipe.profiles[0].view.effects=false;
    await page.locator('#import').setInputFiles({name:'feel.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(recipe))});await page.waitForFunction(()=>document.querySelector('#recipe-status').textContent.startsWith('Accepted'));
    await page.locator('#run').click();await page.keyboard.press('f');await page.waitForFunction(()=>weaponFeelLab.snapshot().hits===1);s=await snapshot();assert.deepEqual(s.lastShot.direction,[0,0,-1]);assert.equal(s.presentation.recoil,0,'disabled cosmetic effects cannot alter canonical ray');
    await page.locator('[data-profile="1"]').click();await page.waitForFunction(()=>weaponFeelLab.snapshot().presentation.switchRemaining===0);await page.keyboard.down('f');await page.waitForFunction(()=>weaponFeelLab.snapshot().shots>=5);await page.keyboard.up('f');await page.locator('#reset').click();
    await page.locator('[data-profile="2"]').click();await page.locator('#run').click();await page.waitForFunction(()=>weaponFeelLab.snapshot().presentation.switchRemaining===0);await page.keyboard.press('f');await page.waitForFunction(()=>weaponFeelLab.snapshot().shots===1);assert.equal((await snapshot()).hits,0,'bolt must travel');await page.waitForFunction(()=>weaponFeelLab.snapshot().hits===1);
    assert.equal((await page.evaluate(()=>weaponFeelLab.stats())).staticUploads,1,'range geometry is retained');await page.locator('#pause').click();
    await page.locator('#reset').click();await page.locator('#counterfire').check();await page.locator('#run').click();await page.waitForFunction(()=>weaponFeelLab.snapshot().combat.actors.find(a=>a.id==='player').health<300);assert.match(await page.locator('#integrity').textContent(),/integrity/);await page.locator('#pause').click();

    // Installation, activation and an online controlled navigation precede a
    // genuinely new offline page. Merely seeing registration is insufficient.
    await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return r?.active?.state==='activated';},{},{timeout:120000});
    await page.reload();await page.waitForFunction(()=>navigator.serviceWorker.controller&&document.documentElement.dataset.labReady==='weapon-feel');
    await context.setOffline(true);const offline=await context.newPage();await offline.goto(url);await offline.waitForFunction(()=>document.documentElement.dataset.labReady==='weapon-feel');await offline.locator('#run').click();await offline.keyboard.press('f');await offline.waitForFunction(()=>weaponFeelLab.snapshot().hits===1);await offline.close();await context.setOffline(false);

    const mobile=await browser.newContext({viewport:{width:320,height:780},hasTouch:true,reducedMotion:'reduce'}),mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));await mp.goto(url);await mp.waitForFunction(()=>document.documentElement.dataset.labReady==='weapon-feel');await mp.locator('#run').tap();await mp.locator('[data-action="fire"]').tap();await mp.waitForFunction(()=>weaponFeelLab.snapshot().shots===1);assert.ok(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'320px layout fits');
    await mp.locator('#pause').tap();await mp.screenshot({path:'browser-artifacts/weapon-feel-mobile.png',fullPage:true});await mobile.close();
    const denied=await browser.newContext(),dp=await denied.newPage();await dp.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'?null:get.call(this,type,...args);};});await dp.goto(url);await dp.waitForFunction(()=>document.documentElement.dataset.labReady==='failed');assert.equal(await dp.locator('#startup-reload').isVisible(),true);await denied.close();
    const silent=await browser.newContext(),sp=await silent.newPage();await sp.addInitScript(()=>{globalThis.AudioContext=class{constructor(){throw Error('test device failure');}};});await sp.goto(url);await sp.waitForFunction(()=>document.documentElement.dataset.labReady==='weapon-feel');await sp.locator('#sound').click();assert.match(await sp.locator('#sound').textContent(),/unavailable/);await sp.locator('#run').click();await sp.keyboard.press('f');await sp.waitForFunction(()=>weaponFeelLab.snapshot().hits===1);await silent.close();
    const delayed=await browser.newContext(),ap=await delayed.newPage();await ap.addInitScript(()=>{const NativeAudio=globalThis.AudioContext;globalThis.AudioContext=class extends NativeAudio{resume(){return super.resume().then(()=>new Promise(resolve=>{globalThis.finishAudioResume=resolve;}));}};});await ap.goto(url);await ap.waitForFunction(()=>document.documentElement.dataset.labReady==='weapon-feel');await ap.locator('#sound').click();await ap.waitForFunction(()=>typeof finishAudioResume==='function');await ap.evaluate(()=>{window.dispatchEvent(new Event('blur'));finishAudioResume();});assert.equal(await ap.locator('#sound').textContent(),'Sound on');assert.equal(await ap.locator('#sound').getAttribute('aria-pressed'),'true');await ap.locator('#sound').click();assert.equal(await ap.locator('#sound').textContent(),'Sound off');await delayed.close();
    await page.locator('#scene').evaluate(c=>c.getContext('webgl').getExtension('WEBGL_lose_context').loseContext());await page.waitForFunction(()=>document.querySelector('#status').textContent==='GRAPHICS LOST');assert.equal(await page.locator('#run').isDisabled(),true);assert.equal(await page.locator('#startup-reload').isVisible(),true);
    assert.deepEqual(errors,[]);console.log('Weapon Feel: three live profiles, real hits/motion/projectiles, immediate mouse aim, ADS/ray alignment, buffering/cancellation, reload, recipe edit/rejection/roundtrip, 320px touch, retained geometry, graphics recovery and fresh offline play PASS');
  }finally{await context.close();}
}
