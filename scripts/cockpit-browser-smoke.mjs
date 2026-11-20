// SPDX-License-Identifier: Apache-2.0
// Real packaged headless Chromium smoke for COCKPIT-001, isolated CI tooling only.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist');
const manifest=JSON.parse(await readFile(join(dist,'manifest.json'),'utf8'));
const allowed=new Set(manifest.files.map(x=>x.path));
const hash=data=>createHash('sha256').update(data).digest('hex');
const server=createServer(async(request,response)=>{
  try{
    const key=decodeURIComponent(new URL(request.url,'http://localhost').pathname).replace(/^\/+/, '');
    if(!allowed.has(key)){response.writeHead(404);response.end('not in package');return;}
    const bytes=await readFile(join(dist,key));
    response.setHeader('content-type',key.endsWith('.js')?'text/javascript':key.endsWith('.css')?'text/css':key.endsWith('.html')?'text/html':key.endsWith('.json')?'application/json':'application/octet-stream');
    response.end(bytes);
  }catch(error){response.writeHead(500);response.end(error.message);}
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1400,height:950},deviceScaleFactor:1,serviceWorkers:'block'});
  const errors=[];
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    return url.origin===`http://127.0.0.1:${server.address().port}`?route.continue():route.abort();
  });
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}/demos/cockpit-physics-lab/index.html`,{waitUntil:'load'});
  await page.waitForFunction(()=>document.documentElement.dataset.labReady==='cockpit-physics',{timeout:30000});
  assert.equal(await page.locator('#status').textContent(),'READY');
  assert.match(await page.title(),/TOO CLOSE FOR GUNS — SWITCHING TO MISSILES!/);
  assert.equal(await page.locator('#missile-ammo').textContent(),'4 / 4');
  assert.match(await page.locator('#sight-error').textContent(),/BORESIGHT 240 m/);
  const screenshot=await page.locator('.viewport').screenshot();
  await mkdir(join(root,'browser-artifacts'),{recursive:true});
  await writeFile(join(root,'browser-artifacts/cockpit-original-spitfire.png'),screenshot);
  const atConvergence=Number((await page.locator('#sight-error').textContent()).match(/MAX ERROR ([0-9.]+)/)[1]);
  assert.equal(atConvergence,0,'wing gun sight must converge at calibrated range');
  await page.locator('#distance').evaluate(el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForTimeout(120);
  const atNearRange=Number((await page.locator('#sight-error').textContent()).match(/MAX ERROR ([0-9.]+)/)[1]);
  assert.ok(atNearRange>0.1,'wrong range must show physical parallax, not zero HUD error');
  await page.getByRole('button',{name:'Launch'}).click();
  await page.waitForTimeout(600);
  assert.equal(await page.locator('#status').textContent(),'RUNNING');
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(80);
  assert.match(await page.locator('#last-shot').textContent(),/SHOT 1/);
  await page.keyboard.press('KeyM');
  await page.waitForFunction(()=>document.querySelector('#missile-ammo')?.textContent==='3 / 4',{timeout:5000});
  assert.match(await page.locator('#last-shot').textContent(),/MISSILE 1 AWAY|MISSILE 1 IMPACT/);
  // A launched missile is not an immediate raycast hit. A later tick must
  // advance it through the physical test sphere.
  await page.waitForFunction(()=>document.querySelector('#missile-hits')?.textContent==='1',{timeout:10000});
  await page.locator('#view').selectOption('chase');
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#view').inputValue(),'chase');
  await page.locator('#craft').selectOption('space');
  await page.getByRole('button',{name:'Launch'}).click();
  await page.waitForTimeout(180);
  assert.match(await page.locator('#aero').textContent(),/INERTIAL/);
  await page.keyboard.press('KeyM');
  await page.waitForFunction(()=>document.querySelector('#missile-ammo')?.textContent==='3 / 4',{timeout:5000});
  await page.locator('#craft').selectOption('car');
  await page.getByRole('button',{name:'Launch'}).click();
  await page.keyboard.down('KeyW');await page.waitForTimeout(650);await page.keyboard.up('KeyW');
  const speed=Number((await page.locator('#speed').textContent()).split(' ')[0]);
  assert.ok(speed>0,'four-wheel car must advance under real physics');
  assert.match(await page.locator('#aero').textContent(),/RPM/);
  assert.equal(await page.locator('#missile-ammo').textContent(),'N/A');
  assert.equal(await page.locator('#missile').isDisabled(),true);
  assert.deepEqual(errors,[],'browser errors are not acceptable');
  const report={kind:'qsol.vanillajs.cockpit-browser-smoke.v1',status:'PASS',
    module:'demos/cockpit-physics-lab/index.html',source:process.env.GITHUB_SHA??null,
    browser:browser.version(),manifestSHA256:hash(await readFile(join(dist,'manifest.json'))),
    screenshotSHA256:hash(screenshot),atConvergence,atNearRange,carSpeed:speed,
    checked:['ready','physical sight convergence','near-plane parallax','airborne fixed ticks',
      'real projectile ray input','physical missile launch, motion and impact','space missile launch','car missile lockout','view switching','space flight','vehicle3d movement','no browser exceptions']};
  await writeFile(join(root,'browser-artifacts/cockpit-smoke.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  await context.close();
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
