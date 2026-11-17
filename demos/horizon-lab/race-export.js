// SPDX-License-Identifier: Apache-2.0
// Only trusted engine bytes from the checked generated archive become code.
// Authored content passes the strict project validator and remains inert data.
import {validateRaceProject,serializeRaceProject} from './race-project.js';
import {raceRuntime} from './race-runtime.js';
import {zipStoredFiles} from '../../api/package/zip.js';
import {fileModuleArchive,fileModuleSource} from './race-file-source.js';
const encode=text=>new TextEncoder().encode(text);
const safe=path=>typeof path==='string'&&path.length<=240&&/^[a-zA-Z0-9._/-]+$/.test(path)&&!path.startsWith('/')&&!path.split('/').some(p=>['.','..',''].includes(p));
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
const literal=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export async function exportHorizonRaceFiles(value){
  const project=validateRaceProject(value);
  const files=new Map(),sources=[],localModules={};
  for(const row of raceRuntime.files){
    if(!safe(row.path)||files.has(row.path))throw Error('Invalid portable source member');
    const bytes=encode(row.text);
    if(await sha(bytes)!==row.sha256)throw Error('Damaged portable source: '+row.path);
    if(row.path.endsWith('.js')&&row.path!=='offline/register.js'&&row.path!=='demos/horizon-lab/race-launch.js')localModules[row.path]=fileModuleSource(row.text,row.links);
    files.set(row.path,bytes);sources.push({path:row.path,sha256:row.sha256});
  }
  const html=files.get('demos/horizon-lab/race-portable-shell.txt');
  if(!html)throw Error('Missing portable shell');
  files.delete('demos/horizon-lab/race-portable-shell.txt');files.set('index.html',html);
  files.set('project.json',encode(serializeRaceProject(project)));
  files.set('project-data.js',encode('// Authored data only; generated after strict validation.\nexport default '+literal(project)+';\n'));
  const gameStart=(playerModule,projectModule)=>`// SPDX-License-Identifier: Apache-2.0\nimport {mountRacePlayer} from '${playerModule}';\nimport project from '${projectModule}';\ntry { const player=mountRacePlayer(project); globalThis.__horizonRace=Object.freeze({snapshot:()=>player.snapshot()}); document.documentElement.dataset.labReady='horizon-race'; } catch(error) { document.getElementById('race-status').textContent='Race unavailable: '+error.message; }\n`;
  const playerPath='demos/horizon-lab/race-player.js';
  files.set('game-start.js',encode(gameStart('./'+playerPath,'./project-data.js')));
  localModules['game-start.js']=gameStart('horizon-file/'+playerPath,'horizon-file/project-data.js');
  localModules['project-data.js']=new TextDecoder().decode(files.get('project-data.js'));
  files.set('race-file.js',encode(fileModuleArchive('game-start.js',localModules)));
  files.set('ENGINE_SOURCE.json',encode(JSON.stringify({format:'qsol.horizon-race.source.v1',milestone:'HORIZON-003 / v2.9.0 candidate',runtime:sources},null,2)+'\n'));
  files.set('ASSET_LICENSES.json',encode(JSON.stringify({license:'Apache-2.0',note:'Original procedural VANILLAJS geometry and sound; no external art or recordings. Preserve LICENSE and NOTICE. Authored recipe rights remain with its author.'},null,2)+'\n'));
  files.set('.nojekyll',encode(''));
  files.set('README.txt',encode('VANILLAJS HORIZON: authored scenic race\n\nExtract the complete ZIP and open index.html to play directly from disk. To use a local web server instead, run:\npython3 -m http.server 8000 --bind 127.0.0.1\nOpen http://127.0.0.1:8000/ in a modern WebGL-capable browser.\n\nNo npm install, downloaded asset, account or cloud service is needed. Keep all files together. Nested URL prefixes are supported. The scoped SHA-256 worker supports subsequent offline visits on HTTPS/loopback after successful installation; a new browser still needs the package served once.\n\nUse the visible controls and driving instructions. Pass the ordered checkpoints, race the physics-driven rival and reach the finish ahead of the rival. Pause, restart, recover and switch cameras with the on-screen controls. Sound starts only after the Sound button gesture.\n\nThis is a complete single-route race with the HORIZON demonstration rules, not an arbitrary game compiler. Editing routes or handling requires gameplay testing: schema acceptance cannot prove finishability or balance. No multiplayer, car-to-car rigid-body impacts, collision against decorative buildings, or real-world vehicle fidelity is promised.\n\nproject.json is editable inert data; reimport it into HORIZON Race Foundry. ENGINE_SOURCE.json records exact runtime source hashes, manifest.json covers shipped bytes, and LICENSE/NOTICE/ASSET_LICENSES.json preserve provenance. Use an owner-approved immutable engine release for a later Games2 adoption.\n'));
  const entries=await Promise.all([...files].map(async([path,bytes])=>({path,bytes:bytes.length,sha256:await sha(bytes)})));
  entries.sort((a,b)=>a.path.localeCompare(b.path));
  if(entries.length>128||entries.reduce((sum,f)=>sum+f.bytes,0)>4*1024*1024)throw Error('Game package exceeds export budget');
  const version=await sha(encode(JSON.stringify(entries)+'\0'+raceRuntime.workerTemplate));
  const worker=encode(raceRuntime.workerTemplate.replace('__PACKAGE_SHA256__',version).replace('__ASSET_ENTRIES__',JSON.stringify(entries)));
  files.set('service-worker.js',worker);entries.push({path:'service-worker.js',bytes:worker.length,sha256:await sha(worker)});entries.sort((a,b)=>a.path.localeCompare(b.path));
  files.set('manifest.json',encode(JSON.stringify({version:'horizon-race-v1',files:entries},null,2)+'\n'));
  return files;
}
export async function exportHorizonRace(project){
  const owned=validateRaceProject(project),files=await exportHorizonRaceFiles(owned);
  const slug=owned.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'my-race';
  return {blob:zipStoredFiles(files),filename:slug.slice(0,64)+'.zip'};
}
