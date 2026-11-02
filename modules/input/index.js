// SPDX-License-Identifier: Apache-2.0
import {clamp} from '../math/index.js';
export class Actions {
  constructor() { this.held=new Set(); this.edges=new Set(); }
  set(action, down) {
    if (down && !this.held.has(action)) this.edges.add(action);
    if (down) this.held.add(action); else this.held.delete(action);
  }
  value(action) { return this.held.has(action) ? 1 : 0; }
  axis(negative, positive) { return this.value(positive)-this.value(negative); }
  consume(action) { const pressed=this.edges.has(action); this.edges.delete(action); return pressed; }
  clear() { this.held.clear(); this.edges.clear(); }
  flight() {
    return {thrust:[this.axis('left','right'),this.axis('down','up'),this.axis('forward','backward')],
      turn:[this.axis('pitchDown','pitchUp'),this.axis('yawRight','yawLeft'),this.axis('rollRight','rollLeft')],brake:Boolean(this.value('brake'))};
  }
}
export const flightBindings={KeyW:'forward',KeyS:'backward',KeyA:'left',KeyD:'right',Space:'up',ControlLeft:'down',ControlRight:'down',
  ArrowUp:'pitchUp',ArrowDown:'pitchDown',ArrowLeft:'yawLeft',ArrowRight:'yawRight',KeyQ:'rollLeft',KeyE:'rollRight',KeyX:'brake',KeyB:'slow'};
export function attachKeyboard(target, actions, {bindings=flightBindings, enabled=()=>true}={}) {
  const keys=new Set();
  const editable=event=>event.target?.closest?.('input,select,textarea,button');
  const change=(event,down)=>{
    const action=bindings[event.code];
    if (!action) return;
    if (down && (!enabled() || editable(event))) return;
    if (down) keys.add(event.code); else keys.delete(event.code);
    actions.set(action,[...keys].some(code=>bindings[code]===action));
    if (enabled() && !editable(event)) event.preventDefault();
  };
  const down=e=>change(e,true), up=e=>change(e,false);
  const clear=()=>{keys.clear();actions.clear();};
  target.addEventListener('keydown',down);target.addEventListener('keyup',up);target.addEventListener('blur',clear);
  return {clear,dispose(){clear();target.removeEventListener('keydown',down);target.removeEventListener('keyup',up);target.removeEventListener('blur',clear);}};
}
export function deadzone(value, zone=0.16) {
  if (!Number.isFinite(value) || !Number.isFinite(zone) || zone<0 || zone>=1) return 0;
  return Math.sign(value)*clamp((Math.abs(value)-zone)/(1-zone),0,1);
}
export class FlightGamepad {
  constructor() { this.reset(); this.identity=''; }
  reset() { this.armed=false; this.previousPause=false; }
  sample(pads=[]) {
    const out={thrust:[0,0,0],turn:[0,0,0],brake:false,pause:false,connected:false};
    const pad=Array.from(pads).find(p=>p && p.connected!==false && p.mapping==='standard');
    if (!pad) { this.identity='';this.reset();return out; }
    out.connected=true;
    const identity=`${pad.index}:${pad.id}`;
    if (identity!==this.identity) { this.identity=identity;this.reset(); }
    const button=i=>{
      const value=pad.buttons[i]?.value ?? Number(Boolean(pad.buttons[i]?.pressed));
      return Number.isFinite(value)?clamp(value,0,1):0;
    };
    const axis=i=>deadzone(pad.axes[i] ?? 0);
    if (!this.armed) {
      this.armed=!pad.buttons.some((_,i)=>button(i)>0.1) && pad.axes.every(x=>Math.abs(deadzone(x))===0);
      return out;
    }
    out.thrust=[axis(0),button(7)-button(6),axis(1)];
    out.turn=[-axis(3),-axis(2),button(4)-button(5)];out.brake=button(0)>0.5;
    out.pause=button(9)>0.5 && !this.previousPause;this.previousPause=button(9)>0.5;
    return out;
  }
}
