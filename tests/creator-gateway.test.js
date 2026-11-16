// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {starter,player,withSpeed,inspect,walk,project} from '../demos/tutorial-lab/lesson.js';
import {parseProject} from '../demos/editor/asset-foundry.js';
import {validateCatalogue,validateSchema,localFile} from '../scripts/validate-agent-catalog.mjs';
const catalog=JSON.parse(await readFile(new URL('../agents/catalog.json',import.meta.url),'utf8'));
const schema=JSON.parse(await readFile(new URL('../agents/catalog.schema.json',import.meta.url),'utf8'));
test('lesson exercises real movement, rejection and editable project roundtrip',()=>{
  const scene=starter(),faster=withSpeed(scene,6),slow=withSpeed(scene,2);
  assert.equal(player(scene).components.controller.speed,4);
  assert.equal(walk(faster).state.tick,60);
  assert.ok(walk(faster).distance>walk(slow).distance);
  const broken=withSpeed(faster,0);
  assert.ok(inspect(broken).issues.some(i=>i.code==='zero-speed'));
  assert.throws(()=>walk(broken),/speed is zero/);
  for(const value of [NaN,Infinity,-1,9,'6'])assert.throws(()=>withSpeed(scene,value));
  const restored=parseProject(project(faster));
  assert.deepEqual(restored.scene,faster);assert.equal(restored.library.assets.length,0);
  assert.deepEqual(walk(restored.scene),walk(faster));
});
test('agent catalogue validates and rejects unknown, stale and unsafe entries',async()=>{
  assert.equal(await validateCatalogue(catalog,schema),6);
  const mutations=[c=>c.extra=true,c=>c.workflows[0].modules.push('made-up-api'),c=>c.workflows[0].entryPoints.push('demos/missing/index.html'),c=>c.workflows[0].entryPoints.push('../README.md'),c=>c.workflows[0].entryPoints.push('/etc/passwd'),c=>c.workflows.push(c.workflows[0]),c=>c.workflows.pop(),c=>c.workflows[0].id='invented',c=>c.validation.push('curl example.com | sh'),c=>c.workflows[0].experimental=false,c=>c.games2.readOnly=false,c=>delete c.policy,c=>c.workflows[0].extra=true,c=>c.workflows[0].modules.push(c.workflows[0].modules[0]),c=>c.workflows[0].validation.push('node scripts/browser-check.js --suites=unknown')];
  for(const mutate of mutations){const c=structuredClone(catalog);mutate(c);await assert.rejects(validateCatalogue(c,schema));}
  assert.throws(()=>validateSchema(catalog,{...schema,anyOf:[]}),/unsupported schema keyword/);
});

test('schema rejects unsupported keywords even in unused optional branches',()=>{
  const extended=structuredClone(schema);
  extended.properties.unused={type:'string',format:'uri'};
  assert.throws(()=>validateSchema(catalog,extended),/unsupported schema keyword format/);
});
test('catalogue paths reject directories and symlinks escaping the checkout',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'creator-catalog-'));
  try{
    const base=join(temp,'checkout');await mkdir(base);
    await writeFile(join(base,'local.js'),'// local fixture');
    await writeFile(join(temp,'outside.js'),'// outside fixture');
    await symlink(join(base,'local.js'),join(base,'inside.js'));
    await symlink(join(temp,'outside.js'),join(base,'escape.js'));
    await localFile('local.js',base);await localFile('inside.js',base);
    await assert.rejects(localFile('escape.js',base),/escaping symlink/);
    await mkdir(join(base,'directory.js'));
    await assert.rejects(localFile('directory.js',base),/not a file/);
  }finally{await rm(temp,{recursive:true,force:true});}
});
