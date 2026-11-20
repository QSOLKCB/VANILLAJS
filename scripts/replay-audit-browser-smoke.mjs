// SPDX-License-Identifier: Apache-2.0
// REPLAY-AUDIT-001 source-packaged Chromium: no replay or event mocks.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist'),
 manifest=await readFile(join(dist,'manifest.json')),
 permitted=new Set(JSON.parse(manifest).files.map(f=>f.path)),
 hash=b=>createHash('sha256').update(b).digest('hex');
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '');
  if(!permitted.has(path)){res.writeHead(404);res.end('not packaged');return;}
  const data=await readFile(join(dist,path));
  res.setHeader('content-type',path.endsWith('.js')?'text/javascript':
   path.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);
 }catch(error){res.writeHead(500);res.end(error.message);}
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1350,height:1050},acceptDownloads:true,serviceWorkers:'block'});
 const origin='http://127.0.0.1:'+server.address().port,errors=[];
 await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push('JS '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console '+m.text());});
 page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status());});
 await page.goto(origin+'/demos/replay-audit-lab/index.html',{waitUntil:'load'});
 await page.waitForFunction(()=>document.documentElement.dataset.replayAuditReady==='ready');
 const snap=()=>page.evaluate(()=>__replayAudit.snapshot()),cases=[];
 for(const kind of ['fps','air','racing','integer']){
  await page.locator('#model').selectOption(kind);
  await page.locator('#record').click();
  await page.waitForFunction(k=>__replayAudit.snapshot().kind===k,kind,{timeout:20000});
  await page.locator('#verify').click();
  await page.waitForFunction(()=>__replayAudit.snapshot().verified===true,undefined,{timeout:20000});
  const v=await snap();assert.ok(v.ticks>0);cases.push({kind,ticks:v.ticks,events:v.events});
 }
 await page.locator('#compare').click();
 await page.waitForFunction(()=>__replayAudit.snapshot().parity!==null,undefined,{timeout:20000});
 const afterCompare=await snap(),parity=afterCompare.parity;
 assert.deepEqual(parity.map(x=>x.renderHz),[30,60,144]);
 assert.ok(parity.every(x=>x.sameAuthoritativeTrace));
 for(const check of parity){
  const observed=afterCompare.presentation.draws[String(check.renderHz)];
  assert.equal(observed.frames,check.displaySamples,'actual Canvas redraws required');
  assert.equal(observed.lastTick,check.consumedTicks);
  assert.equal(observed.nonAdvancingFrames,check.nonAdvancingFrames);
 }
 assert.notEqual(parity[0].sampleSha256,parity[2].sampleSha256,'rates must schedule different samples');
 assert.ok(parity[2].nonAdvancingFrames>0,'144 Hz must display frames without 120 Hz tick');
 // The visible selector also exercises the same real Canvas cadence path.
 for(const rate of ['30','60','144']){
  await page.locator('#render-rate').selectOption(rate);
  await page.waitForFunction(r=>__replayAudit.snapshot().presentation.audit?.renderHz===Number(r),rate,{timeout:20000});
  const status=await snap(),draws=status.presentation.draws[rate];
  assert.ok(draws.frames>0);assert.equal(draws.lastTick,status.ticks);
  assert.match(status.message,/CADENCE EXERCISED/);
 }
 await page.locator('#tamper').click();
 await page.waitForFunction(()=>{
  const m=__replayAudit.snapshot().message;
  return m.startsWith('EXPECTED REJECTION')||m.startsWith('NEGATIVE CONTROL ERROR')||m.startsWith('FAIL:');
 },undefined,{timeout:20000});
 assert.match((await snap()).message,/EXPECTED REJECTION/);
 await page.locator('#model').selectOption('fps');await page.locator('#record').click();
 await page.waitForFunction(()=>__replayAudit.snapshot().kind==='fps',undefined,{timeout:20000});
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export').click()]);
 const bytes=await readFile(await download.path()),saved=JSON.parse(bytes);
 await page.locator('#model').selectOption('racing');
 await page.locator('#import').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:bytes});
 await page.waitForFunction(()=>__replayAudit.snapshot().message.startsWith('IMPORTED'),undefined,{timeout:20000});
 assert.equal((await snap()).kind,'fps');
 const forged=structuredClone(saved);forged.trace[0].stateSha256='0'.repeat(64);
 await page.locator('#import').setInputFiles({name:'forged.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(forged))});
 await page.waitForFunction(()=>__replayAudit.snapshot().message.startsWith('IMPORT REJECTED'),undefined,{timeout:20000});
 assert.equal((await snap()).kind,'fps');
 assert.deepEqual(errors,[]);
 const png=await page.locator('#field').screenshot();assert.ok(png.length>2000);
 await mkdir(join(root,'browser-artifacts'),{recursive:true});
 await writeFile(join(root,'browser-artifacts/replay-audit-001.png'),png);
 const evidence={kind:'qsol.vanillajs.replay-audit-001.browser.v1',status:'PASS',
  checkout:process.env.GITHUB_SHA??null,chromium:browser.version(),
  manifestSha256:hash(manifest),screenSha256:hash(png),receiptSha256:hash(bytes),
  models:cases,parity,checks:['actual FPS hits','real TRAJECTORY-001 actor impact',
   'Vehicle3D and integer simulation','three interleaved 30/60/144 Hz Canvas sampling paths',
   'selector driven real Canvas frames','full export/import verification',
   'tamper fails closed','zero JS and network errors']};
 await writeFile(join(root,'browser-artifacts/replay-audit-001.json'),JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify(evidence));
 await context.close();
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
