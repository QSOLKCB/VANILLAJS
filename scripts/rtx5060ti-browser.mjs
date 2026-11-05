// SPDX-License-Identifier: Apache-2.0
// Local-only headed Chromium validation. Called by rtx5060ti-trusted.mjs.
// Nothing in this module is imported by packaged game code.
import assert from 'node:assert/strict';

const SAMPLES=7, WARMUPS=2, FRAMES=240;
const median=v=>[...v].sort((a,b)=>a-b)[Math.floor(v.length/2)];
const percentile=(values,p)=>{
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.ceil((p/100)*sorted.length)-1];
};
const stats=values=>({count:values.length,medianMs:median(values),p95Ms:percentile(values,95),maximumMs:Math.max(...values)});
const order=i=>i%2===0?['baseline','candidate']:['candidate','baseline'];

export async function gpuIdentity(page){
  return page.evaluate(()=>{
    const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl');
    if(!gl)throw new Error('WebGL1 unavailable: no native GPU measurement');
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    if(!debug)throw new Error('WEBGL_debug_renderer_info unavailable: cannot verify hardware path');
    return {vendor:gl.getParameter(debug.UNMASKED_VENDOR_WEBGL),
      renderer:gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
      version:gl.getParameter(gl.VERSION),shadingLanguageVersion:gl.getParameter(gl.SHADING_LANGUAGE_VERSION)};
  });
}
function requireNvidia(info){
  assert.match(info.vendor,/NVIDIA/i,'WebGL vendor must identify NVIDIA');
  assert.match(info.renderer,/RTX\s*5060\s*Ti/i,'WebGL renderer must identify RTX 5060 Ti');
  assert.doesNotMatch(info.renderer,/swiftshader|llvmpipe|software|lavapipe/i,'software rendering forbidden');
}

// Native browser-engine CPU workloads run the historical and current APIs,
// on exactly the same arrays and ray/query order.
async function kernel(page,role){
  return page.evaluate(async role=>{
    const base='/'+role+'/';
    const render=await import(base+'modules/render-webgl/index.js');
    const collision=await import(base+'modules/collision/index.js');
    const geometry=role==='candidate'?await import(base+'modules/geometry/index.js'):null;
    const boxes=Array.from({length:480},(_,i)=>{
      const x=(i%24)*2.25-26,z=Math.floor(i/24)*2.25-21;
      return {center:[x,.5,z],size:[1+(i%3)*.17,1,.7+(i%5)*.12],
        color:[.15+(i%7)*.07,.25+(i%11)*.05,.7]};
    });
    const colliders=boxes.map((b,i)=>({id:'b'+String(i).padStart(4,'0'),box:{
      min:b.center.map((v,k)=>v-b.size[k]/2),max:b.center.map((v,k)=>v+b.size[k]/2)}}));
    const rays=Array.from({length:128},(_,i)=>({
      origin:[((i*7)%53)-26,.5,((i*11)%49)-24],
      displacement:[((i*13)%41)-20,0,((i*17)%43)-21],halfSize:i%5===0?.07:0
    }));
    const make=()=>role==='candidate'?geometry.boxMeshBatch(boxes):
      new Float32Array(boxes.flatMap(b=>render.boxVertices(b.center,b.size,b.color)));
    const runGeometry=()=>{
      let sink=0;
      for(let i=0;i<20;i++){const data=make();sink+=data[(i*17)%data.length];}
      return sink;
    };
    const runCollision=()=>{
      const idx=role==='candidate'?new geometry.StaticAABBIndex(colliders):null;
      const hits=[];
      for(const r of rays)hits.push(idx?idx.castSegment(r.origin,r.displacement,{halfSize:r.halfSize}):
        collision.castSegment(r.origin,r.displacement,colliders,{halfSize:r.halfSize}));
      return hits;
    };
    // Warm the exact algorithms inside this browser realm before timing.
    runGeometry();runCollision();runGeometry();runCollision();
    const t0=performance.now(),geomSink=runGeometry(),geometryMs=performance.now()-t0;
    const t1=performance.now(),hits=runCollision(),collisionMs=performance.now()-t1;
    if(!Number.isFinite(geomSink))throw Error('nonfinite geometry sink');
    const bytes=new Uint8Array(make().buffer);
    const hex=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),
      n=>n.toString(16).padStart(2,'0')).join('');
    return {geometryMs,collisionMs,geometryBytes:bytes.byteLength,
      geometrySha256:await hex(bytes),collisionSha256:await hex(new TextEncoder().encode(JSON.stringify(hits))),
      hitCount:hits.filter(Boolean).length,sink:geomSink};
  },role);
}

