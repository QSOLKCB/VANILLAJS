// SPDX-License-Identifier: Apache-2.0
// Browser integration witness for the packaged visual editor and standalone
// WebGL1 context. No external Playwright runtime dependency in game bundles.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export async function verifyEditor(browser,base){
  await mkdir('browser-artifacts',{recursive:true});
  const page=await browser.newPage({viewport:{width:1380,height:900}}),
    errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  try{
    await page.goto(base+'demos/editor/index.html');
    await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='ready');
    assert.equal(await page.locator('#mode').textContent(),'EDIT');
    assert.equal(await page.locator('#count').textContent(),'4');
    assert.equal(await page.locator('#properties').isVisible(),true);

    // Test that actual WebGL1 allocated drawable geometry rather than merely
    // presenting an HTML editor mockup. Draw a frame first, then read back
    // pixels in the same animation callback (preserveDrawingBuffer:false).
    const bright=await page.locator('#view').evaluate(canvas=>new Promise(resolve=>{
      // Trigger an actual renderer frame before readback, since the WebGL
      // backbuffer is not preserved between compositor frames by default.
      canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:1,bubbles:true,cancelable:true}));
      requestAnimationFrame(()=>{
        const gl=canvas.getContext('webgl'),w=Math.min(canvas.width,200),h=Math.min(canvas.height,160);
        const x=Math.floor((canvas.width-w)/2),y=Math.floor((canvas.height-h)/2);
        const pixels=new Uint8Array(w*h*4);
        gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let colored=0;
        for(let i=0;i<pixels.length;i+=4)
          if(pixels[i]>65||pixels[i+1]>65||pixels[i+2]>65)colored++;
        resolve(colored);
      });
    }));
    assert.ok(bright>0,'actual WebGL geometry must produce colored pixels');

    await page.locator('#add').click();
    assert.equal(await page.locator('#count').textContent(),'5');
    await page.locator('#object-name').fill('Alien Probe');
    await page.locator('#object-name').dispatchEvent('change');
    assert.equal(await page.locator('#selection-name').textContent(),'Alien Probe');

    await page.locator('#object-yaw').fill('45');
    await page.locator('#object-yaw').dispatchEvent('change');
    assert.equal(await page.locator('#object-yaw').inputValue(),'45');

    await page.locator('#undo').click();
    assert.equal(await page.locator('#object-yaw').inputValue(),'0');
    await page.locator('#redo').click();
    assert.equal(await page.locator('#object-yaw').inputValue(),'45');

    await page.locator('#duplicate').click();
    assert.equal(await page.locator('#count').textContent(),'6');

    // Serialized project is transferred through the browser's actual download
    // event, re-imported, and checked by the strict model.
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#save').click();
    const download=await downloadPromise;
    const bytes=await download.createReadStream();
    const chunks=[];for await(const chunk of bytes)chunks.push(chunk);
    const serialized=Buffer.concat(chunks).toString('utf8');
    const project=JSON.parse(serialized);
    assert.equal(project.schemaVersion,2);
    assert.ok(project.objects.every(e=>e.components?.mesh&&e.components?.collider));
    assert.ok(project.objects.some(e=>e.components?.controller?.enabled));
    assert.equal(project.objects.length,6);
    assert.ok(project.objects.some(e=>e.name==='Alien Probe'));
    await page.locator('#open').setInputFiles({name:'saved.vscene.json',
      mimeType:'application/json',buffer:Buffer.from(serialized)});
    await page.waitForFunction(()=>document.querySelector('#status').textContent==='Loaded v2 scene · saved.vscene.json');
    assert.equal(await page.locator('#count').textContent(),'6');
    // A v1 export remains importable, and gets migrated to v2 in memory.
    const oldFile={...project,schemaVersion:1,
      objects:project.objects.map(({components,...legacy})=>legacy)};
    await page.locator('#open').setInputFiles({name:'legacy.vscene.json',
      mimeType:'application/json',buffer:Buffer.from(JSON.stringify(oldFile))});
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Migrated v1'));
    assert.equal(await page.locator('#count').textContent(),'6');
    assert.match(await page.locator('#status').textContent(),/Migrated v1/);
    await page.locator('#open').setInputFiles({name:'saved.vscene.json',
      mimeType:'application/json',buffer:Buffer.from(serialized)});
    await page.waitForFunction(()=>document.querySelector('#status').textContent==='Loaded v2 scene · saved.vscene.json');
    assert.equal(await page.locator('#count').textContent(),'6');
    // New component controls are actual serialized, validated data.
    await page.locator('#hierarchy button[data-id="entity-3"]').click();
    const controller=page.locator('[data-component="controller"][data-field="enabled"]');
    assert.equal(await controller.isChecked(),true);
    await page.locator('#tool-rotate').click();
    assert.equal(await page.locator('#tool-rotate').getAttribute('aria-pressed'),'true');
    await page.locator('#tool-scale').click();
    assert.equal(await page.locator('#tool-scale').getAttribute('aria-pressed'),'true');
    await page.locator('#tool-move').click();
    await page.locator('#gizmo-space').selectOption('local');
    await page.locator('#gizmo-snap').uncheck();
    const meshEnabled=page.locator('[data-component="mesh"][data-field="enabled"]');
    await meshEnabled.uncheck();
    assert.equal(await meshEnabled.isChecked(),false);
    await meshEnabled.check();

    // Native pointer-driven world X gizmo: edit, undo and redo one drag.
    await page.locator('#hierarchy button[data-id="entity-4"]').click();
    await page.locator('#gizmo-space').selectOption('world');
    await page.locator('#gizmo-snap').check();
    await page.locator('#tool-move').click();
    const beforeX=Number(await page.locator('[data-axis="position"][data-i="0"]').inputValue());
    const drag=await page.locator('#view').evaluate(async canvas=>{
      const {projectPoint}=await import('/VANILLAJS/demos/editor/gizmos.js');
      const rect=canvas.getBoundingClientRect(),
        camera={yaw:38,pitch:23,distance:18,target:[0,1,0]};
      const from=projectPoint(camera,[3,1,-3],rect.width,rect.height),
        to=projectPoint(camera,[5.15,1,-3],rect.width,rect.height);
      if(!from||!to)throw Error('cannot project world X gizmo');
      return {start:{x:rect.x+from.x+(to.x-from.x)*.55,
          y:rect.y+from.y+(to.y-from.y)*.55},
        end:{x:rect.x+from.x+(to.x-from.x)*1.05,
          y:rect.y+from.y+(to.y-from.y)*1.05}};
    });
    await page.mouse.move(drag.start.x,drag.start.y);
    await page.mouse.down();
    await page.mouse.move(drag.end.x,drag.end.y,{steps:7});
    await page.mouse.up();
    const movedX=Number(await page.locator('[data-axis="position"][data-i="0"]').inputValue());
    assert.ok(movedX>beforeX+.25,'gizmo must commit a visible world-X move');
    await page.locator('#undo').click();
    assert.equal(Number(await page.locator('[data-axis="position"][data-i="0"]').inputValue()),beforeX);
    await page.locator('#redo').click();
    assert.equal(Number(await page.locator('[data-axis="position"][data-i="0"]').inputValue()),movedX);

    await page.locator('#play').click();
    assert.equal(await page.locator('#mode').textContent(),'PLAY');
    assert.equal(await page.locator('#object-name').isDisabled(),true);
    await page.waitForFunction(()=>Number(document.querySelector('#stats').textContent.match(/^\d+/)?.[0]||0)>3);
    await page.locator('#pause').click();
    assert.equal(await page.locator('#mode').textContent(),'PAUSED');
    await page.locator('#stop').click();
    assert.equal(await page.locator('#mode').textContent(),'EDIT');
    assert.equal(await page.locator('#count').textContent(),'6');
    await page.screenshot({path:'browser-artifacts/visual-editor.png',fullPage:true});

    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(100);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),
      'workbench mobile layout must not overflow');
    await page.screenshot({path:'browser-artifacts/visual-editor-mobile.png',fullPage:true});

    // Invalid import fails without altering the authored scene.
    await page.locator('#open').setInputFiles({
      name:'malformed.json',mimeType:'application/json',
      buffer:Buffer.from('{"schemaVersion":1,"objects":[],"untrusted":true}')});
    assert.equal(await page.locator('#count').textContent(),'6');
    assert.match(await page.locator('#status').textContent(),/rejected/i);
    // Asset Foundry: import a real local OBJ without external material URLs.
    const sourceObj=['o AlienPlane','v -1 0 -1','v 1 0 -1','v 0 0 1',
      'vt 0 0','vt 1 0','vt 0.5 1','f 1/1 2/2 3/3',''].join('\n');
    await page.locator('#asset-obj').setInputFiles({
      name:'alien.obj',mimeType:'text/plain',buffer:Buffer.from(sourceObj)});
    await page.waitForFunction(()=>document.querySelector('#asset-count').textContent==='1 assets');
    assert.match(await page.locator('#status').textContent(),/Verified local OBJ/);
    await page.locator('#asset-attach').click();
    assert.match(await page.locator('#status').textContent(),/Attached mesh/);

    // Placement history follows scene undo/redo, including reused entity IDs.
    await page.locator('#duplicate').click();
    assert.ok((await downloadProject(page)).library.placements.some(p=>p.entityId==='entity-7'));
    await page.locator('#undo').click();
    assert.equal((await downloadProject(page)).library.placements.some(p=>p.entityId==='entity-7'),false);
    await page.locator('#redo').click();
    assert.ok((await downloadProject(page)).library.placements.some(p=>p.entityId==='entity-7'));
    await page.locator('#undo').click();await page.locator('#add').click();
    const divergent=await downloadProject(page);
    assert.ok(divergent.scene.objects.some(object=>object.id==='entity-7'));
    assert.equal(divergent.library.placements.some(p=>p.entityId==='entity-7'),false,
      'a newly authored cube must not inherit the undone duplicate attachment');
    await page.locator('#undo').click();
    await page.locator('#hierarchy button[data-id="entity-4"]').click();

    // Browser-generated PNG proves actual image decoding and canonical RGBA
    // import without depending on an externally hosted image or test fixture.
    const png64=await page.evaluate(()=>{
      const c=document.createElement('canvas');c.width=2;c.height=2;
      const ctx=c.getContext('2d');
      ctx.fillStyle='#ff0000';ctx.fillRect(0,0,1,1);
      ctx.fillStyle='#00ff00';ctx.fillRect(1,0,1,1);
      ctx.fillStyle='#0000ff';ctx.fillRect(0,1,1,1);
      ctx.fillStyle='#ffffff';ctx.fillRect(1,1,1,1);
      return c.toDataURL('image/png').split(',')[1];
    });
    await page.locator('#asset-png').setInputFiles({
      name:'pixels.png',mimeType:'image/png',buffer:Buffer.from(png64,'base64')});
    await page.waitForFunction(()=>document.querySelector('#asset-count').textContent==='2 assets');
    await page.locator('#asset-make-material').click();
    assert.equal(await page.locator('#asset-count').textContent(),'3 assets');
    await page.locator('#asset-attach').click();
    assert.match(await page.locator('#status').textContent(),/Attached material/);

    await page.locator('#asset-make-prefab').click();
    assert.equal(await page.locator('#asset-count').textContent(),'4 assets');
    const projectPromise=page.waitForEvent('download');
    await page.locator('#asset-save-project').click();
    const assetDownload=await projectPromise,assetStream=await assetDownload.createReadStream(),
      assetChunks=[];
    for await(const chunk of assetStream)assetChunks.push(chunk);
    const complete=Buffer.concat(assetChunks).toString('utf8'),exported=JSON.parse(complete);
    assert.equal(exported.format,'qsol.vanillajs.asset-project.v2');
    assert.deepEqual(exported.graphics,{optionalGPU:false});
    assert.equal(exported.scene.schemaVersion,2);
    assert.equal(exported.library.assets.length,4);
    assert.ok(exported.library.assets.some(a=>a.kind==='mesh'&&/^[0-9a-f]{64}$/.test(a.sourceSha256)));
    assert.ok(exported.library.assets.some(a=>a.kind==='texture'&&a.width===2));
    assert.ok(exported.library.assets.some(a=>a.kind==='prefab'));
    assert.ok(exported.library.placements.some(p=>p.entityId==='entity-4'));

    await page.locator('#asset-instance').click();
    assert.equal(await page.locator('#count').textContent(),'7');
    await page.locator('#asset-open-project').setInputFiles({
      name:'saved.vproject.json',mimeType:'application/json',buffer:Buffer.from(complete)});
    await page.waitForFunction(()=>document.querySelector('#status').textContent===
      'Loaded local asset project · saved.vproject.json');
    assert.equal(await page.locator('#count').textContent(),'6');
    assert.equal(await page.locator('#asset-count').textContent(),'4 assets');

    await page.locator('#asset-open-project').setInputFiles({
      name:'untrusted.vproject.json',mimeType:'application/json',
      buffer:Buffer.from('{"format":"bad","scene":{},"library":{}}')});
    await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Project rejected:'));
    assert.match(await page.locator('#status').textContent(),/Project rejected/);
    assert.equal(await page.locator('#asset-count').textContent(),'4 assets');
    assert.equal(await page.locator('#count').textContent(),'6');

    await verifyEditorQoL(browser,base);
    await verifyEditorFallback(browser,base);
    await verifyConcurrentAssetImports(browser,base);
    assert.deepEqual(errors,[]);
    console.log('Visual Editor: real WebGL, hierarchy/search/keyboard navigation, native text undo, scene history/shortcuts, exact decimal/Q16/D4 authoring and rejection, gesture cancellation, project migration/assets/exports, recovery and quota failure, CPU fallback, play controls, and 320px/390px layouts passed.');
  }finally{await page.close();}
}

