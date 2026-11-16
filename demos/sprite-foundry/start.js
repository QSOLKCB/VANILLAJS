// SPDX-License-Identifier: Apache-2.0
const controls=[...document.querySelectorAll('main button,main input,main select')];
for(const control of controls)control.disabled=true;
try{
  await import('./app.js');
  if(document.documentElement.dataset.labReady!=='sprite-foundry')throw Error('Incomplete sprite startup');
  for(const control of controls)control.disabled=false;
  globalThis.__spriteFoundry?.refresh();
}catch(error){
  console.error('Sprite Foundry startup failed',error);
  document.documentElement.dataset.labReady='failed';
  document.getElementById('status').textContent='The sprite tools could not load. Check the connection, then reload the foundry.';
  const reload=document.getElementById('startup-reload');reload.hidden=false;reload.disabled=false;
  reload.onclick=()=>location.reload();
}
