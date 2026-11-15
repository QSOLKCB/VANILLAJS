// SPDX-License-Identifier: Apache-2.0
import {FPSPackSlot,canonicalFPS} from '../../modules/mod-fps/index.js';
import {fpsRecord,fpsList,fpsNumber} from '../../modules/combat3d/index.js';
import {ArenaWorld,FPS_MAX_TICKS,validateFPSInput} from './world.js';
import {FPS_SOURCE} from './identity.js';
export const FPS_REPLAY_KIND='qsol.vanillajs.fps-replay.v1';
// 36,000 complete six-integer commands fit below 3 MiB at worst; 8 MiB also
// covers the accepted pack and bounded final state. No truncated journals.
export const FPS_REPLAY_BYTES=8*1024*1024;
export class FPSSession {
  #slot;#inputs=[];#world;
  constructor(pack,mode='skirmish',difficulty='normal',seed=2026){this.#slot=new FPSPackSlot(pack);this.#world=new ArenaWorld(this.#slot.pack,mode,difficulty,seed);}
  get world(){return this.#world;}
  get pack(){return this.#slot.pack;}
  advance(value){const input=validateFPSInput(value);if(this.#world.status!=='playing')return {accepted:false,events:[]};if(this.#inputs.length>=FPS_MAX_TICKS)throw new RangeError('journal capacity');const r=this.#world.step(input);if(r.accepted)this.#inputs.push(input);return r;}
  replacePack(source){const slot=new FPSPackSlot(source),world=new ArenaWorld(slot.pack,this.world.mode,this.world.difficulty,this.world.seed);this.#slot=slot;this.#world=world;this.#inputs=[];}
  exportReplay(){return canonicalFPS({kind:FPS_REPLAY_KIND,source:FPS_SOURCE,version:1,pack:this.pack.bytes,seed:this.world.seed,mode:this.world.mode,difficulty:this.world.difficulty,inputs:this.#inputs,state:this.world.snapshot(),verification:null});}
}
export function verifyFPSReplay(text){
  if(typeof text!=='string'||text.length>FPS_REPLAY_BYTES||new TextEncoder().encode(text).length>FPS_REPLAY_BYTES)throw new RangeError('replay byte budget');
  const v=JSON.parse(text);fpsRecord(v,['kind','source','version','pack','seed','mode','difficulty','inputs','state','verification']);
  if(v.kind!==FPS_REPLAY_KIND||v.version!==1||v.source!==FPS_SOURCE||typeof v.pack!=='string')throw new TypeError('unsupported replay/source identity');
  fpsNumber(v.seed,0,4294967295,true);fpsList(v.inputs,FPS_MAX_TICKS).forEach(validateFPSInput);
  const session=new FPSSession(v.pack,v.mode,v.difficulty,v.seed);
  for(const input of v.inputs)if(!session.advance(input).accepted)throw new RangeError('unconsumed input after terminal state');
  if(canonicalFPS(v.state)!==canonicalFPS(session.world.snapshot()))throw new RangeError('replay state mismatch in this runtime');
  const verification={source:FPS_SOURCE,ticks:v.inputs.length,complete:true,match:true,scope:'same source and JavaScript runtime; Float64 simulation'};
  if(v.verification!==null&&canonicalFPS(v.verification)!==canonicalFPS(verification))throw new RangeError('claimed verification differs from executed result');
  return {session,verification};
}
