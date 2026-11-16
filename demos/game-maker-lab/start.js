// SPDX-License-Identifier: Apache-2.0
const controls=[...document.querySelectorAll('main button,main input,main select,main textarea')];
for(const control of controls)control.disabled=true;
try{await import('./app.js');if(document.documentElement.dataset.labReady!=='game-maker-lab')throw Error('Incomplete Game Maker startup');for(const control of controls)control.disabled=false;globalThis.__gameMakerLab?.refresh();}
catch(error){console.error('Game Maker startup failed',error);document.documentElement.dataset.labReady='failed';document.querySelector('#status').textContent='Maker tools could not load. Check the connection, then reload.';const reload=document.querySelector('#startup-reload');reload.hidden=false;reload.disabled=false;reload.onclick=()=>location.reload();}