async function downloadProject(page){
  const pending=page.waitForEvent('download');await page.locator('#asset-save-project').click();
  const file=await pending,stream=await file.createReadStream(),chunks=[];
  for await(const chunk of stream)chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function verifyEditorQoL(browser,base){
  const page=await browser.newPage({viewport:{width:1380,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto(base+'demos/editor/index.html');
    await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='ready');
    const positionX=page.locator('[data-axis="position"][data-i="0"]');
    await page.locator('#hierarchy button[data-id="entity-4"]').click();
    const drag=await page.locator('#view').evaluate(async canvas=>{
      const {projectPoint}=await import('/VANILLAJS/demos/editor/gizmos.js');
      const rect=canvas.getBoundingClientRect(),camera={yaw:38,pitch:23,distance:18,target:[0,1,0]};
      const a=projectPoint(camera,[3,1,-3],rect.width,rect.height),
        b=projectPoint(camera,[5.15,1,-3],rect.width,rect.height);
      return {start:[rect.x+a.x+(b.x-a.x)*.55,rect.y+a.y+(b.y-a.y)*.55],
        end:[rect.x+a.x+(b.x-a.x)*1.05,rect.y+a.y+(b.y-a.y)*1.05]};
    });
    for(const cancel of ['escape','blur']){
      await page.mouse.move(...drag.start);await page.mouse.down();
      await page.mouse.move(...drag.end,{steps:5});
      if(cancel==='escape')await page.keyboard.press('Escape');
      else await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
      await page.mouse.up();
      assert.equal(await positionX.inputValue(),'3',cancel+' must discard draft transform');
      assert.equal(await page.locator('#undo').isDisabled(),true,'cancel must not add history');
    }
    await page.locator('#object-yaw').fill('45');
    await page.locator('#object-yaw').dispatchEvent('change');
    await page.mouse.move(...drag.start);await page.mouse.down();
    await page.mouse.move(...drag.end,{steps:5});
    await page.keyboard.press('Control+z');
    await page.mouse.move(drag.end[0]+20,drag.end[1],{steps:3});await page.mouse.up();
    assert.equal(await positionX.inputValue(),'3','pointer movement cannot revive an undone gesture');
    assert.equal(await page.locator('#object-yaw').inputValue(),'0');
    assert.equal(await page.locator('#undo').isDisabled(),true);
    await page.mouse.move(...drag.start);await page.mouse.down();
    await page.mouse.move(...drag.end,{steps:5});await page.keyboard.press('Control+d');
    await page.mouse.move(drag.end[0]+20,drag.end[1],{steps:3});await page.mouse.up();
    assert.equal(await page.locator('#count').textContent(),'5','drag cannot revert a duplicate command');
    assert.equal(await positionX.inputValue(),'3','duplicate uses the committed transform');
    await page.locator('#undo').click();
    await page.locator('#hierarchy button[data-id="entity-4"]').click();

    await page.locator('#hierarchy-search').fill('beacon');
    assert.equal(await page.locator('#hierarchy button').count(),1);
    assert.match(await page.locator('#hierarchy').textContent(),/Beacon/);
    await page.locator('#hierarchy-search').fill('no-such-object');
    assert.equal(await page.locator('#hierarchy button').count(),0);
    await page.locator('#hierarchy-search').fill('');
    await page.locator('#add-child').click();
    await page.locator('#object-name').fill('Orbit child');
    await page.locator('#object-name').dispatchEvent('change');
    await page.locator('#hierarchy-search').fill('Orbit child');
    assert.equal(await page.locator('#hierarchy button').count(),2,'matching child retains its ancestor');
    await page.locator('#hierarchy button[data-id="entity-4"]').click();
    assert.equal(await page.locator('#object-parent option[value="entity-5"]').count(),0,
      'parent choices exclude descendants that would create a cycle');
    await page.locator('#undo').click();await page.locator('#undo').click();
    await page.locator('#hierarchy-search').fill('');
    await page.locator('#hierarchy button[data-id="entity-3"]').click();
    assert.equal(await page.locator('#object-parent').isDisabled(),true,'physics bodies stay at the scene root');
    await page.locator('#hierarchy button').first().focus();
    await page.keyboard.press('End');
    assert.equal(await page.locator('#hierarchy button[aria-selected="true"]').getAttribute('data-id'),'entity-4');
    await page.keyboard.press('Home');
    assert.equal(await page.locator('#hierarchy button[aria-selected="true"]').getAttribute('data-id'),'entity-1');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#hierarchy button[aria-selected="true"]').getAttribute('data-id'),'entity-2');
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.locator('#hierarchy button[aria-selected="true"]').getAttribute('data-id'),'entity-1');

    await page.locator('#view').focus();await page.keyboard.press('Control+d');
    assert.equal(await page.locator('#count').textContent(),'5');
    await page.keyboard.press('Control+z');
    assert.equal(await page.locator('#count').textContent(),'4');
    await page.keyboard.press('Control+Shift+z');
    assert.equal(await page.locator('#count').textContent(),'5');
    // Browser text undo owns focused fields; it must not undo scene commands.
    await page.locator('#hierarchy button[data-id="entity-5"]').click();
    const name=page.locator('#object-name'),beforeName=await name.inputValue();
    await name.focus();await page.keyboard.press('End');await page.keyboard.type(' draft');
    await page.keyboard.press('Control+z');
    assert.equal(await name.inputValue(),beforeName);
    assert.equal(await page.locator('#count').textContent(),'5');
    await page.locator('#view').focus();
    const save=page.waitForEvent('download');await page.keyboard.press('Control+s');
    const download=await save,stream=await download.createReadStream(),chunks=[];
    for await(const chunk of stream)chunks.push(chunk);
    assert.equal(JSON.parse(Buffer.concat(chunks).toString()).objects.length,5);

    // Empty numeric input is an invalid edit, never an implicit zero.
    await page.locator('#hierarchy button[data-id="entity-4"]').click();
    await positionX.fill('');await positionX.dispatchEvent('change');
    assert.equal(await positionX.getAttribute('aria-invalid'),'true');
    assert.match(await page.locator('#status').textContent(),/invalid|rejected|required/i);
    await positionX.fill('1001');await positionX.dispatchEvent('change');
    assert.equal(await positionX.getAttribute('aria-invalid'),'true');
    const validSave=page.waitForEvent('download');await page.locator('#save').click();
    const validDownload=await validSave,validStream=await validDownload.createReadStream(),validChunks=[];
    for await(const chunk of validStream)validChunks.push(chunk);
    const validScene=JSON.parse(Buffer.concat(validChunks).toString());
    assert.equal(validScene.objects.find(object=>object.id==='entity-4').position[0],3,
      'invalid inspector text never reaches the scene');
    await positionX.fill('3');await positionX.dispatchEvent('change');

    // Enter submits no native form/navigation and leaves authoring state intact.
    await name.focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#count').textContent(),'5');
    assert.equal(new URL(page.url()).search,'');
    await page.locator('#view').focus();await page.keyboard.press('f');
    assert.match(await page.locator('#status').textContent(),/fram/i);
    assert.equal(await page.locator('#selection-name').textContent(),'Beacon');
    await page.keyboard.press('Shift+f');
    assert.match(await page.locator('#status').textContent(),/fram/i);

    await page.locator('#exact-authoring summary').click();
    const decimalInputs=['exact-x','exact-y','exact-z'].map(id=>page.locator('#'+id));
    for(const [index,value]of ['0.1','0.2','3'].entries())await decimalInputs[index].fill(value);
    await page.locator('#exact-preview').click();
    assert.match(await page.locator('#exact-result').textContent(),/6554/);
    assert.match(await page.locator('#exact-result').textContent(),/13107/);
    assert.equal(await positionX.inputValue(),'3','preview must not mutate the scene');
    await page.locator('#exact-result').scrollIntoViewIfNeeded();
    await page.screenshot({path:'browser-artifacts/editor-alien-authoring.png',fullPage:true});
    await page.locator('#exact-apply').click();
    assert.equal(await positionX.inputValue(),'0.1');
    await page.locator('#undo').click();assert.equal(await positionX.inputValue(),'3');
    await page.locator('#redo').click();assert.equal(await positionX.inputValue(),'0.1');

    // D4 transforms the decimal draft only; orientation and Z are preserved.
    for(const [index,value]of ['0.1','0.2','3'].entries())await decimalInputs[index].fill(value);
    const yaw=await page.locator('#object-yaw').inputValue();
    await page.locator('#exact-symmetry').selectOption('r');
    await page.locator('#exact-transform').click();
    assert.equal(await decimalInputs[0].inputValue(),'-0.2');
    assert.equal(await decimalInputs[1].inputValue(),'0.1');
    assert.equal(await decimalInputs[2].inputValue(),'3');
    assert.equal(await positionX.inputValue(),'0.1');
    assert.equal(await page.locator('#object-yaw').inputValue(),yaw);

    await decimalInputs[0].fill('1e3');await page.locator('#exact-apply').click();
    assert.equal(await positionX.inputValue(),'0.1','exponent syntax is rejected');
    assert.match(await page.locator('#exact-result').textContent(),/invalid|reject|decimal/i);
    await decimalInputs[0].fill('0.1');
    await page.locator('#exact-rounding').selectOption('exact');
    await page.locator('#exact-quantize').click();
    assert.equal(await positionX.inputValue(),'0.1','inexact Q16 conversion must not apply');
    assert.match(await page.locator('#exact-result').textContent(),/exact|reject/i);
    await page.locator('#exact-rounding').selectOption('nearest-even');
    await page.locator('#exact-quantize').click();
    assert.equal(Number(await positionX.inputValue()),6554/65536);
    await decimalInputs[0].fill('40000');
    await page.locator('#exact-preview').click();
    assert.match(await page.locator('#exact-result').textContent(),/overflow|range|reject/i);
    await page.locator('#exact-overflow').selectOption('saturate');
    await page.locator('#exact-preview').click();
    assert.match(await page.locator('#exact-result').textContent(),/2147483647/);
    await page.locator('#exact-quantize').click();
    assert.equal(Number(await positionX.inputValue()),6554/65536,
      'explicit saturation cannot bypass the scene coordinate limit');
    await page.locator('#exact-authoring summary').click();

    await page.locator('#asset-make-material').click();
    await page.locator('#asset-search').fill('no-such-asset');
    assert.equal(await page.locator('#asset-list option').count(),0);
    assert.equal(await page.locator('#asset-attach').isDisabled(),true);
    await page.locator('#asset-search').fill('material');
    assert.equal(await page.locator('#asset-list option').count(),1);
    await page.locator('#asset-search').fill('');

    await page.setViewportSize({width:320,height:780});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),
      'all editor controls fit a 320px viewport');
    await page.screenshot({path:'browser-artifacts/editor-qol-320.png',fullPage:true});

    await page.locator('#scene-name').fill('Recovery orbit');
    await page.locator('#scene-name').dispatchEvent('change');
    await page.waitForFunction(()=>{
      const saved=JSON.parse(localStorage.getItem('vanillajs.editor.recovery.v1'));
      return saved?.scene?.name==='Recovery orbit'&&saved.library.assets.length===1;
    });
    await page.reload();
    await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='ready');
    assert.equal(await page.locator('#count').textContent(),'4','recovery is explicit, not auto-loaded');
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#restore-draft').click();
    assert.equal(await page.locator('#scene-name').inputValue(),'Recovery orbit');
    assert.equal(await page.locator('#count').textContent(),'5');
    assert.equal(await page.locator('#asset-count').textContent(),'1 assets');
    await page.locator('#hierarchy button[data-id="entity-4"]').click();
    assert.equal(Number(await positionX.inputValue()),6554/65536);
    // Malformed browser storage is rejected without destroying current work.
    await page.evaluate(()=>localStorage.setItem('vanillajs.editor.recovery.v1','{"format":"invalid"}'));
    page.once('dialog',dialog=>dialog.accept());await page.locator('#restore-draft').click();
    assert.match(await page.locator('#status').textContent(),/Recovery rejected/);
    assert.equal(await page.locator('#count').textContent(),'5');
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
}

