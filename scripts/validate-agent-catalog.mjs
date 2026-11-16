// SPDX-License-Identifier: Apache-2.0
// Deliberately bounded JSON Schema subset. Unknown keywords fail closed.
import {readFile,stat,realpath} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
export const root=resolve(import.meta.dirname,'..');
const keywords=new Set(['$schema','title','type','const','enum','properties','required','additionalProperties','items','minItems','uniqueItems','minLength','pattern']);
function checkSchemaKeywords(schema){
  assert.ok(schema&&typeof schema==='object'&&!Array.isArray(schema),'schema must be an object');
  for(const key of Object.keys(schema))assert.ok(keywords.has(key),`unsupported schema keyword ${key}`);
  for(const child of Object.values(schema.properties??{}))checkSchemaKeywords(child);
  if(schema.items)checkSchemaKeywords(schema.items);
}
export function validateSchema(value,schema,where='$'){
  // Check unused optional branches too, before accepting any catalogue data.
  if(where==='$')checkSchemaKeywords(schema);
  if(Object.hasOwn(schema,'const'))assert.deepEqual(value,schema.const,where+' const');
  if(schema.enum)assert.ok(schema.enum.some(x=>JSON.stringify(x)===JSON.stringify(value)),where+' unknown entry');
  if(schema.type){
    const type=Array.isArray(value)?'array':value===null?'null':typeof value;
    assert.equal(type,schema.type,where+' type');
  }
  if(schema.type==='object'){
    assert.equal(schema.additionalProperties,false,'objects must reject unknown properties');
    for(const key of schema.required??[])assert.ok(Object.hasOwn(value,key),where+' missing '+key);
    for(const [key,item]of Object.entries(value)){
      assert.ok(Object.hasOwn(schema.properties,key),where+' unknown '+key);
      validateSchema(item,schema.properties[key],where+'.'+key);
    }
  }
  if(schema.type==='array'){
    assert.ok(value.length>=(schema.minItems??0),where+' too few items');
    if(schema.uniqueItems)assert.equal(new Set(value.map(x=>JSON.stringify(x))).size,value.length,where+' duplicates');
    value.forEach((x,i)=>validateSchema(x,schema.items,`${where}[${i}]`));
  }
  if(schema.type==='string'){
    assert.ok(value.length>=(schema.minLength??0),where+' empty');
    if(schema.pattern)assert.match(value,new RegExp(schema.pattern),where+' pattern');
  }
}
export async function localFile(path,base=root){
  assert.ok(typeof path==='string'&&/^[a-zA-Z0-9_./-]+$/.test(path)&&!path.startsWith('/')&&!path.split('/').includes('..'),'unsafe local path '+path);
  const absolute=await realpath(resolve(base,path));
  assert.ok(absolute.startsWith((await realpath(base))+sep),'escaping symlink '+path);
  assert.ok((await stat(absolute)).isFile(),'not a file '+path);
}
export async function validateCatalogue(catalogue,schema,base=root){
  validateSchema(catalogue,schema);
  const modules=JSON.parse(await readFile(resolve(base,catalogue.moduleCatalogue),'utf8'));
  const expected=schema.properties.workflows.items.properties.id.enum;
  assert.deepEqual(catalogue.workflows.map(w=>w.id).sort(),[...expected].sort(),'missing/duplicate workflow');
  for(const path of [catalogue.moduleCatalogue,...catalogue.policy,catalogue.games2.guide])await localFile(path,base);
  for(const workflow of catalogue.workflows){
    for(const name of workflow.modules){assert.ok(Object.hasOwn(modules.modules,name),'unknown module '+name);await localFile(modules.modules[name].entry,base);}
    for(const path of [...workflow.entryPoints,...workflow.examples,...workflow.docs])await localFile(path,base);
    for(const entry of workflow.examples)assert.ok(entry.endsWith('/index.html'),'example must be a runnable lab');
    for(const entry of workflow.entryPoints)assert.match(entry,/\.(?:html|js|md)$/,'unknown entry type');
  }
  for(const command of new Set([...catalogue.validation,...catalogue.workflows.flatMap(w=>w.validation)])){
    const script=/^node (scripts\/[^ ]+)/.exec(command)?.[1];
    if(script)await localFile(script,base);
    else assert.equal(command,'node --test tests/*.test.js');
  }
  return catalogue.workflows.length;
}
export async function checkCatalogue(){
  const catalogue=JSON.parse(await readFile(resolve(root,'agents/catalog.json'),'utf8'));
  const schema=JSON.parse(await readFile(resolve(root,'agents/catalog.schema.json'),'utf8'));
  return validateCatalogue(catalogue,schema);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  console.log(`Validated ${await checkCatalogue()} agent workflows against schema, module catalogue and local paths.`);
