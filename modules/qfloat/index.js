// SPDX-License-Identifier: Apache-2.0
// QFLOAT-001 first-party authoring facade. Values are checked Q16.16 int32.
// This is a readable input/output adapter, NOT an alternative math kernel.
import {SCALE,INT_MIN,INT_MAX,int32,add,subtract,multiply,divide,
  fromRatio,sqrt,toNumber} from '../integer-math/index.js';

const BASE=BigInt(SCALE),DECIMAL=/^-?(?:0|[1-9][0-9]{0,4})(?:\.[0-9]{1,16})?$/;
const DEC=10000000000000000n;
function rawOf(value){
  if(!(value instanceof QFloat))throw new TypeError('QFloat required');
  return value.raw;
}
export class QFloat{
  #raw;
  constructor(raw){this.#raw=int32(raw);Object.freeze(this);}
  get raw(){return this.#raw;}
  // Float presentation is explicit; never used in authoritative operations.
  get number(){return toNumber(this.#raw);}
  add(other){return new QFloat(add(this.#raw,rawOf(other)));}
  subtract(other){return new QFloat(subtract(this.#raw,rawOf(other)));}
  multiply(other){return new QFloat(multiply(this.#raw,rawOf(other)));}
  divide(other){return new QFloat(divide(this.#raw,rawOf(other)));}
  sqrt(){return new QFloat(sqrt(this.#raw));}
  compare(other){const b=rawOf(other);return this.#raw===b?0:this.#raw>b?1:-1;}
  exact(){
    const n=BigInt(this.#raw),abs=n<0n?-n:n;
    return (n<0n?'-':'')+String(abs/BASE)+'.'+
      String((abs%BASE)*(DEC/BASE)).padStart(16,'0');
  }
  approx(digits=3){
    if(!Number.isInteger(digits)||digits<0||digits>12)
      throw new RangeError('digits must be 0..12');
    return this.number.toFixed(digits);
  }
  toString(){return this.exact();}
  toJSON(){return {kind:'qsol.qfloat.q16.v1',raw:this.#raw};}
  valueOf(){throw new TypeError('implicit QFloat to Float64 forbidden');}
  [Symbol.toPrimitive](hint){
    if(hint==='string')return this.exact();
    throw new TypeError('implicit QFloat to Float64 forbidden');
  }
}
export function fromRaw(raw){return new QFloat(raw);}
export function fromDecimal(text){
  if(typeof text!=='string'||text.length>24||!DECIMAL.test(text))
    throw new TypeError('canonical bounded decimal string required');
  const negative=text.startsWith('-'),positive=negative?text.slice(1):text,
    [whole,part='']=positive.split('.'),den=10n**BigInt(part.length);
  const numerator=BigInt(whole)*den+BigInt(part||'0');
  const raw=(negative?-1n:1n)*numerator*BASE/den;
  if(raw<BigInt(INT_MIN)||raw>BigInt(INT_MAX))
    throw new RangeError('decimal outside Q16.16 int32 domain');
  return new QFloat(Number(raw));
}
export function fromFraction(numerator,denominator=1){
  return new QFloat(fromRatio(numerator,denominator));
}
export function fromJSON(record){
  if(!record||typeof record!=='object'||Array.isArray(record)||
     Object.keys(record).length!==2||
     !Object.hasOwn(record,'kind')||!Object.hasOwn(record,'raw')||
     record.kind!=='qsol.qfloat.q16.v1')
    throw new TypeError('invalid QFloat serialization');
  return new QFloat(record.raw);
}
export class QPoint2{
  #x;#y;
  constructor(x,y){this.#x=rawOf(x);this.#y=rawOf(y);Object.freeze(this);}
  get x(){return fromRaw(this.#x);}
  get y(){return fromRaw(this.#y);}
  get raw(){return Object.freeze([this.#x,this.#y]);}
  translate(dx,dy){return new QPoint2(
    fromRaw(add(this.#x,rawOf(dx))),fromRaw(add(this.#y,rawOf(dy)))
  );}
  toJSON(){return {kind:'qsol.qfloat.point2.v1',x:this.#x,y:this.#y};}
}
export function point(x,y){return new QPoint2(x,y);}
