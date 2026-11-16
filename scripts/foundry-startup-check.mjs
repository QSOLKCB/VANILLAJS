// SPDX-License-Identifier: Apache-2.0
// Additive browser negative controls. The older cache is an explicitly synthetic
// hostile fixture, not a claim that a historical release contained these bytes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';

const labs=new Map([['sprite-foundry','sprite-foundry'],['weapon-feel-lab','weapon-feel'],['narrative-foundry','narrative-foundry']]);
export const checkSpriteStartup=(browser,base)=>checkFoundryStartup(browser,base,'sprite-foundry');
export const checkNarrativeStartup=(browser,base)=>checkFoundryStartup(browser,base,'narrative-foundry');
export const checkWeaponFeelStartup=(browser,base)=>checkFoundryStartup(browser,base,'weapon-feel-lab');
async function ready(page,value){
  await page.waitForFunction(expected=>document.documentElement.dataset.labReady===expected,value);
}
export async function checkFoundryStartup(browser,base,lab){
  assert.ok(labs.has(lab),'unknown foundry startup fixture');
  const expected=labs.get(lab),failed=await browser.newContext({serviceWorkers:'block'});
  try{
    const page=await failed.newPage(),pattern='**/demos/'+lab+'/app.js';
    await failed.route(pattern,route=>route.abort());
    await page.goto(base+'demos/'+lab+'/index.html');
    const reload=page.locator('#startup-reload');
    await reload.waitFor({state:'visible'});
    assert.ok(await reload.isEnabled(),'failed imports leave a usable recovery action');
    assert.notEqual(await page.evaluate(()=>document.documentElement.dataset.labReady),expected);
    await failed.unroute(pattern);await reload.click();await ready(page,expected);
  }finally{await failed.close();}

  const root=resolve(import.meta.dirname,'../dist');
  const poisoned='throw Error("Synthetic older-cache module must not execute");\n';
  const old=new Map([
    ['index.html','<!doctype html><title>Older worker fixture</title><script type="module" src="./offline/register.js"></script>'],
    ['offline/register.js',await readFile(resolve(root,'offline/register.js'),'utf8')],
    ['demos/'+lab+'/index.html','<!doctype html><p>Older foundry shell fixture</p>'],
    ['demos/'+lab+'/app.js',poisoned],
    ['modules/math/index.js',poisoned],
    ['modules/sprite2d/index.js',poisoned],
    ['modules/weapon-feel/index.js',poisoned],
    ['modules/narrative/index.js',poisoned],
    ['modules/scene-graph/index.js',poisoned]
  ]);
  const entries=[...old].map(([path,text])=>({path,bytes:Buffer.byteLength(text),
    sha256:createHash('sha256').update(text).digest('hex')}));
  const worker=(await readFile(new URL('./service-worker.template.js',import.meta.url),'utf8'))
    .replace('__PACKAGE_SHA256__','sprite-feel-older-cache-fixture')
    .replace('__ASSET_ENTRIES__',JSON.stringify(entries));
  let initial=true;
  const server=createServer(async(req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(!pathname.startsWith('/VANILLAJS/'))throw Error('prefix');
      const name=pathname.slice('/VANILLAJS/'.length),path=resolve(root,name);
      if(!path.startsWith(root+sep))throw Error('path');
      res.setHeader('Cache-Control','no-store');
      res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)]||'text/plain');
      res.end(name==='service-worker.js'?worker:initial&&old.has(name)?old.get(name):await readFile(path));
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const address='http://127.0.0.1:'+server.address().port+'/VANILLAJS/',context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(address+'index.html');
    await page.evaluate(async()=>{
      let timer;
      try{await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{
        timer=setTimeout(()=>reject(Error('Older worker fixture did not activate')),20000);
      })]);}finally{clearTimeout(timer);}
    });
    initial=false;
    await page.goto(address+'demos/'+lab+'/index.html');
    assert.match(await page.locator('body').textContent(),/Older foundry shell fixture/);
    // Fresh HTML references a complete content-derived module namespace, while
    // the previous unversioned cache deliberately continues serving bad modules.
    await page.goto(address+'demos/'+lab+'/index.html?foundry=current');
    await ready(page,expected);
    assert.equal(await page.evaluate(url=>fetch(url).then(r=>r.text()),address+'demos/'+lab+'/app.js'),poisoned);
    assert.equal(await page.evaluate(url=>fetch(url).then(r=>r.text()),address+'modules/math/index.js'),poisoned);
    assert.deepEqual(errors,[]);
  }finally{await context.close();await new Promise(r=>server.close(r));}
  console.log(lab+': failed-import reload and retained older-worker module isolation PASS');
}
