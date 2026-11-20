// SPDX-License-Identifier: Apache-2.0
// CAD-002 package-owned browser regression: real profile dimensions, dragging,
// immutable asset revision, project reopen, playback isolation and zero network.
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
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const server=createServer(async(req,res)=>{
  try{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,'');
    if(name==='manifest.json'){
      res.setHeader('content-type','application/json');res.end(manifest);return;
    }
    if(!allowed.has(name)){res.writeHead(404);res.end('not in package');return;}
    const bytes=await readFile(join(dist,name));
    res.setHeader('content-type',name.endsWith('.js')?'text/javascript':
      name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':
      name.endsWith('.json')?'application/json':'application/octet-stream');
    res.end(bytes);
  }catch(error){res.writeHead(500);res.end(error.message);}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1480,height:1060},deviceScaleFactor:1,
    acceptDownloads:true,serviceWorkers:'block'});
  const origin='http://127.0.0.1:'+server.address().port,failures=[];
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();
  page.on('pageerror',e=>failures.push(e.message));
  page.on('response',r=>{if(r.status()>=400)failures.push('HTTP '+r.status()+' '+r.url());});
  page.on('console',m=>{if(m.type()==='error')failures.push(m.text());});
  await page.goto(origin+'/demos/editor/index.html',{waitUntil:'load'});
  await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='ready'&&
    document.documentElement.dataset.cadProfileReady==='ready',undefined,{timeout:30000});
  const snap=()=>page.evaluate(()=>__editorCadProfile);
  const countBefore=Number(await page.locator('#count').textContent());
  await page.locator('#cad-kind').selectOption('urn');
  await page.locator('#cad-radius').fill('1.1');
  await page.locator('#cad-height').fill('2.5');
  await page.locator('#cad-segments').fill('20');
  await page.locator('#cad-create').click();
  await page.waitForFunction(n=>Number(document.getElementById('count').textContent)===n,
    countBefore+1,{timeout:15000});
  assert.equal(await page.locator('#object-name').inputValue(),'CAD Urn');
  const assetBefore=await page.locator('#asset-count').textContent();
  assert.equal(assetBefore,'1 assets');
  await page.locator('#cad-profile-load').click();
  let draft=await snap();
  assert.equal(draft.profile.length,5);
  assert.equal(draft.segments,20);
  const beforeCad=await page.locator('#view').screenshot();
  const beforeEditorCount=await page.locator('#count').textContent();
  const beforeDraft=draft.profile.map(x=>[...x]);
  await page.locator('#cad-profile-zoom').selectOption('2');
  await page.locator('#cad-profile-pan').selectOption('60');
  draft=await snap();
  assert.deepEqual(draft.profile,beforeDraft,'preview zoom/pan must not author geometry');
  assert.equal(await page.locator('#count').textContent(),beforeEditorCount);
  assert.equal(await page.locator('#asset-count').textContent(),assetBefore);
  assert.equal(sha(await page.locator('#view').screenshot()),sha(beforeCad),
    'profile preview transforms must not redraw authoritative game geometry');
  await page.locator('#cad-profile-zoom').selectOption('1');
  await page.locator('#cad-profile-pan').selectOption('0');
  // Use real numeric handle changes; the nearest snapped radius is 0.05 m.
  await page.locator('#cad-profile-ring-missing').count().then(x=>assert.equal(x,0));
  await page.locator('#cad-profile-points button[data-index="2"]').click();
  await page.locator('#cad-profile-radius').fill('1.234');
  await page.locator('#cad-profile-radius').press('Tab');
  draft=await snap();
  assert.equal(draft.profile[2][0],1.25);
  // Real pointer drags move a handle on the source-owned Canvas2D sketch.
  const preview=page.locator('#cad-profile-canvas');await preview.scrollIntoViewIfNeeded();
  const box=await preview.boundingBox();
  const pt=draft.profile[2],zoom=1,scale=Math.min((320-60)/5,(270-40)/12)*zoom;
  const x=box.x+(40+pt[0]*scale)*box.width/320,
    y=box.y+(135-pt[1]*scale)*box.height/270;
  await page.mouse.move(x,y);await page.mouse.down();
  await page.mouse.move(x+8,y,{steps:4});await page.mouse.up();
  draft=await snap();
  assert.notEqual(draft.profile[2][0],1.25,'drag must edit the selected radius');
  assert.ok(Math.abs(draft.profile[2][0]/.05-Math.round(draft.profile[2][0]/.05))<1e-8);
  const editedProfile=draft.profile.map(p=>[...p]);
  const screenshot=await preview.screenshot();
  await mkdir(join(root,'browser-artifacts'),{recursive:true});
  await writeFile(join(root,'browser-artifacts/cad-002-profile.png'),screenshot);
  await page.locator('#cad-profile-add').click();
  assert.equal((await snap()).profile.length,6);
  await page.locator('#cad-profile-remove').click();
  assert.equal((await snap()).profile.length,5);
  // A new version is a NEW mesh and scene entity, preserving the original.
  await page.locator('#cad-profile-commit').click();
  await page.waitForFunction(n=>Number(document.getElementById('count').textContent)===n,
    countBefore+2,{timeout:15000});
  assert.equal(await page.locator('#asset-count').textContent(),'2 assets');
  assert.equal(await page.locator('#object-name').inputValue(),'CAD Profile');
  const downloaded=page.waitForEvent('download');
  await page.locator('#asset-save-project').click();
  const file=await downloaded,raw=await readFile(await file.path());
  const project=JSON.parse(raw.toString('utf8'));
  assert.equal(project.library.assets.length,2);
  assert.equal(project.library.placements.length,2);
  assert.equal(project.library.assets[0].sourceName,'cad-urn.obj');
  const revised=project.library.assets[1];
  assert.equal(revised.sourceName,'cad-profile.obj');assert.equal(revised.license,'Apache-2.0');
  assert.match(revised.sourceSha256,/^[0-9a-f]{64}$/);
  assert.notEqual(revised.sourceSha256,project.library.assets[0].sourceSha256);
  assert.ok(revised.vertices.length>0&&revised.vertices.length%15===0);
  await page.locator('#undo').click();
  assert.equal(Number(await page.locator('#count').textContent()),countBefore+1);
  await page.locator('#redo').click();
  assert.equal(Number(await page.locator('#count').textContent()),countBefore+2);
  // The exported file reopens with the same original and revised source.
  await page.locator('#asset-open-project').setInputFiles({name:'cad-profile.vproject.json',
    mimeType:'application/json',buffer:raw});
  await page.waitForFunction(()=>document.getElementById('status')?.textContent.startsWith('Loaded local asset project'),undefined,{timeout:10000});
  assert.equal(Number(await page.locator('#count').textContent()),countBefore+2);
  const revisedId=project.library.placements.at(-1).entityId;
  await page.locator('#hierarchy button[data-id="'+revisedId+'"]').click();
  await page.locator('#cad-profile-load').click();
  const recovered=await snap();
  assert.equal(recovered.profile.length,5);
  assert.equal(recovered.segments,20);
  for(let i=0;i<recovered.profile.length;i++)
    for(let j=0;j<2;j++)assert.ok(Math.abs(recovered.profile[i][j]-editedProfile[i][j])<=.0000011);
  // An invalid crossing edit must be rejected without changing the draft.
  await page.locator('#cad-profile-points button[data-index="2"]').click();
  const saved=await snap();
  await page.locator('#cad-profile-y').fill('-10');
  await page.locator('#cad-profile-y').press('Tab');
  assert.deepEqual((await snap()).profile,saved.profile);
  assert.match(await page.locator('#cad-profile-status').textContent(),/height must increase/);
  // Exact OBJ precision boundary: a float-distinct ring at +4e-7 of its
  // predecessor must be rejected before an asset is generated.
  await page.locator('#cad-profile-snap').selectOption('0'); // Free, no 0.05m coarsening
  await page.locator('#cad-profile-y').fill(String(saved.profile[1][1]+.0000004));
  await page.locator('#cad-profile-y').press('Tab');
  assert.deepEqual((await snap()).profile,saved.profile);
  assert.match(await page.locator('#cad-profile-status').textContent(),
    /elevations collapse at six-decimal OBJ precision/);
  assert.equal(await page.locator('#asset-count').textContent(),'2 assets');
  assert.deepEqual(failures,[],'no exceptions, HTTP 404 or external network');
  const receipt={kind:'qsol.vanillajs.cad-002.browser.v1',status:'PASS',
    head:process.env.GITHUB_SHA??null,chromium:browser.version(),
    manifestSHA256:sha(manifest),previewSHA256:sha(screenshot),
    assetSourceSHA256:revised.sourceSha256,
    checked:['CAD-001 primitive recovery','preview zoom and pan presentation isolation',
      'snapped radial numeric edits','real pointer handle drag','ring insert/remove',
      'new immutable mesh variant','project asset and licence provenance',
      'scene undo/redo','native project reopen and profile re-recovery',
      'invalid crossing edit atomicity','no JavaScript errors','no external network']};
  await writeFile(join(root,'browser-artifacts/cad-002-acceptance.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt,null,2));
  await context.close();
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