// Verify native GPU output for identical fixed-world poses and frames, outside
// timing measurements. Renderer and shader code come from each checkout.
async function exactPixels(page,role){
  return page.evaluate(async role=>{
    const {Renderer,boxVertices}=await import('/'+role+'/modules/render-webgl/index.js');
    const geometry=role==='candidate'?await import('/'+role+'/modules/geometry/index.js'):null;
    const canvas=document.querySelector('#gpu'),renderer=new Renderer(canvas);
    const boxes=Array.from({length:80},(_,i)=>({
      center:[(i%10)*.65-3,.5+(i%4)*.25,-4-Math.floor(i/10)*1.1],
      size:[.44,.36,.52],color:[.2+(i%5)*.09,.3+(i%4)*.08,.6]}));
    const packed=role==='candidate'?geometry.boxMeshBatch(boxes):
      new Float32Array(boxes.flatMap(b=>boxVertices(b.center,b.size,b.color)));
    const staticMesh=renderer.mesh(packed),dynamicMesh=renderer.mesh([]);
    const output=[];
    for(const tick of [0,73,149]){
      const data=[];
      for(let i=0;i<16;i++){
        const center=[Math.sin(tick/37+i)*2,1.1+(i%3)*.3,-3-i*.47];
        const color=[.8,.25+i*.017,.3];
        if(role==='candidate')boxVertices(center,[.12,.18,.3],color,data);
        else data.push(...boxVertices(center,[.12,.18,.3],color));
      }
      renderer.update(dynamicMesh,data);
      renderer.begin([0,1.5,7],[0,0,0,1],{fog:.005,resolution:1});
      renderer.draw(staticMesh);renderer.draw(dynamicMesh);renderer.gl.finish();
      const gl=renderer.gl,pixels=new Uint8Array(canvas.width*canvas.height*4);
      gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      const digest=await crypto.subtle.digest('SHA-256',pixels);
      const hash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
      const bright=pixels.reduce((n,v,i)=>n+(i%4===0&&v>30?1:0),0);
      output.push({tick,sha256:hash,brightPixels:bright,width:canvas.width,height:canvas.height});
    }
    renderer.dispose();
    return output;
  },role);
}

const captureInit=()=>{
  const native=window.requestAnimationFrame.bind(window);
  const meter={active:false,callbackMs:[],deltaMs:[],last:null,
    reset(){this.callbackMs=[];this.deltaMs=[];this.last=null;this.active=true;},
    stop(){this.active=false;}};
  window.__qsolFrame=meter;
  window.requestAnimationFrame=cb=>native(t=>{
    const recording=meter.active,start=performance.now();
    try{return cb(t);}
    finally{if(recording){
      meter.callbackMs.push(performance.now()-start);
      if(meter.last!==null)meter.deltaMs.push(t-meter.last);
      meter.last=t;
    }}
  });
  const counts={bufferDataCalls:0,bufferSubDataCalls:0,uploadedBytes:0,
    drawArraysCalls:0,drawnVertices:0,
    reset(){this.bufferDataCalls=0;this.bufferSubDataCalls=0;this.uploadedBytes=0;this.drawArraysCalls=0;this.drawnVertices=0;},
    snapshot(){return {bufferDataCalls:this.bufferDataCalls,bufferSubDataCalls:this.bufferSubDataCalls,
      uploadedBytes:this.uploadedBytes,drawArraysCalls:this.drawArraysCalls,drawnVertices:this.drawnVertices};}};
  window.__qsolUploads=counts;
  const proto=WebGLRenderingContext.prototype;
  for(const name of ['bufferData','bufferSubData']){
    const original=proto[name];
    proto[name]=function(...args){
      if(meter.active){
        counts[name+'Calls']++;
        const payload=args[name==='bufferData'?1:2];
        const bytes=typeof payload==='number'?payload:payload?.byteLength??0;
        counts.uploadedBytes+=bytes;
      }
      return original.apply(this,args);
    };
  }
  const draw=proto.drawArrays;
  proto.drawArrays=function(mode,first,count){
    if(meter.active){counts.drawArraysCalls++;counts.drawnVertices+=count;}
    return draw.call(this,mode,first,count);
  };
};

