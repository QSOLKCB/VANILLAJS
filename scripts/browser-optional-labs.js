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
      await page.waitForFunction(()=>window.lab.renderer.stats().frames>2);
      assert.equal(await page.evaluate(()=>window.lab.renderer.mode),'cpu');
      const bright=await page.locator('#view').evaluate(c=>{const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<p.length;i+=4)if(p[i]+p[i+1]+p[i+2]>80)n++;return n;});
      assert.ok(bright>100,'CPU draws visible geometry');
      assert.equal(await page.getByRole('button',{name:'CPU · no compatible GPU'}).isDisabled(),true);
      if(lab==='gpu-lab'){await page.locator('#parity').click();await page.waitForFunction(()=>document.querySelector('#result').textContent.startsWith('PASS'));}
      else{
        await page.locator('#mechanic').selectOption('broadside');await page.locator('#view').focus();await page.keyboard.down('Space');await page.waitForFunction(()=>window.lab.world.hits>0);await page.keyboard.up('Space');
        await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const tick=await page.evaluate(()=>window.lab.world.tick);await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>window.lab.world.tick),tick);
        await page.getByRole('button',{name:'Resume',exact:true}).click();
        assert.equal(await page.evaluate(()=>document.activeElement.id),'view');
        const z=await page.evaluate(()=>window.lab.world.position[2]);await page.keyboard.down('w');
        await page.waitForFunction(z=>window.lab.world.position[2]<z-.1,z);await page.keyboard.up('w');
        await page.getByRole('button',{name:'Use CPU',exact:true}).click();assert.equal(await page.evaluate(()=>document.activeElement.id),'view');
      }
    }
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
    assert.deepEqual(errors,[]);console.log('CPU labs, parity, mechanics, editor export PASS');
  }finally{await context.close();}
}
