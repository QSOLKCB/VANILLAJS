// SPDX-License-Identifier: Apache-2.0
// Local build tool: accepts project data, never project-supplied code.
import {readFile,writeFile,mkdir,rm,lstat} from 'node:fs/promises';
import {resolve,dirname,relative,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {parseProject,MAX_PROJECT_BYTES} from '../demos/editor/asset-foundry.js';
import {exportGame} from '../demos/editor/game-export.js';
const root=resolve(import.meta.dirname,'..');
const sha=data=>createHash('sha256').update(data).digest('hex');
// Follow imports in trusted engine files only, including the optional GPU backend.
export async function gameRuntimeFiles(){
  const pending=['demos/editor/game-player.js'],found=new Map();
  while(pending.length){
    const name=pending.pop();if(found.has(name))continue;
    if(!/^(modules|demos\/editor|demos\/gpu-lab)\/[a-zA-Z0-9_./-]+\.js$/.test(name)||name.split('/').includes('..'))
      throw new Error('Runtime dependency outside game allowlist: '+name);
    const bytes=await readFile(resolve(root,name));found.set(name,bytes);
    for(const match of bytes.toString('utf8').matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)){
      if(!match[1].startsWith('.'))throw new Error('External runtime dependency: '+match[1]);
      pending.push(relative(root,resolve(root,dirname(name),match[1])).split(sep).join('/'));
    }
  }
  return found;
}
export async function packageGame(projectFile,output){
  const input=resolve(projectFile),out=resolve(output);
  if((await lstat(input)).size>MAX_PROJECT_BYTES)throw new RangeError('Project exceeds 256 KiB');
  const {scene,library,graphics}=parseProject(await readFile(input,'utf8'));
  const files=await gameRuntimeFiles();
  files.set('index.html',Buffer.from(exportGame(scene,library,{optionalGPU:graphics?.optionalGPU??false,packaged:true})));
  for(const name of ['LICENSE','NOTICE','offline/register.js'])files.set(name,await readFile(resolve(root,name)));
  files.set('.nojekyll',Buffer.from(''));
  files.set('README.txt',Buffer.from('VANILLAJS authored game preview\n\nServe this folder over HTTP(S); do not open index.html with file://.\nLocal: python3 -m http.server 8000 --bind 127.0.0.1\nThen open http://127.0.0.1:8000/ . Keep every folder together.\n\nWASD: move. Space: jump. Pause/Resume and Restart are on screen.\nThe verified service worker enables offline reload after initial installation\non HTTPS or loopback. The complete folder also runs on a local server offline.\n\nThis is the experimental editor preview: box collisions and trigger events,\nnot a complete game rules or scripting system. Keep your editable project\nJSON separately. Review asset rights before sharing; see LICENSE and NOTICE.\n'));
  const entries=[...files].map(([path,bytes])=>({path,bytes:bytes.length,sha256:sha(bytes)})).sort((a,b)=>a.path.localeCompare(b.path));
  if(entries.reduce((n,e)=>n+e.bytes,0)>16*1024*1024)throw new RangeError('Package exceeds 16 MiB');
  const template=await readFile(resolve(root,'scripts/service-worker.template.js'),'utf8');
  const version=sha(JSON.stringify(entries)+'\0'+template);
  const worker=Buffer.from(template.replace('__PACKAGE_SHA256__',version).replace('__ASSET_ENTRIES__',JSON.stringify(entries)));
  files.set('service-worker.js',worker);
  entries.push({path:'service-worker.js',bytes:worker.length,sha256:sha(worker)});
  entries.sort((a,b)=>a.path.localeCompare(b.path));
  files.set('manifest.json',Buffer.from(JSON.stringify({version:'editor-game-v1',files:entries},null,2)+'\n'));
  // Exclusive creation: never overwrite a game folder or checkout.
  await mkdir(out);
  try{
    for(const [name,bytes] of files){const target=resolve(out,name);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});}
  }catch(error){await rm(out,{recursive:true,force:true});throw error;}
  return {directory:out,files:files.size,bytes:entries.reduce((n,e)=>n+e.bytes,0)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const [input,flag,output,...extra]=process.argv.slice(2);
  if(!input||flag!=='--out'||!output||extra.length){console.error('Usage: node scripts/export-game.js project.vproject.json --out NEW_FOLDER');process.exitCode=1;}
  else try{console.log(JSON.stringify(await packageGame(input,output)));}
  catch(error){console.error('Game export failed: '+error.message);process.exitCode=1;}
}
