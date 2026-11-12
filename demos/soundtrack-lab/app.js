// SPDX-License-Identifier: Apache-2.0
import {compileSoundtrack,parseRecipe,serializeRecipe,PRESETS,RECIPE_KIND,MAX_RECIPE_BYTES} from './score.js';
const $=id=>document.getElementById(id),form=$('recipe-form');
let accepted=null,context=null,voice=null,playVersion=0;
const report=(message,error=false)=>{ $('status').textContent=message;$('status').dataset.error=String(error); };
function stop(message='Stopped. Click Listen to restart.'){
  playVersion++;
  if(voice){voice.onended=null;voice.stop();voice.disconnect();voice=null;}
  $('stop').disabled=true;$('listen').disabled=false;
  if(message)report(message);
}
function sourceLabels(){
  const e8=$('source-kind').value==='e8-coordinate';
  $('start-label').firstChild.textContent=e8?'Starting root':'Initial state';
  $('stride-label').firstChild.textContent=e8?'Root stride':'State step';
  $('source-start').max=e8?'239':'2';$('source-stride').max=e8?'239':'2';
  $('axis-label').hidden=!e8;$('source-axis').disabled=!e8;
}
function fill(recipe){
  const {source,mapping}=recipe;
  for(const key of ['tempo','steps','wave','gain'])$(key).value=String(mapping[key]);
  mapping.frequencies.forEach((value,i)=>$('pitch-'+i).value=String(value));
  $('source-kind').value=source.kind;$('source-start').value=String(source.start);
  $('source-stride').value=String(source.stride);$('source-axis').value=String(source.axis??0);
  $('gain-value').value=`${Math.round(mapping.gain/6000*100)}% of cue limit`;
  sourceLabels();$('dirty').hidden=true;
}
function draft(){
  const number=id=>{const value=$(id).value;if(!value.trim())throw new TypeError('Fill every numeric setting');return Number(value);};
  const source={kind:$('source-kind').value,start:number('source-start'),stride:number('source-stride')};
  if(source.kind==='e8-coordinate')source.axis=number('source-axis');
  return {kind:RECIPE_KIND,source,mapping:{tempo:number('tempo'),steps:number('steps'),
    frequencies:Array.from({length:5},(_,i)=>number('pitch-'+i)),wave:$('wave').value,gain:number('gain')}};
}
function render(score){
  $('summary').textContent=`${score.recipe.mapping.steps} notes · ${(score.frames/48000).toFixed(2)} seconds · ${score.recipe.mapping.tempo} BPM · 48 kHz mono`;
  const notes=$('notes'),rows=$('event-rows');notes.replaceChildren();rows.replaceChildren();
  const frequencies=score.events.map(event=>event.frequency),low=Math.min(...frequencies),span=Math.max(...frequencies)-low;
  score.events.forEach((event,i)=>{
    const note=document.createElement('div');note.className='note';note.style.height=`${25+60*(event.frequency-low)/(span||1)}%`;
    note.title=`Step ${i+1}: ${event.frequency} Hz`;const label=document.createElement('span');label.textContent=String(i+1);note.append(label);notes.append(note);
    const source=score.sources[i],row=document.createElement('tr');
    const sourceText=Object.hasOwn(source,'rootIndex')?`Root ${source.rootIndex} · ${source.coordinate}`:`State ${source.state}`;
    for(const text of [i+1,sourceText,event.frequency+' Hz',event.sample]){const cell=document.createElement('td');cell.textContent=String(text);row.append(cell);}
    rows.append(row);
  });
  notes.setAttribute('aria-label','Pitch sequence in Hz: '+score.events.map(event=>event.frequency).join(', '));
}
function accept(recipe){
  const candidate=compileSoundtrack(recipe); // A failed candidate leaves the accepted cue intact.
  stop(null);accepted=candidate;fill(candidate.recipe);render(candidate);report('Cue ready. Click Listen, or download the WAV.');
}
form.addEventListener('submit',event=>{event.preventDefault();try{accept(draft());}catch(error){report('Settings rejected: '+error.message,true);}});
form.addEventListener('input',()=>{
  $('dirty').hidden=false;$('gain-value').value=`${Math.round(Number($('gain').value)/6000*100)}% of cue limit`;
});
$('source-kind').addEventListener('change',()=>{
  $('source-start').value='0';$('source-stride').value='1';sourceLabels();$('dirty').hidden=false;
});
$('preset').addEventListener('change',()=>accept(PRESETS[$('preset').value]));
$('listen').addEventListener('click',async()=>{
  // Compile any valid edits before playback; invalid edits must never sound silently.
  try{
    accept(draft());const version=++playVersion;
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)throw new Error('Audio playback is unavailable. Download the WAV to use another player.');
    context??=new Audio();$('listen').disabled=true;$('stop').disabled=false;
    report('Starting audio…');await context.resume();
    if(version!==playVersion)return;
    const pcm=accepted.sound.renderAll(),buffer=context.createBuffer(1,pcm.length,48000),channel=buffer.getChannelData(0);
    for(let i=0;i<pcm.length;i++)channel[i]=pcm[i]/32768;
    const node=context.createBufferSource();node.buffer=buffer;node.connect(context.destination);voice=node;
    node.onended=()=>{if(voice===node){node.disconnect();voice=null;$('stop').disabled=true;$('listen').disabled=false;report('Cue finished. Listen again or export it.');}};
    node.start();report('Playing your cue.');
  }catch(error){stop(null);report(error.message,true);}
});
$('stop').addEventListener('click',()=>stop());
window.addEventListener('blur',()=>{if(voice||$('listen').disabled)stop('Playback stopped because the page lost focus.');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('Playback stopped while the page is hidden.');});
window.addEventListener('pagehide',()=>{stop(null);if(context){context.close().catch(()=>{});context=null;}});
function download(filename,data,type){
  const url=URL.createObjectURL(new Blob([data],{type})),link=document.createElement('a');
  link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportCurrent(callback){try{accept(draft());callback();}catch(error){report('Export rejected: '+error.message,true);}}
$('export-wav').addEventListener('click',()=>exportCurrent(()=>download('soundtrack.wav',accepted.sound.wav(),'audio/wav')));
$('export-recipe').addEventListener('click',()=>exportCurrent(()=>download('soundtrack.recipe.json',serializeRecipe(accepted.recipe),'application/json')));
$('export-events').addEventListener('click',()=>exportCurrent(()=>download('soundtrack.score.json',JSON.stringify({frames:accepted.frames,events:accepted.events},null,2)+'\n','application/json')));
$('open-recipe').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{if(file.size>MAX_RECIPE_BYTES)throw new RangeError('Recipe must be at most 4 KiB');accept(parseRecipe(await file.text()));report('Recipe restored. Click Listen to hear it.');}
  catch(error){report('Recipe rejected: '+error.message,true);}
  finally{event.target.value='';}
});
accept(PRESETS.chart);
