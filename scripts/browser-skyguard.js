// SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeScore} from '../demos/skyguard-lab/js/audio.js';
import {checkSkyguardUpgrade} from './skyguard-upgrade-check.mjs';
export async function checkSkyguard(browser,base){
  await mkdir('browser-artifacts',{recursive:true});
  const receipt={status:'RUNNING',browser:browser.version(),checks:[],errors:[]},context=await browser.newContext({viewport:{width:1536,height:960}}),page=await context.newPage();
  page.on('pageerror',e=>receipt.errors.push(e.message));
  await context.addInitScript(()=>{
    // Presentation observer only: the 1.5 px centre dot is the rendered reticle.
    const arc=CanvasRenderingContext2D.prototype.arc;CanvasRenderingContext2D.prototype.arc=function(x,y,r,...rest){if(this.canvas.id==='field'&&r===1.5)window.reticleDraw={x,y};return arc.call(this,x,y,r,...rest);};
    if(!localStorage.getItem('vanillajs-skyguard-v1'))localStorage.setItem('vanillajs-skyguard-v1',JSON.stringify({fx:false,music:false,display:'fit'}));
  });
  const snap=()=>page.evaluate(()=>skyguard.snapshot()),advance=n=>page.evaluate(n=>skyguard.advance(n),n);
  const check=async(name,fn)=>{await fn();receipt.checks.push(name);console.log('Skyguard PASS: '+name);};
  const move=async(x,y)=>{const b=await page.locator('#field').boundingBox(),scale=Math.min(b.width/1152,b.height/720);await page.mouse.move(b.x+(b.width-1152*scale)/2+x*scale,b.y+(b.height-720*scale)/2+y*scale);};
  const fitted=async()=>{const d=await page.evaluate(()=>{const c=document.querySelector('#field').getBoundingClientRect(),fire=document.querySelector('#touch-fire').getBoundingClientRect();return {left:c.left,right:c.right,bottom:c.bottom,height:c.height,fire:fire.bottom,width:innerWidth,view:innerHeight,scroll:document.documentElement.scrollWidth};});assert.ok(d.left>=0&&d.right<=d.width&&d.bottom<=d.view&&d.fire<=d.view&&d.height>30&&d.scroll<=d.width,JSON.stringify(d));};
  const aligned=async()=>{const d=await page.evaluate(()=>({draw:window.reticleDraw,aim:skyguard.snapshot().aim}));assert.ok(Math.hypot(d.draw.x-d.aim.x,d.draw.y-d.aim.y)<.01,'drawn aim matches pointer mapping');};
  try{
    await page.goto(base+'demos/skyguard-lab/index.html?test=1');await page.waitForFunction(()=>!!window.skyguard);
    await check('briefing, ship manual, default Cadet and keyboard deployment',async()=>{
      assert.equal(await page.locator('#difficulty').inputValue(),'cadet');await fitted();await page.screenshot({path:'browser-artifacts/skyguard-briefing.png'});
      await page.locator('#manual-open').click();assert.ok(await page.locator('#manual').isVisible());assert.match(await page.locator('#manual').textContent(),/SEASPEAR/);await page.locator('#manual-close').click();
      await page.locator('#deploy').focus();await page.keyboard.press('Space');await advance(1);assert.equal((await snap()).screen,'game');assert.equal((await snap()).state.total,8);
    });
    await check('absolute pointer, keyboard aiming, toolbar Space, reload and heat',async()=>{
      await move(800,220);await advance(1);await aligned();assert.ok(Math.abs((await snap()).state.aim.x-800)<.1);
      await page.keyboard.down('ArrowLeft');await advance(8);await page.keyboard.up('ArrowLeft');assert.ok((await snap()).state.aim.x<760);
      await page.locator('#sound').click();await page.keyboard.down('Space');await advance(15);await page.keyboard.up('Space');assert.ok((await snap()).state.shots>0,'Space fires after a toolbar click');await page.locator('#sound').click();
      await page.keyboard.press('KeyR');await advance(1);assert.ok((await snap()).state.weapon.reload>0);await advance(150);assert.equal((await snap()).state.weapon.ammo,80);
      await page.keyboard.down('Space');await advance(140);await page.keyboard.up('Space');assert.ok((await snap()).state.weapon.overheated);await advance(150);assert.ok(!(await snap()).state.weapon.overheated);
    });
    await check('focus, repeated held keys and history restore require explicit resume',async()=>{
      await page.keyboard.down('Space');await advance(1);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const before=(await snap()).state;await advance(40);assert.deepEqual((await snap()).state,before);await page.keyboard.up('Space');await page.locator('#resume').click();
      const shots=(await snap()).state.shots;await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',repeat:true,bubbles:true,cancelable:true})));await advance(15);assert.equal((await snap()).state.shots,shots);
      await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));assert.ok((await snap()).paused);await page.locator('#quit').click();await page.locator('#deploy').click();
    });
    await check('native fullscreen, denied fullscreen, windowed mode and four fitted sizes',async()=>{
      await page.locator('#display').selectOption('fullscreen');await page.waitForFunction(()=>document.fullscreenElement?.id==='app');assert.ok((await snap()).paused);await fitted();await page.locator('#resume').click();await move(400,280);await advance(1);await aligned();
      await page.evaluate(()=>document.exitFullscreen());await page.waitForFunction(()=>!document.fullscreenElement&&skyguard.snapshot().display.mode==='fit'&&skyguard.snapshot().paused);assert.ok((await snap()).paused);
      await page.evaluate(()=>document.querySelector('#app').requestFullscreen=()=>Promise.reject(Error('blocked fixture')));await page.locator('#display').selectOption('fullscreen');await page.waitForFunction(()=>skyguard.snapshot().display.message.includes('unavailable'));assert.equal((await snap()).display.mode,'fit');
      await page.locator('#display').selectOption('page');assert.equal((await snap()).display.mode,'page');await page.locator('#display').selectOption('fit');
      for(const [width,height] of [[1366,768],[844,390],[390,844],[320,568]]){await page.setViewportSize({width,height});await fitted();await page.screenshot({path:'browser-artifacts/skyguard-'+width+'x'+height+'.png'});}
      await page.setViewportSize({width:1536,height:960});await page.locator('#quit').click();await page.locator('#deploy').click();
    });
    // Play the real state machine through DOM handlers. The test clock only
    // advances accepted inputs; it cannot change aircraft, hull, ammo or offers.
    for(const [round,station] of [[1,'cannon'],[2,'flak'],[3,'missile'],[4,'rail']]){
      assert.equal((await snap()).state.station,station);
      await move(340+round*55,235);await advance(1);await aligned();
      if(station==='rail')await check('charged rail cancellation and independent touch pointers never discharge on cancel',async()=>{
        await page.keyboard.down('Space');await advance(45);assert.ok((await snap()).state.charge>0);const shots=(await snap()).state.shots;await page.locator('#pause').click();await page.keyboard.up('Space');await page.locator('#resume').click();await advance(1);assert.equal((await snap()).state.shots,shots);
        await page.evaluate(()=>{window.touchTrace=[];for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture'])addEventListener(type,e=>touchTrace.push({type,id:e.pointerId,target:e.target.id}));});
        const session=await context.newCDPSession(page);await session.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
        const b=await page.locator('#field').boundingBox(),f=await page.locator('#touch-fire').boundingBox(),aim={x:b.x+b.width*.45,y:b.y+b.height*.35,id:1},fire={x:f.x+f.width/2,y:f.y+f.height/2,id:2};
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[aim]});await advance(10);assert.equal((await snap()).state.charge,0,'aiming finger does not charge');
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[aim,fire]});await advance(40);assert.ok((await snap()).state.charge>=30);
        // Losing the aim pointer must not vent a charge held by the fire finger.
        await page.evaluate(()=>{const aim=touchTrace.find(e=>e.type==='pointerdown'&&e.target==='field');document.querySelector('#field').dispatchEvent(new PointerEvent('pointercancel',{pointerId:aim.id,pointerType:'touch',bubbles:true}));});await advance(1);assert.ok((await snap()).state.charge>=30);
        // CDP touchEnd lists the contacts to end, not the contacts to keep.
        await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[aim]});await advance(3);assert.ok((await snap()).state.charge>=30,'aim release preserves firing finger: '+JSON.stringify(await page.evaluate(()=>({events:touchTrace,charge:skyguard.snapshot().state.charge,shots:skyguard.snapshot().state.shots}))));
        await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await advance(1);assert.equal((await snap()).state.shots,shots);assert.equal((await snap()).state.charge,0);
        await session.send('Emulation.setTouchEmulationEnabled',{enabled:false});await session.detach();
        await page.locator('#touch-fire').hover();await page.mouse.down();await advance(40);await page.mouse.up();await advance(1);assert.equal((await snap()).state.shots,shots+1,'ordinary charged release fires exactly once');
      });
      await check(station+': clear an air raid through actual aim/fire handlers and select a persistent refit',async()=>{
        await advance(220);await page.screenshot({path:'browser-artifacts/skyguard-'+station+'.png'});
        const result=await page.evaluate(()=>{
          const canvas=document.querySelector('#field'),b=canvas.getBoundingClientRect(),scale=Math.min(b.width/1152,b.height/720),ox=b.x+(b.width-1152*scale)/2,oy=b.y+(b.height-720*scale)/2;let held=false;
          for(let ticks=0;ticks<12000;ticks+=4){const {state:s,screen}=skyguard.snapshot();if(screen!=='game')break;
            const target=s.enemies.reduce((a,b)=>!a||b.y>a.y?b:a,null);let x=target?.x??576,y=target?.y??250;
            if(target&&s.station==='cannon'){const t=Math.hypot(x-576,y-616)/24;x+=target.vx*t;y+=target.vy*t;}
            if(target&&s.station==='flak'){x+=target.vx*28;y+=target.vy*28;}
            canvas.dispatchEvent(new PointerEvent('pointermove',{pointerType:'mouse',clientX:ox+x*scale,clientY:oy+y*scale,bubbles:true}));
            const fire=!!target&&(s.station!=='rail'||s.charge<Math.round(36/(1+.14*s.upgrades.rail.cycle)));
            if(fire!==held){window.dispatchEvent(new KeyboardEvent(fire?'keydown':'keyup',{code:'Space',bubbles:true,cancelable:true}));held=fire;}skyguard.advance(4);
          }
          window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',bubbles:true}));return skyguard.snapshot();
        });
        assert.equal(result.screen,'upgrade',JSON.stringify({station,hp:result.state.hp,remaining:result.state.total-result.state.resolved}));assert.equal(result.state.round,round);assert.ok(result.state.hp>50);assert.equal(await page.locator('.upgrade-card').count(),3);
        const id=result.state.offers[0],old=result.state.upgrades[station][id];await page.locator('.upgrade-card').first().click();const next=await snap();assert.equal(next.state.round,round+1);if(id!=='repair')assert.equal(next.state.upgrades[station][id],old+1);
      });
    }
    await check('controller neutral interlock, disconnect, loss and restart',async()=>{
      await page.evaluate(()=>{window.skyPad={id:'emulated',index:0,mapping:'standard',connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({value:0,pressed:false}))};navigator.getGamepads=()=>[skyPad];});await advance(1);const before=(await snap()).state.shots;
      await page.evaluate(()=>{skyPad.axes[0]=.7;skyPad.buttons[7].value=1;});await advance(12);assert.ok((await snap()).state.shots>before);
      await page.evaluate(()=>skyPad.connected=false);await advance(1);assert.ok((await snap()).paused);await page.evaluate(()=>skyPad.connected=true);await page.locator('#resume').click();const frozen=(await snap()).state.shots;await advance(20);assert.equal((await snap()).state.shots,frozen);
      await page.evaluate(()=>navigator.getGamepads=()=>[]);await advance(1);if(!(await snap()).paused)await page.locator('#pause').click();await page.locator('#quit').click();await page.locator('#difficulty').selectOption('storm');await page.locator('#deploy').click();await advance(10000);assert.equal((await snap()).screen,'lost');await page.locator('#retry').click();assert.equal((await snap()).state.hp,100);assert.equal((await snap()).state.shots,0);await page.locator('#pause').click();await page.locator('#quit').click();
    });
    await check('all four complete naval WAV exports match pure synthesis',async()=>{
      await page.locator('#manual-open').click();
      for(const station of ['cannon','flak','missile','rail']){await page.locator('#soundtrack').selectOption(station);const downloaded=page.waitForEvent('download');await page.locator('#download-music').click();const bytes=await readFile(await (await downloaded).path()),hash=b=>createHash('sha256').update(b).digest('hex');assert.equal(hash(bytes),hash(makeScore(station).wav()));}
      await page.locator('#manual-close').click();
    });
    await check('offline reload uses the complete lab and its shared native module graph',async()=>{
      await page.evaluate(()=>navigator.serviceWorker.ready);await page.goto(base+'demos/skyguard-lab/index.html');await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&!!window.skyguard);await context.setOffline(true);await page.reload();await page.waitForFunction(()=>!!window.skyguard);await page.locator('#deploy').click();await page.waitForFunction(()=>skyguard.snapshot().state.tick>100);await context.setOffline(false);
    });
    await check('audio device failure preserves combat and saved music preference',async()=>{
      const broken=await browser.newContext(),p=await broken.newPage();try{
        await broken.addInitScript(()=>{localStorage.setItem('vanillajs-skyguard-v1',JSON.stringify({fx:true,music:true,display:'fit'}));window.AudioContext=function(){throw Error('fixture device failure');};});
        await p.goto(base+'demos/skyguard-lab/index.html?test=1');await p.locator('#deploy').click();await p.evaluate(()=>skyguard.advance(120));await p.waitForFunction(()=>skyguard.snapshot().audio.failed);assert.ok(await p.evaluate(()=>skyguard.snapshot().state.tick>=120));await p.locator('#sound').click();assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('vanillajs-skyguard-v1')).music),true);
      }finally{await broken.close();}
    });
    await check('previous offline API and failed import recover without a dead launch button',()=>checkSkyguardUpgrade(browser,base));
    assert.deepEqual(receipt.errors,[]);receipt.status='PASS';
  }catch(error){receipt.status='FAIL';receipt.failure=String(error.stack||error);console.error('Skyguard browser failure',await snap().then(x=>({screen:x.screen,station:x.state.station,hp:x.state.hp})).catch(()=>null));await page.screenshot({path:'browser-artifacts/skyguard-failure.png',timeout:5000}).catch(()=>{});throw error;
  }finally{await writeFile('browser-artifacts/skyguard.json',JSON.stringify(receipt,null,2)+'\n');await context.close();}
}
