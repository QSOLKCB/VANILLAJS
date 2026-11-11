// SPDX-License-Identifier: Apache-2.0
import {Experiment,starterPack} from './experiment.js';
import {transitionGraph} from '../../modules/gf3/index.js';
import {referenceSound} from '../../modules/symbolic-events/index.js';
import {IntegerClock} from '../../modules/integer-time/index.js';
import {MAX_PACK_BYTES} from '../../modules/mod-sdk/index.js';
const $=id=>document.getElementById(id);
const clock=new IntegerClock({hz:4,maxFrameUs:250000,maxSteps:1});clock.setPaused(true);
let session,graph,valid=false,last=null,audio=null;
const voices=new Set(),canvas=$('sky');
let ctx=null;try{ctx=canvas.getContext('2d');}catch{/* The numeric table remains usable. */}
function stopVoices(){for(const voice of voices){try{voice.stop();}catch{/* Already ended. */}}voices.clear();}
function pause(){clock.setPaused(true);last=null;stopVoices();$('play').textContent='Play';}
function draft(){pause();valid=false;controls();$('pack-status').textContent='Draft changed · validate to preview and export.';}
function controls(){
  const full=session&&session.snapshot().tick>=session.compiled.source.maxTicks;
  for(const id of ['step','play'])$(id).disabled=!valid||full;
  $('export').disabled=!valid;$('wav').disabled=!session?.snapshot().events.length;
}
function setSource(source){$('manifest').value=JSON.stringify(source,null,2);validate();}
function validate(){
  pause();
  try{
    if(new TextEncoder().encode($('manifest').value).length>MAX_PACK_BYTES)throw new RangeError('32 KiB input limit');
    const candidate=new Experiment(JSON.parse($('manifest').value));
    session=candidate;valid=true;clock.reset();
    graph=transitionGraph(session.compiled.operations);
    $('dimension').value=String(session.compiled.source.dimension);
    $('initial').replaceChildren();
    session.compiled.initial.forEach((value,i)=>{
      const label=document.createElement('label');label.textContent='x'+i;
      const input=document.createElement('select');input.setAttribute('aria-label','Initial trit '+i);
      for(const v of [0,1,2])input.add(new Option(String(v),String(v)));input.value=String(value);
      input.addEventListener('change',()=>{
        const source=JSON.parse(JSON.stringify(session.source));source.entries[0].data.initial[i]=Number(input.value);setSource(source);
      });label.append(input);$('initial').append(label);
    });
    $('operation').replaceChildren(...session.compiled.operations.map(op=>new Option(op.id,op.id)));
    $('pack-status').textContent='PASS · validated, registered and activated locally · '+session.source.id;
    $('status').textContent='Ready · choose a transformation and step.';render();
  }catch(error){valid=false;controls();$('pack-status').textContent='REJECTED · '+error.message;}
}
function drawGraph(){
  const svg=$('graph'),ns='http://www.w3.org/2000/svg';svg.replaceChildren();
  const selected=$('operation').value,state=session.snapshot().state.join('');
  const positions=graph.states.map((_,i)=>{
    const angle=i*2*Math.PI/graph.states.length-Math.PI/2;return [240+145*Math.cos(angle),180+145*Math.sin(angle)];
  });
  const make=(name,attrs,text)=>{const node=document.createElementNS(ns,name);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));if(text!==undefined)node.textContent=text;svg.append(node);return node;};
  const edges=graph.edges.filter(e=>e.operation===selected);
  for(const e of edges){const [x1,y1]=positions[e.from],[x2,y2]=positions[e.to];
    make('line',{x1,y1,x2,y2,stroke:'#355365','stroke-width':1});
    // Dot near destination indicates direction; loops remain explicit in the edge list.
    make('circle',{cx:x1*.15+x2*.85,cy:y1*.15+y2*.85,r:2,fill:'#8ab7c4'});
  }
  graph.states.forEach((s,i)=>{const [cx,cy]=positions[i],current=s.join('')===state;
    const node=make('circle',{cx,cy,r:current?10:5,fill:current?'#72f6ca':'#536e81'});
    const title=document.createElementNS(ns,'title');title.textContent=s.join('');node.append(title);
    if(graph.states.length<=27)make('text',{x:cx,y:cy-13,fill:current?'#72f6ca':'#b5cbd5','text-anchor':'middle','font-size':11},s.join(''));
  });
  make('text',{x:240,y:174,fill:'#72f6ca','text-anchor':'middle','font-size':30},state);
  make('text',{x:240,y:198,fill:'#afc2c2','text-anchor':'middle','font-size':12},selected);
  $('graph-status').textContent=`${graph.states.length} states · ${edges.length} directed edges for ${selected}. Coordinates are illustrative; edge list is exact.`;
  $('edges').textContent=edges.map(e=>`${graph.states[e.from].join('')} → ${graph.states[e.to].join('')}`).join('\n');
}
function drawSky(snapshot){
  const show=ctx&&$('renderer').value==='canvas';canvas.hidden=!show;
  $('render-status').textContent=show?'XY plane · +Y up · pixels are illustrative.':'Numerical view active · Canvas, WebGL and WebGPU are unnecessary for the experiment.';
  if(!show)return;
  const w=canvas.width,h=canvas.height;
  ctx.fillStyle='#07141f';ctx.fillRect(0,0,w,h);
  const extent=Math.max(12,...snapshot.bodies.flatMap(b=>b.position.map(Math.abs)))*1.2,scale=h/(2*extent);
  const x=v=>w/2+v*scale,y=v=>h/2-v*scale;
  ctx.strokeStyle='#183441';ctx.lineWidth=1;
  for(let r=4;r<=12;r+=2){ctx.beginPath();ctx.arc(w/2,h/2,r*scale,0,2*Math.PI);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.stroke();
  ctx.fillStyle='#fff1d0';ctx.beginPath();ctx.arc(w/2,h/2,6,0,2*Math.PI);ctx.fill();
  snapshot.bodies.forEach((b,i)=>{
    ctx.strokeStyle='#2d4a56';ctx.beginPath();ctx.moveTo(w/2,h/2);ctx.lineTo(x(b.position[0]),y(b.position[1]));ctx.stroke();
    ctx.fillStyle=session.compiled.source.palette[snapshot.state[i]];ctx.beginPath();ctx.arc(x(b.position[0]),y(b.position[1]),9,0,2*Math.PI);ctx.fill();
    ctx.font='13px monospace';ctx.fillText(`x${i} = ${snapshot.state[i]}`,x(b.position[0])+15,y(b.position[1])-10);
  });
}
function render(){
  const s=session.snapshot(),op=session.compiled.operations.find(o=>o.id===$('operation').value);
  $('state').textContent=s.state.join(' ');$('tick').textContent=`${s.tick} / ${session.compiled.source.maxTicks}`;
  $('syndrome').textContent=s.syndrome.join(' ');$('formula').textContent=`x′ = A x + b (mod 3)\nA = ${JSON.stringify(op.matrix)}\nb = ${JSON.stringify(op.offset)}`;
  $('objective').textContent=(s.solved?'TARGET REACHED · ':'TARGET · ')+session.compiled.target.join(' ');
  $('bodies').replaceChildren(...s.bodies.map((b,i)=>{
    const row=document.createElement('tr');
    for(const text of ['x'+i,b.position[0].toFixed(4),b.position[1].toFixed(4),Math.hypot(...b.velocity).toFixed(4),b.energy.toFixed(4)]){
      const td=document.createElement('td');td.textContent=text;row.append(td);
    }return row;
  }));
  $('history').replaceChildren(...s.events.map(e=>{
    const row=document.createElement('li');row.textContent=`${String(e.tick).padStart(2,'0')} / ${e.operation} · ${e.before.join('')} → ${e.after.join('')}`;
    const detail=document.createElement('small');detail.textContent=`${e.frequency} Hz · ${e.wave} · 1 tick · ID ${e.id}`;row.append(detail);return row;
  }));
  drawGraph();drawSky(s);controls();
}
function playLatest(s){
  if(!$('sound').checked||audio?.state!=='running')return;
  try{
    const pcm=referenceSound(s.events).renderRange((s.tick-1)*12000,12000);
    const buffer=audio.createBuffer(1,pcm.length,48000),channel=buffer.getChannelData(0);
    for(let i=0;i<pcm.length;i++)channel[i]=pcm[i]/32768;
    const source=audio.createBufferSource();source.buffer=buffer;source.connect(audio.destination);
    voices.add(source);source.onended=()=>voices.delete(source);source.start();
  }catch(error){$('audio-status').textContent='Playback unavailable · '+error.message;}
}
function step(){
  if(!valid)return;
  try{
    const s=session.step($('operation').value);render();playLatest(s);
    $('status').textContent=s.solved?'Target reached. Keep exploring or export your run.':'Committed tick '+s.tick+' · exact state and event recorded.';
    if(s.tick>=session.compiled.source.maxTicks){pause();$('status').textContent='Run complete · tick budget reached. Export or reset.';}
  }catch(error){pause();$('status').textContent='Step rejected · '+error.message;}
}
function download(name,data,type='application/json'){
  const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const json=x=>JSON.stringify(x,null,2)+'\n';
$('step').addEventListener('click',()=>{pause();step();});
$('play').addEventListener('click',()=>{if(!clock.paused)pause();else{last=null;clock.setPaused(false);$('play').textContent='Pause';}});
$('reset').addEventListener('click',()=>setSource(session.source));
$('validate').addEventListener('click',validate);$('restore').addEventListener('click',()=>setSource(starterPack(Number($('dimension').value))));
$('dimension').addEventListener('change',()=>setSource(starterPack(Number($('dimension').value))));
$('operation').addEventListener('change',()=>{pause();render();});$('renderer').addEventListener('change',render);
$('manifest').addEventListener('input',draft);
$('import').addEventListener('change',async()=>{
  pause();const file=$('import').files[0];if(!file)return;
  try{if(file.size>MAX_PACK_BYTES)throw new RangeError('32 KiB input limit');$('manifest').value=await file.text();validate();}
  catch(error){valid=false;controls();$('pack-status').textContent='REJECTED · '+error.message;}
  $('import').value='';
});
$('export').addEventListener('click',()=>{if(valid)download(session.source.id+'.json',json(session.source));});
$('events').addEventListener('click',()=>download('ternary-events.json',json({kind:'qsol.symbolic-log.v1',source:session.source,events:session.snapshot().events})));
$('receipt').addEventListener('click',async()=>{
  // Capture before awaiting byte hashes so a running lab cannot mix ticks/configurations.
  const run=session.receipt();
  const paths=['demos/quantum-game-lab/app.js','demos/quantum-game-lab/experiment.js','demos/quantum-game-lab/index.html','demos/quantum-game-lab/style.css','modules/gf3/index.js','modules/symbolic-events/index.js','modules/mod-experiment/index.js','modules/mod-sdk/index.js','modules/orbital-physics/index.js','modules/audio2d/index.js','modules/integer-time/index.js','modules/integer-math/index.js'];
  let implementation;
  try{
    const hashes={};for(const path of paths){const response=await fetch('../../'+path);if(!response.ok)throw new Error('source unavailable');
      hashes[path]=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await response.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');}
    implementation={kind:'observed-asset-sha256',hashes,baseCommit:'c506cdfcefe2a68928cfa7025528a82ed11d44a9'};
  }catch{implementation={kind:'unavailable',reason:'Source byte hashing unavailable; use the reviewed checkout SHA from the PR.'};}
  download('ternary-reproducibility.json',json({...run,implementation}));
});
$('wav').addEventListener('click',()=>download('ternary-reference.wav',referenceSound(session.snapshot().events).wav(),'audio/wav'));
$('sound').addEventListener('change',async()=>{
  stopVoices();if(!$('sound').checked){$('audio-status').textContent='Sound off · canonical events still recorded.';return;}
  try{
    const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)throw new Error('no audio device API');
    audio??=new Context();await audio.resume();
    $('audio-status').textContent=audio.state==='running'?'Playback enabled · device timing is noncanonical.':'Audio suspended · events and WAV export remain available.';
  }catch(error){$('audio-status').textContent='Audio unavailable · '+error.message;}
});
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('keydown',e=>{if(e.key==='Escape')pause();});
function frame(ms){
  if(!clock.paused){const us=Math.floor(ms*1000);if(last!==null)clock.advance(Math.min(1000000,Math.max(0,us-last)),step);last=clock.paused?null:us;}
  requestAnimationFrame(frame);
}
setSource(starterPack());requestAnimationFrame(frame);
