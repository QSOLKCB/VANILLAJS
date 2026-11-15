// SPDX-License-Identifier: Apache-2.0
import {machineRemembers} from './preset.js';
import {DemoPlayer} from './player.js';
import {validateDemo} from '../../modules/mod-demo/index.js';
const $=id=>document.getElementById(id),player=new DemoPlayer($('screen'),machineRemembers());
let imported=0,frameId=0,disposed=false;
const status=message=>$('status').textContent=message;
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof bytes==='string'?new TextEncoder().encode(bytes):bytes)),b=>b.toString(16).padStart(2,'0')).join('');
function download(name,bytes,type='application/json'){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function render(){
  if(disposed)return;const sample=player.transport.sample,shown=sample===2880000?sample:Math.floor(sample/960)*960,result=player.draw(shown),act=result.commands.state.act;
  $('seek').value=sample/48000;$('time').textContent='00:'+String(Math.min(59,Math.floor(sample/48000))).padStart(2,'0')+' / 01:00';if(sample===2880000)$('time').textContent='01:00 / 01:00';
  $('sample-label').textContent='SAMPLE '+String(sample).padStart(7,'0');$('act-number').textContent='0'+(act+1)+' / 05';$('act-name').textContent=player.project.timeline.scenes[act].name;
  $('boot').hidden=act!==0||sample>480000;$('boot').style.opacity=sample<96000?'1':String(Math.max(0,1-(sample-96000)/384000));$('welcome').hidden=sample!==0||player.transport.playing;$('ending').hidden=sample!==2880000;
  $('toggle').textContent=player.transport.playing?'Ⅱ PAUSE':sample===2880000?'▶ REPLAY':'▶ PLAY';
  document.querySelectorAll('[data-act]').forEach(b=>b.classList.toggle('active',Number(b.dataset.act)===act));
  const g=result.geometry;const gate=player.gate.stats();$('telemetry').textContent=`${g.counts.triangles/6} triangle vertices · ${g.counts.lines/6} line vertices · ${g.counts.points/6} points · 3 retained GPU buffers · ${gate.drawn} draws / ${gate.skipped} reused frames`;
  frameId=requestAnimationFrame(render);
}
const action=fn=>async()=>{try{await fn();}catch(error){status(error.message+' · Retry playback or reload the lab.');}};
const play=action(async()=>{status('Preparing the complete original score…');await player.transport.play();status('Playing · 60 second original production · no gameplay input');});
$('start').onclick=play;$('toggle').onclick=action(async()=>{if(player.transport.playing){player.transport.pause();status('Paused at sample '+player.transport.sample);}else await play();});
$('restart').onclick=action(async()=>{await player.transport.restart();status('Restarted from sample zero');});
$('seek').oninput=action(async()=>{await player.transport.seek(Math.round(Number($('seek').value)*48000));status('Seek reconstructed from absolute sample time');});
for(const b of document.querySelectorAll('[data-act]'))b.onclick=action(()=>player.transport.seek(Number(b.dataset.act)*576000));
$('mute').onclick=()=>{player.transport.mute(!player.transport.muted);$('mute').setAttribute('aria-pressed',String(player.transport.muted));$('mute').textContent=player.transport.muted?'MUTED':'SOUND ON';};
$('quality').onchange=()=>{player.quality=$('quality').value;status('Visual detail changed · score and timeline unchanged');};
$('fullscreen').onclick=action(async()=>{if(document.fullscreenElement)await document.exitFullscreen();else await $('stage').requestFullscreen();});
$('exit-fullscreen').onclick=action(()=>document.exitFullscreen());
document.addEventListener('fullscreenchange',()=>{$('exit-fullscreen').hidden=!document.fullscreenElement;$('fullscreen').textContent=document.fullscreenElement?'EXIT FULLSCREEN':'⛶ FULLSCREEN';player.gate.invalidate();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){player.transport.pause();status('Paused while the page is hidden');}});
$('screen').addEventListener('webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(frameId);player.transport.pause();status('Graphics context lost · playback paused');});
$('screen').addEventListener('webglcontextrestored',action(()=>{player.restore();render();status('Graphics restored · press play to continue');}));
window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frameId);void player.dispose();});
$('project-export').onclick=()=>download('machine-remembers.demoscene.json',player.project.bytes);
$('score-export').onclick=()=>download('machine-remembers.score.json',JSON.stringify({profile:player.project.settings.audioIdentity,sampleRate:48000,frames:2880000,phrases:Array.from({length:8},(_,i)=>player.project.audio.score(i))},null,2));
$('wav-export').onclick=action(()=>{status('Rendering all 2,880,000 samples…');download('machine-remembers-60s.wav',player.project.audio.wav(),'audio/wav');status('Full 60 second PCM16 mono WAV exported');});
async function receipt(){const project=player.project,wav=project.audio.wav();return {kind:'qsol.vanillajs.demoscene-receipt.v1',projectSha256:await sha(project.bytes),scoreSha256:await sha(JSON.stringify(Array.from({length:8},(_,i)=>project.audio.score(i)))),pcm16leSha256:await sha(wav.subarray(44)),wavSha256:await sha(wav),samples:2880000,sampleRate:48000,nominalFrames:3000,profile:'Full Demo',gpuPixels:'noncanonical',liveAudio:'device resampling and latency are noncanonical',moduleGraphSha256:/runtime-([0-9a-f]{64})/.exec(import.meta.url)?.[1]??null,runtimeSource:import.meta.url};}
$('evidence-export').onclick=action(async()=>{download('machine-remembers.receipt.json',JSON.stringify(await receipt(),null,2));status('Canonical audio and project identity receipt exported');});
$('project-import').onchange=action(async()=>{const file=$('project-import').files[0],token=++imported;if(!file)return;if(file.size>32768)throw Error('Project exceeds 32 KiB');const project=validateDemo(await file.text());if(token!==imported)return;player.load(project);await showIdentity();status('Validated project loaded · ready to play');});
async function showIdentity(){$('identity').textContent=player.project.settings.title+' · seed '+player.project.settings.seed+' · project SHA-256 '+await sha(player.project.bytes);}
// Generator packages supply this exact inert project, never executable imports/URLs.
const generated=document.getElementById('generated-project');if(generated)player.load(validateDemo(generated.textContent));
await showIdentity();render();status('Ready · press Start transmission to enable sound');
Object.defineProperty(window,'__demoscene',{value:{player,receipt,seek:async sample=>{player.transport.pause();await player.transport.seek(sample);player.draw(sample);},snapshot:()=>({sample:player.transport.sample,playing:player.transport.playing,starts:player.transport.starts,stops:player.transport.stops,project:player.project.bytes,quality:player.quality,frame:player.frame?.commands.state})}});
document.documentElement.dataset.labReady='demoscene';
