// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {composeTrack} from '../demos/pursuit-lab/js/score.js';
import {replay,snapshot} from '../demos/pursuit-lab/js/sim.js';
import {checkPursuitUpgrade} from './pursuit-upgrade-check.mjs';
export async function checkPursuit(browser,base){
  await mkdir('browser-artifacts',{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const fitted=async()=>page.waitForFunction(()=>{const c=document.querySelector('canvas').getBoundingClientRect(),h=document.querySelector('.telemetry').getBoundingClientRect();return c.width>100&&c.height>40&&c.top>=h.bottom-1&&c.bottom<=innerHeight&&c.right<=innerWidth&&c.left>=0&&document.documentElement.scrollWidth<=innerWidth;});
  const captureIdle=async path=>{
    // Allow the pause/resize frame to paint before taking evidence. Continuous
    // Canvas painting can starve capture on the hosted software compositor.
    const probe=await page.waitForFunction(async()=>{
      const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
      await frame();await frame();
      const canvas=document.querySelector('#game'),context=canvas.getContext('2d'),draw=context.drawImage;
      const before=pursuit.snapshot();let paints=0;
      context.drawImage=function(...args){paints++;return draw.apply(this,args);};
      try{await frame();await frame();return {before,after:pursuit.snapshot(),paints};}
      finally{context.drawImage=draw;}
    });
    const idle=await probe.jsonValue();await probe.dispose();
    assert.ok(idle.before.screen==='menu'||idle.before.paused||['cleared','won','lost'].includes(idle.before.state.mode),'Capture requires an idle game');
    assert.deepEqual(idle.after.state,idle.before.state,'Capture must not advance the run');
    assert.equal(idle.paints,0,'An unchanged idle scene must not repaint');
    await page.screenshot({path});
  };
  try{
    await page.goto(base+'demos/pursuit-lab/index.html?test=1');await page.waitForFunction(()=>!!window.pursuit);await fitted();
    await captureIdle('browser-artifacts/pursuit-briefing.png');
    await page.locator('#launch').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>pursuit.snapshot().state.tick>2);
    assert.equal(await page.evaluate(()=>pursuit.snapshot().state.boosts),3);
    await page.keyboard.down('KeyW');await page.waitForFunction(()=>pursuit.snapshot().state.car.speed>15);
    const initial=await page.evaluate(()=>pursuit.snapshot().state.car.offset);await page.keyboard.down('KeyD');await page.waitForFunction(x=>pursuit.snapshot().state.car.offset>x+1,initial);await page.keyboard.up('KeyD');
    await page.locator('#sound').click();await page.waitForFunction(()=>pursuit.snapshot().audio.music?.active);
    await page.keyboard.press('Space');await page.waitForFunction(()=>pursuit.snapshot().state.boosts===2);assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');
    await page.keyboard.press('KeyP');const frozen=await page.evaluate(()=>pursuit.snapshot().state);await page.waitForTimeout(80);assert.deepEqual(await page.evaluate(()=>pursuit.snapshot().state),frozen);
    assert.equal(await page.evaluate(()=>pursuit.snapshot().audio.effects.voices),0);
    await captureIdle('browser-artifacts/pursuit-driving.png');
    await page.locator('#resume').click();await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',repeat:true})));assert.equal(await page.evaluate(()=>pursuit.snapshot().mask),0);await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyW');await page.waitForFunction(()=>pursuit.snapshot().mask===4);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.evaluate(()=>pursuit.snapshot().paused),true);await page.keyboard.up('KeyW');
    // Native fullscreen is requested by a real user gesture; Escape events are observed through the document API.
    await page.locator('#display').selectOption('fullscreen');await page.waitForFunction(()=>document.fullscreenElement?.id==='app');await fitted();assert.equal(await page.locator('#display').inputValue(),'fullscreen');
    await page.evaluate(()=>document.exitFullscreen());await page.waitForFunction(()=>pursuit.snapshot().display.mode==='fit'&&document.querySelector('#display').value==='fit');assert.equal(await page.locator('#display').inputValue(),'fit');
    // Permission failure recovers to a fitted game and leaves the run paused.
    await page.evaluate(()=>{document.querySelector('#app').requestFullscreen=()=>Promise.reject(new Error('blocked test'));});await page.locator('#display').selectOption('fullscreen');await page.waitForFunction(()=>pursuit.snapshot().display.message.includes('unavailable'));await fitted();
    const wavDownload=page.waitForEvent('download');await page.locator('#track-export').click();const wav=await readFile(await (await wavDownload).path());const hash=b=>createHash('sha256').update(b).digest('hex');assert.equal(hash(wav),hash(composeTrack().wav()));await writeFile('browser-artifacts/pursuit-night-shift.wav',wav);
    const recordDownload=page.waitForEvent('download');await page.locator('#replay-export').click();const record=JSON.parse(await readFile(await (await recordDownload).path(),'utf8'));assert.deepEqual(snapshot(replay(record)),await page.evaluate(()=>pursuit.snapshot().state));
    // Full real rule loop under controlled input; no state, timer or health edits.
    await page.locator('#restart').click();
    const terminal=await page.evaluate(()=>{pursuit.advance(Array(4200).fill(0));return pursuit.snapshot().audio;});
    assert.equal(await page.locator('#menu-title').textContent(),'TARGET LOST.');
    assert.equal(terminal.music.active,false);assert.ok(terminal.effects.voices>0,'Failure cue must survive the terminal update');
    await page.waitForFunction(()=>pursuit.snapshot().audio.effects.voices===0);
    // Focus loss must still cancel a terminal tail although gameplay is already stopped.
    await page.locator('#restart').click();
    const focusTail=await page.evaluate(()=>{pursuit.advance(Array(4200).fill(0));const before=pursuit.snapshot().audio.effects.voices;window.dispatchEvent(new Event('blur'));return {before,after:pursuit.snapshot().audio.effects.voices};});
    assert.ok(focusTail.before>0);assert.equal(focusTail.after,0);
    for(const viewport of [{width:1836,height:888},{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
      await page.setViewportSize(viewport);await page.locator('#restart').click();await fitted();
      if(viewport.width<800){const gas=page.locator('[data-control="throttle"]');
        // Real pointer capture, then cancellation, including multi-key hold semantics.
        const box=await gas.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForFunction(()=>pursuit.snapshot().state.car.speed>1);await gas.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();assert.equal(await page.evaluate(()=>pursuit.snapshot().mask),0);
      }
      await page.keyboard.press('KeyP');await fitted();
      await captureIdle(`browser-artifacts/pursuit-${viewport.width}x${viewport.height}.png`);
    }
    // Standard-controller input must return to neutral after pause/disconnect.
    await page.evaluate(()=>{window.pursuitPad={id:'test',index:0,mapping:'standard',connected:true,axes:[0],buttons:Array.from({length:16},()=>({value:0,pressed:false}))};navigator.getGamepads=()=>[pursuitPad];});
    await page.locator('#resume').click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.evaluate(()=>pursuitPad.buttons[7].value=1);await page.waitForFunction(()=>pursuit.snapshot().state.car.speed>5);await page.evaluate(()=>pursuitPad.connected=false);await page.waitForFunction(()=>pursuit.snapshot().paused);const disconnected=await page.evaluate(()=>pursuit.snapshot().state.tick);await page.evaluate(()=>pursuitPad.connected=true);await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>pursuit.snapshot().state.tick),disconnected);
    await page.evaluate(()=>navigator.getGamepads=()=>[]);
    await page.evaluate(()=>navigator.serviceWorker.ready);await page.goto(base+'demos/pursuit-lab/index.html');await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await page.locator('#launch').click();await page.waitForFunction(()=>pursuit.snapshot().state.tick>2);await context.setOffline(false);
    await page.addInitScript(()=>{window.failAudio=true;const create=AudioContext.prototype.createBuffer;AudioContext.prototype.createBuffer=function(...args){if(window.failAudio)throw Error('test device failure');return create.apply(this,args);};});
    await page.reload();await page.locator('#launch').click();await page.waitForFunction(()=>pursuit.snapshot().audio.failed&&pursuit.snapshot().state.tick>6);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vanillajs-pursuit-v1')).sound),true);
    await page.evaluate(()=>window.failAudio=false);await page.locator('#sound').click();await page.locator('#sound').click();await page.waitForFunction(()=>pursuit.snapshot().audio.music?.active);
    assert.deepEqual(errors,[]);console.log('Pursuit Lab: controls, pause/repeat cancellation, native/fallback fullscreen, four fitted sizes, touch, gamepad, WAV/replay and offline PASS');
  }catch(error){
    console.error('Pursuit browser diagnostics:',await page.evaluate(()=>({tick:window.pursuit?.snapshot().state.tick,mode:window.pursuit?.snapshot().state.mode,paused:window.pursuit?.snapshot().paused,mask:window.pursuit?.snapshot().mask,width:innerWidth,scroll:document.documentElement.scrollWidth,canvas:document.querySelector('canvas')?.getBoundingClientRect().toJSON()})).catch(()=>null),errors);
    // Diagnostic capture must not add another full timeout or hide the failure.
    await page.screenshot({path:'browser-artifacts/pursuit-failure.png',fullPage:true,timeout:5000}).catch(()=>{});throw error;
  }finally{await context.close();}
  await checkPursuitUpgrade(browser,base);
}
