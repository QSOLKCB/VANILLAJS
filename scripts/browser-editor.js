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
    assert.equal(exported.format,'qsol.vanillajs.asset-project.v1');
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

    assert.deepEqual(errors,[]);
    console.log('Visual Editor: real WebGL, hierarchy, inspector, undo/redo, duplicate, export/import, play/pause/stop, invalid import, 390px responsive layout passed.');
  }finally{await page.close();}
}
