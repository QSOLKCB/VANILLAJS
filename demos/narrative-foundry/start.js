// SPDX-License-Identifier: Apache-2.0
const controls=[...document.querySelectorAll('main button,main input,main select,main textarea')];
for(const control of controls)control.disabled=true;
try{
  await import('./app.js');
  if(document.documentElement.dataset.labReady!=='narrative-foundry')throw Error('Incomplete narrative startup');
  for(const control of controls)control.disabled=false;
  globalThis.__narrativeFoundry?.refresh();
}catch(error){
  console.error('Narrative Foundry startup failed',error);
  document.documentElement.dataset.labReady='failed';
  document.getElementById('status').textContent='The story tools could not load. Check the connection, then reload the foundry.';
  const reload=document.getElementById('startup-reload');reload.hidden=false;reload.disabled=false;reload.onclick=()=>location.reload();
}
