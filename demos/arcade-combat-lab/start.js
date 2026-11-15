// SPDX-License-Identifier: Apache-2.0
// Keep module-graph failures visible and recoverable before controls are armed.
const run=document.getElementById('run');
const controls=[...document.querySelectorAll('main button, main input, main select, main textarea')];
for(const control of controls)control.disabled=true;
try{
  await import('./app.js');
  if(document.documentElement.dataset.labReady!=='arcade-combat')throw new Error('Arcade initialization failed');
  for(const control of controls)control.disabled=false;
  document.getElementById('pause').disabled=true;
}catch(error){
  console.error('Arcade startup failed:',error);
  document.getElementById('status').textContent='LOAD FAILED';
  document.getElementById('overlay-title').textContent='The foundry could not start.';
  document.getElementById('overlay-copy').textContent='Unable to load the game. Check your connection and select Reload lab.';
  run.textContent='RELOAD LAB';run.disabled=false;
  run.addEventListener('click',event=>{
    event.preventDefault();event.stopImmediatePropagation();location.reload();
  },{capture:true});
}
