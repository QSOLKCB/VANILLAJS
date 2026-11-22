// SPDX-License-Identifier: Apache-2.0
// COPPER-001: source-bound actual Canvas2D scanline and scroll proof.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,sep,extname} from 'node:path';

const {chromium}=createRequire(import.meta.url)('playwright');
const root=resolve(import.meta.dirname,'../dist');
const out=resolve(process.argv[2]??'copper-001-browser-evidence');
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(process.env.GITHUB_SHA&&process.env.GITHUB_SHA!==head)
  throw Error('Git source checkout mismatch');
const hash=v=>createHash('sha256').update(v).digest('hex');
const server=createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://localhost').pathname;
    if(!path.startsWith('/VANILLAJS/')){res.writeHead(404);res.end();return;}
    const file=resolve(root,decodeURIComponent(path.slice('/VANILLAJS/'.length)));
    if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const bytes=await readFile(file);
    const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css'};
    res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'});
    res.end(bytes);
  }catch{res.writeHead(404);res.end();}
});
await mkdir(out);await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port+'/VANILLAJS/';
let browser,context;
try{
  browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  context=await browser.newContext({viewport:{width:1100,height:900},serviceWorkers:'block'});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push(r.url()));
  await page.goto(base+'demos/copper-lab/index.html',{waitUntil:'load'});
  await page.waitForFunction(()=>window.__copperReport?.active===true);
  const snapshot=()=>page.evaluate(()=>{
    const c=document.querySelector('canvas'),rgba=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let hash=2166136261,nonBlack=0;
    for(let i=0;i<rgba.length;i+=4){
      if(rgba[i]+rgba[i+1]+rgba[i+2]>30)nonBlack++;
      for(let k=0;k<4;k++)hash=Math.imul(hash^rgba[i+k],16777619)>>>0;
    }
    return {report:{...window.__copperReport},canvasHash:hash,nonBlack};
  });
  const original=await snapshot();
  assert.equal(original.report.commands,36);assert.equal(original.report.sourceIntact,true);
  assert.ok(original.nonBlack>30000,'original scanline image is nontrivial');
  await page.screenshot({path:join(out,'copper-initial.png')});
  await page.locator('#mode').click();
  const bypass=await snapshot();
  assert.equal(bypass.report.commands,0);assert.equal(bypass.report.active,false);
  assert.notEqual(bypass.canvasHash,original.canvasHash,'palette/scroll changes real pixels');
  await page.screenshot({path:join(out,'copper-bypass.png')});
  await page.locator('#mode').click();
  const restored=await snapshot();assert.equal(restored.canvasHash,original.canvasHash);
  await page.locator('#scroll').click();
  const scrolled=await snapshot();assert.equal(scrolled.report.offset,1);
  assert.notEqual(scrolled.canvasHash,original.canvasHash,'scroll phase changes pixels');
  assert.equal(scrolled.report.sourceIntact,true,'commands do not mutate bitplanes');
  await page.screenshot({path:join(out,'copper-scrolled.png')});
  await page.locator('#reset').click();
  const reset=await snapshot();
  assert.equal(reset.canvasHash,original.canvasHash,'reset reproduces original output');
  assert.equal(reset.report.retainedBytes,original.report.retainedBytes);
  assert.deepEqual(errors,[]);
  assert.ok(requests.every(x=>x.startsWith(base)),'external runtime request');
  const sources={};
  for(const path of ['modules/copper/index.js','modules/blit/index.js',
    'demos/copper-lab/main.js','scripts/copper-browser.mjs'])
    sources[path]=hash(await readFile(path));
  const record={kind:'qsol.vanillajs.copper.browser.v1',
    sourceHead:head,chromium:browser.version(),
    scope:'Real packaged Canvas2D scanline and scroll comparison; not CRT timing, native GPU speed or FPS proof',
    frames:{original,bypass,restored,scrolled,reset},
    sourceSHA256:sources,requests:requests.map(x=>new URL(x).pathname),errors};
  const json=JSON.stringify(record,null,2)+'\n';
  await writeFile(join(out,'copper-browser.json'),json,{flag:'wx'});
  await writeFile(join(out,'SHA256SUMS'),hash(json)+'  copper-browser.json\n',{flag:'wx'});
  console.log('COPPER-001 BROWSER '+JSON.stringify({head,initial:original.canvasHash,
    bypass:bypass.canvasHash,scrolled:scrolled.canvasHash,resetParity:true,sha256:hash(json)}));
}finally{
  await context?.close();await browser?.close();
  await new Promise(done=>server.close(done));
}
