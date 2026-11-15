// SPDX-License-Identifier: Apache-2.0
const controls=[...document.querySelectorAll('main button,main input,main select,main textarea')];
for(const c of controls)c.disabled=true;
try{await import('./app.js');if(document.documentElement.dataset.labReady!=='block-arena')throw Error('Initialization did not finish');for(const c of controls)c.disabled=false;document.getElementById('pause').disabled=true;}
catch(error){console.error('Block Arena startup failed',error);document.getElementById('status').textContent='LOAD FAILED';document.getElementById('overlay-title').textContent='The arena could not start.';document.getElementById('overlay-copy').textContent='Check your connection, then reload the lab. Your downloaded packs remain yours.';const run=document.getElementById('run');run.disabled=false;run.textContent='RELOAD LAB';run.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();location.reload();},{capture:true});}
