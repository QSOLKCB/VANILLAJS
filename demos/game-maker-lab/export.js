// SPDX-License-Identifier: Apache-2.0
// Only trusted engine bytes from the checked generated archive become code.
// Authored content passes the strict project validator and remains inert data.
import {validateProject,serializeProject,assertPlayable} from './game.js';
import {portableRuntime} from './portable-runtime.js';
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
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
/** Standard ZIP STORE records. No compression library, paths or code from a project. */
export function zipGameFiles(files){
  if(!(files instanceof Map)||files.size<1||files.size>128)throw Error('Invalid ZIP inventory');
  const chunks=[],directory=[];let offset=0,total=0;
  for(const [path,bytes] of [...files].sort(([a],[b])=>a.localeCompare(b))){
    if(!safe(path)||!(bytes instanceof Uint8Array))throw Error('Invalid ZIP member');
    total+=bytes.length;if(total>5*1024*1024)throw Error('ZIP exceeds 5 MiB');
    const name=encode(path),crc=crc32(bytes),header=new Uint8Array(30+name.length),view=new DataView(header.buffer);
    view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x800,true);view.setUint16(12,33,true);
    view.setUint32(14,crc,true);view.setUint32(18,bytes.length,true);view.setUint32(22,bytes.length,true);view.setUint16(26,name.length,true);header.set(name,30);
    chunks.push(header,bytes);
    const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);
    c.setUint32(16,crc,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.set(name,46);directory.push(central);offset+=header.length+bytes.length;
  }
  const centralSize=directory.reduce((n,bytes)=>n+bytes.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);
  v.setUint32(0,0x06054b50,true);v.setUint16(8,files.size,true);v.setUint16(10,files.size,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
  return new Blob([...chunks,...directory,end],{type:'application/zip'});
}
export async function exportGameMaker(project){
  const owned=validateProject(project),files=await exportGameMakerFiles(owned);
  const slug=owned.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'my-game';
  return {blob:zipGameFiles(files),filename:slug.slice(0,64)+'.zip'};
}
