// SPDX-License-Identifier: Apache-2.0
// The lab owns this inert authoring envelope. Renderer handles never enter it.
import {starterScenery,validateScenery} from '../../modules/scenic3d/index.js';
export const HORIZON_PROJECT_FORMAT='qsol.vanillajs.horizon-lab.v1';
export const HORIZON_PROJECT_BYTES=32*1024;
const PI=Math.PI;
function record(value,keys,label){
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw TypeError(label+' must be a plain record');
  const descriptors=Object.getOwnPropertyDescriptors(value),own=Reflect.ownKeys(descriptors);
  if(own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k))||keys.some(k=>!Object.hasOwn(descriptors,k)||!Object.hasOwn(descriptors[k],'value')))throw TypeError(label+' has missing, unknown or accessor fields');
}
function number(value,min,max,label){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw RangeError(label+' is outside its bounds');return value;}
function vector(value,length,min,max,label){
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length!==length||Reflect.ownKeys(value).length!==length+1)throw TypeError(label+' must be an ordinary dense array');
  const fields=Object.getOwnPropertyDescriptors(value);return Array.from({length},(_,i)=>{if(!fields[i]||!Object.hasOwn(fields[i],'value'))throw TypeError(label+' contains an accessor or hole');return number(fields[i].value,min,max,label);});
}
export function validateHorizonProject(value){
  record(value,['format','version','name','scenery','vehicle','lighting'],'project');
  if(value.format!==HORIZON_PROJECT_FORMAT||value.version!==1)throw TypeError('Unsupported HORIZON project format/version');
  if(typeof value.name!=='string'||value.name.trim()!==value.name||value.name.length<1||value.name.length>64||/[\u0000-\u001f\u007f]/.test(value.name))throw TypeError('Study name must be 1–64 printable characters');
  record(value.vehicle,['classId','paint','roughness','metalness','steer','wheelSpin','compression','pitch','roll','brake'],'vehicle');const v=value.vehicle;
  if(!['sport','touring','utility'].includes(v.classId))throw TypeError('Unknown original vehicle class');
  record(value.lighting,['azimuth','elevation','fogDensity'],'lighting');const l=value.lighting;
  const project={format:HORIZON_PROJECT_FORMAT,version:1,name:value.name,scenery:validateScenery(value.scenery),vehicle:{classId:v.classId,paint:vector(v.paint,3,0,1,'paint'),roughness:number(v.roughness,.05,1,'roughness'),metalness:number(v.metalness,0,1,'metalness'),steer:number(v.steer,-.62,.62,'steering'),wheelSpin:number(v.wheelSpin,-2*PI,2*PI,'wheel rotation'),compression:vector(v.compression,4,0,.2,'compression'),pitch:number(v.pitch,-.15,.15,'pitch'),roll:number(v.roll,-.15,.15,'roll'),brake:number(v.brake,0,1,'brake')},lighting:{azimuth:number(l.azimuth,-PI,PI,'sun azimuth'),elevation:number(l.elevation,.1,1.4,'sun elevation'),fogDensity:number(l.fogDensity,0,.03,'fog density')}};
  if(new TextEncoder().encode(JSON.stringify(project)).length>HORIZON_PROJECT_BYTES)throw RangeError('HORIZON project exceeds 32 KiB');
  return project;
}
export function parseHorizonProject(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>HORIZON_PROJECT_BYTES)throw RangeError('HORIZON project exceeds 32 KiB');return validateHorizonProject(JSON.parse(text));}
export function serializeHorizonProject(value){return JSON.stringify(validateHorizonProject(value));}
export function starterHorizonProject(){return validateHorizonProject({format:HORIZON_PROJECT_FORMAT,version:1,name:'Aster Coast',scenery:starterScenery(),vehicle:{classId:'sport',paint:[216/255,79/255,52/255],roughness:.25,metalness:.7,steer:-12*PI/180,wheelSpin:0,compression:[.04,.04,.04,.04],pitch:0,roll:0,brake:0},lighting:{azimuth:-35*PI/180,elevation:35*PI/180,fogDensity:.004}});}
