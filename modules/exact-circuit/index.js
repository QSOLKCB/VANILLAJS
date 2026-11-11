// SPDX-License-Identifier: Apache-2.0
// MOD-SDK-002: bounded, exact cardinal circuit checkpoint *authoring*.
// Independent of flight physics, collision resolution, DOM and presentation.
// Design informed by QSOLKCB/DRONE-RACER src/circuit.js at pinned
// 9fea5ce9bdcd1799e075afcc329972792e15b688. Independently implemented.
import {parseDecimal} from '../exact-rational/index.js';
import {quantizeQ16} from '../rational-q16/index.js';
import {int32,SCALE} from '../integer-math/index.js';

export const CIRCUIT_KIND='qsol.vanillajs.exact-circuit.v2';
const admittedCircuits=new WeakSet(),admittedGates=new WeakSet(),progressOwners=new WeakMap();
const ID=/^[a-z][a-z0-9-]{0,47}$/,COLOR=/^#[0-9a-fA-F]{6}$/;
const circuitKeys=['id','version','laps','spawn','gates','obstacles'];
const gateKeys=['id','x','y','z','width','height','axis','direction'];
const obstacleKeys=['id','min','max','color'];

function dataRecord(value,fields){
  if(value===null||typeof value!=='object'||Array.isArray(value)||
     ![Object.prototype,null].includes(Object.getPrototypeOf(value)))
    throw new TypeError('plain course record required');
  const desc=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(value);
  if(keys.length!==fields.length||
     keys.some(k=>typeof k!=='string'||!fields.includes(k))||
     fields.some(k=>!Object.hasOwn(desc,k)||!Object.hasOwn(desc[k],'value')))
    throw new TypeError('exact course data fields required');
  return Object.fromEntries(fields.map(k=>[k,desc[k].value]));
}
function dense(value,min,max){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||
     value.length<min||value.length>max||Reflect.ownKeys(value).length!==value.length+1)
    throw new TypeError('bounded dense course array required');
  const desc=Object.getOwnPropertyDescriptors(value);
  return Array.from({length:value.length},(_,i)=>{
    if(!Object.hasOwn(desc,i)||!Object.hasOwn(desc[i],'value'))
      throw new TypeError('data-only course array required');
    return desc[i].value;
  });
}
function coordinate(value){
  if(typeof value!=='string'||value.length>24)
    throw new TypeError('bounded decimal coordinate string required');
  const raw=quantizeQ16(parseDecimal(value),{rounding:'exact',overflow:'reject'});
  if(Math.abs(raw)>4096*SCALE)throw new RangeError('circuit coordinate outside 4096 metres');
  return raw;
}
const sourcePoint=value=>Object.freeze(dense(value,3,3).map(coordinate));
const rawPoint=value=>Object.freeze(dense(value,3,3)
  .map(v=>BigInt(int32(v,'raw Q16.16 coordinate'))));
function circuit(value){
  if(!admittedCircuits.has(value))throw new TypeError('compiled exact circuit required');
  return value;
}
function gate(value){
  if(!admittedGates.has(value))throw new TypeError('compiled cardinal gate required');
  return value;
}
/**
 * Compile v2 cardinal X/Z checkpoint geometry and optional inert obstacle AABBs.
 * No rounding, mutable physics objects, arbitrary-angle planes or collisions.
 */
