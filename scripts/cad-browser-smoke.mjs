// SPDX-License-Identifier: Apache-2.0
// CAD-001 actual source-packaged Visual Editor acceptance, isolated pinned browser.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist');
const manifest=await readFile(join(dist,'manifest.json'));
const allowed=new Set(JSON.parse(manifest).files.map(f=>f.path));
const sha=data=>createHash('sha256').update(data).digest('hex');
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,'');
    // Manifest is self-describing and intentionally cannot list itself.
    // Serve exact hashed-on-disk manifest bytes for the editor's existing
    // optional offline registration, without broadening the asset allowlist.
    if(pathname==='manifest.json'){
      res.setHeader('content-type','application/json');res.end(manifest);return;
    }
    if(!allowed.has(pathname)){res.writeHead(404);res.end('not in package');return;}
    const bytes=await readFile(join(dist,pathname));
    res.setHeader('content-type',pathname.endsWith('.js')?'text/javascript':
      pathname.endsWith('.html')?'text/html':pathname.endsWith('.css')?'text/css':
      pathname.endsWith('.json')?'application/json':'application/octet-stream');
    res.end(bytes);
  }catch(error){res.writeHead(500);res.end(error.message);}
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1480,height:1060},deviceScaleFactor:1,acceptDownloads:true,serviceWorkers:'block'});
  const origin='http://127.0.0.1:'+server.address().port,failures=[];
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();
  page.on('pageerror',error=>failures.push(error.message));
  page.on('response',response=>{if(response.status()>=400)
    failures.push('HTTP '+response.status()+' '+response.url());});
  page.on('console',entry=>{if(entry.type()==='error')failures.push(entry.text());});
  await page.goto(origin+'/demos/editor/index.html',{waitUntil:'load'});
  await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='ready',undefined,{timeout:30000});
  const countBefore=Number(await page.locator('#count').textContent());
  const canvas=page.locator('#view'),baseline=await canvas.screenshot();
  assert.equal(await page.locator('#cad-create').isEnabled(),true);
  await page.locator('#cad-kind').selectOption('urn');
  await page.locator('#cad-radius').fill('1.1');
  await page.locator('#cad-height').fill('2.5');
  await page.locator('#cad-segments').fill('20');
  await page.getByRole('button',{name:'Generate & Place CAD'}).click();
  await page.waitForFunction(n=>Number(document.querySelector('#count')?.textContent)===n,
    countBefore+1,{timeout:15000});
  assert.equal(await page.locator('#object-name').inputValue(),'CAD Urn');
  assert.match(await page.locator('#cad-status').textContent(),/Generated CAD Urn/);
  assert.equal(await page.locator('#asset-count').textContent(),'1 assets');
  assert.equal(await page.locator('#asset-list option').count(),1);
  await page.waitForTimeout(200);
  const after=await canvas.screenshot();
  assert.notEqual(sha(after),sha(baseline),'generated CAD shape must alter rendered WebGL viewport');
  const download=page.waitForEvent('download');
  await page.locator('#asset-save-project').click();
  const receipt=await download;
  const raw=JSON.parse(await readFile(await receipt.path(),'utf8'));
  assert.equal(raw.library.assets.length,1);
  const asset=raw.library.assets[0];
  assert.equal(asset.kind,'mesh');
  assert.equal(asset.license,'Apache-2.0');
  assert.match(asset.sourceSha256,/^[a-f0-9]{64}$/);
  assert.equal(asset.sourceName,'cad-urn.obj');
  assert.ok(asset.vertices.length>0&&asset.vertices.length%15===0);
  assert.equal(raw.library.placements.length,1);
  const object=raw.scene.objects.find(x=>x.id===raw.library.placements[0].entityId);
  assert.equal(object.name,'CAD Urn');
  assert.ok(Math.abs(object.position[1]-1.25)<1e-12);
  await page.locator('#undo').click();
  assert.equal(Number(await page.locator('#count').textContent()),countBefore);
  await page.locator('#redo').click();
  assert.equal(Number(await page.locator('#count').textContent()),countBefore+1);
  // Inputs are bounded: an invalid radius cannot create a second entity or asset.
  await page.locator('#cad-radius').fill('-1');
  await page.getByRole('button',{name:'Generate & Place CAD'}).click();
  assert.equal(Number(await page.locator('#count').textContent()),countBefore+1);
  assert.equal(await page.locator('#asset-count').textContent(),'1 assets');
  assert.match(await page.locator('#cad-status').textContent(),/CAD rejected/);
  assert.deepEqual(failures,[],'no browser JS errors');
  await mkdir(join(root,'browser-artifacts'),{recursive:true});
  await writeFile(join(root,'browser-artifacts/cad-001-editor.png'),after);
  const report={kind:'qsol.vanillajs.cad-001.browser.v1',status:'PASS',
    source:process.env.GITHUB_SHA??null,browser:browser.version(),
    manifestSHA256:sha(manifest),screenshotSHA256:sha(after),assetSourceSHA256:asset.sourceSha256,
    triangles:asset.vertices.length/15,
    checked:['source-packaged WebGL editor','generated parametric urn','native viewport pixels changed',
      'strict mesh asset persisted','Apache-2.0 provenance','project download',
      'undo/redo placement history','invalid geometry rejected','no JavaScript errors','no external network']};
  await writeFile(join(root,'browser-artifacts/cad-001-acceptance.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  await context.close();
}finally{
  await browser?.close();
  await new Promise(ok=>server.close(ok));
}
