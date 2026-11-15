// SPDX-License-Identifier: Apache-2.0
// Keep a newly deployed lab's complete native-module graph out of older
// service workers' URL inventories. Source files remain shared and unchanged.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {hash,jsDependencies,resolveLocal} from './browser-dependencies.mjs';

export async function packagePursuitRuntime(root){
  const entry='demos/pursuit-lab/js/start.js',htmlPath='demos/pursuit-lab/index.html';
  const files=new Map(),pending=[entry];let size=0;
  while(pending.length){
    const path=pending.pop();if(files.has(path))continue;
    if(!/^(?:api|modules|demos\/pursuit-lab)\/[a-zA-Z0-9_./-]+\.js$/.test(path)||path.split('/').includes('..'))throw Error('Unsupported Pursuit dependency: '+path);
    const bytes=await readFile(join(root,path)),deps=jsDependencies(bytes.toString('utf8'));
    if(deps.issues.length)throw Error('Unresolved Pursuit dependency in '+path+': '+deps.issues.join(', '));
    files.set(path,bytes);size+=bytes.length;
    if(files.size>128||size>1024*1024)throw Error('Pursuit module package exceeds its budget');
    for(const spec of deps.imports)pending.push(resolveLocal(path,spec));
  }
  const rows=[...files].map(([path,bytes])=>({path,sha256:hash(bytes)})).sort((a,b)=>a.path.localeCompare(b.path));
  const version=hash(JSON.stringify(rows)),prefix='demos/pursuit-lab/runtime-'+version;
  const html=await readFile(join(root,htmlPath),'utf8'),marker='src="./js/start.js"';
  if(html.split(marker).length!==2)throw Error('Expected one Pursuit startup entry');
  for(const [path,bytes] of files){
    const target=join(root,prefix,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes);
  }
  await writeFile(join(root,htmlPath),html.replace(marker,`src="./runtime-${version}/${entry}"`));
  return {entry:prefix+'/'+entry,version,files:rows};
}