export function compileCircuitQ16(source){
  const s=dataRecord(source,circuitKeys);
  if(typeof s.id!=='string'||!ID.test(s.id)||s.version!==2||
     !Number.isSafeInteger(s.laps)||s.laps<1||s.laps>9)
    throw new TypeError('invalid circuit identity, version or lap count');
  const spawn=sourcePoint(s.spawn),ids=new Set(),gates=[];
  for(const row of dense(s.gates,4,64)){
    const g=dataRecord(row,gateKeys);
    if(typeof g.id!=='string'||!ID.test(g.id)||ids.has(g.id)||
       !['x','z'].includes(g.axis)||![1,-1].includes(g.direction))
      throw new TypeError('invalid/duplicate cardinal gate');
    ids.add(g.id);
    const xyz=[coordinate(g.x),coordinate(g.y),coordinate(g.z)];
    const width=coordinate(g.width),height=coordinate(g.height);
    if(width<4*SCALE||width>60*SCALE||
       height<4*SCALE||height>60*SCALE||
       width%2!==0||height%2!==0||xyz[1]-height/2<0)
      throw new RangeError('invalid or below-ground aperture');
    const axis=g.axis==='x'?0:2,lateral=axis===0?2:0;
    const compiled=Object.freeze({
      id:g.id,axis:g.axis,direction:g.direction,
      planeRaw:xyz[axis],sideRaw:xyz[lateral],
      bottomRaw:xyz[1]-height/2,topRaw:xyz[1]+height/2,
      halfWidthRaw:width/2
    });
    admittedGates.add(compiled);
    gates.push(compiled);
  }
  const obstacles=[];
  for(const row of dense(s.obstacles,0,96)){
    const o=dataRecord(row,obstacleKeys);
    if(typeof o.id!=='string'||!ID.test(o.id)||ids.has(o.id)||
       typeof o.color!=='string'||!COLOR.test(o.color))
      throw new TypeError('invalid/duplicate obstacle ID or colour');
    ids.add(o.id);
    const min=sourcePoint(o.min),max=sourcePoint(o.max);
    if(min.some((v,i)=>v>=max[i])||min[1]<0)
      throw new RangeError('invalid obstacle AABB bounds');
    obstacles.push(Object.freeze({id:o.id,min,max,color:o.color}));
  }
  const result=Object.freeze({
    kind:CIRCUIT_KIND,id:s.id,version:2,laps:s.laps,spawnRaw:spawn,
    gates:Object.freeze(gates),obstacles:Object.freeze(obstacles)
  });
  admittedCircuits.add(result);
  return result;
}
/** Exact proper directional intersection; t in (0,1], closed aperture. */
export function crossCircuitGateQ16(compiledGate,fromRaw,toRaw){
  gate(compiledGate);
  const from=rawPoint(fromRaw),to=rawPoint(toRaw);
  const axis=compiledGate.axis==='x'?0:2,lateral=axis===0?2:0;
  const direction=BigInt(compiledGate.direction);
  const before=(BigInt(compiledGate.planeRaw)-from[axis])*direction;
  const travel=(to[axis]-from[axis])*direction;
  if(before<=0n||travel<before)return null;
  const side=from[lateral]*travel+(to[lateral]-from[lateral])*before;
  const height=from[1]*travel+(to[1]-from[1])*before;
  if(side<BigInt(compiledGate.sideRaw-compiledGate.halfWidthRaw)*travel||
     side>BigInt(compiledGate.sideRaw+compiledGate.halfWidthRaw)*travel||
     height<BigInt(compiledGate.bottomRaw)*travel||
     height>BigInt(compiledGate.topRaw)*travel)return null;
  return Object.freeze({n:before,d:travel});
}
function makeProgress(course,fields){
  const result=Object.freeze({...fields,events:Object.freeze(fields.events)});
  progressOwners.set(result,course);return result;
}
export function newCircuitProgress(compiledCircuit){
  const c=circuit(compiledCircuit);
  return makeProgress(c,{
    nextGate:0,completedLaps:0,clearedGates:0,finished:false,
    crossed:0,events:[]
  });
}
/**
 * Advance all strictly chronologically ordered gates along one raw Q16 sweep.
 * Retains intersection fraction over a lap transition; equal times cannot
 * credit two gates. A contact tick is conservatively awarded no checkpoints.
 */
export function advanceCircuitQ16(compiledCircuit,progress,fromRaw,toRaw,{contact=false}={}){
  const c=circuit(compiledCircuit);
  if(progressOwners.get(progress)!==c)throw new TypeError('progress belongs to a different circuit');
  if(typeof contact!=='boolean')throw new TypeError('explicit boolean contact required');
  // Validate every sweep even during contact/after completion.
  const from=rawPoint(fromRaw),to=rawPoint(toRaw);
  if(progress.finished)return progress;
  if(contact)return makeProgress(c,{...progress,crossed:0,events:[]});
  const gateCount=c.gates.length;
  let nextGate=progress.nextGate,completedLaps=progress.completedLaps;
  let clearedGates=progress.clearedGates,crossed=0,finished=false;
  let previous={n:0n,d:1n};
  const events=[];
  // One segment can cross a cardinal plane at most once in its direction.
  for(let i=0;i<=gateCount;i++){
    const hit=crossCircuitGateQ16(c.gates[nextGate],fromRaw,toRaw);
    if(!hit||hit.n*previous.d<=previous.n*hit.d)break;
    previous=hit;crossed++;clearedGates++;
    events.push(Object.freeze({type:'gate',id:c.gates[nextGate].id,
      order:clearedGates}));
    nextGate++;
    if(nextGate===gateCount){
      completedLaps++;
      finished=completedLaps===c.laps;
      events.push(Object.freeze({type:finished?'finish':'lap',
        lap:completedLaps}));
      if(finished)break;
      nextGate=0;
    }
  }
  return makeProgress(c,{nextGate,completedLaps,clearedGates,finished,crossed,events});
}
