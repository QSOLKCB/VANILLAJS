// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {parseProject} from '../demos/editor/asset-foundry.js';

export async function checkTutorial(browser,base){
  const context=await browser.newContext({viewport:{width:320,height:800}}),
    page=await context.newPage(),errors=[];
  page.setDefaultTimeout(10000);
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  page.on('pageerror',e=>errors.push(e.message));
  await mkdir('browser-artifacts',{recursive:true});
  try{
    await page.goto(base+'demos/creator-hub/index.html');
    await page.locator('a[href="../tutorial-lab/index.html"]').click();
    assert.ok(await page.locator('#download').isDisabled());
    await page.waitForFunction(()=>!document.getElementById('load').disabled);
    await page.locator('#load').focus();await page.keyboard.press('Enter');
    await page.locator('#speed').fill('6');await page.locator('#apply').click();
    await page.locator('#test').click();
    assert.match(await page.locator('#result').textContent(),/Executed 60 fixed steps\. Player moved 6.00 metres/);
    assert.ok(await page.locator('#download').isDisabled());
    const before=await page.locator('#view').evaluate(c=>c.toDataURL());
    await page.locator('#view').screenshot({path:'browser-artifacts/tutorial-fast.png'});
    await page.locator('#fault').click();
    assert.match(await page.locator('#result').textContent(),/speed is zero/);
    await page.locator('#test').click();
    assert.match(await page.locator('#result').textContent(),/Could not complete/);
    assert.ok(await page.locator('#download').isDisabled());
    await page.locator('#speed').fill('2');await page.locator('#apply').click();
    await page.locator('#test').click();
    assert.match(await page.locator('#result').textContent(),/moved 2.00 metres/);
    assert.ok(await page.locator('#view').evaluate(c=>c.toDataURL())!==before,
      'speed changes rendered final pose');
    assert.ok(await page.locator('#view').evaluate(c=>{
      const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let orange=0;
      for(let i=0;i<pixels.length;i+=4)
        if(pixels[i]>100&&pixels[i]>pixels[i+1]+20&&pixels[i+1]>pixels[i+2]+20)orange++;
      return orange>10;
    }),'the orange player must be visible above the floor');
    await page.locator('#view').screenshot({path:'browser-artifacts/tutorial-repaired.png'});
    await page.screenshot({path:'browser-artifacts/tutorial-mobile.png',fullPage:true});
    const downloading=page.waitForEvent('download');await page.locator('#download').click();
    const download=await downloading,raw=await readFile(await download.path(),'utf8'),{scene}=parseProject(raw);
    await download.saveAs('browser-artifacts/first-scene.vproject.json');
    const player=scene.objects.find(e=>e.components.controller.enabled);
    assert.equal(player.components.controller.speed,2);
    assert.equal(await page.locator('#progress .done').count(),4);

    // Reuse the actual downloaded bytes in the existing Workbench, not just a
    // parser. The authored controller setting survives import and runs in Play.
    const editor=await context.newPage();
    await editor.goto(base+'demos/editor/index.html');
    await editor.waitForFunction(()=>document.documentElement.dataset.editorReady==='ready');
    await editor.locator('#asset-open-project').setInputFiles({
      name:'first-scene.vproject.json',mimeType:'application/json',buffer:Buffer.from(raw)});
    await editor.waitForFunction(()=>document.querySelector('#status').textContent===
      'Loaded local asset project · first-scene.vproject.json');
    await editor.locator('#hierarchy [data-id="'+player.id+'"]').click();
    assert.equal(await editor.locator('[data-component="controller"][data-field="speed"]').inputValue(),'2');
    await editor.locator('#play').click();
    assert.equal(await editor.locator('#mode').textContent(),'PLAY');
    await editor.locator('#stop').click();
    await editor.close();

    await page.locator('#speed').fill('3');
    assert.ok(await page.locator('#download').isDisabled(),'unapplied edit invalidates test and export');
    assert.ok(await page.locator('#test').isDisabled(),'test cannot use a stale applied value');
    assert.equal(await page.locator('#progress .done').count(),1);
    await page.locator('#apply').click();await page.locator('#test').click();
    assert.match(await page.locator('#result').textContent(),/moved 3.00 metres/);
    assert.ok(await page.locator('#download').isEnabled());
    await page.locator('#load').click();
    assert.equal(await page.locator('#progress .done').count(),1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'320px layout');
    // Playwright 1.64's waitForFunction treats an async predicate's Promise as
    // truthy before its result arrives. Explicitly await real worker readiness.
    const worker=await page.evaluate(async expectedBase=>{
      let timer,registration,active,onStateChange,cancelled=false;
      try{
        return await Promise.race([
          (async()=>{
            registration=await navigator.serviceWorker.ready;
            if(cancelled)throw Error('Tutorial offline readiness already timed out');
            active=registration.active;
            if(!active)throw Error('Tutorial offline registration has no active worker');
            if(registration.scope!==expectedBase||active.scriptURL!==expectedBase+'service-worker.js')
              throw Error('Tutorial offline worker has unexpected scope or script: '+registration.scope+' '+active.scriptURL);
            if(active.state!=='activated')await new Promise((resolve,reject)=>{
              onStateChange=()=>{
                if(active.state==='activated')resolve();
                else if(active.state==='redundant')reject(Error('Tutorial offline worker became redundant before activation'));
              };
              active.addEventListener('statechange',onStateChange);onStateChange();
            });
            return {scope:registration.scope,scriptURL:active.scriptURL,state:active.state};
          })(),
          new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(
            'Tutorial offline worker did not activate within 45 seconds; scope='+(registration?.scope??'not ready')+
            ', active='+(active?.state??'none')
          )),45000);})
        ]);
      }finally{
        cancelled=true;clearTimeout(timer);
        if(active&&onStateChange)active.removeEventListener('statechange',onStateChange);
      }
    },base);
    assert.deepEqual(worker,{scope:base,scriptURL:base+'service-worker.js',state:'activated'});
    // The worker deliberately does not claim existing clients. Start a new
    // client after activation, with the network already unavailable, rather
    // than relying on the original page's reload to acquire a controller.
    const offline=await context.newPage();
    offline.setDefaultTimeout(10000);
    await context.setOffline(true);
    const response=await offline.goto(base+'demos/tutorial-lab/index.html');
    assert.equal(response.status(),200,'offline tutorial document loads successfully');
    assert.equal(response.fromServiceWorker(),true,'the worker supplies the offline navigation');
    assert.equal(await offline.evaluate(()=>!!navigator.serviceWorker.controller),true);
    await offline.locator('#load').click();
    await offline.locator('#speed').fill('6');await offline.locator('#apply').click();
    await offline.locator('#test').click();
    assert.match(await offline.locator('#result').textContent(),/Executed 60 fixed steps/);
    assert.ok(await offline.locator('#download').isDisabled(),'restart clears the earlier diagnosis');
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
  console.log('Tutorial: keyboard start, changed movement/render, failed test, repair, download and Workbench import/Play, invalidation, restart, 320px and offline startup passed.');
}
