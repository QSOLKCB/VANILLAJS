// SPDX-License-Identifier: Apache-2.0
const controls=[...document.querySelectorAll('main button,main input,main select,main textarea')];
for(const control of controls)control.disabled=true;
try{await import('./drive-app.js');if(document.documentElement.dataset.labReady!=='horizon-drive')throw Error('Incomplete driving-study startup');for(const control of controls)control.disabled=false;globalThis.__horizonDrive?.refresh();}
catch(error){console.error('HORIZON driving startup failed',error);document.documentElement.dataset.labReady='failed';document.querySelector('#status').textContent='Driving tools could not load. Check the connection, then reload.';const reload=document.querySelector('#startup-reload');reload.hidden=false;reload.disabled=false;reload.onclick=()=>location.reload();}
