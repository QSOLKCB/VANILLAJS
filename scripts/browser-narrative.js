// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {validateStory,restoreSave,createState,choose} from '../modules/narrative/index.js';
import {lanternStory} from '../demos/narrative-foundry/story.js';
export async function checkNarrativeFoundry(browser,base){
  const context=await browser.newContext({viewport:{width:1480,height:1050},hasTouch:true}),page=await context.newPage(),errors=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
  page.setDefaultTimeout(15000);await mkdir('browser-artifacts',{recursive:true});
  const snapshot=()=>page.evaluate(()=>__narrativeFoundry.snapshot());
  const story=async()=>validateStory((await snapshot()).story);
  const scenePixels=()=>page.locator('#scene').evaluate(c=>{window.dispatchEvent(new Event('resize'));const gl=c.getContext('webgl'),pixels=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let h=2166136261;for(const value of pixels)h=Math.imul(h^value,16777619)>>>0;return h;});
  const play=id=>page.locator('[data-play-choice="'+id+'"]').click();
  const node=id=>page.locator('[data-node="'+id+'"]').click();
  const download=async id=>{const wait=page.waitForEvent('download');await page.locator('#'+id).click();const value=await wait;return readFile(await value.path());};
  try{
    await page.goto(base+'demos/narrative-foundry/index.html');await page.waitForFunction(()=>document.documentElement.dataset.labReady==='narrative-foundry');
    assert.deepEqual(await story(),validateStory(lanternStory()));assert.equal((await snapshot()).scene.lit,false);
    assert.equal(await page.locator('#scene-fallback').isVisible(),false,'actual native scene renderer available');
    const pixels=await page.locator('#scene').evaluate(c=>{window.dispatchEvent(new Event('resize'));const gl=c.getContext('webgl'),pixels=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return {width:c.width,height:c.height,bright:[...pixels].filter((v,i)=>i%4!==3&&v>80).length};});
    assert.ok(pixels.width>100&&pixels.height>100&&pixels.bright>100,'scene draws original geometry');
    await page.screenshot({path:'browser-artifacts/narrative-foundry-desktop.png',fullPage:true});
    const unlitPixels=await scenePixels();
    // Real public module choices, authored conditions and actual scene changes.
    await play('inspect-beacon');assert.equal(await page.locator('[data-play-choice="fit-prism"]').isDisabled(),true);
    await play('back-workshop');assert.equal((await snapshot()).state.variables.hasLens,true);
    await play('carry-lens');await play('fit-prism');
    assert.equal((await snapshot()).state.node,'harbor');assert.equal((await snapshot()).state.objectives['restore-light'],'complete');
    assert.deepEqual((await snapshot()).scene,{lit:true,ending:'harbor'});assert.equal(await page.locator('#scene').getAttribute('data-lit'),'true');
    const litPixels=await scenePixels();assert.notEqual(litPixels,unlitPixels,'story cue changes actual GPU scene pixels');
    const progress=await download('export-save'),original=await story();assert.equal(restoreSave(original,progress.toString()).node,'harbor');
    await page.locator('#restart').click();assert.deepEqual((await snapshot()).scene,{lit:false,ending:'unlit'});
    assert.equal(await scenePixels(),unlitPixels,'restart restores unlit scene geometry');
    await page.locator('#import-save').setInputFiles({name:'harbor.progress.json',mimeType:'application/json',buffer:progress});
    await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Progress restored'));
    assert.equal((await snapshot()).state.node,'harbor');assert.deepEqual((await snapshot()).scene,{lit:true,ending:'harbor'},'restored exact history reconstructs the actual scene');
    assert.equal(await scenePixels(),litPixels,'progress restore reconstructs rendered scene');
    await page.locator('#restart').click();await page.locator('[data-play-choice="find-lens"]').focus();await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'preview-title','new moment receives keyboard focus');
    await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.playChoice),'carry-lens');await page.keyboard.press('Enter');
    assert.equal((await snapshot()).state.node,'beacon');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.playChoice),'fit-prism');await page.keyboard.press('Enter');assert.equal((await snapshot()).state.node,'harbor','successive keyboard choices need no scripted refocusing');
    await page.locator('#restart').click();await play('take-ridge');await play('ridge-tower');await play('answer-courier');assert.equal((await snapshot()).state.node,'courier');assert.equal((await snapshot()).scene.ending,'courier');
    await page.locator('#restart').click();await play('leave-dark');assert.deepEqual((await snapshot()).scene,{lit:false,ending:'dark'});

    // Author a new ending through visible forms, then link and condition it.
    await page.locator('#new-node-id').fill('morning');await page.locator('#new-node-title').fill('A new morning');await page.locator('#add-node').click();
    assert.equal((await snapshot()).selected,'morning');assert.ok((await page.locator('#diagnostics').textContent()).includes('Unreachable: morning'));
    await page.locator('#dialogue').fill('The harbor wakes. Your new choice has changed this story.');await page.locator('#apply-node').click();
    await node('arrival');await page.locator('#new-choice').click();await page.locator('#choice-id').fill('new-morning');await page.locator('#choice-label').fill('Wait for the first warm light');await page.locator('#choice-target').selectOption('morning');
    await page.locator('#condition-op').selectOption('gte');await page.locator('#condition-subject').selectOption('courage');await page.locator('#condition-value').fill('2');
    await page.locator('#effect-op').selectOption('event');await page.locator('#effect-subject').selectOption('harbor-safe');await page.locator('#apply-choice').click();
    assert.equal(await page.locator('[data-play-choice="new-morning"]').isDisabled(),true,'authored condition affects actual choices');
    await page.locator('#initial-variable').selectOption('courage');await page.locator('#initial-value').fill('2');await page.locator('#apply-initial').click();
    assert.equal(await page.locator('[data-play-choice="new-morning"]').isEnabled(),true);
    await play('new-morning');assert.equal((await snapshot()).state.node,'morning');assert.equal((await snapshot()).scene.ending,'harbor');
    assert.match(await page.locator('#preview-text').textContent(),/Your new choice/);
    let reference=createState(await story());reference=choose(await story(),reference.state,'new-morning');assert.deepEqual((await snapshot()).state,reference.state);

    const accepted=(await snapshot()).story,authoredProgress=await download('export-save'),exported=await download('export-story');assert.deepEqual(validateStory(exported.toString()),await story());
    await page.locator('#import-story').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{}')});await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Not applied:'));
    assert.equal((await snapshot()).story,accepted);assert.equal((await snapshot()).state.node,'morning','failed import preserves running preview');
    await page.locator('#import-save').setInputFiles({name:'wrong.progress.json',mimeType:'application/json',buffer:progress});await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Not applied:'));
    assert.equal((await snapshot()).state.node,'morning','wrong-story save rejected transactionally');
    await node('morning');await page.locator('#delete-node').click();assert.equal((await snapshot()).story,accepted,'linked node deletion rejected without partial edits');
    await page.getByText('Inspect or edit complete story JSON',{exact:true}).click();
    const invalid=JSON.parse(accepted);invalid.nodes[0].choices[0].target='missing';await page.locator('#story-json').fill(JSON.stringify(invalid));await page.locator('#apply-json').click();assert.equal((await snapshot()).story,accepted);
    const malicious=JSON.parse(accepted);malicious.nodes[0].onEnter=[{op:'script',source:'globalThis.pwned=true'}];await page.locator('#story-json').fill(JSON.stringify(malicious));await page.locator('#apply-json').click();assert.equal((await snapshot()).story,accepted);assert.equal(await page.evaluate(()=>globalThis.pwned),undefined);
    // Authored markup is visible text, never an HTML element or event handler.
    const literal='<img src=x onerror="globalThis.pwned=true">';await node('morning');await page.locator('#node-title').fill(literal);await page.locator('#apply-node').click();assert.equal(await page.locator('[data-node="morning"] strong').textContent(),literal);assert.equal(await page.locator('#map img').count(),0);assert.equal(await page.evaluate(()=>globalThis.pwned),undefined);await page.locator('#undo').click();assert.equal((await snapshot()).story,accepted);
    // Reject an out-of-order async import if the creator deliberately restarts.
    await page.evaluate(()=>{const original=File.prototype.text;File.prototype.text=function(){File.prototype.text=original;return new Promise(resolve=>{window.finishLateImport=()=>original.call(this).then(resolve);});};});
    await page.locator('#import-story').setInputFiles({name:'late-original.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(lanternStory()))});
    await page.locator('#restart').click();await page.evaluate(()=>finishLateImport());await page.waitForTimeout(50);
    assert.equal((await snapshot()).story,accepted,'late import cannot replace a newer user action');
    await page.locator('#story-json').fill(accepted);
    await page.locator('#undo').click();assert.equal((await story()).variables.find(v=>v.id==='courage').initial,1);await page.locator('#redo').click();assert.equal((await snapshot()).story,accepted);
    await page.locator('#example').click();assert.equal((await story()).nodes.length,7);
    await page.locator('#import-story').setInputFiles({name:'authored.narrative.json',mimeType:'application/json',buffer:exported});await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Validated story imported'));
    assert.equal((await snapshot()).story,accepted);
    await page.locator('#import-save').setInputFiles({name:'authored.progress.json',mimeType:'application/json',buffer:authoredProgress});await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Progress restored'));assert.equal((await snapshot()).state.node,'morning');
    await page.locator('#restart').click();await page.locator('[data-play-choice="new-morning"]').focus();await page.keyboard.press('Enter');assert.equal((await snapshot()).state.node,'morning','keyboard plays a choice');
    const draws=(await snapshot()).view.draws;await page.waitForTimeout(200);assert.equal((await snapshot()).view.draws,draws,'idle narrative preview does not render continuously');
    await page.setViewportSize({width:320,height:900});await page.emulateMedia({reducedMotion:'reduce'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'320px layout does not overflow');
    await page.screenshot({path:'browser-artifacts/narrative-foundry-mobile.png',fullPage:true});
    await page.locator('#restart').click();await page.locator('[data-play-choice="new-morning"]').scrollIntoViewIfNeeded();await page.locator('[data-play-choice="new-morning"]').tap();
    assert.equal((await snapshot()).state.node,'morning');
    // Native context loss preserves the narrative state, then rebuilt resources recover.
    await page.evaluate(()=>{window.sceneLoss=document.querySelector('#scene').getContext('webgl').getExtension('WEBGL_lose_context');if(!sceneLoss)throw Error('Context-loss extension unavailable');sceneLoss.loseContext();});
    await page.locator('#scene-fallback').waitFor({state:'visible'});await page.locator('#restart').click();await play('leave-dark');assert.equal((await snapshot()).state.node,'dark');
    await page.evaluate(()=>sceneLoss.restoreContext());await page.waitForFunction(()=>__narrativeFoundry.snapshot().view!==null&&document.querySelector('#scene-fallback').hidden);
    // A new controlled client, after explicit worker activation, then offline.
    await page.evaluate(async expected=>{let timer;try{await Promise.race([(async()=>{const r=await navigator.serviceWorker.ready;if(r.scope!==expected||!r.active)throw Error('Incorrect offline scope');if(r.active.state!=='activated')await new Promise((resolve,reject)=>{const w=r.active;const f=()=>{if(w.state==='activated'){w.removeEventListener('statechange',f);resolve();}else if(w.state==='redundant'){w.removeEventListener('statechange',f);reject(Error('Offline worker redundant'));}};w.addEventListener('statechange',f);f();});})(),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Offline worker timeout')),45000))]);}finally{clearTimeout(timer);}},base);
    await context.setOffline(true);const offline=await context.newPage(),response=await offline.goto(base+'demos/narrative-foundry/index.html');assert.equal(response.fromServiceWorker(),true);
    await offline.waitForFunction(()=>document.documentElement.dataset.labReady==='narrative-foundry');assert.ok(await offline.evaluate(()=>!!navigator.serviceWorker.controller));
    for(const id of ['find-lens','carry-lens','fit-prism'])await offline.locator('[data-play-choice="'+id+'"]').click();assert.equal(await offline.locator('#scene').getAttribute('data-cue'),'harbor');
    await offline.locator('#new-node-id').fill('offline-note');await offline.locator('#new-node-title').fill('Written offline');await offline.locator('#add-node').click();assert.equal(await offline.locator('#selected-id').textContent(),'offline-note');
    await offline.close();assert.deepEqual(errors,[]);
  }finally{await context.close();}
  const fallback=await browser.newContext();try{const p=await fallback.newPage();await p.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...rest){return kind==='webgl'?null:original.call(this,kind,...rest);};});await p.goto(base+'demos/narrative-foundry/index.html');await p.waitForFunction(()=>document.documentElement.dataset.labReady==='narrative-foundry');assert.equal(await p.locator('#scene-fallback').isVisible(),true);await p.locator('[data-play-choice="leave-dark"]').click();assert.equal(await p.evaluate(()=>__narrativeFoundry.snapshot().state.node),'dark','story survives unavailable graphics');}finally{await fallback.close();}
  const allocation=await browser.newContext();try{const p=await allocation.newPage();await p.addInitScript(()=>{window.sceneResources={created:0,deleted:0};const proto=WebGLRenderingContext.prototype,create=proto.createProgram,dispose=proto.deleteProgram;proto.createProgram=function(...args){sceneResources.created++;return create.apply(this,args);};proto.deleteProgram=function(...args){sceneResources.deleted++;return dispose.apply(this,args);};proto.createBuffer=function(){throw Error('Injected mesh allocation failure');};});await p.goto(base+'demos/narrative-foundry/index.html');await p.waitForFunction(()=>document.documentElement.dataset.labReady==='narrative-foundry');assert.equal(await p.locator('#scene-fallback').isVisible(),true);const owned=await p.evaluate(()=>sceneResources);assert.ok(owned.created>0);assert.equal(owned.deleted,owned.created,'partial scene construction disposes every owned renderer program');await p.locator('[data-play-choice="leave-dark"]').click();assert.equal(await p.evaluate(()=>__narrativeFoundry.snapshot().state.node),'dark');}finally{await allocation.close();}
  console.log('Narrative Foundry: real node/choice/condition authoring, three endings, actual scene cues, exact story/progress roundtrip, rejected data, keyboard/narrow layout, retained rendering, graphics fallback and controlled offline editing/play PASS');
}
