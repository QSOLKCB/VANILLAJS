// SPDX-License-Identifier: Apache-2.0
// FPS-LAB-OPT-001: observational paired Chromium/software-rendering benchmark.
// Not native GPU timing, not a claimed speedup and not a gameplay modification.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import os from 'node:os';

const require=createRequire(import.meta.url);
const {chromium}=require('playwright'); // isolated pinned CI tool, not runtime dependency
const root=resolve(import.meta.dirname,'../dist');
const hash=data=>createHash('sha256').update(data).digest('hex');
const fullName='fps-lab-chromium-observations.json';
const sourceHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(process.env.GITHUB_SHA && process.env.GITHUB_SHA!==sourceHead)
  throw new Error('Benchmark checkout does not match GITHUB_SHA');
const kinds=['course','tracking'];
const warmupFrames=40,measureFrames=120,passes=2;
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(!pathname.startsWith('/VANILLAJS/')){res.writeHead(404);res.end();return;}
    const filename=resolve(root,pathname.slice('/VANILLAJS/'.length));
    if(!filename.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const body=await readFile(filename);
    res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript',
      '.html':'text/html','.css':'text/css','.json':'application/json',
      '.svg':'image/svg+xml'})[extname(filename)]??'application/octet-stream');
    res.end(body);
  }catch(error){res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port+'/VANILLAJS/demos/fps-lab/index.html';

function summaries(values) {
  assert.ok(values.length>=measureFrames-1,'insufficient frame observations');
  assert.ok(values.every(n=>Number.isFinite(n)&&n>=0),'invalid timing sample');
  const sorted=values.slice().sort((a,b)=>a-b);
  const q=p=>sorted[Math.ceil(p*(sorted.length-1))];
  return {samples:values.length,p50:q(.5),p95:q(.95),
    minimum:sorted[0],maximum:sorted.at(-1),
    mean:values.reduce((a,v)=>a+v,0)/values.length};
}
async function sample(browser,scene,eco,pass) {
  const context=await browser.newContext({
    viewport:{width:1280,height:900},deviceScaleFactor:1,
    reducedMotion:'reduce',serviceWorkers:'block'
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.addInitScript(()=>{
      const original=window.requestAnimationFrame.bind(window);
      const state={frames:0,active:false,previous:null,intervals:[],cpuMs:[]};
      window.__fpsFrameProbe=state;
      window.requestAnimationFrame=callback=>original(time=>{
        const start=performance.now();
        try{return callback(time);}
        finally{
          if(state.active){
            if(state.previous!==null)state.intervals.push(time-state.previous);
            state.previous=time;
            state.cpuMs.push(performance.now()-start);
          }
          state.frames++;
        }
      });
    });
    await page.goto(base,{waitUntil:'load',timeout:20000});
    await page.waitForFunction(()=>{
      const status=document.querySelector('#status');
      return status?.textContent==='READY'||status?.textContent==='UNAVAILABLE';
    },null,{polling:100,timeout:10000});
    assert.equal(await page.locator('#status').textContent(),'READY','FPS Lab must initialise WebGL');
    if(scene!=='course')await page.locator('[data-course="'+scene+'"]').click();
    if(eco)await page.locator('#eco').check();
    else await page.locator('#eco').uncheck();
    await page.locator('#launch').click();
    assert.equal(await page.locator('#status').textContent(),'RUNNING','FPS Lab must run');
    await page.evaluate(()=>{window.__fpsFrameProbe.frames=0;});
    await page.waitForFunction(n=>window.__fpsFrameProbe.frames>=n,warmupFrames,{polling:100,timeout:45000});
    await page.evaluate(()=>{
      const p=window.__fpsFrameProbe;
      p.active=true;p.previous=null;p.intervals=[];p.cpuMs=[];
    });
    await page.waitForFunction(n=>window.__fpsFrameProbe.cpuMs.length>=n,measureFrames,{polling:100,timeout:90000});
    const observation=await page.evaluate(()=>{
      const p=window.__fpsFrameProbe;p.active=false;
      const canvas=document.querySelector('#fps-view');
      const gl=canvas.getContext('webgl2')??canvas.getContext('webgl');
      const info=gl?.getExtension('WEBGL_debug_renderer_info');
      return {
        intervals:p.intervals.slice(0,120),
        cpuMs:p.cpuMs.slice(0,120),
        width:canvas.width,height:canvas.height,
        glVersion:gl?.getParameter(gl.VERSION)??null,
        renderer:gl?.getParameter(info?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)??null,
        webglAvailable:!!gl,
        simElapsedText:document.querySelector('#elapsed')?.textContent?.trim()??null,
        hudStatus:document.querySelector('#status')?.textContent??null,
        course:document.querySelector('[data-course][aria-pressed="true"]')?.dataset.course??null,
        errorText:document.querySelector('#error')?.textContent??null,
      };
    });
    assert.ok(observation.webglAvailable,'working WebGL required');
    assert.equal(observation.hudStatus,'RUNNING');
    assert.equal(observation.course,scene);
    assert.ok(observation.width>0&&observation.height>0,'actual render surface required');
    assert.ok(parseFloat(observation.simElapsedText)>0,'simulation must advance');
    assert.deepEqual(errors,[],'no unhandled page errors allowed');
    const result={
      scene,profile:eco?'reduced-resolution':'full-resolution',pass,
      viewport:[1280,900],renderSurface:[observation.width,observation.height],
      renderPixels:observation.width*observation.height,
      renderer:observation.renderer,webglVersion:observation.glVersion,
      simElapsedText:observation.simElapsedText,status:observation.hudStatus,
      frameIntervalMs:summaries(observation.intervals),
      jsAnimationCallbackMs:summaries(observation.cpuMs),
      rawFrameIntervalMs:observation.intervals,rawJsCallbackMs:observation.cpuMs,
      errors
    };
    if(pass===0){
      await mkdir('browser-artifacts',{recursive:true});
      await page.screenshot({path:`browser-artifacts/fps-benchmark-${scene}-${eco?'eco':'full'}.png`});
    }
    return result;
  }finally{await context.close();}
}
let browser;
try{
  browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const observed=[];
  for(const scene of kinds){
    for(let pass=0;pass<passes;pass++){
      const order=pass%2===0?[false,true]:[true,false];
      for(const eco of order){
        const result=await sample(browser,scene,eco,pass);
        observed.push(result);
        console.log('FPS-LAB OBSERVATION '+JSON.stringify({
          scene,pass,profile:result.profile,
          p50FrameIntervalMs:result.frameIntervalMs.p50,
          p95FrameIntervalMs:result.frameIntervalMs.p95,
          p95JsCallbackMs:result.jsAnimationCallbackMs.p95,
          renderPixels:result.renderPixels,
          renderer:result.renderer
        }));
      }
    }
  }
  const files=['scripts/fps-lab-chromium-benchmark.mjs','demos/fps-lab/app.js',
    'demos/fps-lab/index.html','demos/fps-lab/worlds.js'];
  const sources={};
  for(const path of files)sources[path]=hash(await readFile(path));
  const report={
    kind:'qsol.vanillajs.fps-lab.headless-chromium.v1',
    sourceHead,observedAt:new Date().toISOString(),host:{
      platform:process.platform,arch:process.arch,
      cpu:os.cpus()[0]?.model??null,logicalCpu:os.cpus().length,
      node:process.version,githubRunId:process.env.GITHUB_RUN_ID??null,
      headless:true,swiftShaderRequested:true,
      chromiumVersion:browser.version()
    },
    method:{
      scenes:kinds,profiles:['full-resolution','reduced-resolution'],
      passes,order:'AB followed by BA per scene',warmupFrames,measureFrames,
      timing:'requestAnimationFrame callback entry-to-exit JS wall time and RAF timestamp intervals',
      confidence:'exploratory paired observations, not confidence intervals or automatic promotion',
      scope:'headless Chromium software-rendering observation; NOT native GPU FPS/VRAM or a game-engine speedup',
      renderPixels:'render surface pixel count, not a measured GPU memory footprint or perceptual-quality score',
      runtime:'actual packaged FPS Lab, unchanged application code; static scene and tracking range',
      sourceSHA256:sources
    },observations:observed
  };
  const raw=JSON.stringify(report,null,2)+'\n';
  await writeFile(fullName,raw,{flag:'wx'});
  await writeFile('fps-lab-chromium.SHA256SUMS',hash(raw)+'  '+fullName+'\n',{flag:'wx'});
  console.log('FPS-LAB REPORT '+JSON.stringify({file:fullName,sha256:hash(raw),
    observations:observed.length,commit:sourceHead}));
}finally{
  await browser?.close();
  await new Promise(done=>server.close(done));
}
