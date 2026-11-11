// SPDX-License-Identifier: Apache-2.0
// ALIEN-MATH-004: origin-centred D4 actions for bounded exact XY authoring.
import {ExactRational} from '../exact-rational/index.js';
import {ExactInterval} from '../exact-interval/index.js';
import {ExactPoint2, ExactBox2, point2, boxFromCorners} from '../exact-geometry/index.js';

// r(x,y)=(-y,x), s(x,y)=(x,-y); entries represent r^k s^f.
export const D4_ELEMENTS=Object.freeze(['e','r','r2','r3','s','rs','r2s','r3s']);
function element(value){
  if(typeof value!=='string')throw new TypeError('canonical D4 element required');
  const i=D4_ELEMENTS.indexOf(value);
  if(i<0)throw new TypeError('canonical D4 element required');
  return i;
}
/** composeD4(a,b) applies b first, then a. */
export function composeD4(a,b){
  const i=element(a),j=element(b),f=i>=4,h=j>=4;
  const k=((i%4)+(f?-(j%4):j%4)+4)%4;
  return D4_ELEMENTS[k+(f!==h?4:0)];
}
export function inverseD4(g){const i=element(g);return D4_ELEMENTS[i>=4?i:(4-i)%4];}
export function determinantD4(g){return element(g)<4?1:-1;}

const getter=(type,key)=>Object.getOwnPropertyDescriptor(type.prototype,key).get;
const px=getter(ExactPoint2,'x'),py=getter(ExactPoint2,'y');
const bx=getter(ExactBox2,'x'),by=getter(ExactBox2,'y');
const lo=getter(ExactInterval,'lower'),hi=getter(ExactInterval,'upper');
const num=getter(ExactRational,'numerator'),den=getter(ExactRational,'denominator');
function coordinates(p){
  if(p===null||typeof p!=='object'||Object.getPrototypeOf(p)!==ExactPoint2.prototype)throw new TypeError('genuine ExactPoint2 required');
  // Captured original accessors authenticate private fields; no shadow getters.
  return [px.call(p),py.call(p)];
}
const negative=q=>new ExactRational(-num.call(q),den.call(q));
function action(i,x,y){
  if(i>=4)y=negative(y);
  switch(i%4){
    case 0:return point2(x,y);
    case 1:return point2(negative(y),x);
    case 2:return point2(negative(x),negative(y));
    default:return point2(y,negative(x));
  }
}
/** Total on genuine bounded points: only permutations and sign changes. */
export function transformPoint2(g,p){const i=element(g);return action(i,...coordinates(p));}
/** D4 maps an axis-aligned closed box to another, including point/line boxes. */
export function transformBox2(g,box){
  const i=element(g);
  if(box===null||typeof box!=='object'||Object.getPrototypeOf(box)!==ExactBox2.prototype)throw new TypeError('genuine ExactBox2 required');
  const x=bx.call(box),y=by.call(box);
  return boxFromCorners(action(i,lo.call(x),lo.call(y)),action(i,hi.call(x),hi.call(y)));
}
function difference(a,b){return [num.call(a)*den.call(b)-num.call(b)*den.call(a),den.call(a)*den.call(b)];}
function gcd(a,b){while(b!==0n)[a,b]=[b,a%b];return a;}
/** Exact squared Euclidean distance; reject only if the reduced result exceeds R's cap. */
export function squaredDistance2(a,b){
  const [ax,ay]=coordinates(a),[bx,by]=coordinates(b);
  const [xn,xd]=difference(ax,bx),[yn,yd]=difference(ay,by);
  // At most 2051 numerator bits / 2048 denominator bits before reduction.
  const n=xn*xn*yd*yd+yn*yn*xd*xd,d=xd*xd*yd*yd;
  const common=gcd(n,d);
  return new ExactRational(n/common,d/common);
}
