// SPDX-License-Identifier: Apache-2.0
export function startupFailure(host,label,error){
  const notice=document.createElement('section'),title=document.createElement('strong'),message=document.createElement('p'),retry=document.createElement('button');
  notice.className='startup-failure';notice.setAttribute('role','alert');
  title.textContent=label+' could not start';
  message.textContent='Save any scene changes, then reload the Workbench. '+String(error?.message??error);
  retry.type='button';retry.textContent='Reload Workbench';retry.onclick=()=>location.reload();
  notice.append(title,message,retry);host.replaceChildren(notice);
}
