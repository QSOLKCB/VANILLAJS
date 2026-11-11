// SPDX-License-Identifier: Apache-2.0
import {detectGPU} from '../../modules/render-optional/index.js';
export function graphicsControls(renderer,host,onChange=()=>{}){
  const gpu=document.createElement('button'),cpu=document.createElement('button'),status=document.createElement('span');
  gpu.textContent='Checking GPU…';gpu.disabled=true;cpu.textContent='Use CPU';status.textContent='CPU';
  host.append(gpu,cpu,status);let disposed=false;
  renderer.onMode=mode=>{status.textContent=mode;onChange();};
  detectGPU().then(a=>{if(disposed)return;gpu.disabled=!a;gpu.textContent=a?'Enable WebGPU + WASM':'CPU · no compatible GPU';});
  gpu.onclick=async()=>{gpu.disabled=true;try{await renderer.enableGPU();}catch(e){status.textContent='CPU · '+e.message;}finally{if(!disposed)gpu.disabled=false;onChange();}};
  cpu.onclick=()=>{renderer.useCPU();onChange();};
  return ()=>{disposed=true;gpu.remove();cpu.remove();status.remove();};
}
