// SPDX-License-Identifier: Apache-2.0
// Original puzzle rules using Brian Thorne's attributed ARCH OMI delta law.
import {delta16, xor16} from '../../experiments/arch-omi/index.js';
import {BrassMachine} from '../ancient-machine/machine.js';

export const MAX_COMMANDS = 128;
export const LEVEL_SET = 'vault-six-1';
export const PUZZLES = Object.freeze([
  {id:'awakening',name:'The Awakening',seed:0x1234,target:0xeb78,masks:[0x0001],minimum:2,
    note:'A turn changes the whole word. Lever A flips only its final bit.',mechanism:'Raise the entrance gate'},
  {id:'twins',name:'The Twin Keys',seed:0x4a21,target:0xc20c,masks:[0x00f0,0x0f00],minimum:3,
    note:'Each lever toggles its engraved mask. Pulling the same lever twice cancels it.',mechanism:'Part the twin doors'},
  {id:'stillness',name:'The Still Point',seed:0x1477,target:0xa177,masks:[0x1000,0x0100],minimum:4,
    note:'This initial word is a fixed point. A lever must disturb it before the crank can help.',mechanism:'Release the inner gate'},
  {id:'causeway',name:'The Lost Causeway',seed:0x00c3,target:0x59be,masks:[0x3333,0x000f,0x8001],minimum:5,
    note:'Order matters: a mask before a rotation can give a different result from a mask after it.',mechanism:'Raise the causeway'},
  {id:'ascent',name:'The Ascent',seed:0xbeef,target:0x7a7e,masks:[0x0ff0,0x00a5,0x8421],minimum:6,
    note:'The lift waits at each landing. Step aboard, ride up, then walk onto the upper floor.',mechanism:'Power the counterweight lift'},
  {id:'keeper',name:'The Keeper’s Seal',seed:0x5a3c,target:0x31af,masks:[0x1111,0x0248,0x8001],minimum:7,
    note:'The final word releases the vault. Read the lanes, retrace a mistake, and finish the sequence.',mechanism:'Open the final vault'}
].map(p=>Object.freeze({...p,masks:Object.freeze(p.masks)})));
export function integer(value,low,high,name) {
  if(!Number.isInteger(value)||value<low||value>high)throw new RangeError(`Invalid ${name}.`);
  return value;
}
export function exactRecord(value,keys,name) {
  if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).length!==keys.length||
    !keys.every(key=>Object.hasOwn(value,key)))throw new TypeError(`Invalid ${name} fields.`);
}
export function puzzleAt(index) {return PUZZLES[integer(index,0,5,'seal index')];}
export function applyCommand(index,word,command) {
  const puzzle=puzzleAt(index);integer(word,0,65535,'word');integer(command,0,puzzle.masks.length,'command');
  return command===0?delta16(word):xor16(word,puzzle.masks[command-1]);
}

/** Demo-owned lock. Commands are full delta revolutions or labelled XOR levers.
 * Pending cam detents and integer ticks are separate from completed commands. */
