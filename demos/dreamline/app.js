// SPDX-License-Identifier: Apache-2.0
import {createFilm,defaults,projectFromText} from './film.js';
import {productionScore} from './production.js';
import {synthesize,validateScore,FRAMES,RATE} from './music.js';
import {DreamTransport} from './transport.js';
const el=id=>document.getElementById(id),canvas=el('film'),road=el('road');
const p={...defaults,motion:matchMedia('(prefers-reduced-motion: reduce)').matches?'reduced':'full'};
let film,transport,score,frame=0;
function message(text){el('status').textContent=text;}
function settings(){for(const key of ['trace','metal','detail','motion'])el(key).value=p[key];}
function paint(){
  const n=transport.sample();
  const w=Math.min(p.detail==='reduced'?960:1920,Math.max(320,Math.round(canvas.clientWidth*devicePixelRatio/16)*16));
  if(canvas.width!==w){canvas.width=w;canvas.height=w*9/16;}
  road.style.width=canvas.width/Math.min(devicePixelRatio,2)+'px';road.style.height=canvas.height/Math.min(devicePixelRatio,2)+'px';
  film.draw(n,p);el('seek').value=n;el('clock').value=(n/RATE).toFixed(2)+' / 90 s';
  if(n===FRAMES)transport.pause();
  el('play').textContent=transport.running?'Pause':'Play';
}
function loop(){cancelAnimationFrame(frame);paint();if(transport.running)frame=requestAnimationFrame(loop);}
function install(next){
  validateScore(next);if(next.frames!==FRAMES)throw Error('Load a 90-second edit');
  const pcm=synthesize(next),newFilm=createFilm(canvas,road,next,pcm);
  transport?.dispose();film?.dispose();film=newFilm;score=next;transport=new DreamTransport(pcm);
  transport.mute(el('mute').getAttribute('aria-pressed')==='true');
  message(score.source==='original-test-fixture'?'Original engineering fixture · Load the authorised score in Creator controls.':(score===productionScore?'MACHINE DREAMS — Trent Slade (QSOL-IMC) · CC BY 4.0':'Local instrumental arrangement')+' · Source '+score.source.slice(0,12));loop();
}
async function play(){try{await transport.play(el('silent').checked);}catch(e){transport.pause();message('Audio unavailable. Continuing with silent playback.');el('silent').checked=true;await transport.play(true);}loop();}
el('play').onclick=()=>{if(transport.running){transport.pause();loop();}else void play();};
el('restart').onclick=()=>{transport.pause();transport.seek(0);void play();};
el('seek').oninput=async e=>{await transport.seek(Number(e.target.value));loop();};
el('mute').onclick=()=>{transport.mute(!transport.muted);el('mute').setAttribute('aria-pressed',String(transport.muted));el('mute').textContent=transport.muted?'Unmute':'Mute';};
el('silent').onchange=()=>{const resume=transport.running;transport.pause();if(resume)void play();else loop();};
el('full').onclick=()=>{const change=document.fullscreenElement?document.exitFullscreen():canvas.parentElement.requestFullscreen();change.catch(e=>message(e.message));};
for(const key of ['trace','metal','detail','motion'])el(key).oninput=()=>{p[key]=el(key).value;loop();};
el('save').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(p)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='dreamline.project.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
for(const [id,limit] of [['project',1024],['score',1000000]])el(id).onchange=async e=>{
  try{const file=e.target.files[0];if(!file)return;if(file.size>limit)throw Error('File exceeds input budget');
    const text=await file.text();if(id==='score')install(JSON.parse(text));else{Object.assign(p,projectFromText(text));settings();loop();}
  }catch(err){message(err.message);}finally{e.target.value='';}};
document.addEventListener('visibilitychange',()=>{if(document.hidden){transport?.pause();if(transport)loop();}});
window.addEventListener('resize',()=>{if(transport)loop();});
settings();install(productionScore);
