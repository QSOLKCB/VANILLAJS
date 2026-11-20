// SPDX-License-Identifier: Apache-2.0
// Offline-only authoring CLI; never included in the deployed runtime.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {convertObjToLitMesh} from './obj-to-mesh.mjs';
const args=process.argv.slice(2);
if(args.length!==4&&args.length!==6)throw Error('Usage: node scripts/convert-obj-to-mesh.mjs --in SOURCE.obj --out TARGET.json [--scale 1]');
const fields=new Map();for(let i=0;i<args.length;i+=2){
  if(!['--in','--out','--scale'].includes(args[i])||fields.has(args[i]))throw TypeError('unknown or duplicate argument');
  fields.set(args[i],args[i+1]);
}
if(!fields.has('--in')||!fields.has('--out')||args.length!==fields.size*2)throw TypeError('input and output paths required');
const raw=await readFile(fields.get('--in'));
const source=raw.toString('utf8');if(!Buffer.from(source,'utf8').equals(raw))throw TypeError('OBJ must be valid UTF-8');
const mesh=convertObjToLitMesh(source,{scale:fields.has('--scale')?Number(fields.get('--scale')):1});
mesh.source={sha256:createHash('sha256').update(raw).digest('hex'),kind:'OBJ',note:'Geometry only. License and redistribution rights must be verified separately.'};
await writeFile(fields.get('--out'),JSON.stringify(mesh)+'\n',{flag:'wx'});
console.log(JSON.stringify({output:fields.get('--out'),sha256:mesh.source.sha256,triangles:mesh.stats.triangles,renderVertices:mesh.stats.renderVertices}));
