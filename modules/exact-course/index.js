// SPDX-License-Identifier: Apache-2.0
// Optional authoring-only ALIEN MATH bridge for -Z drone-course gates.
import {ExactRational,parseDecimal} from '../exact-rational/index.js';
import {quantizeQ16} from '../rational-q16/index.js';
import {int32} from '../integer-math/index.js';

const admittedCourses=new WeakSet(),admittedGates=new WeakSet();
const q=n=>new ExactRational(BigInt(n));
const ZERO=q(0),TWO=q(2),FOUR=q(4),HUNDRED=q(100),TWO_HUNDRED=q(200),MIN_Z=q(-32767);

function dataRecord(value,keys){
  if(value===null||typeof value!=='object'||
    ![Object.prototype,null].includes(Object.getPrototypeOf(value)))
    throw new TypeError('plain record required');
  const descriptors=Object.getOwnPropertyDescriptors(value),own=Reflect.ownKeys(value);
  if(own.length!==keys.length||keys.some(k=>!Object.hasOwn(descriptors,k)||
    !Object.hasOwn(descriptors[k],'value'))||
    own.some(k=>typeof k!=='string'||!keys.includes(k)))
    throw new TypeError('exact own data properties required');
  return Object.fromEntries(keys.map(k=>[k,descriptors[k].value]));
}
function arrayData(value,min,max){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||
    value.length<min||value.length>max||Reflect.ownKeys(value).length!==value.length+1)
    throw new TypeError('bounded dense array required');
  const d=Object.getOwnPropertyDescriptors(value);
  return Array.from({length:value.length},(_,i)=>{
    if(!Object.hasOwn(d,i)||!Object.hasOwn(d[i],'value'))
      throw new TypeError('dense data-only array required');
    return d[i].value;
  });
}
function rawPoint(value){
  return arrayData(value,3,3).map(n=>BigInt(int32(n,'signed Q16.16 coordinate')));
}
/**
 * Accept a finite course of decimal-string XY rectangular apertures located
 * on monotonically decreasing -Z planes. Both Q16 policies are mandatory.
 */
export function compileCourseQ16(source,options){
  const {id,version,gates}=dataRecord(source,['id','version','gates']);
  if(typeof id!=='string'||!/^[a-z][a-z0-9-]{0,47}$/.test(id)||version!==1)
    throw new TypeError('invalid course identity');
  const entries=arrayData(gates,2,64),seen=new Set(),compiled=[];
  let previousZ=ZERO;
  for(const value of entries){
    const row=dataRecord(value,['id','x','y','z','width','height']);
    if(typeof row.id!=='string'||!/^[a-zA-Z0-9-]{1,32}$/.test(row.id)||
       seen.has(row.id))throw new TypeError('duplicate or invalid gate ID');
    seen.add(row.id);
    const x=parseDecimal(row.x),y=parseDecimal(row.y),z=parseDecimal(row.z);
    const width=parseDecimal(row.width),height=parseDecimal(row.height);
    if(x.abs().compare(TWO_HUNDRED)>0||y.compare(ZERO)<0||
       y.compare(TWO_HUNDRED)>0||z.compare(MIN_Z)<0||
       previousZ.subtract(z).compare(FOUR)<0||
       width.compare(TWO)<0||width.compare(HUNDRED)>0||
       height.compare(TWO)<0||height.compare(HUNDRED)>0)
      throw new RangeError('gate bounds or monotone plane order');
    previousZ=z;
    const halfW=width.divide(TWO),halfH=height.divide(TWO);
    const gate=Object.freeze({
      id:row.id,
      leftRaw:quantizeQ16(x.subtract(halfW),options),
      rightRaw:quantizeQ16(x.add(halfW),options),
      bottomRaw:quantizeQ16(y.subtract(halfH),options),
      topRaw:quantizeQ16(y.add(halfH),options),
      zRaw:quantizeQ16(z,options)
    });
    if(gate.leftRaw>=gate.rightRaw||gate.bottomRaw>=gate.topRaw)
      throw new RangeError('quantization collapsed an aperture');
    admittedGates.add(gate);compiled.push(gate);
  }
  const result=Object.freeze({kind:'qsol.vanillajs.alien-course.v1',
    id,version,gates:Object.freeze(compiled)});
  admittedCourses.add(result);
  return result;
}
/** Exact BigInt intersection of a raw Q16.16 segment with a closed aperture. */
export function crossesGateQ16(gate,from,to){
  if(!admittedGates.has(gate))throw new TypeError('compiled gate required');
  const a=rawPoint(from),b=rawPoint(to),plane=BigInt(gate.zRaw);
  if(a[2]<=plane||b[2]>plane)return false;
  const den=a[2]-b[2],offset=a[2]-plane;
  const x=a[0]*den+(b[0]-a[0])*offset;
  const y=a[1]*den+(b[1]-a[1])*offset;
  return x>=BigInt(gate.leftRaw)*den&&x<=BigInt(gate.rightRaw)*den&&
    y>=BigInt(gate.bottomRaw)*den&&y<=BigInt(gate.topRaw)*den;
}
/** Consume all consecutive gates along one sweep; stop at the first miss. */
export function advanceCourseQ16(course,nextGate,from,to){
  if(!admittedCourses.has(course))throw new TypeError('compiled course required');
  if(!Number.isSafeInteger(nextGate)||nextGate<0||nextGate>course.gates.length)
    throw new RangeError('invalid next gate index');
  rawPoint(from);rawPoint(to);
  let i=nextGate;
  while(i<course.gates.length&&crossesGateQ16(course.gates[i],from,to))i++;
  return Object.freeze({nextGate:i,crossed:i-nextGate,finished:i===course.gates.length});
}
