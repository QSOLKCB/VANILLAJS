// SPDX-License-Identifier: Apache-2.0
// Owner-only VANILLAJS runner tests the source-pinned ARCADE QFloat Lab.
// NO arbitrary branch code, dependency downloads, unpinned Pages scripts or auto trigger.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,existsSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {join,resolve,sep,extname} from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {findPlaywright} from './rtx-playwright.mjs';

export const ARCADE_COMMIT='f29b780734a50171d55ae2f770930db8a487b31c';
const ROOT=resolve(import.meta.dirname,'..');
const BASE='https://qsolkcb.github.io/ARCADE/';
const SOURCE='https://raw.githubusercontent.com/QSOLKCB/ARCADE/'+ARCADE_COMMIT+'/';
export const ASSETS=Object.freeze([
  'arcade3/qfloat-lab.html','arcade3/qfloat-lab.css',
  'arcade3/qfloat-lab.js','arcade3/qfloat-sim.js',
  'arcade2/qfloat.js','arcade2/engine.js'
]);
const MIME={'.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const sha=b=>createHash('sha256').update(b).digest('hex');
const MAX_BYTES=256*1024;

export function parseOptions(args){
  const fields={};
  for(let n=0;n<args.length;n+=2){
    if(n+1>=args.length||!['--head','--out'].includes(args[n])||
      Object.hasOwn(fields,args[n]))
      throw new TypeError('usage: --head VANILLAJS_SHA --out /absolute/fresh/dir');
    fields[args[n]]=args[n+1];
  }
  if(!/^[a-f0-9]{40}$/.test(fields['--head']??'')||
    typeof fields['--out']!=='string'||
    !fields['--out'].startsWith('/')||
    resolve(fields['--out'])!==fields['--out']||
    fields['--out'].startsWith(ROOT+sep)||
    fields['--out']===ROOT)
    throw new TypeError('invalid reviewed SHA or fresh evidence destination');
  return {head:fields['--head'],out:fields['--out']};
}
function git(...args){
  const r=spawnSync('git',args,{cwd:ROOT,encoding:'utf8',timeout:10000});
  if(r.error||r.status!==0)throw Error('git '+args[0]+': '+(r.stderr||r.error?.message||r.status));
  return r.stdout.trim();
}
export function checkDispatch(head,env=process.env){
  if(env.GITHUB_REPOSITORY!=='QSOLKCB/VANILLAJS'||
    env.GITHUB_EVENT_NAME!=='workflow_dispatch'||
    env.GITHUB_REF!=='refs/heads/main'||
    env.GITHUB_ACTOR!=='EmergentMonk'||
    env.GITHUB_SHA!==head)
    throw Error('Owner-approved dispatch from VANILLAJS main required');
  if(!env.DISPLAY&&!env.WAYLAND_DISPLAY)
    throw Error('Headed graphical desktop required; no SSH/headless fallback');
  if(git('rev-parse','HEAD')!==head||git('status','--porcelain')!=='')
    throw Error('Expected clean exact main checkout');
  if(!/(?:github\.com[:/])QSOLKCB\/VANILLAJS(?:\.git)?$/i.test(git('remote','get-url','origin')))
    throw Error('Unexpected remote');
}
function browserExecutable(){
  for(const command of ['google-chrome-stable','google-chrome','chromium','chromium-browser']){
    const r=spawnSync('which',[command],{encoding:'utf8',timeout:5000});
    if(r.status===0&&r.stdout.trim())return r.stdout.trim();
  }
  throw Error('Native Chrome/Chromium required. Never install or download in this workflow.');
}
async function fetchBounded(url){
  const response=await fetch(url,{redirect:'error',cache:'no-store',
    signal:AbortSignal.timeout(18000)});
  if(!response.ok||response.url!==url)
    throw Error('Unexpected source/deployment response '+url+': '+response.status);
  const advertised=Number(response.headers.get('content-length'));
  if(advertised>MAX_BYTES)throw Error('Unbounded asset '+url);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(!bytes.length||bytes.length>MAX_BYTES)throw Error('Invalid asset length '+url);
  return bytes;
}
export function allowedRequest(url){
  try{
    const u=new URL(url),base=new URL(BASE);
    if(u.origin!==base.origin||u.hash||!u.pathname.startsWith(base.pathname))return null;
    const name=u.pathname.slice(base.pathname.length);
    if(!ASSETS.includes(name))return null;
    if(u.search!==''&&!(name==='arcade2/engine.js'&&u.search==='?v=0.8.0'))
      return null;
    return name;
  }catch{return null;}
}
export async function verifyPublished(){
  const manifest=[],resources=new Map();
  for(const path of ASSETS){
    const src=SOURCE+path,live=BASE+path+
      (path==='arcade2/engine.js'?'?v=0.8.0':'');
    // Both requests are fixed, immutable-name/specific-origin inputs.
    const original=await fetchBounded(src);
    const published=await fetchBounded(live);
    if(!original.equals(published))
      throw Error('DEPLOYMENT SOURCE MISMATCH: '+path+
        ' (ARCADE source '+sha(original)+' versus live '+sha(published)+
        '). This witness is pinned to ARCADE commit '+ARCADE_COMMIT);
    manifest.push({path,bytes:published.length,sha256:sha(original),
      sourceCommit:ARCADE_COMMIT});
    resources.set(path,published);
  }
  return {manifest,resources};
}
async function observe(browser,resources,out){
  const context=await browser.newContext({
    viewport:{width:1360,height:940},serviceWorkers:'block',reducedMotion:'reduce'
  });
  const errors=[],checks=[];
  let page=null;
  try{
    await context.route('**/*',async route=>{
      const url=route.request().url();
      const key=allowedRequest(url);
      if(key&&resources.has(key)){
        // Only execute exact bytes fetched from immutable ARCADE commit AND
        // independently confirmed equal to published Pages bytes.
        return route.fulfill({status:200,body:resources.get(key),
          contentType:MIME[extname(key)]});
      }
      const u=new URL(url);
      if(u.origin===new URL(BASE).origin&&u.pathname.endsWith('/favicon.ico'))
        return route.fulfill({status:204,body:''});
      errors.push('Unexpected outbound request '+url);
      return route.abort();
    });
    page=await context.newPage();
    page.on('pageerror',e=>errors.push('pageerror: '+e.message));
    page.on('console',e=>{if(e.type()==='error')errors.push('console: '+e.text());});
    const response=await page.goto(BASE+'arcade3/qfloat-lab.html',
      {waitUntil:'load',timeout:25000});
    assert.equal(response.status(),200);
    await page.waitForFunction(
      ()=>document.documentElement.dataset.qfloatReady==='ready',null,{timeout:15000});
    assert.match(await page.title(),/QFLOAT-001/);
    assert.equal(await page.locator('#result-view').innerText(),'0.300');
    assert.equal(await page.locator('#result-exact').innerText(),'0.2999877929687500');
    assert.equal(await page.locator('#result-raw').innerText(),'19660');
    checks.push('decimal illusion and exact 19660 subunits');

    const pixel=await page.locator('#field').evaluate(el=>{
      return [...el.getContext('2d').getImageData(320,180,1,1).data];
    });
    assert.ok(pixel[0]>75&&pixel[1]>185&&pixel[2]>160&&pixel[3]===255,
      'real Canvas2D center pixel must show object');
    checks.push('actual Canvas2D pixels');

    // In the earlier PR this was a real P2: blur while paused must drop
    // input even if the browser never receives the keyup.
    await page.locator('#field').focus();
    await page.keyboard.down('ArrowRight');
    await page.evaluate(()=>dispatchEvent(new Event('blur')));
    await page.locator('#single').click();
    assert.equal(await page.locator('#x-raw').innerText(),'RAW 20971520');
    await page.keyboard.up('ArrowRight');
    await page.locator('#reset').click();
    checks.push('focus loss while already paused, missing keyup');

    await page.locator('#field').focus();
    await page.keyboard.down('ArrowRight');
    await page.locator('#single').click();
    assert.equal(await page.locator('#x-raw').innerText(),'RAW 21053440');
    await page.keyboard.up('ArrowRight');
    await page.locator('#single').click();
    assert.equal(await page.locator('#x-raw').innerText(),'RAW 21053440');
    checks.push('real keyboard and exact 81920 raw subunit tick');

    await page.locator('#reset').click();
    await page.locator('#field').focus();
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('d');
    await page.keyboard.up('ArrowRight');
    await page.locator('#single').click();
    assert.equal(await page.locator('#x-raw').innerText(),'RAW 21053440');
    await page.keyboard.up('d');
    checks.push('simultaneous keyboard aliases');

    await page.locator('#play').click();
    await page.waitForFunction(
      ()=>Number(document.querySelector('#tick-label').textContent.slice(5))>=10,
      null,{timeout:14000});
    await page.locator('#pause').click();
    const fixed=await page.locator('#tick-label').innerText();
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#tick-label').innerText(),fixed);
    checks.push('real 60Hz timer with stable pause');

    await page.locator('#speed').fill('20.1');
    await page.locator('#speed').dispatchEvent('change');
    assert.match(await page.locator('#status').innerText(),/Rejected speed/);
    await page.locator('#speed').fill('1.25');
    await page.locator('#reset').click();
    assert.equal(await page.locator('#x-raw').innerText(),'RAW 20971520');
    checks.push('guarded speed rejection and integer reset');

    await page.locator('#operand-a').fill('1e3');
    await page.locator('#calculate').click();
    assert.equal(await page.locator('#result-view').innerText(),'REJECTED');
    await page.locator('#operand-a').fill('0.1');
    await page.locator('#calculate').click();
    checks.push('invalid decimal input rejection');

    await page.screenshot({path:join(out,'qfloat-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(100);
    const overflow=await page.evaluate(
      ()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(overflow<=0,'mobile horizontal overflow: '+overflow);
    await page.screenshot({path:join(out,'qfloat-mobile.png'),fullPage:true});
    checks.push('390px responsive display without overflow');

    assert.deepEqual(errors,[],'browser errors / unverified requests');
    return {passed:true,checks,errors,pixel,overflow};
  }catch(error){
    if(page){
      try{await page.screenshot({path:join(out,'qfloat-failure.png'),
        fullPage:true,timeout:5000});}catch{}
    }
    error.checks=checks;
    error.browserErrors=errors;
    throw error;
  }finally{await context.close();}
}
export async function finalize(report,browser){
  if(browser){
    try{await browser.close();}
    catch(error){report.failures.push('browser close: '+error.message);}
  }
  if(report.failures.length)report.status='FAIL';
  return report.status==='PASS'?0:1;
}
function seal(out,report){
  writeFileSync(join(out,'QFLOAT_ARCADE_REPORT.json'),
    JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  const summary=['# VANILLAJS QFloat ARCADE browser witness','',
    'Result: **'+report.status+'**',
    'VANILLAJS HEAD: '+report.sourceHead,
    'ARCADE source commit: '+ARCADE_COMMIT,
    'Runner: '+report.host.runner,
    'Browser: '+(report.browser??'not launched'),
    ...report.failures.map(x=>'- FAILURE: '+x),''].join('\n');
  writeFileSync(join(out,'SUMMARY.md'),summary,{flag:'wx'});
  const files=readdirSync(out).filter(x=>x!=='SHA256SUMS').sort();
  writeFileSync(join(out,'SHA256SUMS'),files.map(f=>
    sha(readFileSync(join(out,f)))+'  '+f).join('\n')+'\n',{flag:'wx'});
}
async function main(args=process.argv.slice(2)){
  const {head,out}=parseOptions(args);
  checkDispatch(head);
  const playwright=findPlaywright(),executablePath=browserExecutable();
  if(existsSync(out))throw Error('Refusing to overwrite evidence');
  mkdirSync(out,{recursive:true,mode:0o700});
  const report={kind:'qsol.vanillajs.qfloat.arcade-witness.v1',status:'FAIL',
    sourceHead:head,arcadeCommit:ARCADE_COMMIT,sourceManifest:[],
    runnerTools:['scripts/qfloat-arcade-witness.mjs',
      'scripts/rtx-playwright.mjs',
      '.github/workflows/rtx5060ti-qfloat.yml'].map(path=>
        ({path,sha256:sha(readFileSync(join(ROOT,path)))})),
    host:{runner:process.env.RUNNER_NAME??'unknown',
      os:os.platform(),cpu:os.cpus()[0]?.model,node:process.version,
      playwright:playwright.version},startedAt:new Date().toISOString(),
    completedAt:null,browser:null,observation:null,failures:[]};
  let browser=null;
  try{
    const {manifest,resources}=await verifyPublished();
    report.sourceManifest=manifest;
    browser=await playwright.chromium.launch({headless:false,executablePath,
      args:['--disable-background-networking','--no-first-run']});
    report.browser=browser.version();
    report.observation=await observe(browser,resources,out);
    report.status='PASS';
  }catch(error){
    report.failures.push(error.name+': '+error.message);
    if(error.checks)report.partialChecks=error.checks;
    if(error.browserErrors)report.browserErrors=error.browserErrors;
    process.exitCode=1;
    console.error('QFloat browser witness failure:',error.stack);
  }finally{
    if(await finalize(report,browser))process.exitCode=1;
    report.completedAt=new Date().toISOString();
    seal(out,report);
    console.log(JSON.stringify({status:report.status,out,
      arcadeCommit:ARCADE_COMMIT,failures:report.failures}));
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{console.error(error.stack);process.exitCode=1;});
}
