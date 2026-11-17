// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {exportHorizonRaceFiles,exportHorizonRace} from '../demos/horizon-lab/race-export.js';
import {zipStoredFiles as zipGameFiles} from '../api/package/zip.js';
import {starterRaceProject as starterProject,parseRaceProject} from '../demos/horizon-lab/race-project.js';
import {runtimeArchive,verifyHorizonRaceRuntime} from '../scripts/horizon-race-runtime.mjs';
import {packageHorizonRace} from '../scripts/export-horizon-race.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('portable source archive exactly matches its native module closure and notices',async()=>{
  await verifyHorizonRaceRuntime();
  const archive=await runtimeArchive();
  assert.ok(archive.files.some(f=>f.path==='demos/horizon-lab/race-player.js'));
  assert.ok(archive.files.some(f=>f.path==='modules/vehicle3d/index.js'));
  assert.ok(archive.files.some(f=>f.path==='modules/vehicle-audio/index.js'));
  assert.ok(!archive.files.some(f=>/app\.js|export\.js|race-runtime|node_modules|tests\//.test(f.path)));
  for(const f of archive.files)assert.equal(hash(Buffer.from(f.text)),f.sha256);
});
test('complete game package preserves exact data, source, licences and scoped digest worker',async()=>{
  const p=starterProject(),files=await exportHorizonRaceFiles(p),again=await exportHorizonRaceFiles(p);
  assert.deepEqual(files,again,'same admitted project and source yield exact exported files');
  const manifest=JSON.parse(new TextDecoder().decode(files.get('manifest.json')));
  assert.equal(manifest.version,'horizon-race-v1');
  assert.equal(manifest.files.length,files.size-1);
  for(const f of manifest.files){assert.equal(hash(files.get(f.path)),f.sha256);assert.equal(files.get(f.path).length,f.bytes);}
  assert.deepEqual(JSON.parse(new TextDecoder().decode(files.get('project.json'))),p);
  for(const name of ['LICENSE','NOTICE','offline/register.js'])assert.deepEqual(Buffer.from(files.get(name)),await readFile(new URL('../'+name,import.meta.url)));
  assert.match(new TextDecoder().decode(files.get('service-worker.js')),/self.registration.scope/);
  assert.ok(!new TextDecoder().decode(files.get('service-worker.js')).includes('__PACKAGE_SHA256__'));
  const changed=structuredClone(p);changed.name+=' changed';
  assert.notDeepEqual((await exportHorizonRaceFiles(changed)).get('service-worker.js'),files.get('service-worker.js'));
});
test('downloaded ZIP passes Python standard-library CRC/inventory validation',async()=>{
  const p=starterProject(),files=await exportHorizonRaceFiles(p),{blob,filename}=await exportHorizonRace(p);
  assert.equal(blob.type,'application/zip');assert.match(filename,/^[a-z0-9-]+\.zip$/);
  const result=JSON.parse(execFileSync('python3',['-c',
    'import io,sys,zipfile,json,hashlib\nz=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))\nassert z.testzip() is None\nassert all(i.compress_type==0 for i in z.infolist())\nprint(json.dumps({i.filename:hashlib.sha256(z.read(i)).hexdigest() for i in z.infolist()}))'
  ],{input:Buffer.from(await blob.arrayBuffer()),maxBuffer:1024*1024}).toString());
  assert.deepEqual(Object.keys(result).sort(),[...files.keys()].sort());
  for(const [path,bytes] of files)assert.equal(result[path],hash(bytes));
});
test('portable export refuses incomplete/malicious data; text cannot escape the data module',async()=>{
  await assert.rejects(exportHorizonRaceFiles({}));
  const p=starterProject(),bad=structuredClone(p);bad.script='alert(1)';await assert.rejects(exportHorizonRaceFiles(bad));
  p.name='</script>\u2028\u2029x';const files=await exportHorizonRaceFiles(p),source=new TextDecoder().decode(files.get('project-data.js'));
  assert.ok(!source.includes('<')&&!source.includes('\u2028')&&!source.includes('\u2029'));
  const data=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  assert.equal(data.default.name,p.name);
  for(const path of ['../escape.js','/absolute.js','a//b','a/./b','a/../b','a'.repeat(241)])assert.throws(()=>zipGameFiles(new Map([[path,new Uint8Array()]])));
});
test('Node export creates a new complete folder and never overwrites an existing one',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'horizon-race-export-'));
  try{
    const input=join(temp,'project.json'),out=join(temp,'game');await writeFile(input,JSON.stringify(starterProject()));
    const result=await packageHorizonRace(input,out);assert.ok(result.files>10);
    assert.ok((await readFile(join(out,'index.html'),'utf8')).includes('game-start.js'));
    await assert.rejects(packageHorizonRace(input,out),/EEXIST/);
    const linked=join(temp,'linked.json');await symlink(input,linked);
    await assert.rejects(packageHorizonRace(linked,join(temp,'linked-output')),/regular local file/);
    await assert.rejects(packageHorizonRace(temp,join(temp,'directory-output')),/regular local file/);
    const oversized=join(temp,'oversized.json');await writeFile(oversized,' '.repeat(65537));
    await assert.rejects(packageHorizonRace(oversized,join(temp,'oversized-output')),/64 KiB/);
    assert.ok((await readFile(join(out,'manifest.json'),'utf8')).includes('horizon-race-v1'));
  }finally{await rm(temp,{recursive:true,force:true});}
});
test('runtime collector rejects missing, external, computed and symlinked dependencies',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'horizon-race-runtime-'));
  const entry=join(temp,'demos/horizon-lab/race-player.js');
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
  const temp=await mkdtemp(join(tmpdir(),'horizon-race-shell-'));
  try{
    const fixture={'demos/horizon-lab/race-player.js':'export const example=1;',
      'demos/horizon-lab/race-portable-shell.txt':'<link rel="stylesheet" href="./demos/horizon-lab/race.css"><script type="module" src="./game-start.js"></script><script type="module" src="./offline/register.js"></script><script src="./demos/horizon-lab/race-launch.js"></script>',
      'demos/horizon-lab/race-launch.js':'// fixture',
      'demos/horizon-lab/race.css':'body{margin:0}',LICENSE:'fixture',NOTICE:'fixture','offline/register.js':'// fixture',
      'scripts/service-worker.template.js':'// fixture'};
    for(const [path,text] of Object.entries(fixture)){await mkdir(dirname(join(temp,path)),{recursive:true});await writeFile(join(temp,path),text);}
    await runtimeArchive(temp);
    for(const [path,bad] of [['demos/horizon-lab/race-portable-shell.txt','<script src="https://example.invalid/remote.js"></script>'],['demos/horizon-lab/race.css','body{background:url(https://example.invalid/image.png)}']]){
      await writeFile(join(temp,path),bad);await assert.rejects(runtimeArchive(temp));await writeFile(join(temp,path),fixture[path]);
    }
    await rm(join(temp,'scripts/service-worker.template.js'));await symlink(join(temp,'LICENSE'),join(temp,'scripts/service-worker.template.js'));
    await assert.rejects(runtimeArchive(temp),/Symlink/);
  }finally{await rm(temp,{recursive:true,force:true});}
});
