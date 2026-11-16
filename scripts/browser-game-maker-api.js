// SPDX-License-Identifier: Apache-2.0
// Actual native Canvas2D/Web Audio checks over the packaged public facade.
import assert from 'node:assert/strict';

export async function checkGameMakerAPI(browser,base){
  const page=await browser.newPage({viewport:{width:1000,height:780}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.goto(base);
    const result=await page.evaluate(async()=>{
      const {createGameMaker}=await import('/VANILLAJS/api/game-maker/index.js');
      const {generateSprite}=await import('/VANILLAJS/modules/sprite2d/index.js');
      const {createTilemap}=await import('/VANILLAJS/modules/tilemap/index.js');
      const first=document.createElement('canvas'),second=document.createElement('canvas');
      document.body.append(first,second);
      const a=createGameMaker({canvas:first,width:128,height:96,pixelsPerUnit:8});
      const b=createGameMaker({canvas:second,width:128,height:96,pixelsPerUnit:8});
      const rgba=(canvas,x,y)=>[...canvas.getContext('2d').getImageData(x,y,1,1).data];
      const digest=(canvas,x=0,y=0,w=canvas.width,h=canvas.height)=>{let hash=2166136261;for(const byte of canvas.getContext('2d').getImageData(x,y,w,h).data)hash=Math.imul(hash^byte,16777619)>>>0;return hash;};
      const project=generateSprite({kind:'character',size:8,seed:9,symmetry:false,frameCount:2,palette:[[0,0,0,0],[200,100,50,255],[0,255,0,255],[0,0,255,255]]});
      project.frames[0].pixels.fill(1);project.frames[0].pixels[0]=0;project.frames[0].pixels[63]=2;project.frames[1].pixels.fill(3);
      a.loadSprite('hero',project);
      function drawA(){
        a.begin('#000000');a.rect(-6,-4,2,2,'#ff0000');a.circle(-3,3,.75,'#00ff00');
        a.line(-1,4,3,4,'#0000ff',.5);a.text('VANILLAJS',2,80,{screen:true,size:12});a.sprite('hero',0,1,-3,{width:2,height:2});
      }
      drawA();
      const primitivePixels={rect:rgba(first,20,70),circle:rgba(first,40,24),line:rgba(first,70,16),transparent:rgba(first,72,56),sprite:rgba(first,74,56),spriteCorner:rgba(first,86,70)};
      const textPixels=[...first.getContext('2d').getImageData(0,80,100,16).data].filter((v,i)=>i%4!==3&&v>100).length;
      // Read back the exact nearest-neighbour asset rectangle. Native antialiased
      // curve edges may change when Chromium moves a read-heavy canvas to CPU.
      const before=digest(first,72,56,16,16),accepted=a.spriteProject('hero');let rejected=false,failedAllocation=false;
      try{a.loadSprite('hero',{...project,script:'globalThis.bad=true'});}catch{rejected=true;}
      drawA();const afterRejected=digest(first,72,56,16,16);
      const imageData=CanvasRenderingContext2D.prototype.createImageData;
      CanvasRenderingContext2D.prototype.createImageData=function(){throw Error('Injected atlas allocation failure');};
      try{a.loadSprite('hero',project);}catch(error){failedAllocation=/Injected/.test(error.message);}finally{CanvasRenderingContext2D.prototype.createImageData=imageData;}
      drawA();const afterAllocation=digest(first,72,56,16,16);
      project.frames[0].pixels.fill(0);const ownsData=JSON.stringify(a.spriteProject('hero'))===JSON.stringify(accepted);
      const level=createTilemap({width:4,height:3,tileset:accepted});level.layers[0].cells[6]=1;
      level.layers.push({id:'parallax',name:'Backdrop',parallax:.5,cells:Array(12).fill(-1)});level.layers[1].cells[6]=0;b.loadTilemap('world',level);
      function drawB(){b.setCamera({x:2,y:1});b.begin('#000000');b.tilemap('world');}
      drawB();const tiles={normal:rgba(second,68,44),parallax:rgba(second,75,39)};
      const beforeMap=digest(second);const invalid=structuredClone(level);invalid.layers[0].cells[0]=99;let mapRejected=false;
      try{b.loadTilemap('world',invalid);}catch{mapRejected=true;}drawB();const afterMap=digest(second);
      a.pause(false);a.setInput({right:true,jump:true});let zeroTickCalled=false;a.advance(0,()=>{zeroTickCalled=true;});a.setInput({right:true,jump:false});
      const ticks=[];a.advance(1/30,(_dt,input,tick)=>ticks.push([tick,input.x,input.jump,input.pressed.jump,Object.isFrozen(input)]));
      a.pause(true);a.pause(false);a.setInput({right:true,jump:true});const blocked=a.input();a.setInput({});a.setInput({right:true,jump:true});const rearmed=a.input();
      a.reset();b.reset();a.pause(false);b.pause(false);
      const burst={x:0,y:0,seed:17,count:4,life:60};a.emit(burst);b.emit(burst);a.advance(1/30,()=>a.tickParticles());for(let i=0;i<2;i++)b.advance(1/60,()=>b.tickParticles());
      const particleIdentity=JSON.stringify(a.particleSnapshot())===JSON.stringify(b.particleSnapshot());for(let i=0;i<5;i++)a.emit({...burst,count:64,seed:i});const boundedParticles=a.snapshot().particles;
      const unavailable=document.createElement('canvas');unavailable.getContext=()=>null;let unavailableMessage='';try{createGameMaker({canvas:unavailable});}catch(error){unavailableMessage=error.message;}
      // A native click creates/resumes the caller-owned audio device. The facade
      // owns only its effect player, voices and buffers, not this AudioContext.
      const button=document.createElement('button');button.id='game-maker-api-audio';button.textContent='Test local API audio';document.body.append(button);
      button.addEventListener('click',async()=>{
        try{
          const context=new AudioContext();await context.resume();a.setAudioContext(context);
          const nodes=[];for(const method of ['createBufferSource','createGain','createStereoPanner']){
            const original=context[method].bind(context);context[method]=(...args)=>{
              const node=original(...args),entry={disconnected:false,stopped:method!=='createBufferSource'};nodes.push(entry);
              const disconnect=node.disconnect.bind(node);node.disconnect=(...values)=>{entry.disconnected=true;return disconnect(...values);};
              if(method==='createBufferSource'){const stop=node.stop.bind(node);node.stop=(...values)=>{entry.stopped=true;return stop(...values);};}
              return node;
            };
          }
          a.loadSound('tone',{frames:48000,events:[{id:1,sample:0,duration:48000,channel:0,frequency:440,wave:'triangle',gain:2000,seed:1}]});
          a.playSound('tone');const liveVoices=a.snapshot().voices;a.pause(true);const pausedVoices=a.snapshot().voices;
          a.pause(false);a.playSound('tone');const source=context.createBufferSource;context.createBufferSource=()=>{throw Error('Injected source failure');};
          let deviceFailure=false;try{a.playSound('tone');}catch(error){deviceFailure=/Injected/.test(error.message);}context.createBufferSource=source;
          a.dispose();a.dispose();const contextStillOwned=context.state==='running',allReleased=nodes.every(n=>n.disconnected&&n.stopped),disposed=a.snapshot();
          drawB();const independentPixels=digest(second),independentState=b.snapshot();b.dispose();await context.close();
          globalThis.__gameMakerAPIAudio={liveVoices,pausedVoices,deviceFailure,contextStillOwned,allReleased,disposed,independentPixels,independentState,closed:context.state==='closed'};
        }catch(error){globalThis.__gameMakerAPIAudio={error:error.message};}
      },{once:true});
      return {primitivePixels,textPixels,before,afterRejected,afterAllocation,rejected,failedAllocation,ownsData,tiles,beforeMap,afterMap,mapRejected,zeroTickCalled,ticks,blocked,rearmed,particleIdentity,boundedParticles,unavailableMessage};
    });
    assert.deepEqual(result.primitivePixels,{rect:[255,0,0,255],circle:[0,255,0,255],line:[0,0,255,255],transparent:[0,0,0,255],sprite:[200,100,50,255],spriteCorner:[0,255,0,255]});
    assert.ok(result.textPixels>50,'native Canvas text must visibly render');
    assert.equal(result.before,result.afterRejected);assert.equal(result.before,result.afterAllocation);
    assert.equal(result.rejected,true);assert.equal(result.failedAllocation,true);assert.equal(result.ownsData,true);
    assert.deepEqual(result.tiles,{normal:[0,0,255,255],parallax:[200,100,50,255]});assert.equal(result.mapRejected,true);assert.equal(result.beforeMap,result.afterMap);
    assert.equal(result.zeroTickCalled,false);assert.deepEqual(result.ticks,[[1,1,false,true,true],[2,1,false,false,true]]);
    assert.equal(result.blocked.x,0);assert.equal(result.blocked.pressed.jump,false);assert.equal(result.rearmed.x,1);assert.equal(result.rearmed.pressed.jump,true);
    assert.equal(result.particleIdentity,true);assert.equal(result.boundedParticles,256);assert.match(result.unavailableMessage,/Canvas 2D is unavailable/);
    await page.locator('#game-maker-api-audio').click();await page.waitForFunction(()=>globalThis.__gameMakerAPIAudio);
    const audio=await page.evaluate(()=>globalThis.__gameMakerAPIAudio);assert.equal(audio.error,undefined);
    assert.equal(audio.liveVoices,1);assert.equal(audio.pausedVoices,0);assert.equal(audio.deviceFailure,true);assert.equal(audio.contextStillOwned,true);assert.equal(audio.allReleased,true);assert.equal(audio.closed,true);
    assert.equal(audio.disposed.disposed,true);assert.equal(audio.disposed.voices,0);assert.equal(audio.disposed.sprites,0);assert.equal(audio.disposed.particles,0);
    assert.equal(audio.independentPixels,result.beforeMap,'disposing one owned facade preserves the other canvas and atlas');assert.equal(audio.independentState.tilemaps,1);assert.equal(audio.independentState.disposed,false);
    // The separately copyable example imports no lab runtime. Exercise its real
    // public-module game through native controls, not a simulation-state setter.
    await page.goto(base+'demos/game-maker-lab/api-example.html');
    await page.waitForFunction(()=>globalThis.gameMakerExample);
    const initial=await page.evaluate(()=>gameMakerExample.snapshot());assert.equal(initial.running,false);assert.equal(initial.collected,false);
    await page.locator('#example-play').click();await page.keyboard.down('ArrowRight');
    await page.waitForFunction(()=>gameMakerExample.snapshot().body.x>=1580);await page.keyboard.up('ArrowRight');
    await page.waitForFunction(()=>gameMakerExample.snapshot().body.vx===0);
    const standing=await page.evaluate(()=>gameMakerExample.snapshot());assert.equal(standing.body.grounded,true);assert.equal(standing.collected,false,'floating pickup requires an actual jump');
    await page.keyboard.press('Space');await page.waitForFunction(()=>gameMakerExample.snapshot().collected);
    assert.ok((await page.evaluate(()=>gameMakerExample.snapshot())).body.y>standing.body.y,'jump changes authoritative body height');
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const paused=await page.evaluate(()=>gameMakerExample.snapshot());
    await page.waitForTimeout(100);assert.equal((await page.evaluate(()=>gameMakerExample.snapshot())).graphics.ticks,paused.graphics.ticks);assert.equal(paused.running,false);
    await page.locator('#example-play').click();await page.keyboard.down('ArrowRight');await page.waitForFunction(()=>gameMakerExample.snapshot().won);await page.keyboard.up('ArrowRight');
    assert.match(await page.locator('#example-status').textContent(),/delivered the ember/);
    await page.locator('#example-restart').click();const restarted=await page.evaluate(()=>gameMakerExample.snapshot());
    assert.deepEqual(restarted.body,initial.body);assert.equal(restarted.won,false);assert.equal(restarted.collected,false);assert.equal(restarted.running,false);
    await page.locator('#example-dispose').click();const released=await page.evaluate(()=>gameMakerExample.snapshot());
    assert.equal(released.disposed,true);assert.equal(released.graphics.disposed,true);assert.equal(await page.locator('#example-play').isDisabled(),true);
    assert.deepEqual(errors,[]);
    console.log('Game Maker API: native Canvas primitive/text/sprite pixels, atlas/parallax alignment, rejected import/allocation rollback, fixed-tick tap/cancellation, seeded bounded particles, independent instances, real Web Audio resource ownership/failure cleanup and copyable public-only example movement/jump/pickup/win/restart/disposal PASS');
  }finally{await page.close();}
}
