// SPDX-License-Identifier: Apache-2.0
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

export async function checkHome(browser,base){
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  // DRONE-RACER was formerly pushed beyond the right viewport edge by the
  // single-row nav, introducing page-wide horizontal scrolling.
  for(const width of [1024,1440,1655]){
    await page.setViewportSize({width,height:1000});
    const dimensions=await page.evaluate(()=>{
      const nav=[...document.querySelectorAll('.masthead nav a')];
      const drone=nav.find(link=>link.textContent.includes('DRONE-RACER'));
      const rect=drone?.getBoundingClientRect();
      return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        droneVisible:!!rect&&rect.width>0&&rect.height>0,
        droneLeft:rect?.left,droneRight:rect?.right};
    });
    assert.ok(dimensions.droneVisible,'desktop navigation must show DRONE-RACER');
    assert.ok(dimensions.droneLeft>=0&&dimensions.droneRight<=dimensions.viewport,
      'DRONE-RACER must fit in the viewport at '+width+'px');
    assert.ok(dimensions.scrollWidth<=dimensions.viewport,
      'masthead must not cause horizontal page overflow at '+width+'px');
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='READY');
  assert.equal(await page.locator('#error').isVisible(),false);
  const pixels=await page.locator('#flight').evaluate(canvas=>new Promise(resolve=>requestAnimationFrame(()=>{
    const gl=canvas.getContext('webgl'),p=new Uint8Array(canvas.width*canvas.height*4);
    gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,p);
    let bright=0;for(let i=0;i<p.length;i+=4)if(p[i]+p[i+1]+p[i+2]>100)bright++;
    resolve(bright);
  })));
  assert.ok(pixels>500,'WebGL must draw visible geometry');
  await page.locator('#launch').click();await page.keyboard.down('w');
  await page.waitForFunction(()=>parseFloat(document.querySelector('#speed').textContent)>5);
  await page.keyboard.up('w');
  await page.waitForFunction(()=>parseFloat(document.querySelector('#speed').textContent)<.2);
  await page.keyboard.down('ArrowLeft');await page.waitForFunction(()=>parseFloat(document.querySelector('#spin').textContent)>.2);await page.keyboard.up('ArrowLeft');
  await page.locator('#pause').click();const frozen=await page.locator('#elapsed').textContent();
  await page.waitForTimeout(250);assert.equal(await page.locator('#elapsed').textContent(),frozen);
  await page.locator('#launch').click();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  assert.equal(await page.locator('#status').textContent(),'PAUSED');
  await page.locator('#choose-arena').click();assert.equal(await page.locator('#assist').isChecked(),false);
  await page.locator('#launch').click();await page.keyboard.down('w');
  await page.waitForFunction(()=>parseFloat(document.querySelector('#speed').textContent)>5);await page.keyboard.up('w');
  const coast=parseFloat(await page.locator('#speed').textContent());await page.waitForTimeout(250);
  assert.ok(Math.abs(parseFloat(await page.locator('#speed').textContent())-coast)<1,'inertial velocity should persist');
  await page.keyboard.down('x');await page.waitForFunction(()=>parseFloat(document.querySelector('#speed').textContent)<.5);await page.keyboard.up('x');
  await page.locator('#reset').click();assert.equal(await page.locator('#status').textContent(),'READY');
  // Keep W physically down across Escape pause/resume. Repeated down() emits
  // repeat=true; only releasing and pressing again may restart thrust.
  await page.locator('#launch').click();await page.keyboard.down('w');
  await page.waitForFunction(()=>parseFloat(document.querySelector('#speed').textContent)>5);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#status').textContent(),'PAUSED');
  const pausedSpeed=parseFloat(await page.locator('#speed').textContent());
  await page.keyboard.press('Escape');assert.equal(await page.locator('#status').textContent(),'RUNNING');
  await page.keyboard.down('w');await page.waitForTimeout(350);
  assert.ok(Math.abs(parseFloat(await page.locator('#speed').textContent())-pausedSpeed)<.15,'held W repeat must not restart thrust after resume');
  await page.keyboard.up('w');await page.keyboard.down('w');
  await page.waitForFunction(speed=>parseFloat(document.querySelector('#speed').textContent)>speed+3,pausedSpeed);
  await page.keyboard.up('w');await page.locator('#reset').click();
  await mkdir('browser-artifacts',{recursive:true});await page.screenshot({path:'browser-artifacts/flight-lab.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile layout must not overflow');
  await page.screenshot({path:'browser-artifacts/flight-lab-mobile.png',fullPage:true});
  const unsupported=await browser.newPage();await unsupported.addInitScript(()=>HTMLCanvasElement.prototype.getContext=()=>null);
  await unsupported.goto(page.url());await unsupported.locator('#error').waitFor({state:'visible'});
  assert.match(await unsupported.locator('#error').textContent(),/WebGL is unavailable/);
  assert.deepEqual(errors,[]);console.log('Chromium: rendered geometry, both modes, thrust, braking, rotation, pause, held-key repeat cancellation, blur, reset, project subpath, mobile layout and unsupported WebGL passed.');
  await unsupported.close();
  await page.close();
}
