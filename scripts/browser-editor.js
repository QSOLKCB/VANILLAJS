// SPDX-License-Identifier: Apache-2.0
// Browser integration witness for the packaged visual editor and standalone
// WebGL1 context. No external Playwright runtime dependency in game bundles.
import assert from 'node:assert/strict';
export async function verifyEditor(browser,base){
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
    assert.equal(await page.locator('#count').textContent(),'6');
    // A v1 export remains importable, and gets migrated to v2 in memory.
    const oldFile={...project,schemaVersion:1,
      objects:project.objects.map(({components,...legacy})=>legacy)};
    await page.locator('#open').setInputFiles({name:'legacy.vscene.json',
      mimeType:'application/json',buffer:Buffer.from(JSON.stringify(oldFile))});
    assert.equal(await page.locator('#count').textContent(),'6');
    assert.match(await page.locator('#status').textContent(),/Migrated v1/);
    await page.locator('#open').setInputFiles({name:'saved.vscene.json',
      mimeType:'application/json',buffer:Buffer.from(serialized)});
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
    assert.deepEqual(errors,[]);
    console.log('Visual Editor: real WebGL, hierarchy, inspector, undo/redo, duplicate, export/import, play/pause/stop, invalid import, 390px responsive layout passed.');
  }finally{await page.close();}
}
