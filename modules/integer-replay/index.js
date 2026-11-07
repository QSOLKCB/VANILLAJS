// SPDX-License-Identifier: Apache-2.0
// Generic integer-engine replay envelope inspired by BLOAT-OPS strict
// completeness/checkpoint gates, QSOLKCB/BLOAT-OPS at
// 6f290dc818759ca49bcdec54b31d738b33c7946f.
// Original, independent adapter; no mission rules/assets are copied.
import {IntegerEngine,integerChecksum} from '../integer-engine/index.js';
import {int32,vector3} from '../integer-math/index.js';

const FORMAT='qsol.integer-replay/1',MAX_FRAMES=36000;
// Check bounds before inspecting indices: untrusted sparse lengths must not
// create an auxiliary array proportional to the claimed tape size.
const dense=(a,max)=>{
  if(!Array.isArray(a)||a.length>max)return false;
  for(let i=0;i<a.length;i++)if(!Object.hasOwn(a,i))return false;
  return true;
};
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
function checkedFrames(frames,source){
  if(!dense(frames,MAX_FRAMES))
    throw new RangeError('replay must be a dense bounded frame array');
  // The source checkpoint defines the only IDs accepted by IntegerEngine.step.
  const bodyIds=new Set(source.bodies.map(body=>body.id));
  return frames.map((commands,i)=>{
    if(!dense(commands,source.bodies.length))
      throw new TypeError('invalid command frame '+i);
    const seen=new Set();
    return commands.map((c,j)=>{
      if(!c||typeof c!=='object'||Array.isArray(c)||
         !Object.hasOwn(c,'id')||Object.keys(c).some(
           k=>!['id','velocity','acceleration'].includes(k)))
        throw new TypeError('invalid command '+i+'/'+j);
      const id=int32(c.id,'command id');
      if(!bodyIds.has(id)||seen.has(id))
        throw new RangeError('unknown or duplicate body command '+i+'/'+j);
      seen.add(id);
      // Validate numeric values before admitting a tape; no coercion of strings,
      // fractions, sparse vectors, nonfinite or out-of-range integers.
      const copy={id};
      for(const field of ['velocity','acceleration']){
        if(!Object.hasOwn(c,field))continue;
        if(!dense(c[field],3)||c[field].length!==3)
          throw new TypeError('invalid '+field+' '+i+'/'+j);
        copy[field]=vector3(c[field],field);
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
  const source=initialState(initial),commands=checkedFrames(frames,source);
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
  const source=initialState(tape.initial),frames=checkedFrames(tape.frames,source);
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
