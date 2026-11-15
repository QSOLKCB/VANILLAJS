// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
async function press(page,index){
  await page.evaluate(i=>testPad.buttons[i].pressed=true,index);await page.waitForTimeout(70);
  await page.evaluate(i=>testPad.buttons[i].pressed=false,index);await page.waitForTimeout(70);
}
export async function checkSubHunt(browser,base){
  await mkdir('browser-artifacts',{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(base+'demos/subhunt-lab/index.html');await page.waitForFunction(()=>!!window.subhunt);
    // Lab preferences must not overwrite the standalone game's records on a shared origin.
    await page.evaluate(()=>localStorage.setItem('subhunt-best-v1','9876'));
    await page.locator('#mode-pond').click();await page.locator('#difficulty-cadet').click();
    await page.reload();assert.equal(await page.locator('#mode-pond').getAttribute('aria-pressed'),'true');
    await page.locator('#launch').focus();await page.keyboard.press('Space');
    await page.waitForFunction(()=>subhunt.snapshot().state.tick>3);
    const x=await page.evaluate(()=>subhunt.snapshot().state.player.x);
    await page.keyboard.down('ArrowRight');await page.waitForTimeout(250);await page.keyboard.up('ArrowRight');
    assert.ok(await page.evaluate(x=>subhunt.snapshot().state.player.x>x+20,x));
    await page.locator('#sound').click();await page.waitForFunction(()=>subhunt.snapshot().soundtrack?.active);
    // Toolbar focus must not steal Space from combat.
    const shots=await page.evaluate(()=>subhunt.snapshot().state.stats.shots);
    await page.keyboard.press('Space');await page.waitForFunction(n=>subhunt.snapshot().state.stats.shots>n,shots);
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'),'true');
    await page.keyboard.press('Escape');const frozen=await page.evaluate(()=>subhunt.snapshot().state);
    await page.waitForTimeout(120);assert.deepEqual(await page.evaluate(()=>subhunt.snapshot().state),frozen);
    assert.equal(await page.evaluate(()=>subhunt.snapshot().soundtrack.active),false);
    await page.locator('#resume').click();await page.waitForFunction(()=>subhunt.snapshot().soundtrack.active);
    await page.locator('#music').click();await page.waitForFunction(()=>!subhunt.snapshot().soundtrack.active);
    assert.equal(await page.evaluate(()=>subhunt.snapshot().sound),true);
    await page.locator('#music').click();await page.waitForFunction(()=>subhunt.snapshot().soundtrack.active);
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.evaluate(()=>subhunt.snapshot().paused),true);
    assert.equal(await page.evaluate(()=>subhunt.snapshot().soundtrack.active),false);
    const pending=page.waitForEvent('download');await page.locator('#download-track').click();const download=await pending;
    const wav=await readFile(await download.path());
    assert.equal(createHash('sha256').update(wav).digest('hex'),'c764fe7f498ac40bb6dbb2856cbb906f021817736db4798bb7ecb2cad6834a3a');
    await writeFile('browser-artifacts/subhunt-porcelain-patrol.wav',wav);
    await page.locator('#pause-menu').click();await page.locator('#role-sub').click();await page.locator('#launch').click();
    const y=await page.evaluate(()=>subhunt.snapshot().state.player.y);
    await page.keyboard.down('ArrowDown');await page.waitForTimeout(250);await page.keyboard.up('ArrowDown');
    assert.ok(await page.evaluate(y=>subhunt.snapshot().state.player.y>y+20,y));
    await page.keyboard.press('Space');await page.waitForFunction(()=>subhunt.snapshot().state.stats.shots>0);
    await page.screenshot({path:'browser-artifacts/subhunt-desktop.png',fullPage:true});
    await page.keyboard.press('Escape');await page.locator('#pause-menu').click();
    // Learn a swapped USB face layout and axes beyond the first pair in the real UI.
    await page.evaluate(()=>{
      window.testPad={id:'SubHunt raw USB test',index:0,mapping:'',connected:true,axes:[0,0,1,0],buttons:Array.from({length:16},()=>({pressed:false}))};
      navigator.getGamepads=()=>[testPad];
    });
    await page.locator('#controller-setup').click();await page.evaluate(()=>testPad.axes[2]=0);
    await page.waitForFunction(()=>!subhunt.snapshot().calibration.waiting);
    const bindings=[['b',3],['b',0],['b',7],['b',6],['b',1],['a',2,-1],['a',2,1],['a',3,-1],['a',3,1]];
    for(let i=0;i<bindings.length;i++){
      await page.evaluate(b=>{if(b[0]==='b')testPad.buttons[b[1]].pressed=true;else testPad.axes[b[1]]=b[2];},bindings[i]);
      await page.waitForFunction(i=>subhunt.snapshot().calibration.step===i+1,i);
      await page.evaluate(()=>{testPad.buttons.forEach(b=>b.pressed=false);testPad.axes.fill(0);});
      if(i<8)await page.waitForFunction(()=>!subhunt.snapshot().calibration.waiting);else await page.waitForFunction(()=>subhunt.snapshot().calibration===null);
    }
    assert.equal(await page.evaluate(()=>subhunt.snapshot().controllerProfile.buttons.fire),3);
    const saved=await page.evaluate(()=>localStorage.getItem('vanillajs-subhunt-controllers-v1'));
    await page.locator('#controller-setup').click();await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>localStorage.getItem('vanillajs-subhunt-controllers-v1')),saved);
    await page.waitForTimeout(80);await press(page,3);await page.waitForFunction(()=>subhunt.snapshot().screen==='playing');
    await page.evaluate(()=>testPad.axes[2]=1);await page.waitForTimeout(180);await page.evaluate(()=>testPad.axes[2]=0);
    await press(page,0);assert.ok(await page.evaluate(()=>subhunt.snapshot().state.stats.pings)>0);
    await page.evaluate(()=>testPad.connected=false);await page.waitForFunction(()=>subhunt.snapshot().paused);
    const disconnected=await page.evaluate(()=>subhunt.snapshot().state.tick);
    await page.evaluate(()=>{testPad.connected=true;testPad.buttons[3].pressed=true;});await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>subhunt.snapshot().state.tick),disconnected);
    await page.evaluate(()=>testPad.buttons[3].pressed=false);await page.waitForTimeout(80);await press(page,3);
    await page.waitForFunction(()=>!subhunt.snapshot().paused);
    await press(page,7);await press(page,0);await page.waitForFunction(()=>subhunt.snapshot().screen==='menu');
    await page.evaluate(()=>navigator.getGamepads=()=>[]);
    await page.screenshot({path:'browser-artifacts/subhunt-controller.png',fullPage:true});
    for(const width of [320,390,768]){
      await page.setViewportSize({width,height:900});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      const card=await page.locator('#start-card').boundingBox(),frame=await page.locator('#viewport').boundingBox();
      assert.ok(card.y>=frame.y&&card.y+card.height<=frame.y+frame.height);
      await page.locator('#launch').click();await page.locator('[data-control="fire"]').click();
      await page.waitForFunction(()=>subhunt.snapshot().state.stats.shots>0);
      await page.screenshot({path:`browser-artifacts/subhunt-${width}.png`,fullPage:true});
      await page.keyboard.press('Escape');await page.locator('#pause-menu').click();
    }
    assert.equal(await page.evaluate(()=>localStorage.getItem('subhunt-best-v1')),'9876');
    await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await context.setOffline(true);await page.reload();await page.locator('#launch').click();
    await page.waitForFunction(()=>subhunt.snapshot().state.tick>3&&subhunt.snapshot().soundtrack?.active);
    await context.setOffline(false);assert.deepEqual(errors,[]);
  }finally{await context.close();}
  // A failed playback device cannot freeze the game loop or fabricate a music PASS.
  const unavailable=await browser.newContext(),silent=await unavailable.newPage();
  try{
    await silent.addInitScript(()=>{window.AudioContext=class{
      state='running';resume(){return Promise.resolve();}createBuffer(){throw Error('test device unavailable');}createBufferSource(){throw Error('unavailable');}
      createOscillator(){return {type:'sine',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){},disconnect(){}};}
      createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
    };});
    await silent.goto(base+'demos/subhunt-lab/index.html');await silent.locator('#launch').click();await silent.locator('#sound').click();
    await silent.waitForFunction(()=>!subhunt.snapshot().sound&&subhunt.snapshot().state.tick>30);
    assert.ok((await silent.locator('#toast').textContent()).includes('continues in silence'));
  }finally{await unavailable.close();}
  console.log('SubHunt: native modules, both roles, Pond race, difficulty, raw controller calibration/reconnect, PCM hash, pause/mute, mobile, offline and device-failure fallback passed.');
}
