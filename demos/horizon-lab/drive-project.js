// SPDX-License-Identifier: Apache-2.0
// A separate lab sidecar: existing HORIZON visual-study v1 is unchanged.
import {validateScenery} from '../../modules/scenic3d/index.js';
import {vehiclePreset,validateVehicle} from '../../modules/vehicle3d/index.js';
import {createCourseScenery} from './drive-world.js';
export const DRIVE_PROJECT_FORMAT='qsol.vanillajs.horizon-drive.v1';
export const DRIVE_PROJECT_BYTES=48*1024;
function record(value,keys,label){
  if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw TypeError(label+' requires an ordinary record');
  const descriptors=Object.getOwnPropertyDescriptors(value),own=Reflect.ownKeys(descriptors);
  if(own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k)||!Object.hasOwn(descriptors[k],'value')||!descriptors[k].enumerable))throw TypeError(label+' has missing, unknown or executable fields');
}
export function validateDriveProject(value){
  record(value,['format','version','name','vehicle','scenery','course','surfaces'],'Driving study');
  if(value.format!==DRIVE_PROJECT_FORMAT||value.version!==1)throw TypeError('Unsupported driving-study format/version');
  if(typeof value.name!=='string'||value.name.length<1||value.name.length>64||value.name.trim()!==value.name||/[\u0000-\u001f\u007f]/.test(value.name))throw TypeError('Study name must be 1–64 printable characters');
  if(!['pad','ramp','coast'].includes(value.course))throw TypeError('Unknown proving course');
  record(value.surfaces,['asphalt','gravel','terrain'],'Surface friction');const surfaces={};
  for(const [id,n] of Object.entries(value.surfaces)){if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>2)throw RangeError('Surface friction must be 0..2');surfaces[id]=n;}
  const result={format:DRIVE_PROJECT_FORMAT,version:1,name:value.name,vehicle:validateVehicle(value.vehicle),scenery:validateScenery(value.scenery),course:value.course,surfaces};
  if(new TextEncoder().encode(JSON.stringify(result)).length>DRIVE_PROJECT_BYTES)throw RangeError('Driving study exceeds 48 KiB');return result;
}
export function parseDriveProject(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>DRIVE_PROJECT_BYTES)throw RangeError('Driving study exceeds 48 KiB');return validateDriveProject(JSON.parse(text));}
export function serializeDriveProject(value){return JSON.stringify(validateDriveProject(value));}
export function starterDriveProject(profile='arcade'){
  return validateDriveProject({format:DRIVE_PROJECT_FORMAT,version:1,name:'Aster handling study',vehicle:vehiclePreset(profile),scenery:createCourseScenery('pad'),course:'pad',surfaces:{asphalt:1,gravel:.65,terrain:.45}});
}