export class VaultLock {
  #index; #commands=[]; #engine; #motor=false;
  constructor(index) {this.#index=integer(index,0,5,'seal index');this.#rewind();}
  #rewind() {
    let word=PUZZLES[this.#index].seed;
    for(const command of this.#commands)word=applyCommand(this.#index,word,command);
    this.#engine=new BrassMachine({seed:word,ticksPerDetent:15});this.#motor=false;
  }
  #latch() {
    if(this.#engine.snapshot().detents===8) {
      const word=this.#engine.snapshot().word;
      this.#commands.push(0);this.#engine=new BrassMachine({seed:word,ticksPerDetent:15});this.#motor=false;
    }
  }
  snapshot() {return {...this.#engine.snapshot(),commands:[...this.#commands],motor:this.#motor};}
  lever(command) {
    integer(command,1,PUZZLES[this.#index].masks.length,'lever');
    const s=this.#engine.snapshot();
    if(this.#motor||s.phase!==0||s.subTick!==0||this.#commands.length===MAX_COMMANDS)return false;
    this.#commands.push(command);this.#rewind();return true;
  }
  detent() {
    if(this.#motor||this.#commands.length===MAX_COMMANDS)return false;
    this.#engine.move();this.#latch();return true;
  }
  turn() {
    if(this.#motor||this.#commands.length===MAX_COMMANDS)return false;
    this.#motor=true;return true;
  }
  tick() {if(this.#motor){this.#engine.tick();this.#latch();}}
  stopMotor() {this.#motor=false;}
  undo() {
    const s=this.#engine.snapshot();
    if(s.detents||s.subTick||this.#motor){this.#rewind();return true;}
    if(!this.#commands.length)return false;
    this.#commands.pop();this.#rewind();return true;
  }
  reset() {this.#commands=[];this.#rewind();}
  exportReplay() {
    const s=this.snapshot();return {commands:s.commands,word:s.word,detents:s.detents,subTick:s.subTick,motor:s.motor};
  }
  static fromReplay(index,data) {
    exactRecord(data,['commands','word','detents','subTick','motor'],'lock replay');
    if(!Array.isArray(data.commands)||data.commands.length>MAX_COMMANDS)throw new RangeError('Invalid command history.');
    integer(data.word,0,65535,'saved word');integer(data.detents,0,7,'pending detents');integer(data.subTick,0,14,'motor tick');
    if(typeof data.motor!=='boolean')throw new TypeError('Invalid motor flag.');
    const lock=new VaultLock(index);
    // Indexed reads reject sparse arrays rather than skipping missing commands.
    for(let i=0;i<data.commands.length;i++) {
      integer(data.commands[i],0,PUZZLES[index].masks.length,'saved command');lock.#commands.push(data.commands[i]);
    }
    lock.#rewind();
    if(lock.#engine.snapshot().word!==data.word)throw new RangeError('Saved word disagrees with its command history.');
    if(data.commands.length===MAX_COMMANDS&&(data.detents||data.subTick||data.motor))throw new RangeError('A full command tape cannot have a pending turn.');
    lock.#engine=new BrassMachine({seed:data.word,detents:data.detents,subTick:data.subTick,ticksPerDetent:15});
    lock.#motor=data.motor;return lock;
  }
}

/** Bounded breadth-first hints. At most 65,536 words; no wall-clock budget.
 * Delta and each XOR lever cost one completed command. Undo is not a graph edge. */
export class PuzzleSearch {
  #index; #start; #target; #queue=new Uint16Array(65536); #parent=new Int32Array(65536).fill(-1);
  #command=new Uint8Array(65536); #head=0; #tail=1; #status='building'; #path=null;
  constructor(index,start) {
    this.#index=integer(index,0,5,'seal index');this.#start=integer(start,0,65535,'search word');this.#target=PUZZLES[index].target;
    this.#queue[0]=start;this.#parent[start]=start;
    if(start===this.#target){this.#status='found';this.#path=[];}
  }
  step(budget=512) {
    integer(budget,1,4096,'search budget');
    for(let spent=0;spent<budget&&this.#status==='building';spent++){
      if(this.#head===this.#tail){this.#status='unreachable';break;}
      const word=this.#queue[this.#head++];
      for(let command=0;command<=PUZZLES[this.#index].masks.length;command++){
        const next=applyCommand(this.#index,word,command);
        if(this.#parent[next]!==-1)continue;
        this.#parent[next]=word;this.#command[next]=command;this.#queue[this.#tail++]=next;
        if(next===this.#target){
          const path=[];for(let at=next;at!==this.#start;at=this.#parent[at])path.push(this.#command[at]);
          this.#path=path.reverse();this.#status='found';break;
        }
      }
    }
    return this.snapshot();
  }
  snapshot() {return {status:this.#status,expanded:this.#head,visited:this.#tail,commands:this.#path?[...this.#path]:null};}
}
export function solvePuzzle(index,start=PUZZLES[index]?.seed) {
  const search=new PuzzleSearch(index,start);let result=search.snapshot();
  while(result.status==='building')result=search.step(4096);
  return result;
}
