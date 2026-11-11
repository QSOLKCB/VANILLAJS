// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
export async function verifyOptionalLabs(browser,base){
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Real CPU-only path, even on hardware that exposes WebGPU.
  await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
  try{
    for(const lab of ['gpu-lab','space-lab']){
      await page.goto(base+'demos/'+lab+'/index.html');await page.waitForFunction(()=>document.documentElement.dataset.labReady==='ready');
      await page.waitForFunction(()=>window.lab.renderer.stats().frames>2);
      assert.equal(await page.evaluate(()=>window.lab.renderer.mode),'cpu');
      const bright=await page.locator('#view').evaluate(c=>{const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<p.length;i+=4)if(p[i]+p[i+1]+p[i+2]>80)n++;return n;});
      assert.ok(bright>100,'CPU draws visible geometry');
      assert.equal(await page.getByRole('button',{name:'CPU · no compatible GPU'}).isDisabled(),true);
      if(lab==='gpu-lab'){await page.locator('#parity').click();await page.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('PASS'));}
      else{
        await page.locator('#mechanic').selectOption('broadside');await page.locator('#view').focus();await page.keyboard.down('Space');await page.waitForFunction(()=>window.lab.world.hits>0);await page.keyboard.up('Space');
        await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const tick=await page.evaluate(()=>window.lab.world.tick);await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>window.lab.world.tick),tick);
      }
    }
    await page.goto(base+'demos/editor/index.html');await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='ready');
    await page.locator('#optional-gpu').check();await page.waitForFunction(()=>document.querySelector('#graphics-controls').textContent.includes('no compatible GPU'));
    const download=page.waitForEvent('download');await page.locator('#export-game').click();const file=await download;assert.equal(file.suggestedFilename(),'game.html');
    const chunks=[];for await(const chunk of await file.createReadStream())chunks.push(chunk);
    await page.route(base+'exported-game.html',route=>route.fulfill({contentType:'text/html',body:Buffer.concat(chunks).toString('utf8')}));
    await page.goto(base+'exported-game.html');
    await page.waitForFunction(()=>document.querySelector('#controls').textContent.includes('CPU · no compatible GPU'));
    await page.waitForFunction(()=>{const c=document.querySelector('#view'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<p.length;i+=4)if(p[i]+p[i+1]+p[i+2]>100)return true;return false;});
    await page.getByRole('button',{name:'Pause',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Resume',exact:true}).count(),1);
    assert.deepEqual(errors,[]);console.log('CPU labs, parity, mechanics, editor export PASS');
  }finally{await context.close();}
}
