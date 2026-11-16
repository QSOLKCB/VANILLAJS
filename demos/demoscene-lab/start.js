// SPDX-License-Identifier: Apache-2.0
const controls=[...document.querySelectorAll('main button,main input,main select')];
for(const c of controls)c.disabled=true;
try{await import('./app.js');if(document.documentElement.dataset.labReady!=='demoscene')throw Error('Initialization incomplete');for(const c of controls)c.disabled=false;}
catch(error){console.error('Demoscene startup failed',error);document.getElementById('status').textContent='Could not load the production. Check the connection, then retry.';const start=document.getElementById('start');start.disabled=false;start.textContent='RELOAD TRANSMISSION';start.addEventListener('click',event=>{event.stopImmediatePropagation();location.reload();},{capture:true});}
