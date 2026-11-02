import {readdir,readFile} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
async function walk(dir){
  const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){
    const path=resolve(dir,entry.name);if(entry.isDirectory())files.push(...await walk(path));else files.push(path);
  }return files;
}
const files=(await Promise.all(['modules','demos','scripts','tests'].map(d=>walk(resolve(root,d))))).flat().filter(f=>f.endsWith('.js'));
for(const path of files){
  const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
}
const catalogue=JSON.parse(await readFile(resolve(root,'MODULES.json'),'utf8'));
for(const [name,info]of Object.entries(catalogue.modules)){
  const source=await readFile(resolve(root,info.entry),'utf8');
  const imports=[...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m=>m[1]);
  const actual=new Set();
  for(const specifier of imports){
    assert.ok(specifier.startsWith('.'),`${name}: external import ${specifier}`);
    const target=relative(root,resolve(root,dirname(info.entry),specifier));
    const dependency=Object.entries(catalogue.modules).find(([,m])=>m.entry===target)?.[0];
    assert.ok(dependency,`${name}: unregistered import ${target}`);actual.add(dependency);
  }
  assert.deepEqual([...actual].sort(),[...info.depends].sort(),`${name}: catalogue dependencies differ`);
  if(info.environment==='pure-js')assert.ok(!/\b(window|document|navigator|requestAnimationFrame|Math\.random|Date\.now)\b/.test(source),`${name}: browser or ambient clock dependency`);
  await import(new URL('../'+info.entry,import.meta.url));
}
console.log(`Checked ${files.length} JavaScript files and ${Object.keys(catalogue.modules).length} module contracts.`);
