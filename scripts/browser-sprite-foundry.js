// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {parseSpriteProject,serializeSpriteProject,generateSprite,rgbaFrame,buildSpriteAtlas} from '../modules/sprite2d/index.js';
import {palettes} from '../demos/sprite-foundry/examples.js';
export async function checkSpriteFoundry(browser,base){
  const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage(),errors=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));page.on('pageerror',e=>errors.push(e.message));
  page.setDefaultTimeout(15000);await mkdir('browser-artifacts',{recursive:true});
  const snapshot=()=>page.evaluate(()=>__spriteFoundry.snapshot());
  const state=async()=>parseSpriteProject((await snapshot()).project);
  const download=async id=>{const waiting=page.waitForEvent('download');await page.locator('#'+id).click();const result=await waiting;return readFile(await result.path());};
  const wait=()=>page.waitForFunction(()=>document.documentElement.dataset.labReady==='sprite-foundry');
  try{
    await page.goto(base+'demos/sprite-foundry/index.html');await wait();
    await page.screenshot({path:'browser-artifacts/sprite-foundry-desktop.png',fullPage:true});
    await page.locator('#seed').fill('42');await page.locator('#generate').click();
    const expected=generateSprite({kind:'character',size:16,seed:42,symmetry:true,frameCount:4,palette:palettes.relay},{name:'Relay Cadet'});
    assert.deepEqual(await state(),expected,'visible seed controls generate exact public-module data');
    const canvas=page.locator('#pixel-canvas');
    await canvas.click({position:{x:4,y:4}});
    assert.equal((await state()).frames[0].pixels[0],1,'actual pointer paints');
    await page.locator('#duplicate').click();assert.equal((await state()).frames.length,5);
    await canvas.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');
    const edited=await state();assert.equal(edited.frames[1].pixels[1],1);assert.equal(edited.frames[0].pixels[1],0,'duplicate owns independent pixels');
    await page.locator('#undo').click();assert.equal((await state()).frames[1].pixels[1],0);
    await page.locator('#redo').click();assert.equal((await state()).frames[1].pixels[1],1);
    await page.locator('#duration').fill('200');await page.locator('#apply-duration').click();
    await page.locator('#move-left').click();assert.equal((await state()).frames[0].durationMs,200);
    await page.locator('#move-right').click();assert.equal((await state()).frames[1].durationMs,200);
    await page.locator('#onion').check();
    await page.locator('#animate').click();await page.waitForFunction(()=>__spriteFoundry.snapshot().previewFrame>=2);
    await page.evaluate(()=>dispatchEvent(new Event('blur')));
    assert.equal((await snapshot()).playing,false,'blur pauses authoring playback');
    await page.locator('#erase').click();await canvas.click({position:{x:4,y:4}});assert.equal((await state()).frames[1].pixels[0],0);
    await page.locator('#fill').click();await canvas.click({position:{x:4,y:4}});assert.equal((await state()).frames[1].pixels[0],1);
    await page.locator('#undo').click();await page.locator('#pencil').click();

    // Cancellation must roll back an uncommitted stroke instead of inventing
    // an accepted edit or retaining a held touch/pointer.
    const beforeCancel=(await snapshot()).project;
    const bounds=await canvas.boundingBox();await page.mouse.move(bounds.x+4,bounds.y+4);await page.mouse.down();
    assert.equal((await snapshot()).gesture,true);
    await canvas.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();
    assert.equal((await snapshot()).project,beforeCancel);assert.equal((await snapshot()).gesture,false);
    const indices=(await state()).frames;
    await page.locator('#palette-preset').selectOption('signal');await page.locator('#apply-palette').click();
    assert.deepEqual((await state()).frames,indices,'palette edit preserves drawing and timing');
    await page.locator('#alpha').fill('128');await page.locator('#apply-color').click();
    assert.equal((await state()).recipe.palette[1][3],128);
    await page.locator('#undo').click();

    const accepted=await state(),project=await download('export-project');
    assert.deepEqual(parseSpriteProject(project.toString()),accepted);
    const png=await download('export-png'),sheet=await download('export-sheet'),atlas=JSON.parse((await download('export-atlas')).toString());
    assert.deepEqual(atlas,buildSpriteAtlas(accepted).metadata);
    assert.equal(png.readUInt32BE(16),16);assert.equal(png.readUInt32BE(20),16);
    assert.equal(sheet.readUInt32BE(16),atlas.width);assert.equal(sheet.readUInt32BE(20),atlas.height);
    const frame=(await snapshot()).frame;
    const decoded=await page.evaluate(async bytes=>{
      const image=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}),{colorSpaceConversion:'none',premultiplyAlpha:'none'});
      const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);image.close();
      return [...c.getContext('2d').getImageData(0,0,c.width,c.height).data];
    },[...png]);
    assert.deepEqual(decoded,[...rgbaFrame(accepted,frame)],'opaque/transparent source texels survive PNG export');
    await page.locator('#import-project').setInputFiles({name:'bad.sprite.json',mimeType:'application/json',buffer:Buffer.from('{}')});
    await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Not applied:'));
    assert.deepEqual(await state(),accepted,'invalid import is transactional');
    await page.locator('#seed').fill('-1');await page.locator('#generate').click();assert.deepEqual(await state(),accepted);
    await page.locator('#import-project').setInputFiles({name:'roundtrip.sprite.json',mimeType:'application/json',buffer:project});
    await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Validated project'));
    assert.deepEqual(await state(),accepted);

    // Restored selection/cursor cannot retain indexes from a larger palette.
    const large=generateSprite({kind:'enemy',size:32,seed:9,symmetry:false,frameCount:2,palette:[...palettes.relay,[1,2,3,255],[4,5,6,255],[7,8,9,255]]});
    await page.locator('#import-project').setInputFiles({name:'larger.sprite.json',mimeType:'application/json',buffer:Buffer.from(serializeSpriteProject(large))});
    await page.waitForFunction(()=>JSON.parse(__spriteFoundry.snapshot().project).recipe.size===32);
    await page.locator('#palette [data-index="7"]').click();await canvas.focus();
    for(let i=0;i<31;i++)await page.keyboard.press('ArrowRight');
    await page.locator('#undo').click();assert.ok((await snapshot()).color<accepted.recipe.palette.length);
    assert.deepEqual(await state(),accepted);
    await page.locator('#redo').click();assert.deepEqual(await state(),large);
    await page.locator('#undo').click();

    // Reuse the actual explicit flattened export in the existing Asset Foundry.
    await page.locator('summary').click();
    const opaque=await download('export-opaque'),editor=await context.newPage();
    await editor.goto(base+'demos/editor/index.html');
    await editor.waitForFunction(()=>document.documentElement.dataset.editorReady==='ready');
    await editor.locator('#asset-license').selectOption('Apache-2.0');
    await editor.locator('#asset-png').setInputFiles({name:'sprite-opaque.png',mimeType:'image/png',buffer:opaque});
    await editor.waitForFunction(()=>document.querySelector('#status').textContent==='Imported canonical opaque PNG texels · sprite-opaque.png');
    assert.ok((await editor.locator('#asset-list').textContent()).includes('sprite-opaque.png'));
    await editor.close();

    await page.setViewportSize({width:320,height:900});await page.emulateMedia({reducedMotion:'reduce'});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'320px creator layout');
    await page.screenshot({path:'browser-artifacts/sprite-foundry-mobile.png',fullPage:true});
    await page.locator('#example').selectOption('moss-guardian');await page.locator('#load-example').click();
    assert.equal((await state()).name,'Moss Guardian','restart/example loading remains usable');

    // Explicit readiness, followed by a NEW controlled client offline. Existing
    // clients are intentionally not claimed by the shared offline worker.
    const worker=await page.evaluate(async expected=>{
      let timer;
      try{return await Promise.race([
        (async()=>{
          const registration=await navigator.serviceWorker.ready,active=registration.active;
          if(!active)throw Error('No active offline worker');
          if(active.state!=='activated')await new Promise((resolve,reject)=>{
            const listener=()=>{if(active.state==='activated'){active.removeEventListener('statechange',listener);resolve();}
              else if(active.state==='redundant'){active.removeEventListener('statechange',listener);reject(Error('Worker redundant'));}};
            active.addEventListener('statechange',listener);listener();
          });
          if(registration.scope!==expected)throw Error('Unexpected worker scope');
          return {scope:registration.scope,state:active.state};
        })(),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Sprite offline worker not activated in 45 seconds')),45000);})
      ]);}finally{clearTimeout(timer);}
    },base);
    assert.deepEqual(worker,{scope:base,state:'activated'});
    await context.setOffline(true);
    const offline=await context.newPage(),response=await offline.goto(base+'demos/sprite-foundry/index.html');
    assert.equal(response.fromServiceWorker(),true);
    await offline.waitForFunction(()=>document.documentElement.dataset.labReady==='sprite-foundry');
    await offline.locator('#seed').fill('19');await offline.locator('#generate').click();
    assert.equal(await offline.evaluate(()=>JSON.parse(__spriteFoundry.snapshot().project).recipe.seed),19);
    await offline.locator('#pixel-canvas').focus();await offline.keyboard.press('Space');
    assert.equal(await offline.evaluate(()=>JSON.parse(__spriteFoundry.snapshot().project).frames[0].pixels[0]),1);
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
  // A real touchscreen tap uses the same drawing transaction; no permanent
  // gesture is left behind when the pointer ends.
  const touch=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  try{const page=await touch.newPage();await page.goto(base+'demos/sprite-foundry/index.html');
    await page.waitForFunction(()=>document.documentElement.dataset.labReady==='sprite-foundry');
    await page.locator('#pixel-canvas').scrollIntoViewIfNeeded();const box=await page.locator('#pixel-canvas').boundingBox();
    await page.touchscreen.tap(box.x+4,box.y+4);
    assert.equal(await page.evaluate(()=>JSON.parse(__spriteFoundry.snapshot().project).frames[0].pixels[0]),1);
    assert.equal(await page.evaluate(()=>__spriteFoundry.snapshot().gesture),false);
  }finally{await touch.close();}
  console.log('Sprite Foundry: exact seeded pixels, pencil/erase/fill, keyboard/touch, frames/timing, palette/alpha, undo/redo, rejected imports, PNG/atlas, real Asset Foundry import, cancellation, narrow layout and offline authoring PASS');
}
