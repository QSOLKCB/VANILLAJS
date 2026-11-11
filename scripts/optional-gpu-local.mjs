// SPDX-License-Identifier: Apache-2.0
// Explicit local hardware test; never dispatched on a personal runner by PR CI.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('playwright'),root=resolve('dist');
const server=createServer(async(req,res)=>{try{
  const pathname=new URL(req.url,'http://localhost').pathname,path=resolve(root,'.'+pathname);
  if(!path.startsWith(root+sep))throw Error('path');
  res.setHeader('Content-Type',extname(path)==='.js'?'text/javascript':extname(path)==='.css'?'text/css':'text/html');res.end(await readFile(path));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:false,args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist']});
try{
  const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    const request=navigator.gpu.requestAdapter.bind(navigator.gpu);window.adapterRequests=0;window.deviceRequests=0;
    navigator.gpu.requestAdapter=async(...args)=>{window.adapterRequests++;const a=await request(...args);if(!a)return a;
      const make=a.requestDevice.bind(a);let used=false;a.requestDevice=async(...args)=>{if(used)throw Error('consumed adapter');used=true;window.deviceRequests++;return make(...args);};return a;};
  });
  const base=`http://127.0.0.1:${server.address().port}/`;
  for(const lab of ['gpu-lab','space-lab']){
    await page.goto(base+'demos/'+lab+'/index.html');await page.waitForFunction(()=>window.lab);
    await page.waitForFunction(()=>document.querySelector('#graphics button').disabled===false);
    assert.equal(await page.evaluate(()=>window.deviceRequests),0,'detection must not create devices');
    for(let i=0;i<2;i++){
      await page.getByRole('button',{name:'Enable WebGPU + WASM',exact:true}).click();await page.waitForFunction(()=>window.lab.renderer.mode==='webgpu-wasm');
      await page.getByRole('button',{name:'Use CPU',exact:true}).click();await page.waitForFunction(()=>window.lab.renderer.mode==='cpu');
    }
    await page.getByRole('button',{name:'Enable WebGPU + WASM',exact:true}).click();await page.waitForFunction(()=>window.lab.renderer.mode==='webgpu-wasm');
    const result=await page.evaluate(async()=>{
      const r=window.lab.renderer,b=r.gpu,device=b.device,w=b.canvas.width,h=b.canvas.height,pitch=Math.ceil(w*4/256)*256;
      b.context.configure({device,format:b.format,alphaMode:'opaque',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
      const buffer=device.createBuffer({size:pitch*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),submit=device.queue.submit.bind(device.queue);let submissions=0;
      device.queue.submit=commands=>{submissions++;const copy=device.createCommandEncoder();copy.copyTextureToBuffer({texture:b.context.getCurrentTexture()},{buffer,bytesPerRow:pitch},[w,h]);submit([...commands,copy.finish()]);};
      try{b.render(r.primitives,r.vp,r.fog);}finally{device.queue.submit=submit;}
      await buffer.mapAsync(GPUMapMode.READ);const data=new Uint8Array(buffer.getMappedRange());let bright=0;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*pitch+x*4;if(data[i]+data[i+1]+data[i+2]>100)bright++;}
      buffer.unmap();buffer.destroy();return {bright,submissions,adapters:window.adapterRequests,devices:window.deviceRequests};
    });
    assert.ok(result.bright>500,'real submitted GPU pixels');assert.equal(result.submissions,1);assert.equal(result.devices,3);assert.ok(result.adapters>=4);
    const reuse=await page.evaluate(()=>{
      const r=window.lab.renderer,b=r.gpu,write=b.device.queue.writeBuffer.bind(b.device.queue);let writes=0;
      b.device.queue.writeBuffer=(...args)=>{writes++;return write(...args);};
      try{b.render(r.primitives,r.vp,r.fog);b.render(r.primitives,r.vp,r.fog);return writes;}
      finally{b.device.queue.writeBuffer=write;}
    });assert.equal(reuse,0,'unchanged complete inputs reuse GPU projection/uploads');
    console.log(lab,result,'unchanged uploads',reuse);
    await mkdir('browser-artifacts',{recursive:true});await page.screenshot({path:'browser-artifacts/'+lab+'-hardware.png'});
    await page.evaluate(()=>window.lab.renderer.gpu.device.destroy());await page.waitForFunction(()=>window.lab.renderer.mode==='cpu');
    await page.getByRole('button',{name:'Enable WebGPU + WASM',exact:true}).click();await page.waitForFunction(()=>window.lab.renderer.mode==='webgpu-wasm');
    await page.evaluate(async()=>{
      const r=window.lab.renderer;r.useCPU();const instantiate=WebAssembly.instantiate;WebAssembly.instantiate=async()=>{throw Error('injected WASM failure');};
      try{await r.enableGPU();throw Error('expected failure');}catch(e){if(e.message!=='injected WASM failure')throw e;}finally{WebAssembly.instantiate=instantiate;}
      if(r.mode!=='cpu')throw Error('missing CPU fallback');await r.enableGPU();
      r.canvas.width=640;r.canvas.height=360;
    });
    await page.waitForFunction(()=>window.lab.renderer.gpu?.canvas.width===640);
  }
  const info=await page.evaluate(async()=>{const a=await navigator.gpu.requestAdapter();return {vendor:a.info.vendor,architecture:a.info.architecture,fallback:a.info.isFallbackAdapter};});console.log('Adapter',info);assert.equal(info.fallback,false);
  assert.deepEqual(errors,[]);console.log('Hardware GPU pixels, fresh adapters, loss/retry, initialization failure and resize PASS');
}finally{await browser.close();await new Promise(r=>server.close(r));}
