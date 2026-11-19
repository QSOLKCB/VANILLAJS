// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
export async function verifyDreamline(browser,base){
  const context=await browser.newContext({viewport:{width:960,height:800},reducedMotion:'reduce'});
  try{
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'demos/dreamline/index.html');
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('fixture')||document.querySelector('#status').textContent.includes('MACHINE DREAMS'));
    await page.locator('summary').click();assert.equal(await page.locator('#motion').inputValue(),'reduced');
    const seek=async n=>{
      await page.locator('#seek').evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input'));},n);
      await page.waitForFunction(v=>document.querySelector('#clock').value===(v/48000).toFixed(2)+' / 90 s',n);
    };
    await mkdir('browser-artifacts',{recursive:true});
    const identity=()=>page.locator('#film').evaluate(c=>c.toDataURL());
    await seek(1920000);const first=await identity();
    await seek(3072000);assert.notEqual(await identity(),first);await seek(1920000);assert.equal(await identity(),first);
    await page.locator('#film').screenshot({path:'browser-artifacts/dreamline-horizon.png'});
    await page.locator('#mute').click();assert.equal(await page.locator('#mute').getAttribute('aria-pressed'),'true');
    await page.locator('#play').click();await page.waitForFunction(()=>+document.querySelector('#seek').value>1924800);
    await page.locator('#play').click();assert.equal(await page.locator('#play').innerText(),'Play');
    await page.locator('#silent').check();await seek(4310400);await page.locator('#play').click();
    await page.waitForFunction(()=>document.querySelector('#clock').value==='90.00 / 90 s'&&document.querySelector('#play').textContent==='Play');
    await page.locator('#restart').click();await page.waitForFunction(()=>+document.querySelector('#seek').value<480000);
    await page.locator('#play').click();
    await page.locator('#project').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"remote":"x"}')});
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Invalid'));
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
}
