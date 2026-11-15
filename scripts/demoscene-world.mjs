// SPDX-License-Identifier: Apache-2.0
import {mkdir,mkdtemp,rename,rm,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {machineRemembers} from '../demos/demoscene-lab/preset.js';
import {portableDemo,writePortable} from './demoscene-package.mjs';
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!['--preset','--seed','--out'].includes(args[i])||options[args[i]]!==undefined||args[i+1]===undefined)throw Error('usage: node scripts/demoscene-world.mjs --preset machine-remembers --seed 1983 --out ./demo-output');options[args[i]]=args[i+1];}
if(options['--preset']!=='machine-remembers'||!/^\d{1,10}$/.test(options['--seed']??'')||!options['--out'])throw Error('preset, uint32 seed and output are required');
const project=machineRemembers(Number(options['--seed'])),out=resolve(options['--out']),parent=dirname(out);
await mkdir(parent,{recursive:true});const stage=await mkdtemp(join(parent,'.demoscene-stage-'));let reserved=false;
try{
  const {files,report}=await portableDemo(project);await writePortable(stage,files);await writeFile(join(stage,'byte-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  // Exclusive outer reservation prevents overwriting even an existing empty
  // directory. The entire production appears in one same-filesystem rename.
  await mkdir(out);reserved=true;await rename(stage,join(out,'production'));
  console.log(JSON.stringify({entry:join(out,'production/index.html'),project:join(out,'production/project.demoscene.json'),uncompressedBytes:report.totalUncompressedBytes,gzip9Bytes:report.gzip9Bytes,profile:'Full Demo',serve:'Serve production/ with any local HTTP server; native modules need HTTP.'},null,2));
}catch(error){if(reserved)await rm(out,{recursive:true,force:true});throw error;}finally{await rm(stage,{recursive:true,force:true});}
