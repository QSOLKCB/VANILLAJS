// SPDX-License-Identifier: Apache-2.0
// Local-only, explicit owner handover. Never runs via the personal-runner workflow.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
if(process.env.VANILLAJS_OWNER_PROCEED!=='1')throw new Error('Obtain the owner’s explicit browser handover before setting VANILLAJS_OWNER_PROCEED=1.');
const baseline=process.argv.includes('--baseline');
const root=resolve(import.meta.dirname,'..'),stage=resolve(process.env.VANILLAJS_BROWSER_STAGE||resolve(root,'dist'));
const out=resolve(process.env.VANILLAJS_BROWSER_OUT||'browser-artifacts/owner-voidward');
await mkdir(out,{recursive:true});
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.txt':'text/plain'};
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(!pathname.startsWith('/VANILLAJS/'))throw new Error('outside subpath');
    const file=resolve(stage,pathname.slice('/VANILLAJS/'.length)||'index.html');
    if(!file.startsWith(stage+sep))throw new Error('outside stage');
    res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/VANILLAJS/`;
const receipt={kind:'qsol.vanillajs.voidward-owner.v1',status:'RUNNING',baseline,environment:{platform:process.platform,arch:process.arch,node:process.version},input:'Playwright controls only its dedicated browser; no OS keyboard/mouse injection',checks:[],hardware:{status:'UNVERIFIED'},limitations:['Touch is emulated; no physical phone was used.','Audio signal and controls are checked; human listening is not assessed.']};
let browser;
async function check(name,fn){const t=performance.now();console.log('START '+name);const result=await fn();receipt.checks.push({name,status:'PASS',elapsedMs:performance.now()-t,...(result?{result}:{})});await writeFile(resolve(out,'owner-result.json'),JSON.stringify(receipt,null,2));console.log('PASS '+name);}
try{
  browser=await chromium.launch({headless:false,executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/google-chrome',args:['--no-sandbox'],timeout:30000});
  receipt.environment.browser=browser.version();
  const cdp=await browser.newBrowserCDPSession();
  try{
    const info=await cdp.send('SystemInfo.getInfo');
    // Full diagnostics remain local; publish only the coarse assessment below.
    await writeFile(resolve(out,'gpu-local.json'),JSON.stringify(info,null,2));
    const renderer=info.gpu?.auxAttributes?.glRenderer||'';
    receipt.hardware={status:/swiftshader|llvmpipe|softpipe|software rasterizer/i.test(renderer)?'SOFTWARE_RENDERER_REPORTED':renderer?'HARDWARE_RENDERER_AVAILABLE':'UNVERIFIED',canvas2d:info.gpu?.featureStatus?.['2d_canvas'],compositing:info.gpu?.featureStatus?.gpu_compositing,note:'Availability does not prove workload participation; inspect the dedicated game GPU trace separately.'};
  }finally{await cdp.detach();}
  await check('ternary-reach',async()=>{const {verify4XLab}=await import('./browser-4x.js');await verify4XLab(browser,base);});
  if(baseline){
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    try{await page.goto(base+'demos/editor/index.html');await page.locator('#view').waitFor();await page.screenshot({path:resolve(out,'editor-baseline.png'),fullPage:true});}finally{await page.close();}
  }else{
    await check('existing-visual-editor',async()=>{const {verifyEditor}=await import('./browser-editor.js');await verifyEditor(browser,base);});
    await check('voidward-campaigns',async()=>{const {verifyVoidwardLab}=await import('./browser-voidward.js');return await verifyVoidwardLab(browser,base,{out:resolve(out,'campaigns'),traceGPU:true});});
    await check('editor-campaign-bridge',async()=>{const {verifyEditor4X}=await import('./browser-editor-4x.js');return await verifyEditor4X(browser,base);});
  }
  assert.ok(receipt.checks.length);receipt.status='PASS';
}catch(error){receipt.status='FAIL';receipt.error=error.message;console.error(error);process.exitCode=1;}
finally{
  await browser?.close().catch(()=>{});await new Promise(r=>server.close(r));
  receipt.automationStopped=true;await writeFile(resolve(out,'owner-result.json'),JSON.stringify(receipt,null,2));
  console.log('Browser and preview server stopped. '+receipt.status);
}
