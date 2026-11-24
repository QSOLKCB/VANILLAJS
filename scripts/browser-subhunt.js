// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
async function press(page,index){
  // Polling is frame-driven. Wall-clock pulses can disappear between slow frames.
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.evaluate(i=>testPad.buttons[i].pressed=true,index);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.evaluate(i=>testPad.buttons[i].pressed=false,index);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
// The mobile controls scroll the live canvas off centre. Capture the whole page
// through the ordinary viewport compositor, preserving the tested portrait layout.
// Hosted headless Chromium twice timed out capturing beyond the viewport here.
export async function captureMobilePage(page,width){
  const viewport=page.viewportSize();
  const layout=()=>{
    const bounds=selector=>{
      const rect=document.querySelector(selector).getBoundingClientRect();
      return [rect.x+scrollX,rect.y+scrollY,rect.width,rect.height];
    };
    return {width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,
      game:bounds('#viewport'),controls:bounds('.touch-controls'),footer:bounds('footer')};
  };
  const original=await page.evaluate(layout),scroll=await page.evaluate(()=>scrollY);
  assert.equal(original.width,width);
  assert.ok(original.height>=viewport.height&&original.height<=8192,'bounded mobile document height');
  let frozen=false,tick;
  try{
    await page.setViewportSize({width,height:original.height});
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    assert.deepEqual(await page.evaluate(layout),original,'full mobile document must retain its layout');
    // Stop the live canvas repainting while Chromium captures the composed page.
    await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+100));
    frozen=true;
    const before=await page.evaluate(()=>subhunt.snapshot());
    assert.equal(before.screen,'playing');
    assert.equal(before.paused,false);
    tick=before.state.tick;
    let png;
    try{
      png=await page.screenshot({path:`browser-artifacts/subhunt-${width}.png`});
    }catch(error){
      if(error.name!=='TimeoutError')throw error;
      console.warn(`SubHunt ${width}px screenshot timed out; resetting viewport and retrying once`);
      await page.setViewportSize(viewport);
      await page.setViewportSize({width,height:original.height});
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      assert.deepEqual(await page.evaluate(layout),original,'retried mobile document must retain its layout');
      png=await page.screenshot({path:`browser-artifacts/subhunt-${width}.png`});
    }
    assert.equal(png.readUInt32BE(16),width,'captured PNG width');
    assert.equal(png.readUInt32BE(20),original.height,'captured PNG must include the complete document');
    assert.equal(await page.evaluate(()=>subhunt.snapshot().state.tick),tick,'capture must not advance the game');
  }finally{
    try{
      await page.setViewportSize(viewport);
      await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),scroll);
    }finally{
      if(frozen)await page.clock.resume();
    }
  }
  await page.waitForFunction(tick=>subhunt.snapshot().state.tick>tick,tick);
}
export async function checkSubHunt(browser,base){
  await mkdir('browser-artifacts',{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.clock.install();
    await page.goto(base+'demos/subhunt-lab/index.html');await page.waitForFunction(()=>!!window.subhunt);
    // Lab preferences must not overwrite the standalone game's records on a shared origin.
    await page.evaluate(()=>localStorage.setItem('subhunt-best-v1','9876'));
    await page.locator('#mode-pond').click();await page.locator('#difficulty-cadet').click();
    await page.reload();assert.equal(await page.locator('#mode-pond').getAttribute('aria-pressed'),'true');
    await page.locator('#launch').focus();await page.keyboard.press('Space');
    await page.waitForFunction(()=>subhunt.snapshot().state.tick>3);
    // Verify real displacement; a fixed wall-clock pulse can span too few rendered frames in CI.
    const x=await page.evaluate(()=>subhunt.snapshot().state.player.x);
    await page.keyboard.down('ArrowRight');
    try{await page.waitForFunction(x=>subhunt.snapshot().state.player.x>x+20,x,{timeout:5000});}
    finally{await page.keyboard.up('ArrowRight');}
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
    await page.keyboard.down('ArrowDown');
    try{await page.waitForFunction(y=>subhunt.snapshot().state.player.y>y+20,y,{timeout:5000});}
    finally{await page.keyboard.up('ArrowDown');}
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
      await captureMobilePage(page,width);
      await page.keyboard.press('Escape');await page.locator('#pause-menu').click();
    }
    assert.equal(await page.evaluate(()=>localStorage.getItem('subhunt-best-v1')),'9876');
    await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    await context.setOffline(true);await page.reload();await page.locator('#launch').click();
    await page.waitForFunction(()=>subhunt.snapshot().state.tick>3&&subhunt.snapshot().soundtrack?.active);
    await context.setOffline(false);assert.deepEqual(errors,[]);
  }finally{await context.close();}
  // v0.3.0 recovery matrix: playback/export failures cannot freeze either game.
  for(const mode of ['campaign','pond'])for(const role of ['boat','sub'])for(const remembered of [false,true]){
    const context=await browser.newContext(),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.addInitScript(remembered=>{
        if(remembered)localStorage.setItem('vanillajs-subhunt-preferences-v1',JSON.stringify({sound:true,music:true}));
        window.failMusic=true;window.failWav=false;
        const create=AudioContext.prototype.createBuffer,write=DataView.prototype.setInt16;
        AudioContext.prototype.createBuffer=function(...args){if(window.failMusic)throw Error('injected music device failure');return create.apply(this,args);};
        DataView.prototype.setInt16=function(...args){if(window.failWav)throw Error('injected WAV write failure');return write.apply(this,args);};
      },remembered);
      await page.goto(base+'demos/subhunt-lab/index.html');
      await page.locator('#mode-'+mode).click();await page.locator('#role-'+role).click();await page.locator('#launch').click();
      if(!remembered)await page.locator('#sound').click();
      await page.waitForFunction(()=>subhunt.snapshot().sound&&!subhunt.snapshot().music);
      assert.ok((await page.locator('#toast').textContent()).includes('Soundtrack unavailable'));
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vanillajs-subhunt-preferences-v1')).music),true);
      const before=await page.evaluate(()=>subhunt.snapshot().state);
      await page.keyboard.down('ArrowRight');await page.keyboard.down('Space');
      await page.waitForFunction(t=>subhunt.snapshot().state.tick>t+12,before.tick);
      await page.keyboard.up('Space');await page.keyboard.up('ArrowRight');
      const after=await page.evaluate(()=>subhunt.snapshot().state);
      assert.ok(after.player.x>before.player.x&&after.stats.shots>before.stats.shots&&after.timeLeft<before.timeLeft);
      if(mode==='pond')assert.notEqual(after.targets[0].x,before.targets[0].x);
      await page.keyboard.press('Escape');const frozen=await page.evaluate(()=>subhunt.snapshot().state);
      await page.waitForTimeout(120);assert.deepEqual(await page.evaluate(()=>subhunt.snapshot().state),frozen);
      await page.locator('#resume').click();await page.waitForFunction(t=>subhunt.snapshot().state.tick>t+3,frozen.tick);
      await page.locator('#music').click();await page.waitForFunction(()=>!subhunt.snapshot().music);
      await page.evaluate(()=>window.failWav=true);await page.locator('#download-track').click();
      const tick=await page.evaluate(()=>subhunt.snapshot().state.tick);
      await page.waitForFunction(t=>subhunt.snapshot().state.tick>t+3,tick);
      await page.evaluate(()=>{window.failMusic=false;window.failWav=false;});await page.locator('#music').click();
      await page.waitForFunction(()=>subhunt.snapshot().soundtrack?.active);
      assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }
  await checkSubHuntPreferences(browser,base);
  console.log('SubHunt: native modules, both roles, Pond race, difficulty, raw controller calibration/reconnect, PCM hash, pause/mute, mobile, offline, eight recovery cases and preference persistence passed.');
}

