// SPDX-License-Identifier: Apache-2.0
const controls=[...document.querySelectorAll('main button,main input,main select,main textarea')];
for(const control of controls)control.disabled=true;
try{await import('./race-app.js');if(document.documentElement.dataset.labReady!=='horizon-race')throw Error('Incomplete racing-foundry startup');for(const control of controls)control.disabled=false;globalThis.__horizonRace?.refresh();}
catch(error){console.error('HORIZON racing startup failed',error);document.documentElement.dataset.labReady='failed';document.querySelector('#author-status').textContent='Racing tools could not load. Check the connection, then reload.';const reload=document.querySelector('#startup-reload');reload.hidden=false;reload.disabled=false;reload.onclick=()=>location.reload();}
