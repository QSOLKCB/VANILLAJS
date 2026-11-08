// SPDX-License-Identifier: Apache-2.0
// Packaged Chromium witness, independent of GPU timing or remote resources.
import assert from 'node:assert/strict';
export async function verifyDonorLabs(browser,base){
  const bullet=await browser.newPage({viewport:{width:1280,height:860}});
  try{
    await bullet.goto(base+'demos/bullet-time-lab/index.html');
    await bullet.waitForFunction(()=>document.documentElement.dataset.labReady==='bullet-time');
    assert.equal(await bullet.locator('#status').textContent(),'READY');
    await bullet.locator('#step').click();
    assert.equal(await bullet.locator('#tick').textContent(),'1');
    await bullet.locator('#optimized').uncheck();
    await bullet.locator('#reset').click();
    await bullet.locator('#run').click();
    await bullet.keyboard.down('q');await bullet.keyboard.down('Space');
    await bullet.waitForFunction(()=>Number(document.querySelector('#tick').textContent.replaceAll(',',''))>=20);
    await bullet.waitForFunction(()=>parseFloat(document.querySelector('#domain').textContent)<.95);
    await bullet.keyboard.up('Space');await bullet.keyboard.up('q');
    await bullet.locator('#pause').click();
    assert.equal(await bullet.locator('#status').textContent(),'PAUSED');
    await bullet.screenshot({path:'browser-artifacts/bullet-time-lab.png'});
    await bullet.setViewportSize({width:390,height:844});
    assert.ok(await bullet.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),
      'bullet lab mobile layout overflows');
  }finally{await bullet.close();}
  // This context deliberately persists across an online and offline navigation
  // so only the activated service worker can satisfy the second page load.
  const arcade=await browser.newPage({viewport:{width:1280,height:860}});
  try{
    await arcade.goto(base+'demos/arcade-lab/index.html');
    await arcade.waitForFunction(()=>document.documentElement.dataset.labReady==='arcade');
    await arcade.locator('#step').click();
    assert.equal(await arcade.locator('#tick').textContent(),'1');
    await arcade.locator('[data-mode="bank"]').click();
    assert.equal(await arcade.locator('#mode').textContent(),'BANK');
    await arcade.locator('#run').click();
    await arcade.keyboard.down('Space');
    await arcade.waitForFunction(()=>Number(document.querySelector('#tick').textContent.replaceAll(',',''))>=20);
    await arcade.keyboard.up('Space');await arcade.locator('#pause').click();
    await arcade.screenshot({path:'browser-artifacts/arcade-lab.png'});
    await arcade.waitForFunction(()=>document.documentElement.dataset.offlineWorker==='registered');
    await arcade.evaluate(async()=>{
      // No unbounded wait: a failed install must be an actionable CI failure.
      const registered=await navigator.serviceWorker.getRegistration();
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_,reject)=>setTimeout(()=>reject(new Error(
          'offline worker did not activate: '+(registered?.installing?.state??'no installing worker')
        )),15000))
      ]);
    });
    await arcade.reload(); // A newly activated worker starts controlling on navigation.
    assert.equal(await arcade.evaluate(()=>Boolean(navigator.serviceWorker.controller)),true);
    const context=arcade.context();
    await context.setOffline(true);
    try{
      const offlinePage=await context.newPage();
      try{
        await offlinePage.goto(base+'demos/bullet-time-lab/index.html');
        await offlinePage.waitForFunction(()=>document.documentElement.dataset.labReady==='bullet-time');
        assert.equal(await offlinePage.locator('#status').textContent(),'READY');
      }finally{await offlinePage.close();}
    }finally{await context.setOffline(false);}
  }finally{await arcade.close();}
  console.log('Chromium donor labs: real ticks, clock scaling, both modes, mobile layout and verified offline navigation passed.');
}
