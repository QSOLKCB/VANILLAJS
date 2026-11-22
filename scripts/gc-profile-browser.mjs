// SPDX-License-Identifier: Apache-2.0
// GC-PROFILE-001: opt-in Chromium Allocation Observatory. Never shipped at runtime.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,sep,extname} from 'node:path';
import {performance} from 'node:perf_hooks';
import os from 'node:os';
import {quantiles,allocationSummary,gcTraceSummary,namedMetrics,VISUAL_BOX_COUNTS} from './gc-profile-core.mjs';

const usage='node scripts/gc-profile-browser.mjs --out /new/output [--frames 60] [--warmup 20] [--executable /path/to/chromium] [--backend software|default]';
function argumentsOf(argv){
  if(argv.includes('--help')){console.log(usage);process.exit(0);}
  const o={out:null,frames:60,warmup:20,executable:null,backend:'software'};
  for(let i=0;i<argv.length;i+=2){
    const k=argv[i],v=argv[i+1];
    if(!v||!['--out','--frames','--warmup','--executable','--backend'].includes(k))
      throw Error('Invalid arguments. '+usage);
    if(k==='--out')o.out=resolve(v);
    else if(k==='--frames')o.frames=Number(v);
    else if(k==='--warmup')o.warmup=Number(v);
    else if(k==='--backend')o.backend=v;
    else if(k==='--executable')o.executable=resolve(v);
  }
  if(!o.out||!['software','default'].includes(o.backend)||
     !Number.isSafeInteger(o.frames)||o.frames<30||o.frames>360||
     !Number.isSafeInteger(o.warmup)||o.warmup<10||o.warmup>180)
    throw Error('Invalid frame/window/output bounds. '+usage);
  return o;
}
const config=argumentsOf(process.argv.slice(2));
const {chromium}=createRequire(import.meta.url)('playwright'); // external isolated test tool only
const sourceHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(process.env.GITHUB_SHA&&sourceHead!==process.env.GITHUB_SHA)
  throw Error('Runner checkout does not match GITHUB_SHA');
