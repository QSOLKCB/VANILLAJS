// SPDX-License-Identifier: Apache-2.0
import {startupFailure} from './startup-status.js';
const roots=[...document.querySelectorAll('header,.creator-guide,main')];
for(const root of roots)root.inert=true;
document.documentElement.dataset.editorReady='loading';
try{
  await import('./app.js');
  if(!['ready','unavailable'].includes(document.documentElement.dataset.editorReady))throw Error('Editor initialization did not finish');
}catch(error){
  document.documentElement.dataset.editorReady='failed';
  document.getElementById('status').textContent='Editor startup failed.';
  startupFailure(document.getElementById('demoscene-workshop'),'Workbench',error);
  document.getElementById('demoscene-workshop').scrollIntoView({block:'center'});
  console.error('Workbench startup failed',error);
}finally{for(const root of roots)root.inert=false;}