async function appPage(context,url){
  const page=await context.newPage();
  page.setDefaultTimeout(20000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(captureInit);
  await page.goto(url,{waitUntil:'load'});
  await page.locator('[data-course="tracking"]').click();
  await page.locator('#launch').click();
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='RUNNING',null,{polling:100,timeout:15000});
  const info=await page.locator('#fps-view').evaluate(canvas=>{
    const gl=canvas.getContext('webgl'),debug=gl?.getExtension('WEBGL_debug_renderer_info');
    if(!debug)throw Error('FPS WebGL debug renderer unavailable');
    return {vendor:gl.getParameter(debug.UNMASKED_VENDOR_WEBGL),renderer:gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)};
  });
  requireNvidia(info);
  return {page,errors,info};
}
async function collectFrames(page,count){
  await page.evaluate(()=>{window.__qsolUploads.reset();window.__qsolFrame.reset();});
  await page.waitForFunction(n=>window.__qsolFrame.callbackMs.length>=n,count,{polling:100,timeout:90000});
  return page.evaluate(()=>{
    window.__qsolFrame.stop();
    return {callbackMs:window.__qsolFrame.callbackMs.slice(),deltaMs:window.__qsolFrame.deltaMs.slice(),
      uploads:window.__qsolUploads.snapshot()};
  });
}
async function timedApp(context,url){
  const {page,errors}=await appPage(context,url);
  try{
    // Discard initial shader compilation, browser window startup and clock reset.
    await collectFrames(page,90);
    const raw=await collectFrames(page,FRAMES);
    assert.equal(errors.length,0,'no application JavaScript errors');
    assert.ok(raw.callbackMs.length>=FRAMES);
    const callbacks=raw.callbackMs.slice(0,FRAMES),deltas=raw.deltaMs.slice(0,FRAMES-1);
    return {jsCallback:stats(callbacks),frameInterval:stats(deltas),longFramesOver33ms:deltas.filter(x=>x>33.333).length,
      gpuUploads:raw.uploads,raw:{callbackMs:callbacks,deltaMs:deltas}};
  }finally{await page.close();}
}
async function sampledMemory(context,url){
  const {page,errors}=await appPage(context,url);
  const cdp=await context.newCDPSession(page);
  try{
    await cdp.send('HeapProfiler.enable');await cdp.send('Performance.enable');
    await collectFrames(page,90);
    await cdp.send('HeapProfiler.collectGarbage');
    const used=async()=>{
      const r=await cdp.send('Performance.getMetrics');
      return r.metrics.find(x=>x.name==='JSHeapUsedSize')?.value??null;
    };
    const before=await used();
    await cdp.send('HeapProfiler.startSampling',{samplingInterval:32768});
    await collectFrames(page,180);
    const {profile}=await cdp.send('HeapProfiler.stopSampling');
    await cdp.send('HeapProfiler.collectGarbage');
    const after=await used();
    assert.equal(errors.length,0,'no application JavaScript errors during memory sample');
    return {sampledAllocationBytes:profile.samples.reduce((n,x)=>n+x.size,0),
      sampleCount:profile.samples.length,heapUsedBeforeGCBytes:before,heapUsedAfterGCBytes:after,
      scope:'CDP statistical allocation sampling at 32KiB; heap after forced GC, NOT exact allocated bytes or process RSS'};
  }finally{await cdp.detach();await page.close();}
}

