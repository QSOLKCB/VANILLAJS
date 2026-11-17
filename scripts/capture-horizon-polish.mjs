// SPDX-License-Identifier: Apache-2.0
// Development-only visual evidence. Uses the existing externally provisioned Chromium.
// Reference captures pin only camera pose/FOV; no simulation state is injected.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const options={};for(const argument of process.argv.slice(2)){const m=/^--(dist|out|reference)=(.+)$/.exec(argument);if(!m||options[m[1]])throw Error('usage: --dist=DIR --out=NEW_DIR [--reference=capture.json]');options[m[1]]=m[2];}
if(!options.dist||!options.out)throw Error('dist and out are required');
const root=resolve(options.dist),out=resolve(options.out),reference=options.reference?JSON.parse(await readFile(options.reference,'utf8')):null;
await mkdir(out,{recursive:true});assert.equal((await readdir(out)).length,0,'capture output must be empty; preserve earlier evidence');
const manifest=await readFile(resolve(root,'manifest.json')),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const server=createServer(async(req,res)=>{try{const url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!url.startsWith('/VANILLAJS/'))throw Error('prefix');const file=resolve(root,url.slice(11)||'index.html');if(!file.startsWith(root+sep))throw Error('path');const bytes=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/VANILLAJS/`;
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const evidence={kind:'qsol.horizon.polish-capture.v1',source:execFileSync('git',['-C',resolve(root,'..'),'rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:execFileSync('git',['-C',resolve(root,'..'),'status','--porcelain'],{encoding:'utf8'}).trim().length>0,manifestSHA256:hash(manifest),browser:browser.version(),node:process.version,viewport:{width:1440,height:1100},rendering:'Chromium / SwiftShader; frame samples include submission and synchronous one-pixel readback, not physical GPU FPS',referenceManifest:reference?.manifestSHA256??null,captures:{}};
async function instrument(page,race){
  await page.evaluate(async race=>{
    globalThis.__captureNow=performance.now.bind(performance);
    const resource=tail=>{const row=performance.getEntriesByType('resource').find(row=>new URL(row.name).pathname.endsWith(tail));if(!row)throw Error('Loaded native module not found: '+tail);return row.name;};
    const {LitRenderer}=await import(resource('/modules/render-lit/index.js'));
    const View=race?(await import(resource('/demos/horizon-lab/race-view.js'))).RaceView:(await import(resource('/demos/horizon-lab/view.js'))).HorizonView;
    const begin=LitRenderer.prototype.begin,draw=View.prototype.draw;
    LitRenderer.prototype.begin=function(position,orientation,settings){
      const camera=globalThis.__captureCamera;
      if(camera){position=camera.position;orientation=camera.orientation;settings={...settings,fov:camera.fov};}
      globalThis.__capturedCamera={position:[...position],orientation:[...orientation],fov:settings.fov};
      return begin.call(this,position,orientation,settings);
    };
    View.prototype.draw=function(...args){globalThis.__captureDraw=()=>draw.apply(this,args);return draw.apply(this,args);};
  },race);
}
async function capture(page,name,race){
  await page.evaluate(camera=>{globalThis.__captureCamera=camera;dispatchEvent(new Event('resize'));},reference?.captures[name]?.camera??null);
  const canvas=page.locator(race?'#race-canvas':'#scene');await canvas.scrollIntoViewIfNeeded();
  const data=await page.evaluate(async race=>{
    const canvas=document.querySelector(race?'#race-canvas':'#scene'),gl=canvas.getContext('webgl');
    const pixel=new Uint8Array(4),samples=[];for(let i=0;i<14;i++){const start=__captureNow();__captureDraw();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);if(i>1)samples.push(__captureNow()-start);}
    const sorted=[...samples].sort((a,b)=>a-b),state=(race?__horizonRace:__horizonLab).snapshot(),debug=gl.getExtension('WEBGL_debug_renderer_info');
    return {camera:__capturedCamera,state,canvas:{width:canvas.width,height:canvas.height,cssWidth:canvas.clientWidth,cssHeight:canvas.clientHeight},renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),timing:{samples,median:sorted[Math.floor(sorted.length/2)],p95:sorted[Math.ceil(sorted.length*.95)-1]},error:gl.getError()};
  },race);
  assert.equal(data.error,0);assert.ok(data.state.view.graphics.frameDraws>10);if(reference){assert.deepEqual(data.camera,reference.captures[name].camera,'matching comparison camera');assert.deepEqual(data.canvas,reference.captures[name].canvas,'matching viewport/profile resolution');}
  const filename=name+'.png';await canvas.screenshot({path:resolve(out,filename)});
  evidence.captures[name]={...data,file:filename,sha256:hash(await readFile(resolve(out,filename)))};
  console.log(name+': '+data.state.view.graphics.vertices+' vertices, '+data.state.view.graphics.bytes+' bytes, '+data.state.view.graphics.frameDraws+' draws');
}
try{
  for(const profile of ['high','low']){
    const context=await browser.newContext({viewport:evidence.viewport,deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.goto(base+'demos/horizon-lab/scenery.html');await page.waitForFunction(()=>document.documentElement.dataset.labReady==='horizon-lab');await instrument(page,false);
      if(profile==='low')await page.locator('#quality').selectOption('low');
      for(const mode of ['hero','orbit','road','bonnet']){await page.locator('[data-camera="'+mode+'"]').click();await capture(page,'scenery-'+mode+'-'+profile,false);}
      assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }
  for(const profile of ['high','low']){
    const context=await browser.newContext({viewport:evidence.viewport,deviceScaleFactor:1,serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.goto(base+'demos/horizon-lab/index.html');await page.waitForFunction(()=>document.documentElement.dataset.labReady==='horizon-race');await instrument(page,true);
      if(profile==='low'){await page.locator('#quality').selectOption('low');await page.locator('#race-apply').click();}
      await page.locator('button[data-camera="chase"]').click();await capture(page,'race-chase-'+profile,true);
      await page.evaluate(()=>{globalThis.__captureCamera=null;});
      await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));await page.locator('#race-start').click();await page.keyboard.down('KeyW');
      for(let i=0;i<320;i++){if(await page.evaluate(()=>__horizonRace.snapshot().ticks>=600))break;await page.clock.runFor(17);}
      await page.keyboard.up('KeyW');await page.keyboard.press('Escape');await page.clock.resume();
      const moving=await page.evaluate(()=>__horizonRace.snapshot());assert.ok(Math.hypot(...moving.player.velocity)>3,'at-speed image requires real driving');assert.ok(moving.player.position[2]<-15,'player moved in world space');
      await capture(page,'race-speed-'+profile,true);assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }
  await writeFile(resolve(out,'capture.json'),JSON.stringify(evidence,null,2)+'\n');console.log('Matching HORIZON capture complete: '+out);
}finally{await browser.close();await new Promise(r=>server.close(r));}
