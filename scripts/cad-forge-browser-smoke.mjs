// SPDX-License-Identifier: Apache-2.0
// CAD-003: real packaged Chromium, native WebGL + Canvas2D and existing
// SHA-256 Asset Foundry. Zero external URLs, clocked gameplay or mock meshes.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist');
const manifest=await readFile(join(dist,'manifest.json'));
const allowed=new Set(JSON.parse(manifest).files.map(f=>f.path));
const sha=b=>createHash('sha256').update(b).digest('hex');
const server=createServer(async(req,res)=>{
  try{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,'');
    if(name==='manifest.json'){res.setHeader('content-type','application/json');res.end(manifest);return;}
    if(!allowed.has(name)){res.writeHead(404);res.end('not in manifest');return;}
    const bytes=await readFile(join(dist,name));
    res.setHeader('content-type',name.endsWith('.js')?'text/javascript':
      name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':
      name.endsWith('.json')?'application/json':'application/octet-stream');
    res.end(bytes);
  }catch(error){res.writeHead(500);res.end(error.message);}
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1500,height:1040},deviceScaleFactor:1,
    acceptDownloads:true,serviceWorkers:'block'});
  const origin='http://127.0.0.1:'+server.address().port,errors=[];
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?
    route.continue():route.abort());
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',response=>{if(response.status()>=400)errors.push('HTTP '+response.status()+' '+response.url());});
  page.on('console',c=>{if(c.type()==='error')errors.push(c.text());});
  await page.goto(origin+'/demos/editor/index.html',{waitUntil:'load'});
  await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='ready'&&
    document.documentElement.dataset.geometryForgeReady==='ready',undefined,{timeout:30000});
  const base=Number(await page.locator('#count').textContent()),
    snap=()=>page.evaluate(()=>__editorGeometryForge);
  assert.equal((await snap()).closed,true);
  assert.match(await page.locator('#forge-diagnostics').textContent(),/CLOSED/);
  const nativeCanvas=page.locator('#view'),old=await nativeCanvas.screenshot();
  await page.locator('#forge-kind').selectOption('tower');
  await page.locator('#forge-width').fill('3');
  await page.locator('#forge-depth').fill('3');
  await page.locator('#forge-height').fill('4');
  await page.locator('#forge-bevel').fill('0.25');
  await page.locator('#forge-bevel').dispatchEvent('change');
  let visual=await snap();
  assert.equal(visual.closed,true);
  assert.ok(visual.volume>0);
  const workplane=page.locator('#forge-footprint-canvas');
  const preview=await workplane.screenshot();
  // The CAD drawing is a read-only preview. Nothing enters the scene
  // until the physical user action is accepted.
  assert.equal(Number(await page.locator('#count').textContent()),base);
  assert.equal(await page.locator('#asset-count').textContent(),'0 assets');
  assert.equal(sha(await nativeCanvas.screenshot()),sha(old));
  await page.locator('#forge-commit').click();
  await page.waitForFunction(n=>Number(document.querySelector('#count').textContent)===n,base+1,{timeout:15000});
  assert.equal(await page.locator('#object-name').inputValue(),'Forge tower');
  assert.equal(await page.locator('#asset-count').textContent(),'1 assets');
  assert.notEqual(sha(await nativeCanvas.screenshot()),sha(old),'actual scene renderer changed');
  await page.locator('#forge-inspect').click();
  assert.match(await page.locator('#forge-inspection').textContent(),/CLOSED/);
  assert.match(await page.locator('#forge-inspection').textContent(),/boundaries 0/);
  assert.match(await page.locator('#forge-inspection').textContent(),/Euler 2/);
  // A custom convex footprint is editable as inert numbers, not scripts.
  await page.locator('#forge-custom').check();
  await page.locator('#forge-outline').fill('-2,-1; 2,-1; 1.6,1; -1.6,1');
  await page.locator('#forge-height').fill('2.5');
  await page.locator('#forge-height').dispatchEvent('change');
  assert.equal((await snap()).closed,true);
  await page.locator('#forge-commit').click();
  await page.waitForFunction(n=>Number(document.querySelector('#count').textContent)===n,base+2,{timeout:15000});
  assert.equal(await page.locator('#asset-count').textContent(),'2 assets');
  const saved=page.waitForEvent('download');
  await page.locator('#asset-save-project').click();
  const download=await saved,bytes=await readFile(await download.path());
  const project=JSON.parse(bytes.toString('utf8'));
  assert.equal(project.library.assets.length,2);
  assert.equal(project.library.placements.length,2);
  for(const asset of project.library.assets){
    assert.equal(asset.kind,'mesh');assert.equal(asset.sourceName,'cad-forge.obj');
    assert.equal(asset.license,'Apache-2.0');
    assert.match(asset.sourceSha256,/^[0-9a-f]{64}$/);
    assert.ok(asset.vertices.length>0&&asset.vertices.length%15===0);
  }
  await page.locator('#undo').click();
  assert.equal(Number(await page.locator('#count').textContent()),base+1);
  await page.locator('#redo').click();
  assert.equal(Number(await page.locator('#count').textContent()),base+2);
  // Import the original project bytes and inspect the saved mesh in the
  // actual unchanged editor, with the same on-screen controls.
  await page.locator('#asset-open-project').setInputFiles({
    name:'geometry-forge.vproject.json',mimeType:'application/json',buffer:bytes
  });
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.startsWith(
    'Loaded local asset project'),undefined,{timeout:10000});
  const secondId=project.library.placements.at(-1).entityId;
  await page.locator('#hierarchy [data-id="'+secondId+'"]').click();
  await page.locator('#forge-inspect').click();
  assert.match(await page.locator('#forge-inspection').textContent(),/CLOSED/);
  assert.match(await page.locator('#forge-inspection').textContent(),/winding errors 0/);
  // A concave input must be rejected before creating any asset or object.
  await page.locator('#forge-outline').fill('-2,-2;2,-2;0,0;2,2;-2,2');
  assert.equal((await snap()).valid,false);
  assert.match(await page.locator('#forge-status').textContent(),/Forge rejected/);
  await page.locator('#forge-commit').click();
  assert.equal(Number(await page.locator('#count').textContent()),base+2);
  assert.equal(await page.locator('#asset-count').textContent(),'2 assets');
  assert.deepEqual(errors,[],'zero exceptions, HTTP failures or external requests');
  await mkdir(join(root,'browser-artifacts'),{recursive:true});
  await writeFile(join(root,'browser-artifacts/cad-003-forge.png'),preview);
  const receipt={kind:'qsol.vanillajs.cad-003.browser.v1',status:'PASS',
    testedMergeCheckout:process.env.GITHUB_SHA??null,chromium:browser.version(),
    packageSHA256:sha(manifest),previewSHA256:sha(preview),
    projectSHA256:sha(bytes),assets:project.library.assets.map(a=>a.sourceSha256),
    checks:['native editor and Geometry Forge startup','closed topology and reference volume',
      'original industrial tower with true bevel','non-authoritative Canvas2D preview',
      'real WebGL scene mutation on Generate','selected mesh topology inspection',
      'custom numeric convex polygon and second mesh','Apache-2.0 SHA-256 sources',
      'project save/reopen','scene undo/redo','concave input fail-closed',
      'zero browser exceptions and external network']};
  await writeFile(join(root,'browser-artifacts/cad-003-acceptance.json'),
    JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt,null,2));
  await context.close();
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