const root=resolve(import.meta.dirname,'../dist');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const server=createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/VANILLAJS/gc-fixture.html'){
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
      res.end('<!doctype html><title>GC profiling fixture</title><body></body>');return;
    }
    if(!path.startsWith('/VANILLAJS/')){res.writeHead(404);res.end();return;}
    const file=resolve(root,decodeURIComponent(path.slice('/VANILLAJS/'.length)));
    if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const bytes=await readFile(file);
    res.writeHead(200,{'Content-Type':({'.js':'text/javascript','.mjs':'text/javascript',
      '.html':'text/html','.json':'application/json','.css':'text/css',
      '.svg':'image/svg+xml'})[extname(file)]??'application/octet-stream',
      'Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end();}
});
async function readTrace(cdp,handle){
  let total=0;const chunks=[];
  try{
    while(true){
      const row=await cdp.send('IO.read',{handle,size:65536});
      const part=Buffer.from(row.data,row.base64Encoded?'base64':'utf8');
      total+=part.byteLength;
      if(total>32*1024*1024)throw new RangeError('CDP trace exceeds 32 MiB');
      chunks.push(part);
      if(row.eof)break;
    }
  }finally{await cdp.send('IO.close',{handle}).catch(()=>{});}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function profile(page,measure,details){
  const cdp=await page.context().newCDPSession(page);
  let resolveComplete,rejectComplete;
  const completed=new Promise((resolve,reject)=>{resolveComplete=resolve;rejectComplete=reject;});
  const timeout=setTimeout(()=>rejectComplete(Error('CDP tracingComplete timed out')),30000);
  cdp.once('Tracing.tracingComplete',event=>{clearTimeout(timeout);resolveComplete(event);});
  let tracing=false,sampling=false;
  try{
    await cdp.send('Performance.enable');await cdp.send('HeapProfiler.enable');
    const before=namedMetrics((await cdp.send('Performance.getMetrics')).metrics);
    await cdp.send('HeapProfiler.startSampling',{samplingInterval:8192,
      includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});sampling=true;
    await cdp.send('Tracing.start',{categories:'devtools.timeline,v8,disabled-by-default-v8.gc',
      transferMode:'ReturnAsStream'});tracing=true;
    const start=performance.now(),observed=await measure(),elapsedMs=performance.now()-start;
    const after=namedMetrics((await cdp.send('Performance.getMetrics')).metrics);
    const allocations=allocationSummary((await cdp.send('HeapProfiler.stopSampling')).profile);
    sampling=false;await cdp.send('Tracing.end');tracing=false;
    const event=await completed;
    assert.ok(event.stream,'Missing CDP trace stream');
    const gc=gcTraceSummary(await readTrace(cdp,event.stream));
    assert.equal(observed.jsWorkMs.length,config.frames,'record every measured callback');
    assert.equal(observed.frameIntervalsMs.length,config.frames-1,'record consecutive RAF intervals');
    return {...details,hostElapsedMs:elapsedMs,
      rawFrameIntervalsMs:observed.frameIntervalsMs,rawJsWorkMs:observed.jsWorkMs,
      frameIntervals:quantiles(observed.frameIntervalsMs),jsWork:quantiles(observed.jsWorkMs),
      cdpBefore:before,cdpAfter:after,
      heapUsedDeltaBytes:before.JSHeapUsedSize===undefined||after.JSHeapUsedSize===undefined?
        null:after.JSHeapUsedSize-before.JSHeapUsedSize,
      allocationSampling:allocations,gc,scene:observed.details};
  }finally{
    clearTimeout(timeout);
    if(sampling)await cdp.send('HeapProfiler.stopSampling').catch(()=>{});
    if(tracing){await cdp.send('Tracing.end').catch(()=>{});await completed.catch(()=>{});}
    await cdp.detach().catch(()=>{});
  }
}
async function contextOf(browser){return browser.newContext({viewport:{width:1100,height:770},
  deviceScaleFactor:1,serviceWorkers:'block'});}
async function gameplay(browser,base){
  const context=await contextOf(browser),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.addInitScript(()=>{
      const native=window.requestAnimationFrame.bind(window);
      const probe={frames:0,enabled:false,previous:null,frameIntervalsMs:[],jsWorkMs:[]};
      window.__gcFpsProbe=probe;
      window.requestAnimationFrame=callback=>native(time=>{
        const start=performance.now();
        try{return callback(time);}
        finally{
          if(probe.enabled){
            if(probe.previous!==null)probe.frameIntervalsMs.push(time-probe.previous);
            probe.previous=time;probe.jsWorkMs.push(performance.now()-start);
          }
          probe.frames++;
        }
      });
    });
    await page.goto(base+'demos/block-arena-lab/index.html',{waitUntil:'load',timeout:30000});
    await page.locator('#run:enabled').waitFor({timeout:30000});
    await page.locator('#run').click();
    await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='PLAYING',null,{timeout:15000});
    await page.keyboard.down('w');await page.keyboard.down('f');
    await page.waitForFunction(n=>window.__gcFpsProbe.frames>=n,config.warmup,{timeout:90000});
    await page.evaluate(()=>{
      const p=window.__gcFpsProbe;
      p.enabled=true;p.previous=null;p.frameIntervalsMs=[];p.jsWorkMs=[];
    });
    const result=await profile(page,async()=>{
      await page.waitForFunction(n=>window.__gcFpsProbe.jsWorkMs.length>=n,config.frames,{timeout:120000});
      return page.evaluate(n=>{
        const p=window.__gcFpsProbe;p.enabled=false;
        const canvas=document.querySelector('#scene'),gl=canvas.getContext('webgl');
        const ext=gl?.getExtension('WEBGL_debug_renderer_info');
        return {frameIntervalsMs:p.frameIntervalsMs.slice(0,n-1),jsWorkMs:p.jsWorkMs.slice(0,n),
          details:{viewport:[gl?.drawingBufferWidth??0,gl?.drawingBufferHeight??0],
            renderer:gl?.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER)??null,
            webglVersion:gl?.getParameter(gl.VERSION)??null,
            status:document.querySelector('#status')?.textContent,
            work:document.querySelector('#work-counts')?.textContent,
            scoreboard:document.querySelector('#score')?.textContent,
            description:'Unchanged packaged Block Arena Foundry; real skirmish with bots, held movement and fire'}};
      },config.frames);
    },{kind:'real-gameplay',profile:'block-arena-skirmish'});
    assert.equal(result.scene.status,'PLAYING','gameplay match must continue');
    assert.ok(result.scene.viewport[0]>0&&result.scene.viewport[1]>0);
    assert.deepEqual(errors,[]);
    await page.keyboard.up('w');await page.keyboard.up('f');
    await page.screenshot({path:join(config.out,'real-fps-gameplay.png')});
    return result;
  }finally{await context.close();}
}
async function stress(browser,base,count,variant,pass){
  const context=await contextOf(browser),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(base+'gc-fixture.html',{waitUntil:'load',timeout:30000});
    await page.evaluate(async({count,variant})=>{
      const {Renderer,boxVertices}=await import('/VANILLAJS/modules/render-webgl/index.js');
      const {BoxVertexStream}=await import('/VANILLAJS/modules/render-packing/index.js');
      const canvas=document.createElement('canvas');
      canvas.style.cssText='display:block;width:900px;height:520px';
      document.body.append(canvas);
      const renderer=new Renderer(canvas),mesh=renderer.mesh([]);
      const stream=new BoxVertexStream(count);
      const size=[.12,.12,.12],color=[.95,.48,.31];
      function geometry(t,streamed){
        const values=[];stream.reset();
        for(let i=0;i<count;i++){
          const a=i*2.399963229728653+t*.022,r=2.1+(i%19)*.11;
          const x=Math.cos(a)*r,y=.4+(i%13)*.12,z=-2-Math.sin(a)*r-(i%5)*.2;
          if(streamed)stream.appendXYZRGB(x,y,z,.12,.12,.12,.95,.48,.31);
          else boxVertices([x,y,z],size,color,values);
        }
        return streamed?stream.view():new Float32Array(values);
      }
      // Run exact independent-format comparison before the profiler begins.
      for(const t of [0,17,199]){
        const a=geometry(t,false),b=geometry(t,true);
        if(a.length!==b.length)throw Error('Float32 vertex-count mismatch');
        const aa=new Uint32Array(a.buffer,a.byteOffset,a.length);
        const bb=new Uint32Array(b.buffer,b.byteOffset,b.length);
        for(let i=0;i<aa.length;i++)if(aa[i]!==bb[i])throw Error('Float32 output mismatch at '+i);
      }
      window.__gcVisual={
        frame(t){
          const data=geometry(t,variant==='stream');
          renderer.begin([0,1.6,8],[0,0,0,1],{fog:.004});
          renderer.update(mesh,data);renderer.draw(mesh);
        },
        details(){
          const gl=renderer.gl,ext=gl.getExtension('WEBGL_debug_renderer_info');
          return {viewport:[gl.drawingBufferWidth,gl.drawingBufferHeight],
            renderer:gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL??gl.RENDERER),
            webglVersion:gl.getParameter(gl.VERSION),count,variant,
            liveVertices:mesh.count,triangles:count*12,drawCallsPerFrame:1,
            floatsPerFrame:count*216,retainedStreamBytes:variant==='stream'?stream.capacityBoxes*216*4:0,
            float32Parity:true,authoritativeProjectiles:false};
        },
        dispose(){renderer.dispose();}
      };
    },{count,variant});
    await page.evaluate(async n=>{
      for(let i=0;i<n;i++){await new Promise(requestAnimationFrame);window.__gcVisual.frame(i);}
    },config.warmup);
    const result=await profile(page,()=>page.evaluate(async n=>{
      const frameIntervalsMs=[],jsWorkMs=[];let previous=null;
      for(let i=0;i<n;i++){
        const time=await new Promise(requestAnimationFrame);
        if(previous!==null)frameIntervalsMs.push(time-previous);
        previous=time;
        const start=performance.now();
        window.__gcVisual.frame(100+i);
        jsWorkMs.push(performance.now()-start);
      }
      return {frameIntervalsMs,jsWorkMs,details:window.__gcVisual.details()};
    },config.frames),{kind:'visual-stress',count,variant,pass});
    assert.ok(result.scene.viewport[0]>0&&result.scene.viewport[1]>0);
    assert.equal(result.scene.liveVertices,count*36);
    assert.deepEqual(errors,[]);
    if(count===256&&pass===0)
      await page.screenshot({path:join(config.out,'stress-'+variant+'-256.png')});
    await page.evaluate(()=>{window.__gcVisual.dispose();delete window.__gcVisual;});
    return result;
  }finally{await context.close();}
}
await mkdir(config.out);
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base='http://127.0.0.1:'+server.address().port+'/VANILLAJS/';
let browser;
try{
  browser=await chromium.launch({headless:true,...(config.executable?{executablePath:config.executable}:{}),
    args:config.backend==='software'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
  const observations=[await gameplay(browser,base)];
  console.log('GC-PROFILE-001 real gameplay '+JSON.stringify({
    p95FrameMs:observations[0].frameIntervals.p95,
    sampledBytes:observations[0].allocationSampling.sampledBytes,
    observedGC:observations[0].gc.observedCount}));
  for(let pass=0;pass<2;pass++)for(const count of VISUAL_BOX_COUNTS)
    for(const variant of pass===0?['legacy','stream']:['stream','legacy']){
      const sample=await stress(browser,base,count,variant,pass);
      observations.push(sample);
      console.log('GC-PROFILE-001 visual '+JSON.stringify({
        count,variant,pass,p95FrameMs:sample.frameIntervals.p95,
        sampledBytes:sample.allocationSampling.sampledBytes,
        observedGC:sample.gc.observedCount}));
    }
  const hashes={};
  for(const path of ['scripts/gc-profile-browser.mjs','scripts/gc-profile-core.mjs',
    'modules/render-webgl/index.js','modules/render-packing/index.js','demos/block-arena-lab/app.js'])
    hashes[path]=sha256(await readFile(path));
  const report={kind:'qsol.vanillajs.gc-profile-001.v1',sourceHead,
    prHeadSha:process.env.GITHUB_HEAD_SHA??null,generatedAt:new Date().toISOString(),
    environment:{os:os.platform(),release:os.release(),arch:os.arch(),
      cpu:os.cpus()[0]?.model??null,node:process.version,chromiumVersion:browser.version(),
      runner:process.env.GITHUB_RUN_ID??'local',headless:true,backendRequested:config.backend},
    protocol:{gameplay:'unchanged packaged Block Arena Foundry, held W/F against real bots',
      visual:'independent visual-only WebGL box workload; no gameplay projectile/collision claims',
      counts:VISUAL_BOX_COUNTS,passes:2,order:'legacy/stream then stream/legacy',
      freshContextPerCase:true,warmupFrames:config.warmup,measuredFrames:config.frames,
      samples:'CDP HeapProfiler statistical sample bytes; not total allocation rate',
      gc:'recognized CDP Tracing duration events; missing events do not prove no collection',
      heap:'JSHeapUsedSize before/after is occupancy, not cumulative allocation',
      timing:'instrumented RAF intervals and per-frame callback/geometry work; profiler overhead included',
      exclusions:'no native GPU completion time, VRAM, unmeasured speedups or cross-browser replay identity',
      sourceSHA256:hashes},
    observations};
  const data=JSON.stringify(report,null,2)+'\n';
  await writeFile(join(config.out,'gc-profile-001.json'),data,{flag:'wx'});
  await writeFile(join(config.out,'SHA256SUMS'),sha256(data)+'  gc-profile-001.json\n',{flag:'wx'});
  console.log('GC-PROFILE-001 RECEIPT '+JSON.stringify({sourceHead,cases:observations.length,
    reportSHA256:sha256(data),directory:config.out}));
}finally{
  await browser?.close();
  await new Promise(done=>server.close(done));
}
