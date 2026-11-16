// SPDX-License-Identifier: Apache-2.0
import {readFile,mkdir,writeFile,rm,lstat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseRaceProject,RACE_PROJECT_BYTES} from '../demos/horizon-lab/race-project.js';
import {exportHorizonRaceFiles} from '../demos/horizon-lab/race-export.js';
import {verifyHorizonRaceRuntime} from './horizon-race-runtime.mjs';
export async function packageHorizonRace(input,output){
  await verifyHorizonRaceRuntime();
  const info=await lstat(input);
  if(!info.isFile()||info.isSymbolicLink())throw Error('Race project must be a regular local file');
  if(info.size>RACE_PROJECT_BYTES)throw Error('Race project exceeds 64 KiB');
  const project=parseRaceProject(await readFile(input,'utf8')),files=await exportHorizonRaceFiles(project),out=resolve(output);
  await mkdir(out); // Exclusive: never overwrite an existing project/directory.
  try{for(const [path,bytes] of files){const target=resolve(out,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});}}
  catch(error){await rm(out,{recursive:true,force:true});throw error;}
  return {directory:out,files:files.size};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [input,flag,output,...extra]=process.argv.slice(2);
  if(!input||flag!=='--out'||!output||extra.length)throw Error('Usage: node scripts/export-horizon-race.mjs PROJECT.json --out NEW_DIRECTORY');
  console.log(JSON.stringify(await packageHorizonRace(input,output)));
}