export async function checkSubHuntPreferences(browser,base){
  for(const [failure,preferred] of [['wav',true],['playback',true],['wav',false]]){
    const context=await browser.newContext(),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.addInitScript(({failure,preferred})=>{
        const key='vanillajs-subhunt-preferences-v1';
        if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify({sound:true,music:preferred}));
        const broken=sessionStorage.getItem('music-recovered')!=='true';
        const create=AudioContext.prototype.createBuffer,write=DataView.prototype.setInt16;
        AudioContext.prototype.createBuffer=function(...args){if(broken&&failure==='playback')throw Error('injected playback failure');return create.apply(this,args);};
        DataView.prototype.setInt16=function(...args){if(broken&&failure==='wav')throw Error('injected export failure');return write.apply(this,args);};
      },{failure,preferred});
      await page.goto(base+'demos/subhunt-lab/index.html');await page.locator('#launch').click();
      if(failure==='wav')await page.locator('#download-track').click();
      await page.waitForFunction(()=>!subhunt.snapshot().music);
      assert.match(await page.locator('#toast').textContent(),/Soundtrack unavailable/);
      const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('vanillajs-subhunt-preferences-v1')).music);
      await page.locator('#effects').click();
      assert.equal(await saved(),preferred,`${failure}: FX must preserve saved music intent`);
      for(let i=0;i<2;i++){
        await page.locator('#sound').click();
        assert.equal(await saved(),preferred,`${failure}: SOUND must preserve saved music intent`);
      }
      await page.evaluate(()=>sessionStorage.setItem('music-recovered','true'));
      await page.reload();assert.equal(await page.locator('#music').getAttribute('aria-pressed'),String(preferred));
      await page.locator('#launch').click();
      if(preferred)await page.waitForFunction(()=>subhunt.snapshot().soundtrack?.active);
      else {
        await page.waitForFunction(()=>subhunt.snapshot().state.tick>3);
        assert.equal(await page.evaluate(()=>!!subhunt.snapshot().soundtrack?.active),false);
        await page.locator('#music').click();await page.waitForFunction(()=>subhunt.snapshot().soundtrack?.active);
      }
      // An explicit MUSIC-off choice still persists, including after recovery.
      await page.locator('#music').click();assert.equal(await saved(),false);
      await page.locator('#effects').click();await page.reload();
      assert.equal(await page.locator('#music').getAttribute('aria-pressed'),'false');
      assert.deepEqual(errors,[]);
    }finally{await context.close();}
  }
}
