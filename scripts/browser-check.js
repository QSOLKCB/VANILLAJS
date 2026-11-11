// CI-only tooling. Playwright is installed outside this repository; never a game dependency.
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {SUITES} from './browser-suite-cache.mjs';

















// Hosted CI may run only the groups whose source-bound witness is stale.
// One shared suite inventory governs both actual execution and cache planning.
const args=process.argv.slice(2);
if(args.length>1||(args.length===1&&!args[0].startsWith('--suites=')))
  throw new Error('usage: node scripts/browser-check.js [--suites=home,render,...]');
const chosen=args.length?args[0].slice('--suites='.length).split(','):SUITES;
if(chosen.length===0||new Set(chosen).size!==chosen.length||
    chosen.some(x=>!SUITES.includes(x)))throw new Error('invalid browser suite selection');
const requested=new Set(chosen);
const needs=name=>requested.has(name);
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=resolve(import.meta.dirname,'../dist');
const server=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(!pathname.startsWith('/VANILLAJS/')){res.writeHead(404);res.end();return;}
    const path=resolve(root,pathname.slice('/VANILLAJS/'.length)||'index.html');
    if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)]||'text/plain');res.end(data);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/VANILLAJS/`;
async function runSuite(group,file,exported){
  if(!needs(group))return;
  const fn=(await import(file))[exported];
  if(typeof fn!=='function')throw new TypeError('browser suite function not found: '+exported);
  await fn(browser,base);
}
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
  if(needs('home')){
    await page.goto(base);
  // DRONE-RACER was formerly pushed beyond the right viewport edge by the
  // single-row nav, introducing page-wide horizontal scrolling.
  for(const width of [1024,1440,1655]){
    await page.setViewportSize({width,height:1000});
    const dimensions=await page.evaluate(()=>{
      const nav=[...document.querySelectorAll('.masthead nav a')];
      const drone=nav.find(link=>link.textContent.includes('DRONE-RACER'));
      const rect=drone?.getBoundingClientRect();
      return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        droneVisible:!!rect&&rect.width>0&&rect.height>0,
        droneLeft:rect?.left,droneRight:rect?.right};
    });
    assert.ok(dimensions.droneVisible,'desktop navigation must show DRONE-RACER');
    assert.ok(dimensions.droneLeft>=0&&dimensions.droneRight<=dimensions.viewport,
      'DRONE-RACER must fit in the viewport at '+width+'px');
    assert.ok(dimensions.scrollWidth<=dimensions.viewport,
      'masthead must not cause horizontal page overflow at '+width+'px');
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='READY');
  assert.equal(await page.locator('#error').isVisible(),false);
  const pixels=await page.locator('#flight').evaluate(canvas=>new Promise(resolve=>requestAnimationFrame(()=>{
    const gl=canvas.getContext('webgl'),p=new Uint8Array(canvas.width*canvas.height*4);
    gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,p);
    let bright=0;for(let i=0;i<p.length;i+=4)if(p[i]+p[i+1]+p[i+2]>100)bright++;
    resolve(bright);
  })));
  assert.ok(pixels>500,'WebGL must draw visible geometry');
  await page.locator('#launch').click();await page.keyboard.down('w');
  await page.waitForFunction(()=>parseFloat(document.querySelector('#speed').textContent)>5);
  await page.keyboard.up('w');
  await page.waitForFunction(()=>parseFloat(document.querySelector('#speed').textContent)<.2);
  await page.keyboard.down('ArrowLeft');await page.waitForFunction(()=>parseFloat(document.querySelector('#spin').textContent)>.2);await page.keyboard.up('ArrowLeft');
  await page.locator('#pause').click();const frozen=await page.locator('#elapsed').textContent();
  await page.waitForTimeout(250);assert.equal(await page.locator('#elapsed').textContent(),frozen);
  await page.locator('#launch').click();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  assert.equal(await page.locator('#status').textContent(),'PAUSED');
  await page.locator('#choose-arena').click();assert.equal(await page.locator('#assist').isChecked(),false);
  await page.locator('#launch').click();await page.keyboard.down('w');
  await page.waitForFunction(()=>parseFloat(document.querySelector('#speed').textContent)>5);await page.keyboard.up('w');
  const coast=parseFloat(await page.locator('#speed').textContent());await page.waitForTimeout(250);
  assert.ok(Math.abs(parseFloat(await page.locator('#speed').textContent())-coast)<1,'inertial velocity should persist');
  await page.keyboard.down('x');await page.waitForFunction(()=>parseFloat(document.querySelector('#speed').textContent)<.5);await page.keyboard.up('x');
  await page.locator('#reset').click();assert.equal(await page.locator('#status').textContent(),'READY');
  // Keep W physically down across Escape pause/resume. Repeated down() emits
  // repeat=true; only releasing and pressing again may restart thrust.
  await page.locator('#launch').click();await page.keyboard.down('w');
  await page.waitForFunction(()=>parseFloat(document.querySelector('#speed').textContent)>5);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#status').textContent(),'PAUSED');
  const pausedSpeed=parseFloat(await page.locator('#speed').textContent());
  await page.keyboard.press('Escape');assert.equal(await page.locator('#status').textContent(),'RUNNING');
  await page.keyboard.down('w');await page.waitForTimeout(350);
  assert.ok(Math.abs(parseFloat(await page.locator('#speed').textContent())-pausedSpeed)<.15,'held W repeat must not restart thrust after resume');
  await page.keyboard.up('w');await page.keyboard.down('w');
  await page.waitForFunction(speed=>parseFloat(document.querySelector('#speed').textContent)>speed+3,pausedSpeed);
  await page.keyboard.up('w');await page.locator('#reset').click();
  await mkdir('browser-artifacts',{recursive:true});await page.screenshot({path:'browser-artifacts/flight-lab.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile layout must not overflow');
  await page.screenshot({path:'browser-artifacts/flight-lab-mobile.png',fullPage:true});
  }
  await runSuite('render','./browser-integer.js','verifyIntegerFoundry');
  await runSuite('render','./browser-opt-render.js','verifyRenderReuse');
  await runSuite('render','./browser-webgl-api.js','verifyWebGLAPI');
  await runSuite('render','./browser-frame-gate.js','verifyFrameGate');
  await runSuite('play','./browser-interactions.js','verifyInteractions');
  await runSuite('play','./browser-mouse.js','verifyMouseLook');
  await runSuite('play','./browser-fps.js','verifyFps');
  await runSuite('play','./browser-fps-motion.js','verifyFpsMotion');
  await runSuite('play','./browser-platforms.js','verifyPlatforms');
  await runSuite('worlds','./browser-rts.js','verifyRts');
  await runSuite('worlds','./browser-flow.js','verifyFlow');
  await runSuite('worlds','./browser-2d.js','verify2DLab');
  await runSuite('worlds','./browser-4x.js','verify4XLab');
  await runSuite('research','./browser-omi.js','verifyOmi');
  await runSuite('research','./browser-machine.js','verifyMachine');
  await runSuite('research','./browser-graph.js','verifyGraphLab');
  await runSuite('research','./browser-qgame.js','verifyQuantumGameLab');
  await runSuite('render','./browser-vault.js','verifyVault');
  await runSuite('donor','./browser-optional-labs.js','verifyOptionalLabs');
  await runSuite('donor','./browser-donor-labs.js','verifyDonorLabs');
  await runSuite('editor','./browser-editor.js','verifyEditor');
  if(needs('home')){
  const unsupported=await browser.newPage();await unsupported.addInitScript(()=>HTMLCanvasElement.prototype.getContext=()=>null);
  await unsupported.goto(page.url());await unsupported.locator('#error').waitFor({state:'visible'});
  assert.match(await unsupported.locator('#error').textContent(),/WebGL is unavailable/);
  assert.deepEqual(errors,[]);console.log('Chromium: rendered geometry, both modes, thrust, braking, rotation, pause, held-key repeat cancellation, blur, reset, project subpath, mobile layout and unsupported WebGL passed.');
  }
  console.log('Browser verification finished for suites: '+chosen.join(','));
}finally{await browser.close();await new Promise(r=>server.close(r));}
