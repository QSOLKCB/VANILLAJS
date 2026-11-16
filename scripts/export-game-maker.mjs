// SPDX-License-Identifier: Apache-2.0
import {readFile,mkdir,writeFile,rm,lstat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseProject} from '../demos/game-maker-lab/game.js';
import {exportGameMakerFiles} from '../demos/game-maker-lab/export.js';
import {verifyGameMakerRuntime} from './game-maker-runtime.mjs';
export async function packageGameMaker(input,output){
  await verifyGameMakerRuntime();
  if((await lstat(input)).size>1024*1024)throw Error('Project exceeds 1 MiB');
  const project=parseProject(await readFile(input,'utf8')),files=await exportGameMakerFiles(project),out=resolve(output);
  await mkdir(out); // Exclusive: never overwrite an existing project/directory.
  try{for(const [path,bytes] of files){const target=resolve(out,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});}}
  catch(error){await rm(out,{recursive:true,force:true});throw error;}
  return {directory:out,files:files.size};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [input,flag,output,...extra]=process.argv.slice(2);
  if(!input||flag!=='--out'||!output||extra.length)throw Error('Usage: node scripts/export-game-maker.mjs PROJECT.json --out NEW_DIRECTORY');
  console.log(JSON.stringify(await packageGameMaker(input,output)));
}
