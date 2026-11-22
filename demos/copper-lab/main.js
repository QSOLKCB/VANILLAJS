// SPDX-License-Identifier: Apache-2.0
import {BitplaneSurface} from '../../modules/blit/index.js';
import {createCopperProgram,CopperDisplay,COPPER_FORMAT} from '../../modules/copper/index.js';

const W=320,H=192,bitmap=new BitplaneSurface(W,H,4).clear(1);
for(let y=0;y<H;y++)bitmap.fillRect(0,y,W,1,y<64?2:y<128?4:6);
for(let x=0;x<W;x++){
  const far=52+Math.round(13*Math.sin(x/21)+8*Math.cos(x/49));
  bitmap.fillRect(x,far,1,H-far,7);
  const near=112+Math.round(14*Math.sin(x/30)+11*Math.cos(x/17));
  bitmap.fillRect(x,near,1,H-near,10);
}
for(let i=0;i<14;i++)bitmap.line(0,95+i*6,W-1,95+i*6,12);
bitmap.fillRect(30,21,260,18,0).fillRect(34,24,252,12,3);
const source=bitmap.indices(),pristine=source.slice();
const display=new CopperDisplay(W,H),canvas=document.getElementById('screen');
const ctx=canvas.getContext('2d',{alpha:false});
const palette=Array.from({length:16},(_,i)=>[
  Math.min(255,18+i*13),Math.min(255,28+i*10),Math.min(255,46+i*9),255]);
let active=true,offset=0;
function render(){
  const commands=[];
  if(active){
    for(let y=0;y<H;y+=16){
      commands.push({line:y,op:'palette',index:7,
        color:[Math.min(255,62+y),Math.min(255,96+(y/2|0)),173,255]});
      commands.push({line:y,op:'palette',index:10,
        color:[Math.min(255,30+(y/2|0)),Math.min(255,85+y),
          Math.min(255,132+(y/4|0)),255]});
      commands.push({line:y,op:'scroll',x:Math.round(Math.sin(y/18+offset)*18)});
    }
  }
  const program=createCopperProgram({height:H,palette,commands});
  const rgba=display.render(source,program);
  ctx.putImageData(new ImageData(rgba,W,H),0,0);
  const checksum=rgba.reduce((n,v)=>Math.imul(n^v,16777619)>>>0,2166136261);
  const state={kind:COPPER_FORMAT,width:W,height:H,commands:program.commandCount,active,
    offset,checksum,retainedBytes:display.retainedBytes,
    sourceIntact:source.every((pixel,i)=>pixel===pristine[i])};
  document.getElementById('report').textContent='SCANLINE COMMANDS '+state.commands+' / '+
    (active?'ACTIVE':'BYPASSED')+'\nSCROLL PHASE '+offset+
    ' / RGBA HASH '+checksum.toString(16).padStart(8,'0')+
    '\nRETAINED RGBA '+display.retainedBytes+' BYTES / SOURCE INTACT '+state.sourceIntact;
  window.__copperReport=state;
}
render();
document.getElementById('mode').addEventListener('click',()=>{active=!active;render();});
document.getElementById('scroll').addEventListener('click',()=>{offset=(offset+1)%16;render();});
document.getElementById('reset').addEventListener('click',()=>{active=true;offset=0;render();});
