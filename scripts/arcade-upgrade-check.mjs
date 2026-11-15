// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';

export async function checkArcadeUpgrade(browser,base){
  // Real audio2d from pre-Foundry main 3c35784636288bafe4923537463f853b6bcf0cb4.
  const legacy=await readFile(new URL('../tests/fixtures/arcade-pre-foundry-audio2d.txt',import.meta.url),'utf8');
  assert.equal(createHash('sha256').update(legacy).digest('hex'),'07e19391b84034acba56ef840a4d622b70e815f5376de123b6a07a9ccebf3098');
  assert.equal(legacy.includes('export function isSound2D'),false);
  const root=resolve(import.meta.dirname,'../dist');
  const oldFiles=new Map([
    ['index.html','<!doctype html><title>Previous package</title><script type="module" src="./offline/register.js"></script>'],
    ['offline/register.js',await readFile(resolve(root,'offline/register.js'),'utf8')],
    ['modules/audio2d/index.js',legacy]
  ]);
  const entries=[...oldFiles].map(([path,source])=>({path,bytes:Buffer.byteLength(source),sha256:createHash('sha256').update(source).digest('hex')}));
  const template=await readFile(new URL('./service-worker.template.js',import.meta.url),'utf8');
  const worker=template.replace('__PACKAGE_SHA256__','arcade-legacy-fixture').replace('__ASSET_ENTRIES__',JSON.stringify(entries));
  let previousPackage=true;
  const server=createServer(async(req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(!pathname.startsWith('/VANILLAJS/'))throw Error('outside fixture scope');
      res.setHeader('Cache-Control','no-store');
      if(pathname==='/VANILLAJS/service-worker.js'){res.setHeader('Content-Type','text/javascript');res.end(worker);return;}
      const name=pathname.slice('/VANILLAJS/'.length)||'index.html',path=resolve(root,name);
      if(!path.startsWith(root+sep))throw Error('outside package');
      const bytes=previousPackage&&oldFiles.has(name)?oldFiles.get(name):await readFile(path);
      res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)]||'application/octet-stream');res.end(bytes);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const legacyBase=`http://127.0.0.1:${server.address().port}/VANILLAJS/`;
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(legacyBase+'index.html');await page.evaluate(()=>navigator.serviceWorker.ready);
    previousPackage=false;await page.goto(legacyBase+'demos/arcade-combat-lab/index.html');
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    const cachedAudio=()=>page.evaluate(url=>fetch(url).then(r=>r.text()),legacyBase+'modules/audio2d/index.js');
    assert.equal(await cachedAudio(),legacy,'The old worker must serve the incompatible shared module');
    await page.waitForFunction(()=>document.documentElement.dataset.labReady==='arcade-combat',null,{timeout:10000});
    for(const mode of ['run','arena']){
      await page.locator(`[data-mode="${mode}"]`).click();
      const x=await page.evaluate(()=>arcadeFoundry.snapshot().combat.actors[0].x);
      await page.locator('#run').click();await page.keyboard.down('d');
      await page.waitForFunction(x=>arcadeFoundry.snapshot().combat.actors[0].x>x+100,x);await page.keyboard.up('d');
      if(mode==='run')await page.locator('#sound').click();
      await page.waitForFunction(()=>arcadeFoundry.audioStats()?.voices>0);
      await page.locator('#pause').click();const frozen=await page.evaluate(()=>arcadeFoundry.snapshot());
      await page.waitForTimeout(80);assert.deepEqual(await page.evaluate(()=>arcadeFoundry.snapshot()),frozen);
      await page.locator('#restart').click();assert.equal(await page.evaluate(()=>arcadeFoundry.snapshot().tick),0);
    }
    assert.equal(await cachedAudio(),legacy,'Starting the new lab must preserve the old cache');assert.deepEqual(errors,[]);
  }catch(error){console.error('Arcade cached-upgrade errors:',errors);throw error;}
  finally{await context.close();await new Promise(r=>server.close(r));}

  const failed=await browser.newContext({serviceWorkers:'block'}),retry=await failed.newPage();
  try{
    await failed.route('**/arcade-combat-lab/app.js',route=>route.abort());
    await retry.goto(base+'demos/arcade-combat-lab/index.html');
    await retry.getByRole('button',{name:'RELOAD LAB',exact:true}).waitFor();
    assert.match(await retry.locator('#overlay-copy').textContent(),/Unable to load/);
    assert.equal(await retry.locator('[data-mode="arena"]').isDisabled(),true);
    await failed.unroute('**/arcade-combat-lab/app.js');await retry.locator('#run').click();
    await retry.waitForFunction(()=>document.documentElement.dataset.labReady==='arcade-combat');
    await retry.locator('#run').click();await retry.waitForFunction(()=>arcadeFoundry.snapshot().tick>2);
  }finally{await failed.close();}
  console.log('Arcade upgrade: real legacy worker retained; both modes, controls, audio, pause/restart and failed-import reload recovery PASS');
}
