// SPDX-License-Identifier: Apache-2.0
// Demo-only Alien Math authoring adapters. Simulation and WebGL still use their
// existing numeric contracts; exact decimals are not persisted in scene files.
import {ExactRational,parseDecimal} from '../../modules/exact-rational/index.js';
import {ExactInterval} from '../../modules/exact-interval/index.js';
import {point2} from '../../modules/exact-geometry/index.js';
import {transformPoint2} from '../../modules/exact-d4/index.js';
import {quantizeQ16,rationalFromQ16} from '../../modules/rational-q16/index.js';

const AXES=['X','Y','Z'];
const POSITION_LIMIT=new ExactInterval(parseDecimal('-1000'),parseDecimal('1000'));
const STEPS=new Map([[.25,parseDecimal('0.25')],[15,parseDecimal('15')],[.1,parseDecimal('0.1')]]);

function exactPosition(values){
  if(!Array.isArray(values)||values.length!==3)
    throw new TypeError('Position requires three decimal strings: X, Y and Z');
  // Array.from also visits holes, so incomplete triples cannot bypass validation.
  return Array.from(values,(value,i)=>{
    try{return parseDecimal(value);}
    catch(error){throw new TypeError(AXES[i]+': '+error.message);}
  });
}

function positionResult(rationals){
  rationals.forEach((value,i)=>{
    if(!POSITION_LIMIT.contains(value))
      throw new RangeError(AXES[i]+': position must be within the closed interval [-1000, 1000] metres');
  });
  const decimals=rationals.map(value=>value.toDecimalExact());
  // Explicit, potentially inexact conversion only after exact input/bounds checks.
  // This is the existing scene/viewport Number boundary, not Q16 quantization.
  return {decimals,position:decimals.map(Number),fractions:rationals.map(value=>value.toString())};
}

/** Parse exact XYZ decimals, validate authoring bounds, then expose scene Numbers. */
export function parseExactPosition(values){return positionResult(exactPosition(values));}

/** Spell a stored Number as a bounded plain decimal without silently rounding. */
export function formatPositionNumber(value){
  if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1000)
    throw new RangeError('Stored position must be finite within [-1000, 1000]');
  let text=String(value);
  if(text.includes('e')){
    const sign=text[0]==='-'?'-':'';
    const [mantissa,exponent]=text.slice(sign.length).split('e');
    const [whole,fraction='']=mantissa.split('.'),digits=whole+fraction;
    const point=whole.length+Number(exponent);
    text=sign+(point<=0?'0.'+'0'.repeat(-point)+digits:
      point>=digits.length?digits+'0'.repeat(point-digits.length):
      digits.slice(0,point)+'.'+digits.slice(point));
  }
  try{return parseDecimal(text).toDecimalExact();}
  catch{
    throw new RangeError('Stored position needs more than 18 decimal places; enter a bounded decimal explicitly');
  }
}

/** Preview only. Callers must supply both rounding and overflow explicitly. */
export function previewQ16Position(values,options){
  const rationals=exactPosition(values);
  const raw=rationals.map((value,i)=>{
    try{return quantizeQ16(value,options);}
    catch(error){
      if(error instanceof RangeError)throw new RangeError(AXES[i]+': '+error.message);
      throw error;
    }
  });
  const quantized=raw.map(rationalFromQ16);
  return {raw,decimals:quantized.map(value=>value.toDecimalExact()),
    errors:quantized.map((value,i)=>value.subtract(rationals[i]).toString())};
}

/** D4 acts on the local XY position about its parent origin; Z is unchanged. */
export function transformExactPositionXY(values,operation){
  const [x,y,z]=exactPosition(values);
  const transformed=transformPoint2(operation,point2(x,y));
  return positionResult([transformed.x,transformed.y,z]);
}

/** Fixed editor grid: nearest multiple, with exact halfway ties toward +Infinity. */
export function snapEditorDelta(value,step){
  if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>10000)
    throw new RangeError('Snap movement must be finite within [-10000, 10000]');
  const grid=STEPS.get(step);
  if(!grid)throw new RangeError('Snap step must be 0.25 metres, 15 degrees or 0.1 scale');
  // Tiny pointer deltas (including subnormals) unambiguously round to zero.
  // All remaining bounded values have a plain shortest decimal spelling with
  // <=18 fractional places, accepted by ALIEN-MATH-001 without epsilon fudging.
  if(Math.abs(value)<step/2)return 0;
  const units=parseDecimal(String(value)).divide(grid);
  const n=units.numerator,d=units.denominator,remainder=n%d;
  let rounded=n/d;
  if(remainder>0n&&remainder*2n>=d)rounded++;
  else if(remainder<0n&&-remainder*2n>d)rounded--;
  return Number(grid.multiply(new ExactRational(rounded)).toDecimalExact());
}
