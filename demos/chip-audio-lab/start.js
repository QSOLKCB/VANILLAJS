// SPDX-License-Identifier: Apache-2.0
// Browser/device ownership belongs to this demo, not the pure chip-audio module.
import {createChipAudio,makeChipWave,PAULA_CLOCK,CHIP_AUDIO_RATE} from '../../modules/chip-audio/index.js';
const hzToPeriod=(clock,hz,waveLength)=>Math.max(124,Math.min(65535,Math.round(PAULA_CLOCK[clock]/(hz*waveLength))));
function score(){
  const clock=document.getElementById('clock').value,filter=document.getElementById('filter').checked?'led-approx':'off';
  const lead=makeChipWave({wave:'square',frames:32,duty:100});
  const bass=makeChipWave({wave:'triangle',frames:32});
  const harmony=makeChipWave({wave:'saw',frames:32});
  const percussion=makeChipWave({wave:'noise',frames:128,seed:1985});
  const events=[];let id=1;
  // Original eight-note test phrase (not a transcription or copied composition).
  const pitches=[330,392,440,494,440,392,330,262];
  for(let i=0;i<pitches.length;i++){
    events.push({id:id++,channel:0,start:18000*i,duration:16000,gate:11000,
      period:hzToPeriod(clock,pitches[i],lead.length),volume:42,attack:1,decay:3,sustain:10,release:2,loop:true,sample:lead});
    events.push({id:id++,channel:3,start:18000*i,duration:6000,gate:1000,
      period:hzToPeriod(clock,160,percussion.length),volume:15,attack:0,decay:1,sustain:0,release:1,loop:true,sample:percussion});
  }
  for(let i=0;i<4;i++){
    events.push({id:id++,channel:1,start:36000*i,duration:33000,gate:28000,
      period:hzToPeriod(clock,[110,131,147,131][i],bass.length),volume:43,attack:3,decay:6,sustain:10,release:3,loop:true,sample:bass});
    events.push({id:id++,channel:2,start:36000*i+4500,duration:28000,gate:21000,
      period:hzToPeriod(clock,[220,262,294,262][i],harmony.length),volume:20,attack:4,decay:5,sustain:6,release:4,loop:true,sample:harmony});
  }
  return createChipAudio({frames:3*CHIP_AUDIO_RATE,clock,filter,events});
}
const status=document.getElementById('status');let context=null,current=null;
function paint(pcm){
  const canvas=document.getElementById('signal'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);ctx.strokeStyle='#5c8792';ctx.lineWidth=1;
  for(let side=0;side<2;side++){
    const baseline=(side+.5)*(h/2);ctx.beginPath();ctx.moveTo(0,baseline);ctx.lineTo(w,baseline);ctx.stroke();
    ctx.strokeStyle=side===0?'#90e4c8':'#e6b5ef';ctx.beginPath();
    const frames=pcm.length/2;
    for(let x=0;x<w;x++){
      const from=Math.floor(x*frames/w),to=Math.max(from+1,Math.floor((x+1)*frames/w));
      let lo=0,hi=0;
      for(let n=from;n<to;n++){const s=pcm[n*2+side];lo=Math.min(lo,s);hi=Math.max(hi,s);}
      ctx.moveTo(x,baseline-lo*(h/4-4)/32768);
      ctx.lineTo(x,baseline-hi*(h/4-4)/32768);
    }
    ctx.stroke();ctx.strokeStyle='#5c8792';
  }
}
async function play(){
  try{
    const s=score(),pcm=s.renderAll();paint(pcm);
    if(!context)context=new AudioContext();await context.resume();
    if(current){current.stop();current.disconnect();current=null;}
    const buffer=context.createBuffer(2,s.frames,s.sampleRate);
    for(let side=0;side<2;side++){
      const channel=buffer.getChannelData(side);
      for(let i=0;i<s.frames;i++)channel[i]=pcm[i*2+side]/32768;
    }
    current=context.createBufferSource();current.buffer=buffer;current.connect(context.destination);current.start();
    status.textContent='Playing 3-second original test phrase ('+s.clock+', '+s.filter+').';
  }catch(error){status.textContent='Playback error: '+error.message;}
}
function save(){
  try{
    const s=score(),wav=s.wav(),url=URL.createObjectURL(new Blob([wav],{type:'audio/wav'}));
    const link=document.createElement('a');link.href=url;link.download='vanillajs-chip-audio-001.wav';
    document.body.append(link);link.click();link.remove();
    // This URL belongs only to the click. Revoke after a later browser turn.
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    status.textContent='Stereo WAV generated entirely offline: '+wav.byteLength+' bytes.';
  }catch(error){status.textContent='Export error: '+error.message;}
}
document.getElementById('play').addEventListener('click',play);
document.getElementById('save').addEventListener('click',save);
paint(score().renderAll());
