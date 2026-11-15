// SPDX-License-Identifier: Apache-2.0
import {INPUT} from './sim.js';
const bindings={ArrowLeft:1,KeyA:1,ArrowRight:2,KeyD:2,ArrowUp:4,KeyW:4,ArrowDown:8,KeyS:8,Space:16,ShiftLeft:16,ShiftRight:16};
export class Controls{
  constructor(root,{active,pause}){
    this.keys=new Set();this.pointers=new Map();this.blocked=new Set();this.pulse=0;this.padBlocked=true;this.padConnected=false;this.startHeld=false;
    this.active=active;this.pause=pause;
    window.addEventListener('keydown',e=>{if(!bindings[e.code]||e.target.closest?.('input,select,textarea'))return;if(!active())return;e.preventDefault();if(this.blocked.has(e.code)||(e.repeat&&!this.keys.has(e.code)))return;if(!e.repeat&&bindings[e.code]===16)this.pulse|=16;this.keys.add(e.code);});
    window.addEventListener('keyup',e=>{this.keys.delete(e.code);this.blocked.delete(e.code);});
    for(const button of root.querySelectorAll('[data-control]')){
      button.addEventListener('pointerdown',e=>{e.preventDefault();if(!active())return;button.setPointerCapture(e.pointerId);const mask=INPUT[button.dataset.control];if(mask===16)this.pulse|=16;this.pointers.set(e.pointerId,{button,mask});button.classList.add('held');});
      const release=e=>{this.pointers.delete(e.pointerId);if(![...this.pointers.values()].some(v=>v.button===button))button.classList.remove('held');};
      for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release);
    }
  }
  clear(){for(const key of this.keys)this.blocked.add(key);this.keys.clear();this.pulse=0;for(const {button} of this.pointers.values())button.classList.remove('held');this.pointers.clear();this.padBlocked=true;}
  poll(){
    let pad;try{pad=Array.from(navigator.getGamepads?.()??[]).find(p=>p?.connected&&p.mapping==='standard');}catch{}
    if(!pad){if(this.padConnected){this.clear();this.pause();}this.padConnected=false;this.startHeld=false;return 0;}
    this.padConnected=true;const pressed=i=>(pad.buttons[i]?.value??0)>.3||!!pad.buttons[i]?.pressed,axis=pad.axes[0]??0;
    let mask=(axis<-.25||pressed(14)?1:0)|(axis>.25||pressed(15)?2:0)|(pressed(7)||pressed(12)?4:0)|(pressed(6)||pressed(13)?8:0)|(pressed(0)?16:0),start=pressed(9);
    if(this.padBlocked){if(!mask&&!start)this.padBlocked=false;this.startHeld=start;return 0;}
    if(start&&!this.startHeld){this.pause(true);this.startHeld=start;return 0;}this.startHeld=start;if(this.active()&&(mask&16))this.pulse|=16;return this.active()?mask:0;
  }
  mask(pad=0){let m=pad|this.pulse;for(const k of this.keys)m|=bindings[k];for(const p of this.pointers.values())m|=p.mask;return m;}
  consume(pad=0){const mask=this.mask(pad);this.pulse=0;return mask;}
}
