// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

export async function verifyDemosceneWorkbench(page,base){
  const bytes=()=>page.evaluate(()=>__editorDemoscene);
  const entry=async id=>JSON.parse(await bytes()).manifest.entries.find(e=>e.id===id).data;
  const status=message=>page.waitForFunction(s=>document.querySelector('#fx-status').textContent.includes(s),message);
  const click=async(id,message)=>{await page.locator('#fx-'+id).click();if(message)await status(message);};
  const set=async(selector,value)=>{await page.locator(selector).fill(value);await page.locator(selector).press('Tab');};
  await page.goto(base+'demos/editor/index.html#visual-fx');
  await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='ready');
  assert.equal(await page.locator('#fx-effect-apply').isDisabled(),true,'capture an object before applying its effect');
  assert.equal(await page.locator('#fx-key').isDisabled(),true);
  const initial=await bytes();
  // Both Play and Paused used to leave the entire panel silently disabled.
  for(const paused of [false,true]){
    await page.locator('#play').click();if(paused)await page.locator('#pause').click();
    assert.equal(await page.locator('#fx-add').isDisabled(),true);
    assert.equal(await page.locator('#fx-mode').isVisible(),true);
    assert.match(await page.locator('#fx-mode').textContent(),/including when paused/);
    await click('edit','Visual FX editing ready');
    assert.equal(await page.locator('#mode').textContent(),'EDIT');
    assert.equal(await page.locator('#fx-add').isEnabled(),true);
    assert.equal(await page.locator('#fx-mode').isHidden(),true);
    assert.equal(await bytes(),initial,'leaving Scene Play preserves composition');
    assert.equal(await page.locator('[data-axis="position"][data-i="1"]').inputValue(),'2.5','authored scene restored');
  }
  await click('add','Selected geometry');const captured=await bytes();
  assert.equal(await page.locator('#fx-node option').count(),1);
  assert.equal((await entry('node-0')).name,'PLAYER');
  await page.locator('#fx-effect').selectOption('radial');await set('#fx-copies','8');
  await click('effect-apply','Effect applied');assert.equal((await entry('node-0')).copies,8);assert.equal((await entry('node-0')).effect,'radial');
  await set('[data-axis="position"][data-i="0"]','3');await set('#object-yaw','90');
  await set('[data-axis="scale"][data-i="0"]','1.5');await set('#object-color','#ff0000');
  await set('#fx-time','18');await click('key','sample 864000');
  const key=(await entry('node-0')).keys.at(-1);
  assert.equal(key.position[0],3);assert.equal(key.rotation[1],Math.PI/2);assert.equal(key.scale[0],1.5);assert.deepEqual((await entry('node-0')).color,[1,0,0]);
  await click('preview-seek','Absolute-time preview at sample 864000');
  assert.equal(await page.locator('#fx-preview-state').textContent(),'Preview paused at 18.00 seconds');
  await page.screenshot({path:'browser-artifacts/demoscene-workbench.png',fullPage:true});
  await set('#fx-time','0.14');await set('#fx-copies','9');await click('effect-apply','Effect applied');
  const acceptedFractional=await bytes();await set('#fx-time','61');await set('#fx-copies','10');
  await click('effect-apply','Rejected');assert.equal(await bytes(),acceptedFractional);await set('#fx-time','18');
  await page.locator('#visual-fx details summary').click();
  await set('#fx-camera','1, 5, 30');await set('#fx-target','0, 2, 0');await click('camera-key','Camera key applied');
  assert.deepEqual((await entry('timeline')).camera.find(k=>k.sample===864000).position,[1,5,30]);
  await set('#fx-title','ALIEN WORKSHOP');await set('#fx-scroller','BUTTONS CONNECTED');await click('text','3D typography applied');
  assert.equal((await entry('settings')).text.title,'ALIEN WORKSHOP');
  const notes=(await entry('phrase-2')).notes[2];await page.locator('#fx-transpose').selectOption('2');await click('music','Integer score phrase changed');
  assert.deepEqual((await entry('phrase-2')).notes[2],notes.map(n=>n*2));
  await page.locator('#fx-cue').selectOption('1');await click('sync','selected voice');assert.equal((await entry('timeline')).cueChannel,1);
  await page.locator('#visual-fx details summary').click();
  await click('preview-play','Previewing the same effects');
  await page.waitForFunction(()=>{const match=/^Preview playing at ([0-9.]+)/.exec(document.querySelector('#fx-preview-state').textContent);return match&&Number(match[1])>18.1;});
  await click('preview-stop','Preview paused.');const paused=await page.locator('#fx-preview-state').textContent();
  await page.waitForTimeout(120);assert.equal(await page.locator('#fx-preview-state').textContent(),paused);
  // Delay a real AudioContext resume: Pause must win even while Play is pending.
  await page.evaluate(()=>{
    const original=AudioContext.prototype.resume;
    AudioContext.prototype.resume=function(){
      const resumed=original.call(this);window.__fxResumeWaiting=true;
      return Promise.all([resumed,new Promise(resolve=>{window.__fxReleaseResume=()=>{AudioContext.prototype.resume=original;resolve();};})]);
    };
  });
  await click('preview-play');await page.waitForFunction(()=>window.__fxResumeWaiting);
  await click('preview-stop','Preview paused.');await page.evaluate(()=>window.__fxReleaseResume());
  await page.waitForTimeout(120);assert.match(await page.locator('#fx-preview-state').textContent(),/^Preview paused/);
  assert.match(await page.locator('#fx-status').textContent(),/^Preview paused\./);
  await click('preview-play','Previewing the same effects');await page.locator('#play').click();
  assert.match(await page.locator('#fx-preview-state').textContent(),/^Preview paused/);await click('edit','Visual FX editing ready');
  const event=page.waitForEvent('download');await click('export','Validated project exported');const fx=await readFile(await (await event).path());
  assert.equal(fx.toString(),await bytes());assert.notEqual(fx.toString(),captured);
  await click('undo','FX undo');assert.notEqual(await bytes(),fx.toString());
  await click('redo','FX redo');assert.equal(await bytes(),fx.toString());
  await page.locator('#fx-import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});
  await status('Rejected');assert.equal(await bytes(),fx.toString());
  await click('undo','FX undo');
  await page.locator('#fx-import').setInputFiles({name:'fx.json',mimeType:'application/json',buffer:fx});await status('Composition imported');assert.equal(await bytes(),fx.toString());
  await page.locator('#fx-effect').selectOption('rotate');await set('#fx-copies','2');await click('add','Selected geometry');
  await page.locator('#fx-node').selectOption('node-1');assert.equal(await page.locator('#fx-effect').inputValue(),'rotate');assert.equal(await page.locator('#fx-copies').inputValue(),'2');
  await page.locator('#fx-node').selectOption('node-0');assert.equal(await page.locator('#fx-effect').inputValue(),'radial');assert.equal(await page.locator('#fx-copies').inputValue(),'9');
  // The actual desktop sidebar and narrow mobile layout must expose clickable controls.
  for(const width of [1024,375]){
    await page.setViewportSize({width,height:850});await click('preview-seek','Absolute-time preview');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Workbench horizontal overflow at '+width);
    const button=page.locator('#fx-key');await button.scrollIntoViewIfNeeded();
    const fits=await button.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.closest('.tree').getBoundingClientRect();return a.left>=b.left&&a.right<=b.right;});assert.equal(fits,true,'keyframe button fits sidebar');
  }
  await page.setViewportSize({width:1440,height:1100});
  console.log('Workbench FX: Play/Paused recovery, capture, effects, inspector keys, camera, text, score, cues, sound/pause/seek, undo/redo, import/export and narrow controls PASS');
  return fx;
}
