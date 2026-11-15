// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';

export async function checkPursuitUpgrade(browser,base){
  // Exact api/audio/index.js from pre-Pursuit main 3c35784636288bafe4923537463f853b6bcf0cb4.
  // The fixture worker models its cache-first response without downloading git history in CI.
  const legacy=await readFile(new URL('../tests/fixtures/pursuit-pre89-audio.txt',import.meta.url),'utf8');
  assert.equal(createHash('sha256').update(legacy).digest('hex'),'5885ba4b6d9197e6369a8d31f96ddbe9ff22e4e878fed2ace4dcceea8d30a458');
  const root=resolve(import.meta.dirname,'../dist');
  const oldFiles=new Map([
    ['index.html','<!doctype html><title>Previous package</title><script type="module" src="./offline/register.js"></script>'],
    ['offline/register.js',await readFile(resolve(root,'offline/register.js'),'utf8')],
    ['api/audio/index.js',legacy]
  ]);
  const entries=[...oldFiles].map(([path,source])=>({path,bytes:Buffer.byteLength(source),sha256:createHash('sha256').update(source).digest('hex')}));
  const template=await readFile(new URL('./service-worker.template.js',import.meta.url),'utf8');
  const worker=template.replace('__PACKAGE_SHA256__','pursuit-legacy-fixture').replace('__ASSET_ENTRIES__',JSON.stringify(entries));
  // Install the real verified-cache worker from a small previous-version
  // inventory, then replace the network assets without replacing its cache.
  let previousPackage=true;
  const server=createServer(async(req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(!pathname.startsWith('/VANILLAJS/'))throw Error('outside fixture scope');
      res.setHeader('Cache-Control','no-store');
      if(pathname==='/VANILLAJS/service-worker.js'){
        res.setHeader('Content-Type','text/javascript');res.end(worker);return;
      }
      const path=resolve(root,pathname.slice('/VANILLAJS/'.length)||'index.html');
      if(!path.startsWith(root+sep))throw Error('outside package');
      const name=pathname.slice('/VANILLAJS/'.length)||'index.html';
      const bytes=previousPackage&&oldFiles.has(name)?oldFiles.get(name):await readFile(path);
      res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)]||'application/octet-stream');
      res.end(bytes);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const legacyBase=`http://127.0.0.1:${server.address().port}/VANILLAJS/`;
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto(legacyBase+'index.html');
    await page.evaluate(()=>new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('Legacy worker did not activate')),30000);
      navigator.serviceWorker.ready.then(()=>{clearTimeout(timeout);resolve();},error=>{clearTimeout(timeout);reject(error);});
    }));
    previousPackage=false;
    await page.goto(legacyBase+'demos/pursuit-lab/index.html');
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const cachedAudio=()=>page.evaluate(url=>fetch(url).then(r=>r.text()),legacyBase+'api/audio/index.js');
    assert.equal(await cachedAudio(),legacy,'The old worker must actually serve the incompatible API');
    await page.locator('#launch').click();await page.waitForFunction(()=>window.pursuit?.snapshot().state.tick>2);
    await page.keyboard.down('KeyW');await page.waitForFunction(()=>pursuit.snapshot().state.car.speed>5);await page.keyboard.up('KeyW');
    await page.locator('#sound').click();await page.waitForFunction(()=>pursuit.snapshot().audio.music?.active);
    assert.equal(await cachedAudio(),legacy,'Starting the game must not remove or replace the older cache');
    assert.deepEqual(errors,[]);
  }catch(error){
    console.error('Pursuit cache-upgrade diagnostics:',page.url(),await page.evaluate(async()=>({
      registration:await navigator.serviceWorker.getRegistration().then(r=>r&&({scope:r.scope,active:r.active?.state,waiting:r.waiting?.state})),
      controller:navigator.serviceWorker.controller?.scriptURL,offline:document.documentElement.dataset.offlineWorker
    })).catch(()=>null),errors);throw error;
  }finally{await context.close();await new Promise(resolve=>server.close(resolve));}

  const failed=await browser.newContext({serviceWorkers:'block'}),retry=await failed.newPage();
  try{
    // Fail an imported module, rather than the bootstrap, then recover through the visible control.
    await failed.route('**/demos/pursuit-lab/js/sim.js',route=>route.abort());
    await retry.goto(base+'demos/pursuit-lab/index.html');
    await retry.getByRole('button',{name:'RELOAD LAB',exact:true}).waitFor();
    assert.match(await retry.locator('#status').textContent(),/Unable to start/);
    await failed.unroute('**/demos/pursuit-lab/js/sim.js');
    await retry.getByRole('button',{name:'RELOAD LAB',exact:true}).click();
    await retry.getByRole('button',{name:'START PURSUIT →',exact:true}).click();
    await retry.waitForFunction(()=>window.pursuit?.snapshot().state.tick>2);
  }finally{await failed.close();}
  console.log('Pursuit upgrade: legacy cached API retained, launch/driving/audio and visible module-failure recovery PASS');
}
