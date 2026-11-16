// SPDX-License-Identifier: Apache-2.0
// Device lifecycle belongs to the lab; the engine consumes bounded snapshots.
const keys={KeyW:'throttle',ArrowUp:'throttle',KeyS:'brake',ArrowDown:'brake',Space:'brake',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
const controls=new Set(['throttle','brake','left','right']);
export class DriveInput{
  #down=new Set();#active=new Set();#blocked=new Set();#pointers=new Map();
  keyDown(code,repeat,running){if(!Object.hasOwn(keys,code))return false;this.#down.add(code);if(running&&!repeat&&!this.#blocked.has(code))this.#active.add(code);return true;}
  keyUp(code){this.#down.delete(code);this.#active.delete(code);this.#blocked.delete(code);}
  press(id,control,running){if(!controls.has(control))throw TypeError('Unknown driving control');if(running)this.#pointers.set(id,control);}
  release(id){this.#pointers.delete(id);}
  cancel(){for(const code of this.#down)this.#blocked.add(code);this.#active.clear();this.#pointers.clear();}
  read(){const active=new Set([...this.#active].map(code=>keys[code]).concat([...this.#pointers.values()]));return {throttle:active.has('throttle')?1:0,brake:active.has('brake')?1:0,steer:(active.has('right')?1:0)-(active.has('left')?1:0)};}
  snapshot(){return {input:this.read(),heldKeys:[...this.#active],pointers:this.#pointers.size,blockedKeys:[...this.#blocked]};}
}
