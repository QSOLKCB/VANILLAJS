// SPDX-License-Identifier: Apache-2.0
// SENSE-001 packed-browser acceptance. Pinned tooling is CI-only; native JS runtime.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';

const {chromium}=createRequire(import.meta.url)('playwright');
const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist');
const manifestBytes=await readFile(join(dist,'manifest.json'));
const allowed=new Set(JSON.parse(manifestBytes).files.map(f=>f.path));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/,'');
    if(!allowed.has(path)){res.writeHead(404);res.end('not in package');return;}
    const buffer=await readFile(join(dist,path));
    res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':
      path.endsWith('.css')?'text/css':path.endsWith('.html')?'text/html':'application/octet-stream');
    res.end(buffer);
  }catch(error){res.writeHead(500);res.end(error.message);}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1450,height:1000},deviceScaleFactor:1,serviceWorkers:'block'});
  const origin='http://127.0.0.1:'+server.address().port;
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(origin+'/demos/sensing-lab/index.html',{waitUntil:'load'});
  await page.waitForFunction(()=>document.documentElement.dataset.labReady==='sense-001',undefined,{timeout:20000});
  assert.match(await page.title(),/Shadowline Tactics/);
  const snap=()=>page.evaluate(()=>__sensingLab.snapshot());
  const first=await snap();
  assert.equal(first.turn,0);assert.equal(first.phase,'active');
  assert.equal(first.perception.threats.length,3);
  assert.equal(first.perception.seen.length,3);
  await mkdir(join(root,'browser-artifacts'),{recursive:true});
  const screenshot=await page.locator('#field').screenshot();
  await writeFile(join(root,'browser-artifacts/sense-001-shadowline.png'),screenshot);
  for(const view of ['fps','sensor','tactical']){
    await page.locator('#view').selectOption(view);
    const after=await snap();
    assert.equal(after.view,view);
    assert.equal(after.turn,first.turn,'camera cannot advance a turn');
    assert.deepEqual(after.perception,first.perception,'camera cannot alter target visibility');
    assert.deepEqual(after.guards,first.guards,'camera cannot rotate the sentries');
  }
  // A genuine keyboard input, not a direct mission-state mutation.
  await page.locator('h1').click();
  await page.keyboard.press('KeyW');
  let after=await snap();
  assert.equal(after.turn,1);assert.equal(after.agent.z,12);
  await page.locator('[data-action="wait"]').click();
  after=await snap();assert.equal(after.turn,2);assert.equal(after.phase,'active');
  // The WAIT button remains keyboard-focused after a click. A subsequent
  // real D key must still move the operative; no canvas re-focus is required.
  await page.keyboard.press('KeyD');
  after=await snap();assert.equal(after.turn,3);assert.equal(after.agent.x,3);
  await page.locator('#undo').click();
  after=await snap();assert.equal(after.turn,2);assert.equal(after.agent.x,2);
  await page.locator('#training-step').click();
  after=await snap();assert.equal(after.turn,3);assert.equal(after.agent.x,3);
  // The training journey uses the exact same 38 real turn commands as manual play.
  await page.locator('#reset').click();
  for(let i=0;i<38;i++)await page.locator('#training-step').click();
  const victory=await snap();
  assert.equal(victory.turn,38);assert.equal(victory.phase,'escaped');
  assert.equal(victory.intel,true);
  assert.equal(victory.agent.x,21);assert.equal(victory.agent.z,2);
  assert.equal(await page.locator('#training-step').isDisabled(),true);
  assert.deepEqual(errors,[],'no browser JS errors permitted');
  const receipt={kind:'qsol.vanillajs.sense-001.browser.v1',status:'PASS',
    source:process.env.GITHUB_SHA??null,tool:browser.version(),
    manifestSHA256:digest(manifestBytes),screenshotSHA256:digest(screenshot),
    checks:['source-packaged Canvas2D','original 3-guard map','three view invariance',
      'actual keyboard turn','wait and movement','undo rollback','training route 38 real turns',
      'manifest extraction','no browser errors']};
  await writeFile(join(root,'browser-artifacts/sense-001-acceptance.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt,null,2));
  await context.close();
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
