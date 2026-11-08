import {cp,mkdir,rm,readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'dist');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const path of ['index.html','modules','demos','api','offline','LICENSE','NOTICE','MODULES.json'])await cp(resolve(root,path),resolve(out,path),{recursive:true});
// Research tooling and evidence stay out of the runtime. Only this pure kernel ships.
await mkdir(resolve(out,'experiments/arch-omi'),{recursive:true});
await cp(resolve(root,'experiments/arch-omi/index.js'),resolve(out,'experiments/arch-omi/index.js'));
await mkdir(resolve(out,'experiments/e8-geometry'),{recursive:true});
await cp(resolve(root,'experiments/e8-geometry/index.js'),resolve(out,'experiments/e8-geometry/index.js'));
await writeFile(resolve(out,'.nojekyll'),'');
const files=[];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){
  const p=resolve(dir,e.name);if(e.isDirectory())await walk(p);else{const data=await readFile(p);files.push({path:relative(out,p),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
}}
await walk(out);files.sort((a,b)=>a.path.localeCompare(b.path));
// Build-time identity covers every distributed asset byte and relative path.
// The worker is generated from this immutable input list (no stale manual bump).
const size=files.reduce((total,f)=>total+f.bytes,0);
if(size>16*1024*1024)throw new RangeError('offline precache exceeds 16 MiB budget');
const versionHash=createHash('sha256').update(JSON.stringify(files)).digest('hex');
const template=await readFile(resolve(root,'scripts/service-worker.template.js'),'utf8');
const worker=template.replace('__PACKAGE_SHA256__',versionHash)
  .replace('__ASSET_ENTRIES__',JSON.stringify(files));
await writeFile(resolve(out,'service-worker.js'),worker);
files.push({path:'service-worker.js',bytes:Buffer.byteLength(worker),
  sha256:createHash('sha256').update(worker).digest('hex')});
files.sort((a,b)=>a.path.localeCompare(b.path));
const {version}=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
await writeFile(resolve(out,'manifest.json'),JSON.stringify({version,files},null,2)+'\n');
console.log(`Packaged ${files.length} files into dist/; SHA-256 manifest written.`);
