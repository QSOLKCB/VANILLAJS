// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch();
try{
  const context=await browser.newContext({viewport:{width:960,height:800}}),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/demos/dreamline/index.html');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await context.setOffline(true);await page.reload();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('MACHINE DREAMS'));
  const pcm=await page.evaluate(async()=>{
    const {productionScore}=await import('./production.js'),{synthesize}=await import('./music.js');
    const hash=await crypto.subtle.digest('SHA-256',synthesize(productionScore));
    return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
  });
  assert.equal(pcm,'82a2683b79ef7631876276acf3079eb8467356a8479ae92e79b592515dc5dab9');
  await mkdir('browser-artifacts',{recursive:true});
  await page.locator('#play').click();const captures=[];
  for(const sec of [8,22,40,61,82]){
    await page.waitForFunction(s=>Number(document.querySelector('#seek').value)>=s*48000,sec);
    const sample=await page.locator('#seek').inputValue();
    await page.locator('#film').screenshot({path:'browser-artifacts/dreamline-'+sec+'.png'});
    captures.push({targetSeconds:sec,observedSample:Number(sample)});
  }
  await page.waitForFunction(()=>document.querySelector('#clock').value==='90.00 / 90 s'&&document.querySelector('#play').textContent==='Play');
  assert.deepEqual(errors,[]);assert.equal(await page.locator('#silent').isChecked(),false);
  await writeFile('browser-artifacts/dreamline-offline.json',JSON.stringify({browser:browser.version(),pcm,captures,terminalSample:4320000,offline:true}));
}finally{await browser.close();}
