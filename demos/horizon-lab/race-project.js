// SPDX-License-Identifier: Apache-2.0
// Separate inert race-study sidecar. Legacy visual, driving and track v1 stay intact.
import {validateScenery,ScenicRoad} from '../../modules/scenic3d/index.js';
import {vehiclePreset,validateVehicle} from '../../modules/vehicle3d/index.js';
import {defaultVehicleSound,validateVehicleSound} from '../../modules/vehicle-audio/index.js';
import {createRaceScenery} from './race-course.js';
export const RACE_PROJECT_FORMAT='qsol.vanillajs.horizon-race.v1';
export const RACE_PROJECT_BYTES=64*1024;
function record(value,keys,label){
  if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw TypeError(label+' requires an ordinary record');
  const ds=Object.getOwnPropertyDescriptors(value),actual=Reflect.ownKeys(ds);
  if(actual.length!==keys.length||actual.some(k=>typeof k!=='string'||!keys.includes(k)||!Object.hasOwn(ds[k],'value')||!ds[k].enumerable))throw TypeError(label+' has missing, unknown or executable fields');
}
function number(value,min,max,label){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw RangeError(label+' outside '+min+'..'+max);return value;}
function choice(value,values,label){if(!values.includes(value))throw TypeError('Unknown '+label);return value;}
function color(value){if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length!==3||Reflect.ownKeys(value).length!==4)throw TypeError('Paint requires three channels');const out=[];for(let i=0;i<3;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw TypeError('Paint contains executable/missing channels');out.push(number(d.value,0,1,'Paint'));}return out;}
export function raceVehicleForClass(classId='sport',preset='arcade'){
  choice(classId,['sport','touring','utility'],'vehicle class');const r=vehiclePreset(preset),dimensions={sport:[4.4,1.95,1.25,2.62,1.76,.34,1200],touring:[4.9,1.88,1.52,2.85,1.68,.35,1450],utility:[4.7,2.08,1.86,2.72,1.84,.42,1750]}[classId];
  const [length,width,height,wheelbase,track,radius,mass]=dimensions;r.name='Sunward '+classId;r.chassis={length,width,height};r.wheel={wheelbase,track,radius};r.inertia=r.inertia.map(n=>n*mass/r.mass);r.suspension.spring*=mass/r.mass;r.suspension.damper*=mass/r.mass;r.mass=mass;r.drive='all';return validateVehicle(r);
}
export function validateRaceProject(value){
  record(value,['format','version','name','scenery','vehicle','appearance','surfaces','camera','audio','race'],'Race study');
  if(value.format!==RACE_PROJECT_FORMAT||value.version!==1)throw TypeError('Unsupported race-study format/version');
  if(typeof value.name!=='string'||!value.name||value.name.length>64||value.name.trim()!==value.name||/[\u0000-\u001f\u007f]/.test(value.name))throw TypeError('Race name must be 1–64 printable characters');
  record(value.appearance,['classId','paint','roughness','metalness'],'Appearance');const a=value.appearance,appearance={classId:choice(a.classId,['sport','touring','utility'],'vehicle class'),paint:color(a.paint),roughness:number(a.roughness,.08,1,'Roughness'),metalness:number(a.metalness,0,1,'Metalness')};
  record(value.surfaces,['asphalt','gravel','terrain'],'Surface friction');const surfaces={};for(const id of ['asphalt','gravel','terrain'])surfaces[id]=number(value.surfaces[id],0,2,'Surface friction');
  record(value.camera,['mode','chaseDistance','chaseHeight','fov'],'Camera');const c=value.camera,camera={mode:choice(c.mode,['chase','bonnet','cockpit'],'camera'),chaseDistance:number(c.chaseDistance,5,18,'Chase distance'),chaseHeight:number(c.chaseHeight,2,9,'Chase height'),fov:number(c.fov,.6,1.4,'Camera field of view')};
  record(value.race,['countdownSeconds','checkpointCount','rivalSpeed','recoveryPenaltySeconds'],'Race rules');const r=value.race,race={countdownSeconds:number(r.countdownSeconds,0,5,'Countdown'),checkpointCount:number(r.checkpointCount,4,20,'Checkpoint count'),rivalSpeed:number(r.rivalSpeed,6,18,'Rival speed'),recoveryPenaltySeconds:number(r.recoveryPenaltySeconds,1,20,'Recovery penalty')};if(!Number.isInteger(race.checkpointCount))throw TypeError('Checkpoint count must be an integer');
  const scenery=validateScenery(value.scenery),road=new ScenicRoad(scenery);if(road.length<120)throw RangeError('Race road needs at least 120 m');if(scenery.road.some(k=>k.width<10))throw RangeError('Race road needs at least 10 m full width for two cars');
  const result={format:RACE_PROJECT_FORMAT,version:1,name:value.name,scenery,vehicle:validateVehicle(value.vehicle),appearance,surfaces,camera,audio:validateVehicleSound(value.audio),race};
  if(new TextEncoder().encode(JSON.stringify(result)).length>RACE_PROJECT_BYTES)throw RangeError('Race study exceeds 64 KiB');return result;
}
export function parseRaceProject(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>RACE_PROJECT_BYTES)throw RangeError('Race study exceeds 64 KiB');return validateRaceProject(JSON.parse(text));}
export function serializeRaceProject(value){return JSON.stringify(validateRaceProject(value));}
export function starterRaceProject(){return validateRaceProject({format:RACE_PROJECT_FORMAT,version:1,name:'Cape Aster — Sunward Run',scenery:createRaceScenery(),vehicle:raceVehicleForClass(),appearance:{classId:'sport',paint:[.92,.31,.09],roughness:.25,metalness:.62},surfaces:{asphalt:1,gravel:.65,terrain:.45},camera:{mode:'chase',chaseDistance:9,chaseHeight:4,fov:.92},audio:defaultVehicleSound(),race:{countdownSeconds:3,checkpointCount:8,rivalSpeed:10,recoveryPenaltySeconds:4}});}
