// SPDX-License-Identifier: Apache-2.0
// Only trusted engine bytes from the checked generated archive become code.
// Authored content passes the strict project validator and remains inert data.
import {validateProject,serializeProject,assertPlayable} from './game.js';
import {portableRuntime} from './portable-runtime.js';
import {zipStoredFiles as zipGameFiles} from '../../api/package/zip.js';
export {zipGameFiles};
const encode=text=>new TextEncoder().encode(text);
const safe=path=>typeof path==='string'&&path.length<=240&&/^[a-zA-Z0-9._/-]+$/.test(path)&&!path.startsWith('/')&&!path.split('/').some(p=>['.','..',''].includes(p));
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
const literal=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export async function exportGameMakerFiles(value){
  const project=validateProject(value);assertPlayable(project);
  const files=new Map(),sources=[];
  for(const row of portableRuntime.files){
    if(!safe(row.path)||files.has(row.path))throw Error('Invalid portable source member');
    const bytes=encode(row.text);
    if(await sha(bytes)!==row.sha256)throw Error('Damaged portable source: '+row.path);
    files.set(row.path,bytes);sources.push({path:row.path,sha256:row.sha256});
  }
  const html=files.get('demos/game-maker-lab/portable-shell.txt');
  if(!html)throw Error('Missing portable shell');
  files.delete('demos/game-maker-lab/portable-shell.txt');files.set('index.html',html);
  files.set('project.json',encode(serializeProject(project)));
  files.set('project-data.js',encode('// Authored data only; generated after strict validation.\nexport default '+literal(project)+';\n'));
  files.set('game-start.js',encode("// SPDX-License-Identifier: Apache-2.0\nimport {mountPortable} from './demos/game-maker-lab/portable.js';\nimport project from './project-data.js';\ntry { mountPortable(project); } catch(error) { document.getElementById('play-status').textContent='Game unavailable: '+error.message; }\n"));
  files.set('ENGINE_SOURCE.json',encode(JSON.stringify({format:'qsol.game-maker.source.v1',milestone:'v2.8.0 candidate',runtime:sources},null,2)+'\n'));
  files.set('ASSET_LICENSES.json',encode(JSON.stringify({note:'Authored assets retain their declared licences. OWNER-LOCAL-ONLY is not permission to redistribute. Supply required attribution for your own imports.',player:{name:project.playerSprite.name,license:project.playerSprite.license},tileset:{name:project.map.tileset.name,license:project.map.tileset.license}},null,2)+'\n'));
  files.set('.nojekyll',encode(''));
  files.set('README.txt',encode('VANILLAJS Game Maker: authored platform game\n\nExtract the complete ZIP to a new folder. Run:\npython3 -m http.server 8000 --bind 127.0.0.1\nOpen http://127.0.0.1:8000/ in a modern browser.\n\nNative modules need HTTP(S); do not double-click index.html. No npm install, remote asset, account or cloud service is required. Keep every file and directory together. The package works under a nested URL prefix. The scoped SHA-256 worker enables later offline visits after installation on HTTPS/loopback; wait for installation before disconnecting. A new browser still needs the package served once.\n\nMove with A/D or arrows; Space jumps. Use Play, Pause, Restart and Sound controls. Collect every signal, avoid hazards, reach the exit. This exports the fixed original Game Maker platform rules, not arbitrary game scripts or a universal game compiler. Your level must still be play-tested for reachability and balance.\n\nproject.json is editable authored data. Reimport it into the Game Maker Lab. ENGINE_SOURCE.json records exact engine source identities; manifest.json covers shipped bytes. Preserve LICENSE, NOTICE and asset attribution. ASSET_LICENSES.json records declared art licences; review rights before sharing.\n'));
  const entries=await Promise.all([...files].map(async([path,bytes])=>({path,bytes:bytes.length,sha256:await sha(bytes)})));
  entries.sort((a,b)=>a.path.localeCompare(b.path));
  if(entries.length>128||entries.reduce((sum,f)=>sum+f.bytes,0)>4*1024*1024)throw Error('Game package exceeds export budget');
  const version=await sha(encode(JSON.stringify(entries)+'\0'+portableRuntime.workerTemplate));
  const worker=encode(portableRuntime.workerTemplate.replace('__PACKAGE_SHA256__',version).replace('__ASSET_ENTRIES__',JSON.stringify(entries)));
  files.set('service-worker.js',worker);entries.push({path:'service-worker.js',bytes:worker.length,sha256:await sha(worker)});entries.sort((a,b)=>a.path.localeCompare(b.path));
  files.set('manifest.json',encode(JSON.stringify({version:'game-maker-v1',files:entries},null,2)+'\n'));
  return files;
}
export async function exportGameMaker(project){
  const owned=validateProject(project),files=await exportGameMakerFiles(owned);
  const slug=owned.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'my-game';
  return {blob:zipGameFiles(files),filename:slug.slice(0,64)+'.zip'};
}
