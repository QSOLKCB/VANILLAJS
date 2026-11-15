// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {packagePursuitRuntime} from '../scripts/pursuit-package.mjs';

const entry='demos/pursuit-lab/js/start.js',html='demos/pursuit-lab/index.html';
async function fixture(files,run){
  const root=await mkdtemp(join(tmpdir(),'pursuit-package-'));
  try{
    for(const [path,source] of Object.entries({[html]:'<script type="module" src="./js/start.js"></script>',...files})){
      await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),source);
    }
    await run(root);
  }finally{await rm(root,{recursive:true,force:true});}
}
test('Pursuit package retains native imports and binds transitive dependency bytes to the entry URL',async()=>{
  const files={
    [entry]:"import './app.js'; await import('../../../api/sound.js');",
    'demos/pursuit-lab/js/app.js':"export {value} from '../../../modules/math/index.js';",
    'api/sound.js':"import '../modules/math/index.js';",
    'modules/math/index.js':"export const value=1;"
  };
  let original;
  await fixture(files,async root=>{
    const result=await packagePursuitRuntime(root);original=result;
    assert.equal(result.files.length,4);
    const prefix=result.entry.slice(0,-entry.length);
    for(const [path,source] of Object.entries(files)){
      assert.equal(await readFile(join(root,prefix,path),'utf8'),source);
      assert.equal(await readFile(join(root,path),'utf8'),source,'shared source stays unchanged');
    }
    assert.ok((await readFile(join(root,html),'utf8')).includes(result.entry.replace('demos/pursuit-lab/','./')));
  });
  await fixture(files,async root=>assert.deepEqual(await packagePursuitRuntime(root),original));
  await fixture({...files,'modules/math/index.js':'export const value=2;'},async root=>{
    const changed=await packagePursuitRuntime(root);assert.notEqual(changed.entry,original.entry);
  });
});
test('Pursuit packaging closes cycles without duplicating module identities',async()=>{
  await fixture({[entry]:"import './other.js';",'demos/pursuit-lab/js/other.js':"import './start.js';"},async root=>{
    assert.equal((await packagePursuitRuntime(root)).files.length,2);
  });
});
test('unresolved imports fail packaging before writing a runnable snapshot',async()=>{
  for(const source of ["import 'external';","import('../../../../outside.js');","import('./missing.js');","import(location.hash);","fetch('./untracked.json');"]){
    await fixture({[entry]:source},async root=>{
      await assert.rejects(()=>packagePursuitRuntime(root));
      assert.ok(!(await readdir(join(root,'demos/pursuit-lab'))).some(p=>p.startsWith('runtime-')));
    });
  }
});
