// SPDX-License-Identifier: Apache-2.0
// Real packaged Chromium regression for the PR70 navigation/module race.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {verifyMachine} from './browser-machine.js';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=resolve(import.meta.dirname,'../dist');
const server=createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(!pathname.startsWith('/VANILLAJS/'))throw Error('scope');
    const path=resolve(root,pathname.slice(11)||'index.html');
    if(!path.startsWith(root+sep))throw Error('path');
    res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json'})[extname(path)]||'application/octet-stream');
    res.end(await readFile(path));
  }catch{res.writeHead(404);res.end();}
});
await mkdir('browser-artifacts',{recursive:true});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/VANILLAJS/`;
let browser;
try{
  browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage();let release;
  const held=new Promise(r=>release=r);
  await page.route('**/ancient-machine/app.js',async route=>{await held;await route.continue();});
  await page.goto(base);await page.locator('.machine-link').click();
  assert.equal(await page.locator('#word').textContent(),'0x1234');
  assert.equal(await page.locator('#detents').textContent(),'000000');
  assert.equal(await page.locator('.drum-digit').count(),0,'old assertion deterministically sees empty SVG');
  release();await page.waitForLoadState('load');
  assert.equal(await page.locator('.drum-digit').count(),64);await page.close();
  // Exercise the actual verifier with delayed module delivery, not a mock DOM.
  let delayed=0;
  const wrapped={newPage:async options=>{
    const next=await browser.newPage(options);
    await next.route('**/ancient-machine/app.js',async route=>{
      delayed++;await new Promise(r=>setTimeout(r,300));await route.continue();
    });return next;
  }};
  await verifyMachine(wrapped,base);assert.ok(delayed>=2);
  // A broken application must still fail the exact-count assertion after load.
  const brokenPages=[];
  const broken={newPage:async options=>{
    const next=await browser.newPage(options);brokenPages.push(next);
    await next.route('**/ancient-machine/app.js',route=>route.fulfill({contentType:'text/javascript',body:''}));
    return next;
  }};
  await assert.rejects(()=>verifyMachine(broken,base),error=>error.code==='ERR_ASSERTION'&&error.actual===0&&error.expected===64);
  await Promise.all(brokenPages.map(page=>page.close()));
  console.log('PASS Machine Lab: old race reproduced, real verifier passes delayed modules, absent initialization remains detectable.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
