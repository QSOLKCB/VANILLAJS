// SPDX-License-Identifier: Apache-2.0
// Outruin-derived fullscreen state. Layout, input cancellation and persistence belong to the caller.
export function createDisplayController({root,initial='fit',onChange=()=>{},onTransition=()=>{},save=()=>{}}={}){
  if(!root?.ownerDocument||typeof onChange!=='function'||typeof onTransition!=='function'||typeof save!=='function')throw new TypeError('Explicit root and callbacks required');
  if(!['fit','page'].includes(initial))throw new RangeError('Initial mode must be fit or page');
  const doc=root.ownerDocument;let windowed=initial,pending=false,disposed=false,message='';
  const snapshot=()=>Object.freeze({mode:doc.fullscreenElement===root?'fullscreen':windowed,windowed,fullscreen:doc.fullscreenElement===root,pending,message,disposed});
  const publish=()=>{if(!disposed)onChange(snapshot());};
  const persist=mode=>{try{save(mode);}catch{/* Optional preferences do not control display availability. */}};
  const changed=()=>{if(!disposed){onTransition();publish();}};
  doc.addEventListener('fullscreenchange',changed);publish();
  return Object.freeze({snapshot,async setMode(mode){
    if(disposed)throw new Error('Display controller disposed');
    if(!['fit','page','fullscreen'].includes(mode))throw new RangeError('Unknown display mode');
    if(pending)return false;
    onTransition();message='';pending=true;
    if(mode!=='fullscreen'){windowed=mode;persist(mode);}publish();
    let requested=false;
    try{
      if(mode==='fullscreen'&&doc.fullscreenElement!==root){
        if(!root.requestFullscreen)throw new Error('Fullscreen unavailable');requested=true;await root.requestFullscreen();
      }else if(mode!=='fullscreen'&&doc.fullscreenElement===root)await doc.exitFullscreen();
    }catch{
      if(!disposed){if(doc.fullscreenElement!==root){windowed='fit';persist('fit');message='Fullscreen unavailable. Using Fit window.';}else message='Press Esc to leave fullscreen.';}
    }finally{
      pending=false;
      if(disposed&&requested&&doc.fullscreenElement===root){try{await doc.exitFullscreen();}catch{}}
      publish();
    }
    return !disposed&&snapshot().mode===mode;
  },dispose(){if(disposed)return;disposed=true;doc.removeEventListener('fullscreenchange',changed);}});
}
