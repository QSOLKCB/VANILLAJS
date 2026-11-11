// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {createForgeScene,addEntity} from '../demos/editor/model.js';
import {createAssetLibrary,addMeshAsset,setPlacement} from '../demos/editor/asset-foundry.js';
import {exportGame} from '../demos/editor/game-export.js';
export function largeEditorProject(){
  let scene=createForgeScene();while(scene.objects.length<43)scene=addEntity(scene);
  const asset=addMeshAsset(createAssetLibrary(),{name:'512 triangles',license:'CC0-1.0',sourceName:'fixture.obj',sourceSha256:'a'.repeat(64),
    text:'v 0 0 0\nv 1 0 0\nv 0 1 0\n'+'f 1 2 3\n'.repeat(512)});
  let library=asset.library;
  for(const object of scene.objects)library=setPlacement(scene,library,object.id,asset.id);
  return {scene,library};
}
export async function verifyOptionalLabs(browser,base){
  const context=await browser.newContext(),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Real CPU-only path, even on hardware that exposes WebGPU.
  await page.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
  try{
    for(const lab of ['gpu-lab','space-lab']){
      await page.goto(base+'demos/'+lab+'/index.html');await page.waitForFunction(()=>document.documentElement.dataset.labReady==='ready');
      await page.waitForFunction(()=>window.lab.renderer.stats().frames>0);
      assert.equal(await page.evaluate(()=>window.lab.kind),lab==='gpu-lab'?'kinetic-foundry':'orbital-proving-ground');
      assert.equal(await page.evaluate(()=>window.lab.renderer.mode),'cpu');
      const bright=await page.locator('#view').evaluate(c=>{const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<p.length;i+=4)if(p[i]+p[i+1]+p[i+2]>80)n++;return n;});
      assert.ok(bright>100,'CPU draws visible geometry');
      assert.equal(await page.getByRole('button',{name:'CPU · no compatible GPU'}).isDisabled(),true);
      if(lab==='gpu-lab'){
        assert.equal(await page.locator('#mechanic').count(),0,'sculpture has no space mechanics');
        await page.locator('[data-pattern="conveyor"]').click();assert.equal(await page.locator('#scene-name').textContent(),'ASSEMBLY LINE');
        await page.locator('#count').selectOption('16');assert.equal(await page.locator('#population').textContent(),'256 PILLARS');
        await page.locator('#parity').click();await page.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('PASS'));
        assert.match(await page.locator('#result').textContent(),/9216 vertices/);
        await page.locator('#pause').click();const tick=await page.evaluate(()=>window.lab.world.tick);
        await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>window.lab.world.tick),tick);
        const frames=await page.evaluate(()=>window.lab.renderer.stats().frames);await page.waitForTimeout(120);
        assert.equal(await page.evaluate(()=>window.lab.renderer.stats().frames),frames,'paused sculpture avoids repeated draws');
        await page.locator('[data-pattern="weave"]').click();assert.equal(await page.evaluate(()=>window.lab.world.tick),0);
        await page.waitForFunction(()=>window.lab.renderer.stats().frames>0);
        await page.locator('#count').selectOption('8');await page.screenshot({path:'browser-artifacts/kinetic-foundry.png',fullPage:true});
      }
      else{
        await page.locator('#mechanic').selectOption('broadside');await page.locator('#view').focus();await page.keyboard.down('Space');await page.waitForFunction(()=>window.lab.world.hits>0);await page.keyboard.up('Space');
        await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const tick=await page.evaluate(()=>window.lab.world.tick);await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>window.lab.world.tick),tick);
        await page.getByRole('button',{name:'Resume',exact:true}).click();
        assert.equal(await page.evaluate(()=>document.activeElement.id),'view');
        const z=await page.evaluate(()=>window.lab.world.position[2]);await page.keyboard.down('w');
        await page.waitForFunction(z=>window.lab.world.position[2]<z-.1,z);await page.keyboard.up('w');
        await page.getByRole('button',{name:'Use CPU',exact:true}).click();assert.equal(await page.evaluate(()=>document.activeElement.id),'view');
        await page.locator('#camera').selectOption('follow');assert.match(await page.locator('#view-label').textContent(),/FOLLOW/);
        await page.locator('#mechanic').selectOption('flight');assert.equal(await page.evaluate(()=>window.lab.world.hits),0);
        await page.locator('#view').focus();await page.keyboard.down('w');
        await page.waitForFunction(()=>window.lab.world.checkpoint===1);await page.keyboard.up('w');
        await page.locator('#mechanic').selectOption('docking');
        await page.evaluate(()=>{window.lab.world.position=[0,0,1];window.lab.world.velocity=[0,0,0];});
        await page.locator('[data-control="dock:1"]').focus();await page.keyboard.down('Space');
        await page.waitForFunction(()=>window.lab.world.docked);await page.keyboard.up('Space');
        await page.waitForFunction(()=>document.querySelector('#progress').textContent==='DOCKED');
        await page.locator('#mechanic').selectOption('orbit');await page.waitForFunction(()=>window.lab.world.trail.length>2);
        assert.equal(await page.locator('[data-control="thrust:1"]').isDisabled(),true);
        assert.ok(Math.abs(await page.evaluate(()=>Math.hypot(...window.lab.world.position))-25)<.01);
        await page.locator('#pause').click();const orbit=await page.evaluate(()=>JSON.stringify(window.lab.world.position));
        await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>JSON.stringify(window.lab.world.position)),orbit);
        await page.locator('#mechanic').selectOption('flight');await page.locator('#camera').selectOption('tactical');
        await page.screenshot({path:'browser-artifacts/space-proving-ground.png',fullPage:true});
        // Holding a pointer through pause cannot reapply thrust on resume.
        await page.locator('#pause').click();const control=page.locator('[data-control="thrust:1"]'),box=await control.boundingBox();
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
        await page.waitForFunction(()=>window.lab.world.velocity[2]<-.1);
        await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();
        await page.locator('#pause').click();const velocity=await page.evaluate(()=>window.lab.world.velocity[2]);
        await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.lab.world.velocity[2]),velocity,'stale pointer does not restore thrust');
        await page.locator('#pause').click();
      }
      await page.setViewportSize({width:320,height:780});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'lab fits 320px');
      await page.screenshot({path:'browser-artifacts/'+lab+'-320.png',fullPage:true});
      await page.setViewportSize({width:1280,height:900});
    }
    const touchContext=await browser.newContext({viewport:{width:320,height:780},hasTouch:true,reducedMotion:'reduce'});
    try{
      await touchContext.addInitScript(()=>Object.defineProperty(navigator,'gpu',{value:undefined,configurable:true}));
      const touch=await touchContext.newPage();touch.on('pageerror',e=>errors.push(e.message));
      await touch.goto(base+'demos/space-lab/index.html');await touch.waitForFunction(()=>window.lab);
      assert.equal(await touch.locator('#pause').textContent(),'Resume','reduced motion starts paused');
      await touch.locator('#pause').click();const control=touch.locator('[data-control="thrust:1"]');await control.scrollIntoViewIfNeeded();
      const box=await control.boundingBox(),cdp=await touchContext.newCDPSession(touch);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:1}]});
      await touch.waitForFunction(()=>window.lab.world.velocity[2]<-.1);
      await touch.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      const velocity=await touch.evaluate(()=>window.lab.world.velocity[2]);await touch.locator('#pause').click();
      await touch.waitForTimeout(150);assert.equal(await touch.evaluate(()=>window.lab.world.velocity[2]),velocity,'hidden-page cancellation clears touch thrust');
      await touch.goto(base+'demos/gpu-lab/index.html');await touch.waitForFunction(()=>window.lab);
      assert.equal(await touch.locator('#pause').textContent(),'Resume');assert.equal(await touch.evaluate(()=>window.lab.world.tick),0);
    }finally{await touchContext.close();}
    const unavailable=await context.newPage();unavailable.on('pageerror',e=>errors.push(e.message));
    await unavailable.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=()=>null;});
    for(const lab of ['gpu-lab','space-lab']){
      await unavailable.goto(base+'demos/'+lab+'/index.html');await unavailable.waitForFunction(()=>document.documentElement.dataset.labReady==='failed');
      assert.match(await unavailable.locator('#error').textContent(),/Canvas 2D/);
    }
    await unavailable.close();
    await page.goto(base+'demos/editor/index.html');await page.waitForFunction(()=>document.documentElement.dataset.editorReady==='ready');
    await page.locator('#optional-gpu').check();await page.waitForFunction(()=>document.querySelector('#graphics-controls').textContent.includes('no compatible GPU'));
    const download=page.waitForEvent('download');await page.locator('#export-game').click();const file=await download;assert.equal(file.suggestedFilename(),'game.html');
    const chunks=[];for await(const chunk of await file.createReadStream())chunks.push(chunk);
    await page.route(base+'exported-game.html',route=>route.fulfill({contentType:'text/html',body:Buffer.concat(chunks).toString('utf8').replace('mountGame(JSON','window.exportedRenderer=mountGame(JSON')}));
    await page.goto(base+'exported-game.html');
    await page.waitForFunction(()=>document.querySelector('#controls').textContent.includes('CPU · no compatible GPU'));
    await page.waitForFunction(()=>{const c=document.querySelector('#view'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<p.length;i+=4)if(p[i]+p[i+1]+p[i+2]>100)return true;return false;});
    await page.getByRole('button',{name:'Pause',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Resume',exact:true}).count(),1);
    await page.getByRole('button',{name:'Resume',exact:true}).click();
    assert.equal(await page.evaluate(()=>document.activeElement.id),'view');
    const sumZ=()=>Array.from(window.exportedRenderer.meshes.values()).reduce((sum,m)=>sum+m.data.reduce((n,v,i)=>n+(i%6===2?v:0),0),0);
    const z=await page.evaluate(sumZ);await page.keyboard.down('w');
    await page.waitForFunction(z=>Array.from(window.exportedRenderer.meshes.values()).reduce((sum,m)=>sum+m.data.reduce((n,v,i)=>n+(i%6===2?v:0),0),0)<z-1,z);await page.keyboard.up('w');
    await page.getByRole('button',{name:'Use CPU',exact:true}).click();assert.equal(await page.evaluate(()=>document.activeElement.id),'view');
    await page.keyboard.press('Space');assert.equal(await page.getByRole('button',{name:'Pause',exact:true}).count(),1);
    const large=largeEditorProject();
    await page.route(base+'large-game.html',route=>route.fulfill({contentType:'text/html',body:exportGame(large.scene,large.library).replace('mountGame(JSON','window.exportedRenderer=mountGame(JSON')}));
    await page.goto(base+'large-game.html');await page.waitForFunction(()=>window.exportedRenderer?.stats().frames>1);
    assert.deepEqual(await page.evaluate(()=>Array.from(window.exportedRenderer.meshes.values(),m=>m.data.length/6)),[65535,513]);
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    assert.deepEqual(errors,[]);console.log('Distinct CPU labs: sculpture presets/budgets/parity/idle, flight gates, docking, shots, orbit trail, fresh inputs, 320px/Canvas failure and editor exports PASS');
  }finally{await context.close();}
}
