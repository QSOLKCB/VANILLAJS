// SPDX-License-Identifier: Apache-2.0
// A failed import must leave a visible, recoverable briefing instead of a dead button.
import('./app.js').catch(error=>{
  console.error('Skyguard startup failed',error);
  const status=document.getElementById('startup-status'),button=document.getElementById('deploy');
  status.textContent='Skyguard could not load. Close older VANILLAJS tabs, then reload to update.';
  button.textContent='RELOAD SKYGUARD';button.disabled=false;button.addEventListener('click',()=>location.reload());
});
