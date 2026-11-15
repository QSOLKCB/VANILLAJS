// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
export async function checkFPSUpgrade(browser,base){
  const legacy=await readFile(new URL('../tests/fixtures/arcade-pre-foundry-audio2d.txt',import.meta.url),'utf8');
  assert.equal(createHash('sha256').update(legacy).digest('hex'),'07e19391b84034acba56ef840a4d622b70e815f5376de123b6a07a9ccebf3098');
  const root=resolve(import.meta.dirname,'../dist'),old=new Map([['index.html','<!doctype html><script type="module" src="./offline/register.js"></script>'],['offline/register.js',await readFile(resolve(root,'offline/register.js'),'utf8')],['modules/audio2d/index.js',legacy]]);
  const entries=[...old].map(([path,text])=>({path,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')}));
  const worker=(await readFile(new URL('./service-worker.template.js',import.meta.url),'utf8')).replace('__PACKAGE_SHA256__','fps-old-cache-fixture').replace('__ASSET_ENTRIES__',JSON.stringify(entries));
  let initial=true;
  const server=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/VANILLAJS\//,''),path=resolve(root,name);if(!path.startsWith(root+sep))throw Error('path');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)]||'text/plain');res.end(name==='service-worker.js'?worker:initial&&old.has(name)?old.get(name):await readFile(path));}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const address=`http://127.0.0.1:${server.address().port}/VANILLAJS/`,context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{await page.goto(address+'index.html');await page.evaluate(()=>navigator.serviceWorker.ready);initial=false;await page.goto(address+'demos/block-arena-lab/index.html');await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const oldAudio=()=>page.evaluate(url=>fetch(url).then(r=>r.text()),address+'modules/audio2d/index.js');assert.equal(await oldAudio(),legacy);
    await page.waitForFunction(()=>document.documentElement.dataset.labReady==='block-arena');for(const mode of ['skirmish','survival']){await page.locator(`[data-mode="${mode}"]`).click();await page.locator('#run').click();await page.keyboard.down('w');await page.waitForFunction(()=>blockArena.snapshot().player.position[2]<11);await page.keyboard.up('w');await page.keyboard.press('Escape');}
    assert.equal(await oldAudio(),legacy);assert.deepEqual(errors,[]);
  }finally{await context.close();await new Promise(r=>server.close(r));}
  const failed=await browser.newContext({serviceWorkers:'block'}),retry=await failed.newPage();
  try{await failed.route('**/block-arena-lab/app.js',r=>r.abort());await retry.goto(base+'demos/block-arena-lab/index.html');await retry.getByRole('button',{name:'RELOAD LAB',exact:true}).waitFor();assert.equal(await retry.locator('[data-mode="survival"]').isDisabled(),true);await failed.unroute('**/block-arena-lab/app.js');await retry.locator('#run').click();await retry.waitForFunction(()=>document.documentElement.dataset.labReady==='block-arena');await retry.locator('#run').click();await retry.waitForFunction(()=>blockArena.snapshot().tick>4);}finally{await failed.close();}
  console.log('Block Arena upgrade: real older worker retained; both modes and failed-import reload recovery PASS');
}
