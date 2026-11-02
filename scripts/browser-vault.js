// CI-only checks of the packaged game, using ordinary controls and local files.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PUZZLES,solvePuzzle,applyCommand} from '../demos/clockwork-vault/puzzles.js';
import {importVault} from '../demos/clockwork-vault/world.js';
export async function verifyVault(browser,baseURL){
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
  const word=()=>page.locator('#lock-word').textContent();
  const freeze=()=>page.evaluate(()=>({z:document.querySelector('#position-z').textContent,height:document.querySelector('#height').textContent,
    elapsed:document.querySelector('#elapsed').textContent,word:document.querySelector('#lock-word').textContent,
    phase:document.querySelector('#lock-phase').textContent,cam:document.querySelector('#lock-cam').getAttribute('transform'),count:document.querySelector('#seal-count').textContent}));
  const restore=async data=>page.locator('#replay-file').setInputFiles({name:'vault.json',mimeType:'application/json',buffer:Buffer.from(typeof data==='string'?data:JSON.stringify(data))});
  async function approach(){
    await page.locator('#vault-view').focus();await page.keyboard.down('w');
    await page.waitForFunction(()=>!document.querySelector('#interact').disabled,null,{timeout:30000});await page.keyboard.up('w');await page.locator('#interact').click();
    await page.locator('#console-panel').waitFor({state:'visible'});
  }
  async function solve(index){
    let current=Number.parseInt(await word(),16);
    for(const command of solvePuzzle(index,current).commands){
      current=applyCommand(index,current,command);
      if(command===0)await page.locator('#turn').click();else await page.locator(`[data-lever="${command}"]`).click();
      await page.waitForFunction(value=>Number.parseInt(document.querySelector('#lock-word').textContent,16)===value,current);
    }
    assert.equal(await page.locator('#engage').isDisabled(),false);await page.locator('#engage').click();
    await page.waitForFunction(n=>document.querySelector('#seal-count').textContent===`${String(n).padStart(2,'0')} / 06 SEALS`,index+1);
  }
  await page.goto(baseURL);await page.locator('.vault-link').click();assert.match(page.url(),/\/VANILLAJS\/demos\/clockwork-vault\/index.html$/);
  assert.equal(await page.locator('#status').textContent(),'READY');assert.equal(await page.locator('#interact').isDisabled(),true);
  const pixels=await page.locator('#vault-view').evaluate(canvas=>new Promise(resolve=>requestAnimationFrame(()=>{
    const gl=canvas.getContext('webgl'),data=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);
    let bright=0;for(let i=0;i<data.length;i+=4)if(data[i]+data[i+1]+data[i+2]>110)bright++;resolve(bright);
  })));assert.ok(pixels>500,'the chamber must draw visible WebGL geometry');
  await page.screenshot({path:'browser-artifacts/clockwork-vault.png',fullPage:true});
  await page.locator('#launch').click();await page.keyboard.down('w');await page.waitForFunction(()=>parseFloat(document.querySelector('#position-z').textContent)<3.3);
  await page.keyboard.press('Escape');const paused=await freeze();await page.waitForTimeout(180);assert.deepEqual(await freeze(),paused);
  await page.locator('#launch').click();await page.keyboard.down('w');await page.waitForTimeout(400);
  assert.ok(Number(paused.z)-Number(await page.locator('#position-z').textContent())<.4,'a held repeat must not restart walking');
  await page.keyboard.up('w');await approach();assert.equal(await page.locator('#console-title').textContent(),PUZZLES[0].name);
  await page.locator('#crank').click();assert.match(await page.locator('#lock-phase').textContent(),/^1 \/ 8/);assert.equal(await word(),'0x1234');
  assert.equal(await page.locator('[data-lever="1"]').isDisabled(),true);await page.locator('#undo').click();assert.match(await page.locator('#lock-phase').textContent(),/^0 \/ 8/);
  await page.locator('#hint').click();await page.waitForFunction(()=>document.querySelector('#hint-copy').textContent.includes('Shortest route: 2'));
  await page.locator('#turn').click();await page.waitForFunction(()=>/^[2-6] \/ 8/.test(document.querySelector('#lock-phase').textContent));
  await page.keyboard.press('Escape');const pending=await freeze();await page.waitForTimeout(220);assert.deepEqual(await freeze(),pending);
  const downloadPromise=page.waitForEvent('download');await page.locator('#save').click();const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),'clockwork-vault-v1.json');const saved=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.equal(saved.console,0);assert.equal(saved.locks[0].motor,true);assert.ok(saved.locks[0].detents>0);assert.doesNotThrow(()=>importVault(saved));
  await page.locator('#restart').click();await restore(saved);await page.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('Replay restored'));
  assert.equal(await page.locator('#status').textContent(),'PAUSED');await page.locator('#launch').click();
  await page.waitForFunction(()=>document.querySelector('#lock-word').textContent==='0xEB79');await page.locator('#undo').click();assert.equal(await word(),'0x1234');
  await page.locator('[data-lever="1"]').click();assert.equal(await word(),'0x1235');await page.locator('#undo').click();
  await page.locator('#crank').focus();await page.keyboard.down('Space');assert.match(await page.locator('#lock-phase').textContent(),/^1 \/ 8/);
  await page.keyboard.press('Escape');await page.locator('#launch').click();await page.keyboard.down('Space');await page.keyboard.up('Space');
  assert.match(await page.locator('#lock-phase').textContent(),/^1 \/ 8/);await page.locator('#undo').click();
  await page.locator('#turn').click();await page.waitForFunction(()=>document.querySelector('#lock-word').textContent==='0xEB79');
  await page.locator('[data-lever="1"]').click();assert.equal(await word(),'0xEB78');
  await page.screenshot({path:'browser-artifacts/clockwork-console.png',fullPage:false});
  const engage=await page.locator('#engage').boundingBox();await page.mouse.move(engage.x+engage.width/2,engage.y+engage.height/2);await page.mouse.down();
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();assert.equal(await page.locator('#seal-count').textContent(),'00 / 06 SEALS');
  await page.locator('#launch').click();await page.locator('#engage').click();assert.equal(await page.locator('#seal-count').textContent(),'01 / 06 SEALS');
  // Four more locks, reached by walking through the real gates and causeway.
  for(let index=1;index<5;index++){await approach();await solve(index);}
  // Wait at the lower landing, board, ride and leave the actual moving collider.
  await page.locator('#vault-view').focus();await page.keyboard.down('w');await page.waitForFunction(()=>parseFloat(document.querySelector('#position-z').textContent)<-42.1);await page.keyboard.up('w');
  await page.waitForFunction(()=>document.querySelector('#lift-state').textContent==='LOWER LANDING',null,{timeout:20000});
  await page.keyboard.down('w');await page.waitForFunction(()=>document.querySelector('#support').textContent==='lift'&&parseFloat(document.querySelector('#position-z').textContent)<-44.5);await page.keyboard.up('w');
  await page.waitForFunction(()=>parseFloat(document.querySelector('#height').textContent)>.5);
  await page.keyboard.press('Escape');const riding=await freeze();await page.waitForTimeout(200);assert.deepEqual(await freeze(),riding);
  await page.screenshot({path:'browser-artifacts/clockwork-lift.png',fullPage:true});await page.locator('#launch').click();
  await page.waitForFunction(()=>parseFloat(document.querySelector('#height').textContent)>=1.99,null,{timeout:15000});
  await approach();assert.equal(await page.locator('#console-title').textContent(),PUZZLES[5].name);await solve(5);
  await page.locator('#vault-view').focus();await page.keyboard.down('w');await page.waitForFunction(()=>document.querySelector('#status').textContent==='COMPLETE',null,{timeout:15000});await page.keyboard.up('w');
  assert.equal(await page.locator('#seal-count').textContent(),'06 / 06 SEALS');assert.equal(await page.locator('#rescues').textContent(),'0');
  assert.ok(parseFloat(await page.locator('#position-z').textContent())<-59);await page.screenshot({path:'browser-artifacts/clockwork-complete.png',fullPage:true});
  // Atomic rejection, future-version rejection, oversize files and stale reads.
  await restore(saved);await page.waitForFunction(()=>document.querySelector('#status').textContent==='PAUSED');const beforeBad=await freeze();
  const bad=structuredClone(saved);bad.locks[0].word=0;
  for(const invalid of [bad,{...saved,levelSet:'future'},'{',' '.repeat(65537)]){
    await page.evaluate(()=>{document.querySelector('#message').textContent='Awaiting file';document.querySelector('#message').classList.remove('error');});
    await restore(invalid);await page.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('Replay rejected'));
    assert.deepEqual(await freeze(),beforeBad);
  }
  await page.evaluate(data=>{const original=File.prototype.text;File.prototype.text=function(){File.prototype.text=original;return new Promise(resolve=>{window.finishVaultRead=()=>resolve(JSON.stringify(data));});};},saved);
  await restore(saved);await page.waitForFunction(()=>typeof window.finishVaultRead==='function');await page.locator('#restart').click();
  await page.evaluate(()=>window.finishVaultRead());await page.waitForTimeout(100);assert.equal(await page.locator('#status').textContent(),'READY');assert.equal(await page.locator('#position-z').textContent(),'5.00');
  await page.locator('#launch').click();await page.locator('#vault-view').click();await page.waitForFunction(()=>document.pointerLockElement?.id==='vault-view');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#status').textContent==='PAUSED');
  await page.locator('#launch').click();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});
  assert.equal(await page.locator('#status').textContent(),'PAUSED');const hidden=await freeze();await page.waitForTimeout(150);assert.deepEqual(await freeze(),hidden);
  await page.locator('#vault-view').dispatchEvent('webglcontextlost');assert.equal(await page.locator('#status').textContent(),'UNAVAILABLE');assert.match(await page.locator('#error').textContent(),/context lost/);

  const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(baseURL+'demos/clockwork-vault/index.html');await mobile.locator('#launch').tap();
  const forward=mobile.locator('[data-hold="forward"]');await forward.scrollIntoViewIfNeeded();const box=await forward.boundingBox(),cdp=await mobile.context().newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:0}]});
  await mobile.waitForFunction(()=>!document.querySelector('#interact').disabled);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await mobile.locator('#interact').tap();await mobile.locator('#crank').tap();assert.match(await mobile.locator('#lock-phase').textContent(),/^1 \/ 8/);await mobile.locator('#undo').tap();
  await mobile.locator('#turn').tap();await mobile.waitForFunction(()=>document.querySelector('#lock-word').textContent==='0xEB79');
  await mobile.locator('[data-lever="1"]').tap();assert.equal(await mobile.locator('#engage').isDisabled(),false);
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390 px console fits');await mobile.screenshot({path:'browser-artifacts/clockwork-console-mobile.png',fullPage:false});
  await mobile.locator('#engage').tap();await mobile.locator('#pause').tap();assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390 px game fits');
  await mobile.screenshot({path:'browser-artifacts/clockwork-vault-mobile.png',fullPage:true});await mobile.setViewportSize({width:320,height:700});
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'320 px game fits');
  const unsupported=await browser.newPage();unsupported.on('pageerror',e=>errors.push(e.message));await unsupported.addInitScript(()=>HTMLCanvasElement.prototype.getContext=()=>null);
  await unsupported.goto(baseURL+'demos/clockwork-vault/index.html');assert.match(await unsupported.locator('#error').textContent(),/WebGL is unavailable/);assert.equal(await unsupported.locator('#launch').isDisabled(),true);
  assert.deepEqual(errors,[]);await Promise.all([page.close(),mobile.close(),unsupported.close()]);
  console.log('Clockwork Vault: visible chamber, all six locks and physical exit, gate/causeway/lift traversal with zero rescues, staged motor/undo/hints, real partial JSON download/restore, invalid/stale files, fresh keys, cancelled pointer, native mouse capture, pause/blur/hidden, WebGL failure and 390/320 px touch-emulated layouts passed.');
}
