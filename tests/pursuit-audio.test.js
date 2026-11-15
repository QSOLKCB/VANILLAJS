// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {Audio} from '../demos/pursuit-lab/js/audio.js';
function device(){
  const sources=[];const node=()=>({connect(){},disconnect(){this.disconnected=true;},gain:{value:1},pan:{value:0}});
  return {state:'running',currentTime:0,destination:{},sources,
    createBuffer:(_,frames)=>({getChannelData:()=>new Float32Array(frames)}),
    createGain:node,createStereoPanner:node,createBufferSource(){const source={...node(),start(){this.started=true;},stop(){this.stopped=true;}};sources.push(source);return source;},
    async resume(){this.state='running';}};
}
async function fixture(){const audio=new Audio(),context=device(),previous=globalThis.AudioContext;
  try{globalThis.AudioContext=function(){return context;};await audio.enable(true);}finally{if(previous===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=previous;}
  return {audio,context};
}
const driving={mode:'catch',tick:12,car:{speed:50},events:[]};
test('pursuit terminal cues survive music/engine shutdown and subsequent result frames, then release naturally',async()=>{
  for(const mode of ['cleared','won','lost']){const {audio,context}=await fixture();audio.frame(driving,true);
    assert.equal(audio.snapshot().music.active,true);assert.equal(audio.snapshot().effects.voices,1);
    const terminal={...driving,mode,events:[{type:mode==='lost'?'fail':'clear'}]};audio.tick(terminal);
    const cue=context.sources.at(-1);assert.equal(cue.started,true);audio.stopDriving();
    for(let frame=0;frame<8;frame++)audio.frame(terminal,false);
    assert.equal(audio.snapshot().music.active,false);assert.equal(audio.engine,null);assert.equal(audio.snapshot().effects.voices,1);assert.notEqual(cue.stopped,true);
    assert.ok(context.sources.slice(0,-1).every(source=>source.stopped));cue.onended();
    assert.equal(audio.snapshot().effects.voices,0);assert.equal(cue.disconnected,true);audio.stop();
  }
});
test('pause, explicit focus/transition stop, mute and recovery failure still silence every voice',async()=>{
  for(const action of ['pause','stop','mute','fail']){const {audio}=await fixture();audio.frame(driving,true);audio.tick({...driving,events:[{type:'clear'}]});
    if(action==='pause')audio.frame(driving,false);else if(action==='mute')await audio.enable(false);else audio[action]();
    assert.equal(audio.snapshot().music.active,false);assert.equal(audio.snapshot().effects.voices,0);assert.equal(audio.engine,null);
  }
});
