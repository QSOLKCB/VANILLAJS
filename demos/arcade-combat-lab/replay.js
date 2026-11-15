// SPDX-License-Identifier: Apache-2.0
import {ArcadePackSlot,canonicalArcadeJSON} from '../../modules/mod-arcade/index.js';
import {combatRecord as record,combatArray as list,combatInteger as int} from '../../modules/combat2d/index.js';
import {createArcadeGame,stepArcadeGame,arcadeSnapshot,ARCADE_ENGINE,ARCADE_TICKS} from './world.js';
export const REPLAY_KIND='qsol.vanillajs.arcade-replay.v1',SNAPSHOT_KIND='qsol.vanillajs.arcade-snapshot.v1';
export const MAX_REPLAY_BYTES=262144,MAX_SNAPSHOT_BYTES=524288;
function parse(text,max) {
  if(typeof text!=='string'||text.length>max||new TextEncoder().encode(text).length>max)throw new RangeError('bounded JSON text required');
  return JSON.parse(text);
}
function replayObject(value) {
  record(value,['kind','engine','mode','difficulty','seed','pack','inputs']);
  if(value.kind!==REPLAY_KIND||value.engine!==ARCADE_ENGINE||typeof value.pack!=='string')throw new TypeError('unsupported replay identity');
  list(value.inputs,ARCADE_TICKS).forEach(w=>int(w,'input word',0,127));
  const session=new ArcadeSession(value.pack,value.mode,value.difficulty,value.seed);
  for(const word of value.inputs)if(!session.advance(word).accepted)throw new RangeError('input after terminal state');
  return session;
}
export function readArcadeReplay(text) {return replayObject(parse(text,MAX_REPLAY_BYTES));}
export function readArcadeSnapshot(text) {
  const value=parse(text,MAX_SNAPSHOT_BYTES);record(value,['kind','replay','state']);
  if(value.kind!==SNAPSHOT_KIND)throw new TypeError('unsupported snapshot');
  const session=replayObject(value.replay);
  if(canonicalArcadeJSON(value.state)!==canonicalArcadeJSON(arcadeSnapshot(session.state)))throw new RangeError('snapshot does not match replay');
  return session;
}
export class ArcadeSession {
  #slot;#state;#inputs=[];
  constructor(pack,mode='run',difficulty='normal',seed=2026) {
    const slot=new ArcadePackSlot(pack),state=createArcadeGame(slot.pack,mode,difficulty,seed);
    this.#slot=slot;this.#state=state;
  }
  get state(){return this.#state;}
  get pack(){return this.#slot.pack;}
  advance(word) {
    int(word,'input word',0,127);
    if(this.#state.status!=='playing')return {accepted:false,state:this.#state,events:[]};
    if(this.#inputs.length>=ARCADE_TICKS)throw new RangeError('journal capacity');
    const result=stepArcadeGame(this.#state,word);
    this.#inputs.push(word);this.#state=result.state;return {...result,accepted:true};
  }
  replacePack(source) {
    const slot=new ArcadePackSlot(source),state=createArcadeGame(slot.pack,this.#state.mode,this.#state.difficulty,this.#state.seed);
    this.#slot=slot;this.#state=state;this.#inputs=[];
  }
  replay() {
    return {kind:REPLAY_KIND,engine:ARCADE_ENGINE,mode:this.#state.mode,difficulty:this.#state.difficulty,
      seed:this.#state.seed,pack:this.pack.bytes,inputs:[...this.#inputs]};
  }
  exportReplay(){return canonicalArcadeJSON(this.replay());}
  exportSnapshot(){return canonicalArcadeJSON({kind:SNAPSHOT_KIND,replay:this.replay(),state:arcadeSnapshot(this.#state)});}
}
