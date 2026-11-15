// SPDX-License-Identifier: Apache-2.0
// Adapted from QSOLKCB/SubHunt v0.1.0; provenance: docs/SUBHUNT_INTEGRATION.md.
// Pure mapping/calibration over supplied samples. Applications own polling and focus.
export const GAMEPAD_DIRECTIONS=Object.freeze(['left','right','up','down']);
const finite=n=>Number.isFinite(n)&&Math.abs(n)<=16;
const index=(n,max)=>Number.isInteger(n)&&n>=0&&n<max;
function record(value,label){
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new TypeError(label+' must be a plain record');
  const out=Object.create(null);
  for(const key of Reflect.ownKeys(value)){
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    if(typeof key!=='string'||!Object.hasOwn(descriptor,'value'))throw new TypeError(label+' must contain data fields');
    out[key]=descriptor.value;
  }
  return out;
}
function keys(value,allowed,label){if(Object.keys(value).some(k=>!allowed.includes(k)))throw new TypeError('unexpected '+label+' field');}
/** Own and freeze a bounded profile. Action names belong to the consuming game. */
export function validateGamepadProfile(input){
  const p=record(input,'profile');keys(p,['version','buttons','directions'],'profile');
  if(p.version!==1)throw new TypeError('unsupported gamepad profile');
  const buttons=record(p.buttons,'buttons'),directions=record(p.directions,'directions');
  const names=Object.keys(buttons),used=new Set(),bindings=new Set();
  if(names.length<1||names.length>16||names.some(k=>!/^[a-z][a-zA-Z0-9]{0,23}$/.test(k)||['constructor','prototype','__proto__','x','y'].includes(k)))throw new TypeError('invalid action names');
  for(const key of names){const n=buttons[key];if(!index(n,128)||used.has(n))throw new RangeError('duplicate/invalid action button');used.add(n);}
  keys(directions,GAMEPAD_DIRECTIONS,'direction');
  const owned={};
  for(const key of GAMEPAD_DIRECTIONS){
    const b=record(directions[key],'binding');
    keys(b,b.kind==='button'?['kind','index']:['kind','index','value','neutral','button'],'binding');
    if(!index(b.index,b.kind==='button'?128:32))throw new RangeError('binding index');
    if(b.kind==='button'){if(used.has(b.index))throw new RangeError('duplicate button');used.add(b.index);}
    else {
      if(b.kind!=='axis'||!finite(b.value)||!finite(b.neutral)||Math.abs(b.value-b.neutral)<.3)throw new RangeError('invalid learned axis');
      if(b.button!==undefined){if(!index(b.button,128)||used.has(b.button))throw new RangeError('duplicate/invalid fallback');used.add(b.button);}
    }
    const identity=b.kind+':'+b.index+':'+(b.kind==='axis'?b.value:'');
    if(bindings.has(identity))throw new RangeError('duplicate direction');bindings.add(identity);
    owned[key]=Object.freeze({...b});
  }
  // A shared physical axis cannot have contradictory released values.
  for(const a of Object.values(owned))for(const b of Object.values(owned))if(a.kind==='axis'&&b.kind==='axis'&&a.index===b.index&&a.neutral!==b.neutral)throw new RangeError('inconsistent axis neutral');
  return Object.freeze({version:1,buttons:Object.freeze({...buttons}),directions:Object.freeze(owned)});
}
export function defaultGamepadProfile(buttons={primary:0,secondary:1,pause:9,menu:8,restart:2}){
  const axis=(index,value,button)=>({kind:'axis',index,value,neutral:0,button});
  return validateGamepadProfile({version:1,buttons,directions:{left:axis(0,-1,14),right:axis(0,1,15),up:axis(1,-1,12),down:axis(1,1,13)}});
}
function sample(pad){return !!pad?.connected&&Array.isArray(pad.buttons)&&pad.buttons.length<=128&&Array.isArray(pad.axes)&&pad.axes.length<=32;}
/** Accept one unambiguous button or axis excursion against an explicitly confirmed centre. */
export function captureGamepadBinding(pad,baseline){
  if(!sample(pad)||!Array.isArray(baseline)||baseline.length!==pad.axes.length||!Array.from(baseline).every(finite))return null;
  const buttons=pad.buttons.map((b,i)=>b?.pressed?i:-1).filter(i=>i>=0);
  if(buttons.length===1)return {kind:'button',index:buttons[0]};if(buttons.length>1)return null;
  const changed=pad.axes.map((value,i)=>({kind:'axis',index:i,value,neutral:baseline[i]})).filter(b=>finite(b.value)&&Math.abs(b.value-b.neutral)>=.5);
  return changed.length===1?changed[0]:null;
}
export function gamepadReleased(pad,baseline){
  return sample(pad)&&Array.isArray(baseline)&&baseline.length===pad.axes.length&&Array.from(baseline).every(finite)&&
    !pad.buttons.some(b=>b?.pressed)&&Array.from(pad.axes).every((v,i)=>finite(v)&&Math.abs(v-baseline[i])<.15);
}
/** Compile once, then read many samples without exposing mutable caller-owned profile data. */
export function createGamepadMapper(input=defaultGamepadProfile()){
  const profile=validateGamepadProfile(input),actions=Object.keys(profile.buttons);
  return Object.freeze({profile,
    read(pad){
      const result={x:0,y:0,...Object.fromEntries(actions.map(k=>[k,false]))};
      if(!sample(pad))return result;
      for(const key of actions)result[key]=!!pad.buttons[profile.buttons[key]]?.pressed;
      const active={};
      for(const key of GAMEPAD_DIRECTIONS){
        const b=profile.directions[key];
        if(b.kind==='button'){active[key]=pad.buttons[b.index]?.pressed?1:0;continue;}
        const value=pad.axes[b.index];
        if(b.button!==undefined&&pad.buttons[b.button]?.pressed){active[key]=1;continue;}
        if(!finite(value)){active[key]=0;continue;}
        const sameAxis=Object.values(profile.directions).filter(d=>d.kind==='axis'&&d.index===b.index);
        if(sameAxis.length>2){
          const values=[...new Set(sameAxis.map(d=>d.value))].sort((a,b)=>a-b),spacing=values[1]-values[0];
          const circular=values.length===4&&values.slice(1).every((v,i)=>Math.abs(v-values[i]-spacing)<.03),period=spacing*4;
          let distance=Math.abs(value-b.value);
          if(circular){distance%=period;distance=Math.min(distance,period-distance);}
          active[key]=Math.abs(value-b.neutral)<.15?0:distance<=(circular?spacing/2+.02:.12)?1:0;
        }else{const strength=(value-b.neutral)/(b.value-b.neutral);active[key]=strength>.22?Math.min(1,strength):0;}
      }
      result.x=active.right-active.left;result.y=active.down-active.up;return result;
    }
  });
}
