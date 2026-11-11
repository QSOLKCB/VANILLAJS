// SPDX-License-Identifier: Apache-2.0
// MOD-SDK-002: typed ALIEN MATH course entries over the MOD-SDK-001 registry.
// This is a data-domain adapter, not a gameplay loader or executable plugin.
import {DataModRegistry,validateModManifest} from '../mod-sdk/index.js';
import {compileCourseQ16} from '../exact-course/index.js';
import {compileCircuitQ16} from '../exact-circuit/index.js';

export const COURSE_ENTRY_KIND='qsol.vanillajs.course-source.v1';
const exactOptions=Object.freeze({rounding:'exact',overflow:'reject'});

function courseData(payload){
  if(payload===null||typeof payload!=='object'||Array.isArray(payload)||
     ![Object.prototype,null].includes(Object.getPrototypeOf(payload)))
    throw new TypeError('plain course entry data required');
  const desc=Object.getOwnPropertyDescriptors(payload),keys=Reflect.ownKeys(payload);
  if(keys.length!==2||!['kind','course'].every(k=>Object.hasOwn(desc,k)&&
    Object.hasOwn(desc[k],'value'))||
    keys.some(k=>typeof k!=='string'||!['kind','course'].includes(k)))
    throw new TypeError('exact typed course entry fields required');
  if(desc.kind.value!==COURSE_ENTRY_KIND)
    throw new TypeError('unsupported course entry kind');
  const source=desc.course.value;
  if(source===null||typeof source!=='object')throw new TypeError('course object required');
  const version=Object.getOwnPropertyDescriptor(source,'version');
  if(!version||!Object.hasOwn(version,'value'))
    throw new TypeError('course version must be own data');
  if(version.value===1)return compileCourseQ16(source,exactOptions);
  if(version.value===2)return compileCircuitQ16(source);
  throw new TypeError('unsupported course version');
}
function registry(value){
  if(!(value instanceof DataModRegistry))throw new TypeError('DataModRegistry required');
  return value;
}
/**
 * Pure validation. All entries in a typed course manifest must compile
 * successfully before the caller registers any of them. No side effects.
 */
export function validateCourseMod(source){
  const manifest=validateModManifest(source);
  if(manifest.entries.length===0)throw new TypeError('course pack has no entries');
  for(const entry of manifest.entries)courseData(entry.data);
  return manifest;
}
/** Register only after full manifest and domain validation succeeds. */
export function registerCourseMod(target,source){
  registry(target);
  const manifest=validateCourseMod(source);
  return target.register(manifest);
}
/**
 * Read the current active registry snapshot. Non-course entries are ignored;
 * malformed recognized course entries are rejected rather than silently used.
 * No mutable compiled object or execution authority is serialized.
 */
export function activeCompiledCourses(target){
  registry(target);
  const compiled=[];
  for(const row of target.activeEntries()){
    const data=row.entry.data;
    if(data&&typeof data==='object'&&
       Object.hasOwn(data,'kind')&&data.kind===COURSE_ENTRY_KIND){
      compiled.push(Object.freeze({modId:row.modId,version:row.version,
        entryId:row.entry.id,compiled:courseData(data)}));
    }
  }
  return Object.freeze(compiled);
}