async function verifyEditorFallback(browser,base){
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      return type==='webgl'||type==='webgl2'||type==='experimental-webgl'?null:original.call(this,type,...args);
    };
    Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true});
    Storage.prototype.setItem=function(){throw new DOMException('Storage is full','QuotaExceededError');};
  });
  try{
    await page.goto(base+'demos/editor/index.html');
    await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='ready');
    await page.waitForFunction(()=>{
      const canvas=document.querySelector('#view').nextElementSibling;
      if(!(canvas instanceof HTMLCanvasElement))return false;
      const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      let bright=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]+pixels[i+1]+pixels[i+2]>100)bright++;
      return bright>100;
    });
    assert.equal(await page.locator('#optional-gpu').isChecked(),false);
    await page.locator('#optional-gpu').check();
    await page.getByRole('button',{name:'CPU · no compatible GPU'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'CPU · no compatible GPU'}).isDisabled(),true);
    await page.locator('#add').click();
    assert.equal(await page.locator('#count').textContent(),'5');
    await page.waitForFunction(()=>document.querySelector('#draft-status').textContent==='Recovery unavailable');
    // Isolate input cancellation from floor-contact/gravity settling behavior.
    await page.locator('#hierarchy button[data-id="entity-3"]').click();
    await page.locator('[data-component="rigidbody"][data-field="gravityScale"]').fill('0');
    await page.locator('[data-component="rigidbody"][data-field="gravityScale"]').dispatchEvent('change');
    await page.locator('#frame').click();
    await page.locator('#view').focus();await page.keyboard.press('Shift+f');
    await page.locator('#play').click();
    await page.waitForTimeout(100);
    await page.locator('#view').focus();await page.keyboard.down('d');await page.waitForTimeout(120);
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    assert.equal(await page.locator('#mode').textContent(),'PAUSED');
    const cpuPixels=async()=>createHash('sha256').update(await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{
      resolve(document.querySelector('#view').nextElementSibling.toDataURL());
    })))).digest('hex');
    const stoppedPixels=await cpuPixels();
    await page.locator('#pause').click();await page.locator('#view').focus();
    await page.keyboard.down('d'); // repeat=true: still physically held across blur/resume.
    await page.waitForTimeout(180);await page.locator('#pause').click();
    assert.equal(await cpuPixels(),stoppedPixels,'held-key repeat cannot restart movement after blur');
    await page.keyboard.up('d');await page.locator('#pause').click();await page.locator('#view').focus();
    await page.keyboard.down('d');await page.waitForTimeout(180);await page.locator('#pause').click();
    assert.notEqual(await cpuPixels(),stoppedPixels,'a fresh press resumes actual movement');
    await page.keyboard.up('d');await page.locator('#stop').click();
    assert.equal(await page.locator('#mode').textContent(),'EDIT');
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
}

