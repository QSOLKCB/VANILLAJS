// SPDX-License-Identifier: Apache-2.0
// Frozen test-only baseline extracted from VANILLAJS b9e9b1951c71ba53a132b061de09888ef712f2f8.
// partitionPackage/digestClosures and ownership policy are unchanged; no runtime packaging.
import {createHash} from 'node:crypto';
export const SUITES=Object.freeze(['home','render','play','worlds','research','donor','editor']);
export const PROFILE='browser-suite-source-v2-three-executions';
const DIGEST=bytes=>createHash('sha256').update(bytes).digest('hex');
const sortByPath=(a,b)=>a.path.localeCompare(b.path);
const OWN=Object.freeze({
  home:['demos/flight-lab/'],
  render:['demos/integer-foundry/','demos/clockwork-vault/'],
  play:['demos/interaction-lab/','demos/fps-lab/'],
  worlds:['demos/rts-lab/','demos/2d-lab/'],
  research:['demos/omi-lab/','demos/ancient-machine/'],
  donor:['demos/bullet-time-lab/','demos/arcade-lab/','demos/shared-lab/','demos/gpu-lab/','demos/space-lab/'],
  editor:['demos/editor/']
});
const allOwn=Object.values(OWN).flat();
function owners(path){return SUITES.filter(group=>
  OWN[group].some(prefix=>path.startsWith(prefix)));}
export function partitionPackage(files){
  if(!Array.isArray(files)||files.some(f=>typeof f?.path!=='string'||
      !/^[a-zA-Z0-9._/-]+$/.test(f.path)||typeof f.sha256!=='string'||
      !/^[a-f0-9]{64}$/.test(f.sha256)))throw new TypeError('invalid package inventory');
  if(files.some(f=>f.path.split('/').includes('..')||f.path.startsWith('/')))
    throw new TypeError('unsafe package path');
  if(new Set(files.map(f=>f.path)).size!==files.length)
    throw new TypeError('duplicate package inventory paths');
  const global=[],own=Object.fromEntries(SUITES.map(g=>[g,[]]));
  for(const f of files){
    const groups=owners(f.path);
    if(groups.length>1)throw new Error('ambiguous suite ownership: '+f.path);
    if(groups.length===1)own[groups[0]].push(f);
    else if(f.path.startsWith('demos/')){
      // New scenes and unclassified shared demo assets are assumed
      // potentially relevant to EVERY suite until explicitly classified.
      global.push(f);
    }else if(f.path==='service-worker.js'){
      // Install/caching behavior affects shell + donor + editor navigation,
      // but isolated no-worker contexts in other groups are independent.
      for(const g of ['home','donor','editor'])own[g].push(f);
    }else if(f.path==='index.html'){
      for(const g of ['home','donor','editor'])own[g].push(f);
    }else global.push(f);
  }
  for(const g of SUITES){
    if(!own[g].some(f=>f.path.startsWith('demos/')))
      throw new Error('missing scoped runtime members: '+g);
  }
  return {global,own};
}
export function digestClosures(files,sharedCode,suiteCode,environment){
  const {global,own}=partitionPackage(files);
  const results={};
  for(const group of SUITES){
    // The donor verifier opens the editor/player, and editor controls import
    // GPU-lab code. Include both complete directory closures, independently
    // of generated service-worker hashes. Keep exclusive ownership for validation.
    const consumers=(group==='donor'||group==='editor')?['donor','editor']:[group];
    const runtime=[...new Map([...global,...consumers.flatMap(g=>own[g])].map(f=>[f.path,f])).values()].map(f=>({path:f.path,sha256:f.sha256}));
    runtime.sort(sortByPath);
    const identity={protocol:PROFILE,group,env:environment,runtime,
      sharedCode:[...sharedCode].sort(sortByPath),
      suiteCode:[...suiteCode[group]].sort(sortByPath)};
    results[group]=DIGEST(Buffer.from(JSON.stringify(identity)));
  }
  return results;
}
