// SPDX-License-Identifier: Apache-2.0
// Packaged authoring witness. The caller owns browser launch and owner approval.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {parsePack} from '../demos/4x-game-lab/voidward/js/content.js';

export async function verifyEditor4X(browser,base){
  await mkdir('browser-artifacts',{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[],checks=[],screenshots=[];
  context.on('page',p=>p.on('pageerror',error=>errors.push(error.message)));page.on('pageerror',error=>errors.push(error.message));
  const files=()=>page.evaluate(()=>__editor4x.files),control=id=>page.locator('#fourx-'+id);
  async function download(button){const pending=page.waitForEvent('download');await button.click();const item=await pending;assert.equal(await item.failure(),null);return readFile(await item.path(),'utf8');}
  async function openSection(label){const summary=page.locator('#fourx-workshop summary').filter({hasText:label});if(!await summary.evaluate(el=>el.parentElement.open))await summary.click();}
  async function imported(text){await control('import').setInputFiles({name:'campaign.json',mimeType:'application/json',buffer:Buffer.from(text)});await page.waitForFunction(()=>document.querySelector('#fourx-status').textContent.includes('Campaign imported and validated')&&!document.querySelector('#fourx-export').disabled);}
  async function screenshot(name){await page.screenshot({path:'browser-artifacts/'+name,fullPage:true});screenshots.push(name);}
  try{
    await page.goto(base+'demos/editor/index.html#fourx');await page.waitForFunction(()=>__editor4x&&!document.querySelector('#fourx-export').disabled&&document.documentElement.dataset.editorReady==='ready');
    assert.equal(await page.locator('#fourx-workshop>details').evaluate(el=>el.open),true);
    await control('starter').click();await page.waitForFunction(()=>document.querySelector('#fourx-status').textContent.includes('Frontier template loaded'));
    const original=await files(),nativeTemplate=await download(control('export'));await imported(nativeTemplate);assert.deepEqual(await files(),original);checks.push('native-template-import');
    await page.locator('#play').click();assert.equal(await control('identity').isDisabled(),true);assert.equal(await control('import').isDisabled(),true);await page.locator('#stop').click();assert.equal(await control('identity').isDisabled(),false);checks.push('scene-play-isolation');

    await control('id').fill('editor-browser-universe');await control('title').fill('Editor Browser Universe');await control('identity').click();
    await openSection('Campaign text files');await control('file').selectOption('system_names.txt');const names=await control('text').inputValue();await control('text').fill(names.replace(/^[^\n]+/,'Editor Beacon'));await control('text-apply').focus();await page.keyboard.press('Enter');
    assert.equal(parsePack(await files()).systemNames[0],'Editor Beacon');await control('undo').click();assert.notEqual(parsePack(await files()).systemNames[0],'Editor Beacon');await control('redo').click();assert.equal(parsePack(await files()).systemNames[0],'Editor Beacon');checks.push('text-edit-campaign-undo-redo');

    await openSection('Galaxy in the 3D viewport');await control('map-scene').click();assert.equal(await page.locator('#count').textContent(),'30');
    await page.locator('#undo').click();assert.equal(await page.locator('#count').textContent(),'4');await page.locator('#redo').click();assert.equal(await page.locator('#count').textContent(),'30');
    await page.locator('#hierarchy [data-id="entity-1"]').click();
    await page.locator('[data-axis="position"][data-i="0"]').fill('123');await page.locator('[data-axis="position"][data-i="0"]').press('Tab');
    await page.locator('[data-axis="position"][data-i="2"]').fill('234');await page.locator('[data-axis="position"][data-i="2"]').press('Tab');
    await control('map-apply').click();assert.deepEqual(parsePack(await files()).layout.find(s=>s.id===0),{id:0,x:246,y:468});
    await control('lane-target').selectOption('29');await control('connect').click();let pack=parsePack(await files());assert.ok(pack.map[0].links.includes(29)&&pack.map[29].links.includes(0));
    await control('home-empire').selectOption('0');await control('home').click();assert.equal(parsePack(await files()).empires[0].home,0);
    await page.locator('#view').focus();await page.keyboard.press('Shift+f');await screenshot('editor-4x-viewport.png');checks.push('native-viewport-positions-scene-undo-lanes-homes');

    await openSection('Selected geometry');await control('hull').selectOption('scout-0');await control('project').click();await page.waitForFunction(()=>!document.querySelector('#fourx-project-apply').disabled);await control('project-apply').click();
    assert.ok(parsePack(await files()).provenance.some(p=>p.license==='OWNER-LOCAL-ONLY'));
    await page.locator('#asset-license').selectOption('MIT');await page.locator('#asset-obj').setInputFiles({name:'editor-original-wing.obj',mimeType:'text/plain',buffer:Buffer.from('v 0 0 -1\nv 1 0 1\nv -1 0 1\nf 1 2 3\n')});
    await page.waitForFunction(()=>document.querySelector('#asset-list option')?.textContent.includes('editor-original-wing.obj'));await page.locator('#asset-list').selectOption({index:0});await page.locator('#asset-attach').click();await page.locator('#add-child').click();await page.locator('#hierarchy [data-id="entity-1"]').click();
    await control('project').click();await page.waitForFunction(()=>!document.querySelector('#fourx-project-apply').disabled);await control('project-apply').click();pack=parsePack(await files());
    assert.deepEqual(new Set(pack.provenance.map(p=>p.license)),new Set(['MIT','OWNER-LOCAL-ONLY']));
    const hull=JSON.parse(await download(control('hull-export')));assert.equal(hull.kind,'voidward.workbench-hull.v1');assert.equal(hull.provenance.length,2);checks.push('primitive-mesh-projection-all-source-provenance');

    const portable=await download(control('export')),sdk=await download(control('sdk')),expected=parsePack(JSON.parse(portable).files).raw;
    await writeFile('browser-artifacts/editor-4x-campaign.json',portable);await writeFile('browser-artifacts/editor-4x-hull.json',JSON.stringify(hull,null,2));
    await imported(portable);assert.deepEqual(await files(),expected);await imported(sdk);assert.deepEqual(await files(),expected);
    await control('import').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"kind":"voidward.text-pack.v1","files":{}}')});await page.waitForFunction(()=>document.querySelector('#fourx-status').dataset.error==='true');assert.deepEqual(await files(),expected);checks.push('native-sdk-roundtrip-invalid-admission');
    await page.reload();await page.waitForFunction(()=>__editor4x&&!document.querySelector('#fourx-restore').disabled);await control('restore').click();assert.deepEqual(await files(),expected);checks.push('separate-campaign-recovery');

    const pending=context.waitForEvent('page');await control('play').click();const game=await pending;await game.waitForFunction(()=>globalThis.__voidward?.pack.meta.id==='editor-browser-universe');assert.deepEqual(await game.evaluate(()=>__voidward.pack.raw),expected);
    assert.equal(await game.evaluate(()=>localStorage.getItem('vanillajs.editor.4x-handoff.v1')),null);await game.locator('[data-action="end"]').click();assert.equal(await game.evaluate(()=>__voidward.state.turn),2);
    await game.locator('.nav').getByRole('button',{name:'Campaign workshop',exact:true}).click();await game.locator('[data-action="visual-workshop"]').click();await game.locator('[data-action="visual-editor-draft"]').click();await game.waitForURL('**/editor/index.html?draft=voidward');await game.waitForFunction(()=>__editor4x?.files['campaign.txt'].includes('editor-browser-universe'));
    assert.deepEqual(await game.evaluate(()=>__editor4x.files),expected);assert.equal(await game.evaluate(()=>localStorage.getItem('vanillajs.voidward.editor-draft.v1')),null);await game.close();checks.push('play-exported-draft-and-return-to-editor');

    const recovery=await page.evaluate(()=>localStorage.getItem('vanillajs.editor.4x-recovery.v1'));
    await page.evaluate(()=>localStorage.setItem('vanillajs.voidward.editor-draft.v1','{"kind":"wrong"}'));await page.goto(base+'demos/editor/index.html?draft=voidward');await page.waitForFunction(()=>document.querySelector('#fourx-status')?.textContent.includes('handoff rejected'));
    assert.equal(await page.evaluate(()=>localStorage.getItem('vanillajs.editor.4x-recovery.v1')),recovery);assert.equal(await page.evaluate(()=>localStorage.getItem('vanillajs.voidward.editor-draft.v1')),'{"kind":"wrong"}');
    await openSection('4X campaign workshop');await control('restore').click();assert.deepEqual(await files(),expected);checks.push('invalid-handoff-preserves-recovery-and-payload');
    await page.setViewportSize({width:320,height:900});await openSection('Campaign text files');await control('file').selectOption('campaign.txt');await control('text-apply').focus();await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'320px editor must not overflow horizontally');await screenshot('editor-4x-mobile.png');checks.push('320px-keyboard-authoring');
    assert.deepEqual(errors,[]);return{status:'PASS',checks,screenshots,artifacts:['editor-4x-campaign.json','editor-4x-hull.json'],limits:'Native project and Mod SDK budgets unchanged; campaign history separately bounded'};
  }catch(error){await page.screenshot({path:'browser-artifacts/editor-4x-failure.png',fullPage:true}).catch(()=>{});throw error;}
  finally{await context.close();}
}
