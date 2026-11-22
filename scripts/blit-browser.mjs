// SPDX-License-Identifier: Apache-2.0
// BLIT-001: real packaged Chromium/Canvas2D smoke with source-bound receipts.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,sep,extname} from 'node:path';

const {chromium}=createRequire(import.meta.url)('playwright');
const root=resolve(import.meta.dirname,'../dist');
const out=resolve(process.argv[2]??'blit-001-browser-evidence');
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(process.env.GITHUB_SHA&&process.env.GITHUB_SHA!==head)
  throw Error('Git source checkout mismatch');
const hash=v=>createHash('sha256').update(v).digest('hex');
const server=createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(!pathname.startsWith('/VANILLAJS/')){res.writeHead(404);res.end();return;}
    const file=resolve(root,decodeURIComponent(pathname.slice('/VANILLAJS/'.length)));
    if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const bytes=await readFile(file);
    const mime={'.js':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css'};
    res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'});
    res.end(bytes);
  }catch{res.writeHead(404);res.end();}
});
await mkdir(out);
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port+'/VANILLAJS/';
let browser,context;
try{
  browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  context=await browser.newContext({viewport:{width:1100,height:900},serviceWorkers:'block'});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push(r.url()));
  await page.goto(base+'demos/blit-lab/index.html',{waitUntil:'load'});
  await page.waitForFunction(()=>window.__blitReport?.mode==='start');
  const get=()=>page.evaluate(()=>{
    const c=document.querySelector('canvas'),ctx=c.getContext('2d');
    const rgba=ctx.getImageData(0,0,c.width,c.height).data;
    let nonBlack=0,colors=new Set(),hash=2166136261;
    for(let i=0;i<rgba.length;i+=4){
      if(rgba[i]+rgba[i+1]+rgba[i+2]>20)nonBlack++;
      if(i%(4*67)===0)colors.add(rgba[i]+','+rgba[i+1]+','+rgba[i+2]);
      for(let k=0;k<4;k++)hash=Math.imul(hash^rgba[i+k],16777619)>>>0;
    }
    return {report:{...window.__blitReport},canvasHash:hash,nonBlack,colors:colors.size};
  });
  const original=await get();assert.equal(original.report.planes,4);
  assert.ok(original.nonBlack>30000&&original.colors>=4,'nontrivial original pixel scene');
  await page.screenshot({path:join(out,'blit-initial.png')});
  await page.locator('#move').click();
  const moved=await get();
  assert.equal(moved.report.spriteX,original.report.spriteX+19);
  assert.notEqual(moved.canvasHash,original.canvasHash,'sprite actually moved');
  await page.screenshot({path:join(out,'blit-moved.png')});
  await page.locator('#copy').click();
  const copied=await get();assert.equal(copied.report.mode,'overlap');
  assert.notEqual(copied.canvasHash,moved.canvasHash,'overlapping copy alters rendered bitmap');
  await page.locator('#reset').click();
  const recovered=await get();
  assert.equal(recovered.canvasHash,original.canvasHash,'reset restores deterministic pixels');
  assert.equal(recovered.report.retainedBytes,original.report.retainedBytes);
  assert.deepEqual(errors,[]);
  assert.ok(requests.every(url=>url.startsWith(base)),'no runtime external URLs');
  const sources={};
  for(const path of ['modules/blit/index.js','demos/blit-lab/main.js','scripts/blit-browser.mjs'])
    sources[path]=hash(await readFile(path));
  const evidence={kind:'qsol.vanillajs.blit.browser.v1',sourceHead:head,chromium:browser.version(),
    scope:'Hosted original Canvas2D pixel/readback and interaction; no native GPU speed or GC improvements inferred',
    frames:{original,moved,copied,recovered},sourceSHA256:sources,
    requests:requests.map(u=>new URL(u).pathname),errors};
  const json=JSON.stringify(evidence,null,2)+'\n';
  await writeFile(join(out,'blit-browser.json'),json,{flag:'wx'});
  await writeFile(join(out,'SHA256SUMS'),hash(json)+'  blit-browser.json\n',{flag:'wx'});
  console.log('BLIT-001 BROWSER '+JSON.stringify({head,originalPixelHash:original.canvasHash,
    resetMatches:recovered.canvasHash===original.canvasHash,rgbaSha256:hash(json)}));
}finally{
  await context?.close();await browser?.close();
  await new Promise(done=>server.close(done));
}
