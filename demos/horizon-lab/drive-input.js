// SPDX-License-Identifier: Apache-2.0
// Device lifecycle belongs to the lab; the engine consumes bounded snapshots.
import {rotate} from '../../modules/math/index.js';
const keys={KeyW:'throttle',ArrowUp:'throttle',KeyS:'brake',ArrowDown:'brake',Space:'brake',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
const controls=new Set(['throttle','brake','left','right']);
/** Lab-owned direction-change threshold, stricter than the engine's shift guard. */
export const DIRECTION_CHANGE_SPEED=.5;
/** Map device intent to ordinary vehicle3d controls; never mutate physical state.
 * Reverse/forward changes brake to <=0.5 m/s total speed, then request the real
 * gearbox and wait for its shift delay. Forward automatic ratios remain free.
 */
export function directionalDriveControls(state,intent){
  const {throttle=0,reverse=0,brake=0,steer=0}=intent;
  if(![throttle,reverse,brake,steer].every(Number.isFinite)||throttle<0||throttle>1||reverse<0||reverse>1||brake<0||brake>1||Math.abs(steer)>1)throw RangeError('Bounded driving intent required');
  if(!state||!Array.isArray(state.velocity)||state.velocity.length!==3||!state.velocity.every(Number.isFinite)||!Number.isInteger(state.gear)||state.gear< -1||state.gear>8||!Number.isFinite(state.shiftRemaining)||state.shiftRemaining<0)throw TypeError('Vehicle telemetry required');
  const output={throttle:0,brake,steer};
  // Independent brake and conflicting directions never silently request a shift.
  if(brake>0||throttle>0&&reverse>0){output.brake=Math.max(brake,throttle>0&&reverse>0?1:0);return output;}
  const wanted=reverse>0?-1:throttle>0?1:0,power=reverse||throttle;
  if(!wanted)return output;
  if(Math.sign(state.gear)!==wanted){
    output.brake=1;
    if(Math.hypot(...state.velocity)<=DIRECTION_CHANGE_SPEED)output.gear=wanted;
    return output;
  }
  if(state.shiftRemaining>0){output.brake=1;return output;}
  // Gear can be retained while coasting in the opposite direction on a slope.
  const forward=rotate(state.orientation,[0,0,-1]),signedSpeed=state.velocity.reduce((sum,n,i)=>sum+n*forward[i],0);
  if(signedSpeed*wanted< -DIRECTION_CHANGE_SPEED){output.brake=1;return output;}
  output.throttle=power;return output;
}
export class DriveInput{
  #down=new Set();#active=new Set();#blocked=new Set();#pointers=new Map();#directional;
  constructor({directional=false}={}){if(typeof directional!=='boolean')throw TypeError('directional must be boolean');this.#directional=directional;}
  keyDown(code,repeat,running){if(!Object.hasOwn(keys,code))return false;this.#down.add(code);if(running&&!repeat&&!this.#blocked.has(code))this.#active.add(code);return true;}
  keyUp(code){this.#down.delete(code);this.#active.delete(code);this.#blocked.delete(code);}
  press(id,control,running){if(!controls.has(control)&&!(this.#directional&&control==='reverse'))throw TypeError('Unknown driving control');if(running)this.#pointers.set(id,control);}
  release(id){this.#pointers.delete(id);}
  cancel(){for(const code of this.#down)this.#blocked.add(code);this.#active.clear();this.#pointers.clear();}
  read(){const active=new Set([...this.#active].map(code=>this.#directional&&['KeyS','ArrowDown'].includes(code)?'reverse':keys[code]).concat([...this.#pointers.values()]));const input={throttle:active.has('throttle')?1:0,brake:active.has('brake')?1:0,steer:(active.has('right')?1:0)-(active.has('left')?1:0)};if(this.#directional)input.reverse=active.has('reverse')?1:0;return input;}
  readVehicle(state){const input=this.read();return this.#directional?directionalDriveControls(state,input):input;}
  snapshot(){return {input:this.read(),heldKeys:[...this.#active],pointers:this.#pointers.size,blockedKeys:[...this.#blocked]};}
}
