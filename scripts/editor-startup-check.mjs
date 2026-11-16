// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';

export async function checkEditorStartup(browser,base){
  // Deliberately injected faults, not claims about the user's browser console.
  for(const fault of ['import','factory']){
    const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
    const pattern=fault==='import'?'**/demos/editor/app.js':'**/demos/demoscene-lab/preset.js';
    const message='<img src=x onerror="window.__fxXss=true"> fixture initialization failure';
    await context.route(pattern,async route=>{
      if(fault==='import')return route.abort();
      const response=await route.fetch();
      const body=(await response.text()).replace('export function machineRemembers(seed=1983){','export function machineRemembers(seed=1983){throw Error('+JSON.stringify(message)+');');
      await route.fulfill({response,body});
    });
    try{
      await page.goto(base+'demos/editor/index.html');
      const reload=page.getByRole('button',{name:'Reload Workbench',exact:true});await reload.waitFor();
      assert.equal(await page.locator('#fx-add').count(),0,'failed startup cannot leave apparently usable unwired FX controls');
      assert.equal(await page.locator('main').evaluate(el=>el.inert),false,'recovery must receive real clicks');
      if(fault==='factory'){
        assert.equal(await page.locator('.startup-failure p').textContent(),'Save any scene changes, then reload the Workbench. '+message);
        assert.equal(await page.locator('.startup-failure img').count(),0);assert.equal(await page.evaluate(()=>window.__fxXss),undefined);
        await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='ready');
        const count=Number(await page.locator('#count').textContent());await page.locator('#add').click();
        assert.equal(Number(await page.locator('#count').textContent()),count+1,'scene editor survives optional FX initialization failure');
      }
      await context.unroute(pattern);await reload.click();
      await page.waitForFunction(()=>document.documentElement.dataset.fxReady==='ready');
      await page.locator('#visual-fx>summary').click();await page.locator('#fx-add').click();
      await page.waitForFunction(()=>JSON.parse(__editorDemoscene).manifest.entries.some(e=>e.id.startsWith('node-')));
    }finally{await context.close();}
  }
  await checkEditorOldWorker(browser);
  console.log('Workbench startup: failed module/factory recovery, text-only errors, usable scene editor, and retained older worker isolation PASS');
}

async function checkEditorOldWorker(browser){
  const root=resolve(import.meta.dirname,'../dist');
  const legacy='// Deliberate older-worker fixture; must never execute in the current editor.\nthrow Error("stale Workbench fixture");\n';
  const old=new Map([
    ['index.html','<!doctype html><script type="module" src="./offline/register.js"></script>'],
    ['offline/register.js',await readFile(resolve(root,'offline/register.js'),'utf8')],
    ['demos/editor/index.html','<!doctype html><p>Old editor shell fixture</p>'],
    ['demos/editor/app.js',legacy],['modules/mod-sdk/index.js',legacy]
  ]);
  const entries=[...old].map(([path,text])=>({path,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')}));
  const worker=(await readFile(new URL('./service-worker.template.js',import.meta.url),'utf8')).replace('__PACKAGE_SHA256__','workbench-older-worker-fixture').replace('__ASSET_ENTRIES__',JSON.stringify(entries));
  let initial=true;
  const server=createServer(async(req,res)=>{try{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/VANILLAJS\//,''),path=resolve(root,name);
    if(!path.startsWith(root+sep))throw Error('path');
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)]||'text/plain');
    res.end(name==='service-worker.js'?worker:initial&&old.has(name)?old.get(name):await readFile(path));
  }catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const address=`http://127.0.0.1:${server.address().port}/VANILLAJS/`,context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(address+'index.html');await page.evaluate(()=>navigator.serviceWorker.ready);initial=false;
    await page.goto(address+'demos/editor/index.html');assert.match(await page.locator('body').textContent(),/Old editor shell fixture/);
    // A query gets fresh HTML from the server. Its complete content-addressed
    // runtime must also escape the old worker's cached editor and shared modules.
    await page.goto(address+'demos/editor/index.html?workbench=visual-fx');
    await page.waitForFunction(()=>document.documentElement.dataset.fxReady==='ready');
    await page.waitForFunction(()=>document.querySelector('#fourx-status').textContent.startsWith('Frontier template ready'));
    await page.locator('#visual-fx>summary').click();await page.locator('#fx-add').click();
    await page.waitForFunction(()=>JSON.parse(__editorDemoscene).manifest.entries.some(e=>e.id.startsWith('node-')));
    for(const path of ['demos/editor/app.js','modules/mod-sdk/index.js'])assert.equal(await page.evaluate(url=>fetch(url).then(r=>r.text()),address+path),legacy);
    assert.deepEqual(errors,[]);
  }finally{await context.close();await new Promise(r=>server.close(r));}
}