export async function runBrowserProbe(browser,baseURL){
  const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1});
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==baseURL) return route.abort('blockedbyclient');
    return route.continue();
  });
  const first=await context.newPage(),renderer=await gpuIdentity(first);requireNvidia(renderer);
  await first.close();
  const kernels={baseline:[],candidate:[]},apps={baseline:[],candidate:[]};
  const pixelHashes={};
  for(const role of ['baseline','candidate']){
    const page=await context.newPage();
    await page.goto(baseURL+'/__qsol_gpu_harness__');
    pixelHashes[role]=await exactPixels(page,role);
    await page.close();
  }
  assert.ok(pixelHashes.baseline.every(x=>x.brightPixels>10),'GPU parity fixture must render nonblank geometry');
  assert.deepStrictEqual(pixelHashes.baseline,pixelHashes.candidate,'native WebGL pixel parity');
  for(let pair=-WARMUPS;pair<SAMPLES;pair++){
    for(const role of order(pair)){
      const page=await context.newPage();await page.goto(baseURL+'/__qsol_gpu_harness__');
      const result=await kernel(page,role);await page.close();
      if(pair>=0)kernels[role].push(result);
    }
  }
  for(let i=0;i<SAMPLES;i++){
    const baseline=kernels.baseline[i],candidate=kernels.candidate[i];
    for(const field of ['geometrySha256','collisionSha256','geometryBytes','hitCount','sink'])
      assert.deepStrictEqual(baseline[field],candidate[field],'exact '+field+' parity pair '+i);
  }
  for(let pair=-WARMUPS;pair<SAMPLES;pair++)
    for(const role of order(pair)){
      const result=await timedApp(context,baseURL+'/'+role+'/demos/fps-lab/index.html');
      if(pair>=0)apps[role].push(result);
    }
  const memory={};
  for(const role of ['baseline','candidate'])
    memory[role]=await sampledMemory(context,baseURL+'/'+role+'/demos/fps-lab/index.html');
  await context.close();
  const summary={};
  for(const role of ['baseline','candidate'])summary[role]={
    geometryPrepMs:stats(kernels[role].map(x=>x.geometryMs)),
    staticCollisionMs:stats(kernels[role].map(x=>x.collisionMs)),
    fpsCallbackMedianMs:stats(apps[role].map(x=>x.jsCallback.medianMs)),
    fpsFrameIntervalP95Ms:stats(apps[role].map(x=>x.frameInterval.p95Ms)),
    fpsUploadBytes:stats(apps[role].map(x=>x.gpuUploads.uploadedBytes)),
    fpsDrawCalls:stats(apps[role].map(x=>x.gpuUploads.drawArraysCalls))
  };
  return {protocol:{warmupPairs:WARMUPS,measuredPairs:SAMPLES,framesPerAppTrial:FRAMES,
    application:'FPS Lab / tracking, running without player input',
    geometry:'480 static boxes, 20 constructions per trial',
    collision:'128 finite segments / 480 static colliders; candidate includes index construction',
    pixelFrames:[0,73,149],rendering:'headed native WebGL1, GPU path required',
    notes:['FPS measures the same recipe and no-input controls, but wall-clock-driven simulation states are not bitwise identical.',
      'CPU kernels and GPU pixel scenes use identical deterministic arrays and pose/tick schedules.',
      'CDP sampling and forced GC run in a separate pass, never inside timed frame trials.',
      'Headed browser samples are environment-specific observations, not strict real-time guarantees.']},
    nativeRenderer:renderer,pixelParity:pixelHashes.baseline,kernelSamples:kernels,
    frameSamples:apps,memory,summary};
}
