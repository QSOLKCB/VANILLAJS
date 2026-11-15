// SPDX-License-Identifier: Apache-2.0
// A failed module graph must leave a visible, usable recovery control.
const launch=document.getElementById('launch'),status=document.getElementById('status');
try{
  await import('./app.js');
  launch.disabled=false;
  launch.innerHTML='START PURSUIT <span>→</span>';
}catch(error){
  console.error('Pursuit startup failed:',error);
  launch.disabled=false;launch.textContent='RELOAD LAB';
  launch.onclick=()=>location.reload();
  status.textContent='Unable to start. Check your connection, then reload the lab.';
}
