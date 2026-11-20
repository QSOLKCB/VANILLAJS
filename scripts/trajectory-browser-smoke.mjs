// SPDX-License-Identifier: Apache-2.0
// Real packaged Chromium acceptance for TRAJECTORY-001. No source mocks.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist'),manifest=await readFile(join(dist,'manifest.json'));
const permitted=new Set(JSON.parse(manifest).files.map(f=>f.path)),sha=b=>createHash('sha256').update(b).digest('hex');
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '');
  if(!permitted.has(path)){res.writeHead(404);res.end('not packaged');return;}
  const bytes=await readFile(join(dist,path));
  res.setHeader('content-type',path.endsWith('.js')?'text/javascript':path.endsWith('.html')?'text/html':'application/octet-stream');
  res.end(bytes);
 }catch(e){res.writeHead(500);res.end(e.message);}
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1200,height:900},serviceWorkers:'block'});
 const origin='http://127.0.0.1:'+server.address().port,errors=[];
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push('JS '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console '+m.text());});
 page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status());});
 await page.goto(origin+'/demos/trajectory-lab/index.html',{waitUntil:'load'});
 assert.match(await page.locator('#receipt').textContent(),/Ready/);
 assert.match(await page.locator('#receipt').textContent(),/"locked": true/);
 await page.locator('#step').click();
 assert.match(await page.locator('#receipt').textContent(),/Acquire lock first/);
 await page.locator('#launch').click();
 assert.match(await page.locator('#receipt').textContent(),/"status": "flying"/);
 for(let i=0;i<4;i++)await page.locator('#step').click();
 assert.match(await page.locator('#receipt').textContent(),/"status": "(hit|expired)"/);
 assert.match(await page.locator('#receipt').textContent(),/"kind": "actor"/);
 const image=await page.locator('#field').screenshot();
 await page.locator('#reset').click();
 assert.match(await page.locator('#receipt').textContent(),/Ready/);
 assert.deepEqual(errors,[]);
 await mkdir(join(root,'browser-artifacts'),{recursive:true});
 await writeFile(join(root,'browser-artifacts/trajectory-001.png'),image);
 const receipt={kind:'qsol.vanillajs.trajectory-001.chromium.v1',status:'PASS',
  checkedSHA:process.env.GITHUB_SHA??null,manifestSHA256:sha(manifest),imageSHA256:sha(image),
  checks:['packaged launch','real lock','fixed ticks','actor contact','reset','zero runtime/network errors']};
 await writeFile(join(root,'browser-artifacts/trajectory-001.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify(receipt));
 await context.close();
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
