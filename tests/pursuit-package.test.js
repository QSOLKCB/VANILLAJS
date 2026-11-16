// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {packagePursuitRuntime,packageLabRuntime} from '../scripts/pursuit-package.mjs';

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

// Skyguard shares the same verified dependency snapshot mechanism.
test('Skyguard receives an isolated native module graph and unknown labs are rejected',async()=>{
  const root=await mkdtemp(join(tmpdir(),'skyguard-package-'));
  try{
    await mkdir(join(root,'demos/skyguard-lab/js'),{recursive:true});await mkdir(join(root,'modules/math'),{recursive:true});
    await writeFile(join(root,'demos/skyguard-lab/index.html'),'<script type="module" src="./js/start.js"></script>');
    await writeFile(join(root,'demos/skyguard-lab/js/start.js'),"import '../../../modules/math/index.js';");
    await writeFile(join(root,'modules/math/index.js'),'export const value=1;');
    const result=await packageLabRuntime(root,'skyguard-lab');assert.equal(result.files.length,2);
    assert.ok(result.entry.startsWith('demos/skyguard-lab/runtime-'));
    const prefix=result.entry.slice(0,-'demos/skyguard-lab/js/start.js'.length);
    assert.equal(await readFile(join(root,prefix,'modules/math/index.js'),'utf8'),'export const value=1;');
    await assert.rejects(()=>packageLabRuntime(root,'../outside'));
  }finally{await rm(root,{recursive:true,force:true});}
});

test('Arcade Foundry packages its root-level bootstrap and complete shared dependency graph',async()=>{
  const root=await mkdtemp(join(tmpdir(),'arcade-package-'));
  const base='demos/arcade-combat-lab',files={
    [base+'/index.html']:'<script type="module" src="./start.js"></script>',
    [base+'/start.js']:"await import('./app.js');",
    [base+'/app.js']:"import '../../modules/audio2d/index.js';",
    'modules/audio2d/index.js':'export const version=1;'
  };
  try{
    for(const [path,source] of Object.entries(files)){
      await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),source);
    }
    const first=await packageLabRuntime(root,'arcade-combat-lab');
    assert.equal(first.files.length,3);
    assert.ok(first.entry.startsWith(base+'/runtime-'));
    const prefix=first.entry.slice(0,-(base+'/start.js').length);
    for(const [path,source] of Object.entries(files).filter(([path])=>path.endsWith('.js')))
      assert.equal(await readFile(join(root,prefix,path),'utf8'),source);
    assert.ok((await readFile(join(root,base+'/index.html'),'utf8')).includes(first.entry.slice(base.length+1)));
    await writeFile(join(root,base+'/index.html'),files[base+'/index.html']);
    await writeFile(join(root,'modules/audio2d/index.js'),'export const version=2;');
    assert.notEqual((await packageLabRuntime(root,'arcade-combat-lab')).entry,first.entry);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('Block Arena startup and transitive shared-module changes produce isolated versioned graphs',async()=>{
  const root=await mkdtemp(join(tmpdir(),'fps-package-')),base='demos/block-arena-lab';
  const files={[base+'/index.html']:'<script type="module" src="./start.js"></script>',[base+'/start.js']:"await import('./app.js');",[base+'/app.js']:"import '../../modules/weapons/index.js';",'modules/weapons/index.js':'export const n=1;'};
  try{for(const [path,source]of Object.entries(files)){await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),source);}
    const first=await packageLabRuntime(root,'block-arena-lab');assert.equal(first.files.length,3);const prefix=first.entry.slice(0,-(base+'/start.js').length);
    for(const [path,source]of Object.entries(files).filter(([p])=>p.endsWith('.js')))assert.equal(await readFile(join(root,prefix,path),'utf8'),source);
    await writeFile(join(root,base+'/index.html'),files[base+'/index.html']);await writeFile(join(root,'modules/weapons/index.js'),'export const n=2;');
    const second=await packageLabRuntime(root,'block-arena-lab');assert.notEqual(first.version,second.version);assert.equal(await readFile(join(root,prefix,'modules/weapons/index.js'),'utf8'),'export const n=1;');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('HORIZON binds both entry pages to one complete immutable graph',async()=>{
  const root=await mkdtemp(join(tmpdir(),'horizon-package-')),base='demos/horizon-lab';
  const files={
    [base+'/index.html']:'<script type="module" src="./start.js"></script>',
    [base+'/drive.html']:'<script type="module" src="./drive-start.js"></script>',
    [base+'/start.js']:"import '../../modules/scenic3d/index.js';",
    [base+'/drive-start.js']:"import '../../modules/vehicle3d/index.js';",
    'modules/scenic3d/index.js':'export const geometry=1;',
    'modules/vehicle3d/index.js':'export const physics=1;'
  };
  const restorePages=async()=>{for(const path of [base+'/index.html',base+'/drive.html'])await writeFile(join(root,path),files[path]);};
  try{
    for(const [path,source]of Object.entries(files)){await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),source);}
    const first=await packageLabRuntime(root,'horizon-lab');assert.equal(first.files.length,4);
    for(const [page,start]of [['index.html','start.js'],['drive.html','drive-start.js']])
      assert.equal(await readFile(join(root,base,page),'utf8'),'<script type="module" src="./runtime-'+first.version+'/'+base+'/'+start+'"></script>');
    await restorePages();await writeFile(join(root,'modules/vehicle3d/index.js'),'export const physics=2;');
    const changed=await packageLabRuntime(root,'horizon-lab');assert.notEqual(changed.version,first.version);
    assert.equal(await readFile(join(root,base,'runtime-'+first.version,'modules/vehicle3d/index.js'),'utf8'),files['modules/vehicle3d/index.js']);
    // Both the original authoring page and the driving page advance together.
    assert.ok((await readFile(join(root,base,'index.html'),'utf8')).includes(changed.version));
    assert.ok((await readFile(join(root,base,'drive.html'),'utf8')).includes(changed.version));
  }finally{await rm(root,{recursive:true,force:true});}
});

test('missing HORIZON drive entry rejects before replacing the authoring entry',async()=>{
  const root=await mkdtemp(join(tmpdir(),'horizon-package-reject-')),base='demos/horizon-lab';
  const original='<script type="module" src="./start.js"></script>';
  try{
    await mkdir(join(root,base),{recursive:true});await writeFile(join(root,base,'index.html'),original);
    await writeFile(join(root,base,'start.js'),'export const ready=true;');
    await assert.rejects(packageLabRuntime(root,'horizon-lab'),/ENOENT/);
    assert.equal(await readFile(join(root,base,'index.html'),'utf8'),original);
    assert.ok(!(await readdir(join(root,base))).some(p=>p.startsWith('runtime-')));
  }finally{await rm(root,{recursive:true,force:true});}
});
