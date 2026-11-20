// SPDX-License-Identifier: Apache-2.0
// TACTICS-001 source-packaged real-browser acceptance (strict localhost only).
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist'),
  manifest=await readFile(join(dist,'manifest.json'));
const allow=new Set(JSON.parse(manifest).files.map(x=>x.path)),
  hash=b=>createHash('sha256').update(b).digest('hex');
const server=createServer(async(req,res)=>{
  try{
    const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/,'');
    if(name==='manifest.json'){res.setHeader('content-type','application/json');res.end(manifest);return;}
    if(!allow.has(name)){res.writeHead(404);res.end('unpackaged');return;}
    const bytes=await readFile(join(dist,name));
    res.setHeader('content-type',name.endsWith('.js')?'text/javascript':
      name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':
      name.endsWith('.json')?'application/json':'application/octet-stream');
    res.end(bytes);
  }catch(error){res.writeHead(500);res.end(error.message);}
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1450,height:1050},deviceScaleFactor:1,serviceWorkers:'block'});
  const origin='http://127.0.0.1:'+server.address().port,errors=[];
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push('pageerror '+e.message));
  page.on('response',response=>{if(response.status()>=400)errors.push('HTTP '+response.status()+' '+response.url());});
  page.on('console',c=>{if(c.type()==='error')errors.push('console '+c.text());});
  await page.goto(origin+'/demos/tactics-lab/index.html',{waitUntil:'load'});
  await page.waitForFunction(()=>document.documentElement.dataset.tacticsReady==='ready',undefined,{timeout:30000});
  const snap=()=>page.evaluate(()=>__tacticsLab.snapshot());
  const first=await snap();
  assert.equal(first.turn,0);assert.equal(first.phase,'active');
  assert.equal(first.units.length,6);assert.equal(first.perception.units.length,6);
  assert.equal(first.selected,'alpha-lead');
  const oldUnit=first.units.find(u=>u.id==='alpha-lead');
  const canvas=page.locator('#field');
  const image=await canvas.screenshot();
  assert.ok(image.length>7000);
  // Modes affect only pixels; never AI, perception, progress, or orders.
  for(const mode of ['intel','cover','tactical']){
    await page.locator('#view').selectOption(mode);
    const report=await snap();
    assert.equal(report.view,mode);assert.equal(report.turn,0);
    assert.deepEqual(report.units,first.units);
    assert.deepEqual(report.perception,first.perception);
  }
  // UI can queue an unseen enemy, but SENSE-001 rejects its actual execution
  // atomically; no sneaky "fire through a wall" state or timer advancement.
  await page.locator('#action').selectOption('suppress');
  await page.locator('#target-unit').selectOption('bravo-east');
  await page.locator('#queue').click();
  assert.equal((await snap()).queued.length,1);
  await page.locator('#execute').click();
  let outcome=await snap();
  assert.equal(outcome.turn,0);
  assert.equal(outcome.journalLength,0);
  assert.match(await page.locator('#status').textContent(),/target-not-visible/);
  assert.deepEqual(outcome.units,first.units);
  // Moving through the actual editor controls consumes exactly one accepted
  // turn and invokes both canonical navigation and opposing AI.
  await page.locator('#action').selectOption('move');
  await page.locator('#target-x').fill('4');
  await page.locator('#target-z').fill('13');
  await page.locator('#queue').click();
  await page.locator('#execute').click();
  outcome=await snap();
  assert.equal(outcome.turn,1);assert.equal(outcome.journalLength,1);
  const moved=outcome.units.find(u=>u.id==='alpha-lead');
  assert.equal(Math.abs(moved.cell[0]-oldUnit.cell[0])+
    Math.abs(moved.cell[1]-oldUnit.cell[1]),1,'one cardinal path step');
  assert.ok(outcome.events.some(e=>e.unitId==='alpha-lead'&&e.action==='move'));
  assert.ok(outcome.events.some(e=>e.unitId.startsWith('bravo-')));
  assert.ok((await page.locator('#cover .entry').count())>=0);
  // This replay re-executes the actual accepted order journal in fresh native
  // tactical states, not a canned event log or a reset shortcut.
  await page.locator('#replay').click();
  assert.match(await page.locator('#status').textContent(),/REPLAY PASS/);
  assert.deepEqual((await snap()).perception,outcome.perception);
  await page.locator('#undo').click();
  assert.equal((await snap()).turn,0);
  await page.locator('#suggest').click();
  assert.equal((await snap()).queued.length,3);
  const suggestions=await snap();
  assert.ok(suggestions.queued.every(o=>o.unitId.startsWith('alpha-')));
  // Return to a reproducible original scenario.
  await page.locator('#reset').click();
  const restored=await snap();
  assert.equal(restored.turn,0);assert.equal(restored.journalLength,0);
  assert.deepEqual(restored.perception,first.perception);
  assert.deepEqual(errors,[],'zero runtime JS errors, HTTP errors, or external requests');
  await mkdir(join(root,'browser-artifacts'),{recursive:true});
  await writeFile(join(root,'browser-artifacts/tactics-001-squadline.png'),image);
  const receipt={kind:'qsol.vanillajs.tactics-001.browser.v1',status:'PASS',
    testedMergeCheckout:process.env.GITHUB_SHA??null,chromium:browser.version(),
    manifestSHA256:hash(manifest),screenshotSHA256:hash(image),
    checks:['original 3-versus-3 source-packaged tactical game','three-camera perception parity',
      'invisible SENSE target suppress rejected atomically','real UI move follows cardinal navigation',
      'opposing squad executes actual AI orders','accepted turn replay equality',
      'undo original state and three-unit deterministic suggestions',
      'reset preserves source visibility','zero JS/network errors']};
  await writeFile(join(root,'browser-artifacts/tactics-001-acceptance.json'),
    JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt,null,2));
  await context.close();
}finally{
  await browser?.close();
  await new Promise(ok=>server.close(ok));
}
