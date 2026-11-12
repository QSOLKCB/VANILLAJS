// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
async function download(page,id){
  const pending=page.waitForEvent('download');await page.locator(id).click();
  const file=await pending;assert.equal(await file.failure(),null);return readFile(await file.path());
}
export async function checkSoundtrack(browser,base){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto(base+'demos/soundtrack-lab/index.html');
    await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Cue ready'));
    assert.equal(await page.locator('#event-rows tr').count(),16);
    await page.locator('#preset').selectOption('race');
    await page.locator('#tempo').fill('137');await page.locator('#generate').click();
    const recipe=JSON.parse((await download(page,'#export-recipe')).toString());
    assert.equal(recipe.mapping.tempo,137);assert.equal(recipe.source.kind,'three-state');
    const score=JSON.parse((await download(page,'#export-events')).toString());
    assert.equal(score.frames,Math.floor(16*48000*30/137));assert.equal(score.events.length,16);
    const wav=await download(page,'#export-wav');
    assert.equal(wav.subarray(0,4).toString(),'RIFF');assert.equal(wav.readUInt32LE(24),48000);
    assert.equal(wav.readUInt32LE(40),score.frames*2);
    await page.locator('#listen').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Playing your cue.');
    assert.equal(await page.locator('#stop').isDisabled(),false);
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    assert.equal(await page.locator('#stop').isDisabled(),true);
    assert.ok((await page.locator('#status').textContent()).includes('lost focus'));
    await page.locator('#listen').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Playing your cue.');
    await page.locator('#stop').click();assert.equal(await page.locator('#listen').isDisabled(),false);
    await page.locator('#preset').selectOption('outpost');
    await page.locator('#open-recipe').setInputFiles({name:'cue.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(recipe))});
    await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Recipe restored'));
    assert.equal(await page.locator('#tempo').inputValue(),'137');
    for(const buffer of [Buffer.from('{bad'),Buffer.from(JSON.stringify({...recipe,script:'alert(1)'})),Buffer.alloc(4097,32)]){
      await page.locator('#open-recipe').setInputFiles({name:'bad.json',mimeType:'application/json',buffer});
      await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Recipe rejected'));
      assert.equal(await page.locator('#tempo').inputValue(),'137');
      assert.deepEqual(JSON.parse((await download(page,'#export-recipe')).toString()),recipe);
    }
    // Invalid edits cannot silently export a previous cue.
    await page.locator('#tempo').fill('30');await page.locator('#export-wav').click();
    assert.ok((await page.locator('#status').textContent()).startsWith('Export rejected'));
    await page.locator('#tempo').fill('137');await page.locator('#generate').click();
    await mkdir('browser-artifacts',{recursive:true});
    await page.screenshot({path:'browser-artifacts/soundtrack-desktop.png',fullPage:true});
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Soundtrack overflow at '+width);
      await page.locator('#export-recipe').focus();await page.keyboard.press('Enter');
    }
    await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();
    await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Cue ready'));
    assert.equal((await download(page,'#export-wav')).subarray(0,4).toString(),'RIFF');
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
  const unavailable=await browser.newContext(),p=await unavailable.newPage();
  try{
    await p.addInitScript(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});
    await p.goto(base+'demos/soundtrack-lab/index.html');await p.locator('#listen').click();
    await p.waitForFunction(()=>document.querySelector('#status').textContent.includes('Audio playback is unavailable'));
    assert.equal((await download(p,'#export-wav')).subarray(0,4).toString(),'RIFF');
  }finally{await unavailable.close();}
  // A delayed AudioContext.resume must not start audio after Stop or focus loss.
  const delayed=await browser.newContext(),pending=await delayed.newPage();
  try{
    await pending.addInitScript(()=>{
      window.startedVoices=0;
      window.AudioContext=class{
        resume(){return new Promise(resolve=>{window.finishResume=resolve;});}
        createBufferSource(){window.startedVoices++;throw new Error('Cancelled audio must not create a voice');}
        close(){return Promise.resolve();}
      };
    });
    await pending.goto(base+'demos/soundtrack-lab/index.html');await pending.locator('#listen').click();
    await pending.waitForFunction(()=>document.querySelector('#status').textContent==='Starting audio…');
    await pending.locator('#stop').click();await pending.evaluate(async()=>{window.finishResume();await Promise.resolve();});
    assert.equal(await pending.evaluate(()=>window.startedVoices),0);
    assert.equal(await pending.locator('#stop').isDisabled(),true);
    assert.ok((await pending.locator('#status').textContent()).startsWith('Stopped.'));
  }finally{await delayed.close();}
  console.log('Soundtrack Lab: real controls, PCM/WAV and score export, strict imports, audio stop/focus handling, mobile layout and offline rendering passed.');
}
