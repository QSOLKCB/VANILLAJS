// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {exportGameMakerFiles,exportGameMaker,zipGameFiles} from '../demos/game-maker-lab/export.js';
import {starterProject,emptyProject} from '../demos/game-maker-lab/starter.js';
import {parseProject} from '../demos/game-maker-lab/game.js';
import {generateSprite} from '../modules/sprite2d/index.js';
import {runtimeArchive,verifyGameMakerRuntime} from '../scripts/game-maker-runtime.mjs';
import {packageGameMaker} from '../scripts/export-game-maker.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('portable source archive exactly matches its native module closure and notices',async()=>{
  await verifyGameMakerRuntime();
  const archive=await runtimeArchive();
  assert.ok(archive.files.some(f=>f.path==='api/game-maker/index.js'));
  assert.ok(archive.files.some(f=>f.path==='modules/tilemap/index.js'));
  assert.ok(archive.files.some(f=>f.path==='modules/motion2d/index.js'));
  assert.ok(!archive.files.some(f=>/app\.js|export\.js|portable-runtime|node_modules|tests\//.test(f.path)));
  for(const f of archive.files)assert.equal(hash(Buffer.from(f.text)),f.sha256);
});
test('complete game package preserves exact data, source, licences and scoped digest worker',async()=>{
  const p=starterProject(),files=await exportGameMakerFiles(p),again=await exportGameMakerFiles(p);
  assert.deepEqual(files,again,'same admitted project and source yield exact exported files');
  const manifest=JSON.parse(new TextDecoder().decode(files.get('manifest.json')));
  assert.equal(manifest.version,'game-maker-v1');
  assert.equal(manifest.files.length,files.size-1);
  for(const f of manifest.files){assert.equal(hash(files.get(f.path)),f.sha256);assert.equal(files.get(f.path).length,f.bytes);}
  assert.deepEqual(JSON.parse(new TextDecoder().decode(files.get('project.json'))),p);
  for(const name of ['LICENSE','NOTICE','offline/register.js'])assert.deepEqual(Buffer.from(files.get(name)),await readFile(new URL('../'+name,import.meta.url)));
  assert.match(new TextDecoder().decode(files.get('service-worker.js')),/self.registration.scope/);
  assert.ok(!new TextDecoder().decode(files.get('service-worker.js')).includes('__PACKAGE_SHA256__'));
  const changed=structuredClone(p);changed.name+=' changed';
  assert.notDeepEqual((await exportGameMakerFiles(changed)).get('service-worker.js'),files.get('service-worker.js'));
});
test('downloaded ZIP passes Python standard-library CRC/inventory validation',async()=>{
  const p=starterProject(),files=await exportGameMakerFiles(p),{blob,filename}=await exportGameMaker(p);
  assert.equal(blob.type,'application/zip');assert.match(filename,/^[a-z0-9-]+\.zip$/);
  const result=JSON.parse(execFileSync('python3',['-c',
    'import io,sys,zipfile,json,hashlib\nz=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))\nassert z.testzip() is None\nassert all(i.compress_type==0 for i in z.infolist())\nprint(json.dumps({i.filename:hashlib.sha256(z.read(i)).hexdigest() for i in z.infolist()}))'
  ],{input:Buffer.from(await blob.arrayBuffer()),maxBuffer:1024*1024}).toString());
  assert.deepEqual(Object.keys(result).sort(),[...files.keys()].sort());
  for(const [path,bytes] of files)assert.equal(result[path],hash(bytes));
});
test('maximum frame-count art exports editable project data within its admission budget',async()=>{
  const p=starterProject(),large=generateSprite({...p.playerSprite.recipe,size:64,frameCount:16});
  p.playerSprite=large;p.map.tileset=large;
  const files=await exportGameMakerFiles(p),data=new TextDecoder().decode(files.get('project.json'));
  assert.deepEqual(parseProject(data),p);
  assert.ok(files.get('project.json').length<=1024*1024);
});
test('portable export refuses incomplete/malicious data; text cannot escape the data module',async()=>{
  await assert.rejects(exportGameMakerFiles(emptyProject()));
  const p=starterProject(),bad=structuredClone(p);bad.script='alert(1)';await assert.rejects(exportGameMakerFiles(bad));
  p.name='</script>\u2028\u2029';const files=await exportGameMakerFiles(p),source=new TextDecoder().decode(files.get('project-data.js'));
  assert.ok(!source.includes('<')&&!source.includes('\u2028')&&!source.includes('\u2029'));
  const data=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  assert.equal(data.default.name,p.name);
  for(const path of ['../escape.js','/absolute.js','a//b','a/./b','a/../b','a'.repeat(241)])assert.throws(()=>zipGameFiles(new Map([[path,new Uint8Array()]])));
});
test('Node export creates a new complete folder and never overwrites an existing one',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'game-maker-export-'));
  try{
    const input=join(temp,'project.json'),out=join(temp,'game');await writeFile(input,JSON.stringify(starterProject()));
    const result=await packageGameMaker(input,out);assert.ok(result.files>10);
    assert.ok((await readFile(join(out,'index.html'),'utf8')).includes('game-start.js'));
    await assert.rejects(packageGameMaker(input,out),/EEXIST/);
    assert.ok((await readFile(join(out,'manifest.json'),'utf8')).includes('game-maker-v1'));
  }finally{await rm(temp,{recursive:true,force:true});}
});
test('runtime collector rejects missing, external, computed and symlinked dependencies',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'game-maker-runtime-'));
  const entry=join(temp,'demos/game-maker-lab/portable.js');
  try{
    await mkdir(dirname(entry),{recursive:true});
    for(const source of ["import 'remote';","import './missing.js';","import(location.hash);","fetch('./secret');"]){
      await writeFile(entry,source);await assert.rejects(runtimeArchive(temp));
    }
    await writeFile(join(temp,'outside.js'),'export const x=1;');await rm(entry);await symlink(join(temp,'outside.js'),entry);
    await assert.rejects(runtimeArchive(temp),/Symlink/);
  }finally{await rm(temp,{recursive:true,force:true});}
});
test('portable shell and stylesheet cannot introduce undeclared or remote runtime resources',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'game-maker-shell-'));
  try{
    const fixture={'demos/game-maker-lab/portable.js':'export const example=1;',
      'demos/game-maker-lab/portable-shell.txt':'<link rel="stylesheet" href="./demos/game-maker-lab/style.css"><script type="module" src="./game-start.js"></script><script type="module" src="./offline/register.js"></script>',
      'demos/game-maker-lab/style.css':'body{margin:0}',LICENSE:'fixture',NOTICE:'fixture','offline/register.js':'// fixture',
      'scripts/service-worker.template.js':'// fixture'};
    for(const [path,text] of Object.entries(fixture)){await mkdir(dirname(join(temp,path)),{recursive:true});await writeFile(join(temp,path),text);}
    await runtimeArchive(temp);
    for(const [path,bad] of [['demos/game-maker-lab/portable-shell.txt','<script src="https://example.invalid/remote.js"></script>'],['demos/game-maker-lab/style.css','body{background:url(https://example.invalid/image.png)}']]){
      await writeFile(join(temp,path),bad);await assert.rejects(runtimeArchive(temp));await writeFile(join(temp,path),fixture[path]);
    }
    await rm(join(temp,'scripts/service-worker.template.js'));await symlink(join(temp,'LICENSE'),join(temp,'scripts/service-worker.template.js'));
    await assert.rejects(runtimeArchive(temp),/Symlink/);
  }finally{await rm(temp,{recursive:true,force:true});}
});