async function verifyConcurrentAssetImports(browser,base){
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto(base+'demos/editor/index.html');
    await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='ready');
    await page.evaluate(()=>{
      const digest=crypto.subtle.digest.bind(crypto.subtle);
      window.pendingAssetDigests=[];
      crypto.subtle.digest=(...args)=>new Promise((resolve,reject)=>{
        window.pendingAssetDigests.push(()=>digest(...args).then(resolve,reject));
      });
    });
    const obj={name:'overlap.obj',mimeType:'text/plain',
      buffer:Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n')};
    await page.locator('#asset-obj').setInputFiles(obj);
    await page.waitForFunction(()=>window.pendingAssetDigests.length===1);
    const png=await page.evaluate(()=>{
      const c=document.createElement('canvas');c.width=2;c.height=2;
      const ctx=c.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,2,2);
      return c.toDataURL('image/png').split(',')[1];
    });
    await page.locator('#asset-png').setInputFiles({name:'overlap.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
    await page.waitForFunction(()=>window.pendingAssetDigests.length===2);
    await page.evaluate(()=>window.pendingAssetDigests[1]());
    await page.waitForFunction(()=>document.querySelector('#asset-count').textContent==='1 assets');
    await page.evaluate(()=>window.pendingAssetDigests[0]());
    await page.waitForFunction(()=>document.querySelector('#asset-count').textContent==='2 assets');
    assert.deepEqual((await downloadProject(page)).library.assets.map(asset=>asset.kind).sort(),['mesh','texture']);
    // A replacement document does invalidate its outstanding asset imports.
    await page.locator('#asset-obj').setInputFiles(obj);
    await page.waitForFunction(()=>window.pendingAssetDigests.length===3);
    page.once('dialog',dialog=>dialog.accept());await page.locator('#new-scene').click();
    await page.evaluate(()=>window.pendingAssetDigests[2]());
    assert.equal(await page.locator('#asset-count').textContent(),'0 assets');
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
}
