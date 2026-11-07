// SPDX-License-Identifier: Apache-2.0
// Generic integer-engine replay envelope inspired by BLOAT-OPS strict
// completeness/checkpoint gates, QSOLKCB/BLOAT-OPS at
// 6f290dc818759ca49bcdec54b31d738b33c7946f.
// Original, independent adapter; no mission rules/assets are copied.
import {IntegerEngine,integerChecksum} from '../integer-engine/index.js';

const FORMAT='qsol.integer-replay/1',MAX_FRAMES=36000;
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},
  (_,i)=>Object.hasOwn(a,i)).every(Boolean);
const keys=(value,required)=>{
  if(!value||typeof value!=='object'||Array.isArray(value)||
     Object.keys(value).sort().join(',')!==[...required].sort().join(','))
    throw new TypeError('replay contains missing or unknown fields');
};
const buildId=value=>{
  if(typeof value!=='string'||!/^[a-f0-9]{40}$/.test(value))
    throw new TypeError('buildId must be a pinned lowercase 40-hex Git source SHA');
  return value;
};
function checkedFrames(frames){
  if(!dense(frames)||frames.length>MAX_FRAMES)
    throw new RangeError('replay must be a dense bounded frame array');
  return frames.map((commands,i)=>{
    if(!dense(commands)||commands.length>256)throw new TypeError('invalid command frame '+i);
    return commands.map((c,j)=>{
      if(!c||typeof c!=='object'||Array.isArray(c)||
         !Object.hasOwn(c,'id')||Object.keys(c).some(
           k=>!['id','velocity','acceleration'].includes(k)))
        throw new TypeError('invalid command '+i+'/'+j);
      // Keep only admitted fields. JSON is not used to coerce values.
      const copy={id:c.id};
      if(Object.hasOwn(c,'velocity')){
        if(!dense(c.velocity)||c.velocity.length!==3)
          throw new TypeError('invalid velocity '+i+'/'+j);
        copy.velocity=[...c.velocity];
      }
      if(Object.hasOwn(c,'acceleration')){
        if(!dense(c.acceleration)||c.acceleration.length!==3)
          throw new TypeError('invalid acceleration '+i+'/'+j);
        copy.acceleration=[...c.acceleration];
      }
      return copy;
    });
  });
}
function initialState(snapshot){
  return IntegerEngine.fromSnapshot(snapshot).snapshot();
}
/** Build one complete tape from a validated starting checkpoint. Produces an
 * owned source-pinned record and a diagnostic (noncryptographic) FNV digest.
 * Failed steps never leave an output record. */
export function sealIntegerReplay(initial,frames,{build}={}){
  buildId(build);
  const source=initialState(initial),commands=checkedFrames(frames);
  const engine=IntegerEngine.fromSnapshot(source);
  for(const input of commands)engine.step(input);
  return {format:FORMAT,build,initial:source,frames:commands,
    ticks:commands.length,digest:integerChecksum(engine),truncated:false};
}
/** Structural/semantic preflight, including all command fields. Does not
 * accept unknown keys, truncated tapes, stale source IDs or sparse arrays. */
export function validateIntegerReplay(tape,{expectedBuild}={}){
  buildId(expectedBuild);
  keys(tape,['format','build','initial','frames','ticks','digest','truncated']);
  if(tape.format!==FORMAT||tape.build!==expectedBuild||tape.truncated!==false)
    throw new RangeError('replay schema, source or completeness mismatch');
  const source=initialState(tape.initial),frames=checkedFrames(tape.frames);
  if(!Number.isSafeInteger(tape.ticks)||tape.ticks!==frames.length)
    throw new RangeError('replay declared ticks disagree with input count');
  if(typeof tape.digest!=='string'||!/^[0-9a-f]{8}$/.test(tape.digest))
    throw new TypeError('invalid diagnostic replay digest');
  return {source,frames};
}
/** Headless exact replay. If an application's isTerminal(state) says the
 * session ended before all inputs were consumed, the trailing inputs FAIL.
 * A matching digest is not sufficient for completeness. */
export function verifyIntegerReplay(tape,{expectedBuild,isTerminal=()=>false}={}){
  if(typeof isTerminal!=='function')throw new TypeError('isTerminal must be a function');
  const {source,frames}=validateIntegerReplay(tape,{expectedBuild});
  const engine=IntegerEngine.fromSnapshot(source);let consumed=0;
  for(const commands of frames){
    if(isTerminal(engine.snapshot()))break;
    engine.step(commands);consumed++;
  }
  const digest=integerChecksum(engine),complete=consumed===frames.length;
  return {match:complete&&digest===tape.digest,complete,consumed,
    unconsumed:frames.length-consumed,ticks:engine.tick,digest,
    final:engine.snapshot()};
}
