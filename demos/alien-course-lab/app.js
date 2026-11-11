// SPDX-License-Identifier: Apache-2.0
import {compileCourseQ16,advanceCourseQ16} from '../../modules/exact-course/index.js';
import {SCALE} from '../../modules/integer-math/index.js';
import {SAMPLE} from './sample.js';
const el=id=>document.getElementById(id);
el('course').value=JSON.stringify(SAMPLE,null,2);
let compiled=null;
function compile(){
  try{
    const source=JSON.parse(el('course').value);
    const options={rounding:el('rounding').value,overflow:el('overflow').value};
    compiled=compileCourseQ16(source,options);
    el('status').textContent='PASS · '+compiled.gates.length+' exact gates · '+options.rounding+' / '+options.overflow;
    el('result').textContent=JSON.stringify(compiled,null,2);
    el('sweep').textContent='Compiled and ready to test a swept crossing.';
    el('download').disabled=false;
  }catch(error){
    compiled=null;el('download').disabled=true;
    el('status').textContent='REJECTED · '+error.message;
    el('result').textContent='No compiled output';el('sweep').textContent='';
  }
}
el('compile').addEventListener('click',compile);
el('sweep-button').addEventListener('click',()=>{
  if(!compiled){el('sweep').textContent='Compile a valid course first.';return;}
  const result=advanceCourseQ16(compiled,0,[0,3*SCALE,0],[0,3*SCALE,-100*SCALE]);
  el('sweep').textContent='(0,3,0) → (0,3,-100): credited '+
    result.crossed+' consecutive gates. Next gate index: '+result.nextGate+'.';
});
el('download').addEventListener('click',()=>{
  if(!compiled)return;
  const data=new Blob([JSON.stringify(compiled,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(data),a=document.createElement('a');
  a.href=url;a.download='alien-course-q16.json';a.click();URL.revokeObjectURL(url);
});
compile();
