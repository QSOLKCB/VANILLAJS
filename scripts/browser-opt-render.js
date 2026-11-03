// CI-only native WebGL conformance and environment-scoped observations.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {referenceGeometry} from './opt-render-reference.js';
export async function verifyRenderReuse(browser,baseURL){
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.setDefaultTimeout(20000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.__uploads={bufferData:0,bufferSubData:0};
    for(const name of ['bufferData','bufferSubData']){const original=WebGLRenderingContext.prototype[name];WebGLRenderingContext.prototype[name]=function(...args){window.__uploads[name]++;return original.apply(this,args);};}
  });
  const settle=()=>page.evaluate(()=>new Promise(resolve=>{let n=0;const frame=()=>++n===12?resolve():requestAnimationFrame(frame);requestAnimationFrame(frame);}));
  const uploads=()=>page.evaluate(()=>({...window.__uploads}));
  await page.goto(baseURL+'demos/clockwork-vault/index.html');await page.locator('#journey li').last().waitFor();await settle();
  await page.evaluate(()=>{window.__hudMutations=0;window.__hudObserver=new MutationObserver(records=>{window.__hudMutations+=records.length;});for(const selector of ['.game-top','.telemetry','.journey','.game-controls'])window.__hudObserver.observe(document.querySelector(selector),{subtree:true,attributes:true,childList:true,characterData:true});});
  const idle=await uploads();await settle();assert.deepEqual(await uploads(),idle,'idle geometry must not upload again');
  assert.equal(await page.evaluate(()=>window.__hudMutations),0,'unchanged HUD must not rewrite DOM');
  await page.locator('#launch').click();await page.keyboard.down('ArrowLeft');await page.waitForTimeout(100);await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(100);await page.keyboard.up('ArrowRight');await settle();
  assert.deepEqual(await uploads(),idle,'camera movement must not rebuild geometry');
  await page.keyboard.press('Escape');await page.locator('#restart').click();await page.locator('#launch').click();await page.keyboard.down('w');
  await page.waitForFunction(()=>!document.querySelector('#interact').disabled);await page.keyboard.up('w');await page.locator('#interact').click();await settle();
  const opened=await uploads();await page.locator('#crank').click();await settle();assert.deepEqual(await uploads(),opened,'pending detents do not alter latched glyphs');
  await page.locator('#undo').click();await page.locator('[data-lever="1"]').click();
  await page.waitForFunction(n=>window.__uploads.bufferSubData===n+2,opened.bufferSubData);
  assert.equal((await uploads()).bufferData,opened.bufferData,'same-size glyph updates reuse GPU storage');
  await page.keyboard.press('Escape');await settle();const paused=await uploads();await settle();assert.deepEqual(await uploads(),paused);
  await page.evaluate(()=>window.__hudObserver.disconnect());

  // Compare fresh v1.0 geometry/dynamic replacement with the adopted path on the
  // real WebGL API. Test-only function injection; no hook is shipped in the app.
  const report=await page.evaluate(async referenceSource=>{
    const root=new URL('../../',location.href);
    const {Renderer,boxVertices,ringVertices}=await import(new URL('modules/render-webgl/index.js',root));
    const {createVault,mechanismGeometry,consolePosition,progress,palette}=await import(new URL('demos/clockwork-vault/world.js',root));
    const {solvePuzzle}=await import(new URL('demos/clockwork-vault/puzzles.js',root));
    const {VaultGeometry}=await import(new URL('demos/clockwork-vault/view.js',root));
    const reference=Function('boxVertices','ringVertices','mechanismGeometry','consolePosition','progress','palette',`return (${referenceSource});`)(boxVertices,ringVertices,mechanismGeometry,consolePosition,progress,palette);
    class FreshRenderer extends Renderer{update(mesh,data){const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);mesh.count=data.length/6;}}
    const make=Type=>{const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:-2000px;width:160px;height:120px';document.body.append(canvas);return new Type(canvas);};
    const old=make(FreshRenderer),next=make(Renderer);
    function playerScene(moving){const s=createVault();if(moving)for(let i=0;i<5;i++){for(const command of solvePuzzle(i).commands){if(command===0)for(let n=0;n<8;n++)s.locks[i].detent();else s.locks[i].lever(command);}s.sealedAt[i]=0;}return s;}
    function pipeline(renderer,reuse){
      renderer.clearMeshes();const cache=new VaultGeometry(),meshes=Array.from({length:reuse?2:1},()=>({vertices:renderer.mesh([]),lines:renderer.mesh([],'lines')})),previous=[];
      return s=>{
        const groups=reuse?Object.values(cache.update(s)):[reference(s)];
        groups.forEach((g,i)=>{if(g!==previous[i]){renderer.update(meshes[i].vertices,g.vertices);renderer.update(meshes[i].lines,g.lines);previous[i]=g;}});
        renderer.begin([0,1.6,5],[0,0,0,1],{fog:.009});
        for(const m of meshes)renderer.draw(m.vertices);for(const m of meshes)renderer.draw(m.lines);
      };
    }
    const drawOld=pipeline(old,false),drawNext=pipeline(next,true);let comparedPixels=0;
    for(const moving of [false,true])for(const tick of [0,60,180,360,480,719,959]){
      const s=playerScene(moving);s.mechanismTick=tick;s.locks[5].lever(1);drawOld(s);drawNext(s);
      const a=new Uint8Array(old.canvas.width*old.canvas.height*4),b=new Uint8Array(a.length);
      old.gl.readPixels(0,0,old.canvas.width,old.canvas.height,old.gl.RGBA,old.gl.UNSIGNED_BYTE,a);
      next.gl.readPixels(0,0,next.canvas.width,next.canvas.height,next.gl.RGBA,next.gl.UNSIGNED_BYTE,b);
      for(let i=0;i<a.length;i++)if(a[i]!==b[i])throw Error(`Pixel parity failed at tick ${tick}, byte ${i}`);
      comparedPixels+=a.length/4;
    }
    const samples=[];
    for(const moving of [false,true]){
      const result={name:moving?'moving-lift':'idle',baselineMs:[],optimizedMs:[]};
      for(let pair=-2;pair<7;pair++)for(const reuse of pair%2?[true,false]:[false,true]){
        const renderer=reuse?next:old,start=performance.now(),draw=pipeline(renderer,reuse),s=playerScene(moving);
        for(let i=0;i<36;i++){s.mechanismTick=1200+i*4;draw(s);}renderer.gl.finish();
        const ms=performance.now()-start;if(pair>=0)result[reuse?'optimizedMs':'baselineMs'].push(ms);
      }
      samples.push(result);
    }
    const renderer=next.gl.getParameter(next.gl.RENDERER);old.dispose();next.dispose();old.canvas.remove();next.canvas.remove();
    return {comparedPixels,renderer,protocol:{warmupPairs:2,measuredPairs:7,framesPerTrial:36,canvasCss:[160,120],timingGate:false,scope:'synchronous scene setup, geometry, uploads, draws and finish on CI software WebGL; not presented game FPS'},samples};
  },referenceGeometry.toString());
  assert.ok(report.comparedPixels>0);assert.deepEqual(errors,[]);
  await writeFile('browser-artifacts/opt-render-browser.json',JSON.stringify({browser:browser.version(),...report},null,2)+'\n');
  await page.close();console.log('OPT rendering: native pixel parity, retained buffers, idle/camera/partial-turn reuse, changed glyphs and unchanged HUD checks passed; paired observations recorded.');
}
