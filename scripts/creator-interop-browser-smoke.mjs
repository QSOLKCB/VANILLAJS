// SPDX-License-Identifier: Apache-2.0
// CREATOR-INTEROP-001 real packaged browser: actual edit, export/import and tamper control.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist'),
  manifest=await readFile(join(dist,'manifest.json')),allowed=new Set(JSON.parse(manifest).files.map(x=>x.path));
const sha=b=>createHash('sha256').update(b).digest('hex');
const server=createServer(async(req,res)=>{
 try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '');
  if(!allowed.has(name)){res.writeHead(404);res.end('unpackaged');return;}
  const bytes=await readFile(join(dist,name));
  res.setHeader('content-type',name.endsWith('.js')?'text/javascript':
    name.endsWith('.html')?'text/html':name.endsWith('.json')?'application/json':'application/octet-stream');
  res.end(bytes);
 }catch(error){res.writeHead(500);res.end(error.message);}
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1400,height:1000},
   acceptDownloads:true,serviceWorkers:'block'});
 const origin='http://127.0.0.1:'+server.address().port,errors=[];
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push('JS '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console '+m.text());});
 page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status());});
 await page.goto(origin+'/demos/creator-interop-lab/index.html',{waitUntil:'load'});
 const report=async()=>JSON.parse(await page.locator('#receipt').textContent());
 const start=await report();assert.equal(start.zones,1);assert.equal(start.cover,1);
 const canvas=page.locator('#field'),bbox=await canvas.boundingBox();
 const choose=async(x,z)=>{
  const pixelX=120+(x+.5)*40,pixelY=60+(z+.5)*40;
  await page.mouse.click(bbox.x+pixelX/720*bbox.width,bbox.y+pixelY/540*bbox.height);
 };
 await page.locator('[data-tool="wall"]').click();
 await choose(4,2);
 const edited=await report();assert.equal(edited.zones,2);assert.equal(edited.cover,2);
 assert.match(edited.message,/Accepted wall/);
 await page.locator('[data-tool="target"]').click();
 await choose(7,3);
 await page.locator('[data-tool="cad"]').click();
 await choose(3,6);
 const authored=await report();assert.equal(authored.placements,start.placements+2);
 assert.equal(authored.assets,start.assets+1);
 assert.match(authored.message,/Accepted cad/);
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);
 const payload=await readFile(await download.path());
 const parsed=JSON.parse(payload);assert.match(parsed.sha256,/^[a-f0-9]{64}$/);
 assert.equal(parsed.project.zones.length,2);
 await page.locator('#reset').click();
 assert.equal((await report()).zones,1);
 await page.locator('#import').setInputFiles({name:'world.json',mimeType:'application/json',buffer:payload});
 await page.waitForFunction(()=>{
  const result=JSON.parse(document.querySelector('#receipt').textContent);
  return result.message.startsWith('Imported ')||result.message.startsWith('Import rejected');
 },undefined,{timeout:20000});
 const restored=await report();assert.match(restored.message,/^Imported verified inert world/);
 assert.equal(restored.zones,2);
 assert.equal(restored.cover,2);assert.equal(restored.placements,authored.placements);
 const corrupt=JSON.parse(payload);corrupt.project.placements[0].position=[17,1,-17];
 await page.locator('#import').setInputFiles({name:'tampered.json',mimeType:'application/json',
   buffer:Buffer.from(JSON.stringify(corrupt))});
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#receipt').textContent)
   .message.startsWith('Import rejected'),undefined,{timeout:20000});
 assert.match((await report()).message,/Import rejected without mutation/);
 assert.equal((await report()).zones,2);
 const nonTactical=await page.evaluate(async project=>{
  const creator=await import('/modules/creator-interop/index.js');
  return creator.creatorPackageJSON(await creator.sealCreatorPackage({...project,tactical:null}));
 },parsed.project);
 await page.locator('#import').setInputFiles({name:'non-tactical.json',mimeType:'application/json',
   buffer:Buffer.from(nonTactical)});
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#receipt').textContent)
   .message.startsWith('Imported '),undefined,{timeout:20000});
 const withoutTactics=await report();assert.equal(withoutTactics.hasTactical,false);
 assert.equal(withoutTactics.tacticalUnits,0);assert.equal(withoutTactics.cover,0);
 assert.equal(await page.locator('[data-tool="alpha"]').isDisabled(),true);
 await page.locator('[data-tool="wall"]').click();
 await choose(2,8);
 const nonTacticalEdit=await report();assert.match(nonTacticalEdit.message,/Accepted wall/);
 assert.equal(nonTacticalEdit.zones,parsed.project.zones.length+1);
 assert.equal(nonTacticalEdit.cover,0);
 const png=await canvas.screenshot();assert.ok(png.length>3000);
 assert.deepEqual(errors,[],'zero errors and external requests');
 await mkdir(join(root,'browser-artifacts'),{recursive:true});
 await writeFile(join(root,'browser-artifacts/creator-interop-001.png'),png);
 const receipt={kind:'qsol.vanillajs.creator-interop-001.chromium.v1',status:'PASS',
  checkedSHA:process.env.GITHUB_SHA??null,manifestSHA256:sha(manifest),
  authoredPackageSHA256:sha(payload),screenshotSHA256:sha(png),
  checks:['packaged World Foundry','real edit changes physical zone and tactical cover together',
   'new target placement','SHA256 sealed download','reset then reimport exact objects',
   'tamper rejected atomically','non-tactical import remains editable without phantom cover',
   'zero network/runtime errors']};
 await writeFile(join(root,'browser-artifacts/creator-interop-001.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify(receipt));
 await context.close();
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
