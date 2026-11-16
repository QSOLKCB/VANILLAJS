// SPDX-License-Identifier: Apache-2.0
const controls=[...document.querySelectorAll('main button,main input,main textarea')];
for(const c of controls)c.disabled=true;
try{await import('./app.js');if(document.documentElement.dataset.labReady!=='weapon-feel')throw Error('Initialization did not finish');for(const c of controls)c.disabled=false;document.getElementById('pause').disabled=true;}
catch(error){console.error('Weapon Feel startup failed',error);document.documentElement.dataset.labReady='failed';document.getElementById('status').textContent='LOAD FAILED';document.getElementById('overlay-title').textContent='The range could not start.';document.getElementById('overlay-copy').textContent='Check the connection, then reload. Accepted exported recipes remain yours.';document.getElementById('run').hidden=true;const button=document.getElementById('startup-reload');button.hidden=false;button.disabled=false;button.addEventListener('click',()=>location.reload());}
