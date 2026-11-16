// SPDX-License-Identifier: Apache-2.0
import {validateDemo,DEMO_KIND} from '../../modules/mod-demo/index.js';
export const original={author:'QSOL-IMC / VANILLAJS',license:'Apache-2.0',source:'Original DEMOSCENE-001 procedural artwork and score',sha256:'original-procedural'};
export function machineRemembers(seed=1983){
  const entry=(id,data)=>({id,kind:'data',data});
  const roots=[65,65,87,78,65,98,87,65],melody=[262,0,311,392,0,349,311,0,262,392,466,392,349,311,294,262];
  const phrases=roots.map((root,p)=>{
    const notes=Array.from({length:4},()=>Array(32).fill(0));
    for(let i=0;i<32;i++){
      const ending=p===7,active=!ending||i<24;
      if(active&&i%2===0&&(p>0||i%8===0))notes[0][i]=root*(i%8===6?2:1);
      if(active&&(p>=2||i%8===0)&&i%2===0)notes[1][i]=p===7?(i<16?[262,0,196,0,131,0,0,0][Math.floor(i/2)]:0):Math.round(melody[(i/2+p*2)%16]*(p===5?1.5:1));
      if(active&&p>=1&&(p>=3||i%2===0))notes[2][i]=root*[4,6,8,12,8,6,4,3][(i+p)%8];
      if(active&&p>=1&&(p>=2||i%4===0))notes[3][i]=i%4===0?55:i%4===2?180:4000;
    }
    return entry('phrase-'+p,{notes,gains:p===0?[1400,900,0,0]:p===7?[1800,1300,650,350]:[2400,p>=4?2100:1400,p>=4?1250:800,p>=4?2200:1600],gates:[10000,11000,6500,2200],waves:['triangle','triangle','square','noise']});
  });
  return validateDemo({kind:DEMO_KIND,manifest:{kind:'qsol.vanillajs.mod-pack.v1',id:'machine-remembers',version:'1.0.0',requires:[],entries:[
    entry('settings',{title:'THE MACHINE REMEMBERS',seed,engine:'vanillajs-demoscene-1',sampleRate:48000,samples:2880000,audioIdentity:'audio2d-pcm16le-48000-mono-v1',palette:[[.18,.95,.89],[.65,.35,1],[1,.43,.19],[.08,.15,.25]],text:{title:'VANILLAJS',subtitle:'THE DEMOSCENE FOUNDRY',scroller:'QSOL-IMC / MAKE AMAZING ALIEN TECH / THIS IS NOT A PRODUCT. THIS IS INDEPENDENCE.'},provenance:{...original}}),
    entry('timeline',{scenes:['COLD BOOT','BLOCK MACHINE','GEOMETRY UNLEASHED','ALIEN CATHEDRAL','FINAL TRANSMISSION'].map((name,i)=>({id:'act-'+i,name,start:i*576000,end:(i+1)*576000,effect:['rotate','lattice','tunnel','radial','dissolve'][i]})),cueChannel:3,camera:[
      {sample:0,position:[0,0,24],target:[0,0,0],fov:1.05},
      {sample:576000,position:[0,6,28],target:[0,3,-15],fov:1.1},
      {sample:1152000,position:[0,3,10],target:[0,3,-30],fov:1.2},
      {sample:1728000,position:[0,8,23],target:[0,6,-10],fov:1.1},
      {sample:2304000,position:[0,5,34],target:[0,3,0],fov:1.05},
      {sample:2592000,position:[0,0,42],target:[0,0,0],fov:1.05},
      {sample:2880000,position:[0,0,42],target:[0,0,0],fov:1.05}]}),...phrases]}});
}
