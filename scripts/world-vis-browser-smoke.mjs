// SPDX-License-Identifier: Apache-2.0
// WORLD-VIS-001 packaged Chromium: real HORIZON static source, LitRenderer,
// source-parity with frustum off/on, retained LOD, three cameras and context.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist');
const manifest=await readFile(join(dist,'manifest.json'));
const permitted=new Set(JSON.parse(manifest).files.map(f=>f.path));
const sha=b=>createHash('sha256').update(b).digest('hex');
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,'');
    if(path==='manifest.json'){res.setHeader('content-type','application/json');res.end(manifest);return;}
    if(!permitted.has(path)){res.writeHead(404);res.end('file not packaged');return;}
    const bytes=await readFile(join(dist,path));
    res.setHeader('content-type',path.endsWith('.js')?'text/javascript':
      path.endsWith('.css')?'text/css':path.endsWith('.html')?'text/html':
      path.endsWith('.json')?'application/json':'application/octet-stream');
    res.end(bytes);
  }catch(error){res.writeHead(500);res.end(error.message);}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1500,height:1024},deviceScaleFactor:1,serviceWorkers:'block'});
  const origin='http://127.0.0.1:'+server.address().port,errors=[];
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?
    route.continue():route.abort());
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
  await page.goto(origin+'/demos/world-vis-lab/index.html',{waitUntil:'load'});
  await page.waitForFunction(()=>document.documentElement.dataset.worldVisReady==='ready'&&
    __worldVis.frames>0,{timeout:60000});
  const snap=()=>page.evaluate(()=>__worldVis);
  let initial=await snap();
  assert.equal(initial.ready,true);assert.ok(initial.world.highTriangles>1000);
  assert.ok(initial.world.batches>5);assert.ok(initial.retained.residentMeshes>0);
  assert.equal(initial.error,null);
  assert.equal(initial.cameraComparisons.length,3);
  const authority=initial.sample;
  const canvas=page.locator('#world-canvas');
  // The same full-res camera must produce identical pixels with on-screen
  // culling OFF vs ON. This is the critical conservative no-false-negative gate.
  await page.locator('#lod').selectOption('high');
  await page.waitForFunction(()=>__worldVis.plan?.lod==='high'&&__worldVis.frames>1,{timeout:20000});
  await page.locator('#culling').check();
  const start=await snap();const culledPNG=await canvas.screenshot();
  await page.locator('#culling').uncheck();
  await page.waitForFunction(n=>__worldVis.frames>n&&__worldVis.plan?.culling===false,start.frames,{timeout:20000});
  const complete=await snap(),allPNG=await canvas.screenshot();
  assert.equal(complete.plan.selected,initial.world.batches,'disabled culling keeps all batches');
  assert.equal(complete.plan.culled,0);
  assert.deepEqual(complete.sample,authority);
  assert.equal(sha(culledPNG),sha(allPNG),
    'full-source camera raster must not change when conservative culling toggles');
  const uploadedBefore=complete.retained.uploads;
  await page.locator('#refresh').click();
  await page.waitForFunction(n=>__worldVis.frames>n,complete.frames,{timeout:20000});
  assert.equal((await snap()).retained.uploads,uploadedBefore,'still camera reuses GPU buffers');
  // Explicit cache reset causes reupload but not changed authoring/physics.
  const preReset=await snap();
  await page.locator('#reset-cache').click();
  await page.waitForFunction(n=>__worldVis.frames>n,preReset.frames,{timeout:20000});
  const reset=await snap();
  assert.ok(reset.retained.uploads>preReset.retained.uploads);
  assert.deepEqual(reset.sample,authority);
  assert.equal(reset.plan.selected,initial.world.batches);
  assert.ok(reset.retained.residentBytes<=reset.retained.maxResidentBytes);
  // Exact source geometry remains available; optional coarse LOD preserves
  // only whole source triangles with lower vertex work, never physics state.
  await page.locator('#culling').check();
  await page.locator('#lod-distance').fill('20');
  await page.locator('#lod').selectOption('auto');
  await page.waitForFunction(()=>__worldVis.plan?.lod==='auto'&&
    __worldVis.plan.lodVertices<__worldVis.plan.fullVertices,{timeout:20000});
  const coarse=await snap();
  assert.ok(coarse.plan.lodVertices<coarse.plan.fullVertices);
  assert.deepEqual(coarse.sample,authority);
  for(const name of ['road','ridge','overlook']){
    const before=(await snap()).frames;
    await page.locator('#camera').selectOption(name);
    await page.waitForFunction(n=>__worldVis.frames>n&&__worldVis.cameraId===
      document.querySelector('#camera').value,before,{timeout:20000});
    const moved=await snap();
    assert.deepEqual(moved.sample,authority);
    assert.equal(moved.plan.selected+moved.plan.culled,moved.world.batches);
    assert.ok(moved.retained.residentBytes<=moved.retained.maxResidentBytes);
    assert.equal(moved.cameraComparisons.length,3);
    assert.equal(moved.error,null);
  }
  // Real canvas context recreation is tested only where WebGL's standard
  // lose-context extension is present in the pinned hosted browser.
  const supportsLoss=await page.evaluate(()=>{
    const gl=document.querySelector('#world-canvas').getContext('webgl');
    return Boolean(gl?.getExtension('WEBGL_lose_context'));
  });
  if(supportsLoss){
    await page.evaluate(()=>document.querySelector('#world-canvas').
      getContext('webgl').getExtension('WEBGL_lose_context').loseContext());
    await page.waitForFunction(()=>document.querySelector('#renderer-status').
      textContent==='CONTEXT LOST',{timeout:10000});
    await page.evaluate(()=>document.querySelector('#world-canvas').
      getContext('webgl').getExtension('WEBGL_lose_context').restoreContext());
    await page.waitForFunction(()=>__worldVis.error===null&&
      document.querySelector('#renderer-status').textContent.startsWith('WEBGL1'),
      {timeout:20000});
    assert.ok((await snap()).retained.residentMeshes>0);
    assert.deepEqual((await snap()).sample,authority);
  }
  assert.deepEqual(errors,[],'no browser JS errors, 404 or external network');
  await mkdir(join(root,'browser-artifacts'),{recursive:true});
  await writeFile(join(root,'browser-artifacts/world-vis-001-horizon.png'),culledPNG);
  const receipt={kind:'qsol.vanillajs.world-vis-001.browser.v1',status:'PASS',
    testedCheckout:process.env.GITHUB_SHA??null,chromium:browser.version(),
    manifestSHA256:sha(manifest),fullResolutionScreenshotSHA256:sha(culledPNG),
    originalHorizonSource:{batches:initial.world.batches,triangles:initial.world.highTriangles},
    contextLossRestoration:supportsLoss?'PASS':'UNSUPPORTED_BY_BROWSER',
    checks:['actual packaged HORIZON scenic geometry','three independent camera frusta',
      'conservative culling/full-source pixel identity','still-camera buffer reuse',
      'retained GPU mesh byte cap','explicit GPU reupload after cache reset',
      'coarse LOD reduces original triangle submissions','camera switch leaves road unchanged',
      'optional real WebGL context restore','no network/errors']};
  await writeFile(join(root,'browser-artifacts/world-vis-001-acceptance.json'),
    JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt,null,2));
  await context.close();
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
