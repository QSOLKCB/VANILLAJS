// SPDX-License-Identifier: Apache-2.0
// CPU-only seven-pair observational workloads, never an RTX FPS claim.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {cpus,platform,arch,release} from 'node:os';
import {distanceCheck2D} from '../modules/range2d/index.js';
import {IntegerEngine} from '../modules/integer-engine/index.js';
import {sealIntegerReplay,verifyIntegerReplay} from '../modules/integer-replay/index.js';
import {NexusLattice} from '../modules/nexus-lattice/index.js';
import {KeplerOrbit,circularSpeedSI} from '../modules/orbital-physics/index.js';

const BASE='4647261445a1128c4e0c1e065f342ac4d2133cff';
const REPEATS=7,WARMUPS=2,median=x=>[...x].sort((a,b)=>a-b)[Math.floor(x.length/2)];
const sha=data=>createHash('sha256').update(data).digest('hex');
let state=0x51a7d0f1;
const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
const workloads=[];
for(const count of [32,256,2048]){
  const pairs=Array.from({length:count},(_,i)=>{
    const a={x:(random()-.5)*200,y:(random()-.5)*200};
    const b={x:a.x+(random()-.5)*240,y:a.y+(random()-.5)*240};
    return {a,b,limit:i%7===0?10:60};
  });
  const measure=mode=>{
    const t=performance.now(),raw=new Uint8Array(count);let axisRejected=0;
    for(let i=0;i<count;i++){
      const p=pairs[i];
      if(mode==='reference')raw[i]=Number(Math.hypot(
        p.a.x-p.b.x,p.a.y-p.b.y)<=p.limit);
      else{
        const observed=distanceCheck2D(p.a,p.b,p.limit);
        raw[i]=Number(observed.within);
        axisRejected+=Number(observed.axisRejected);
      }
    }
    return {ms:performance.now()-t,digest:sha(raw),axisRejected};
  };
  for(let i=0;i<WARMUPS;i++){measure('reference');measure('candidate');}
  const rows={reference:[],candidate:[]};
  for(let i=0;i<REPEATS;i++){
    for(const mode of (i%2?['candidate','reference']:['reference','candidate']))
      rows[mode].push(measure(mode));
  }
  for(const item of [...rows.reference,...rows.candidate])
    assert.equal(item.digest,rows.reference[0].digest,'Euclidean range drift');
  workloads.push({name:'axis-range',pairs:count,sha256:rows.reference[0].digest,
    axisRejected:rows.candidate[0].axisRejected,
    strategies:Object.fromEntries(Object.entries(rows).map(([name,s])=>[name,{
      samplesMs:s.map(x=>x.ms),medianMs:median(s.map(x=>x.ms))
    }]))});
}
const initial=new IntegerEngine({seed:17,bodies:[
  {id:1,position:[0,0,0],halfSize:[1,1,1],velocity:[0,0,0]}
]}).snapshot();
const frames=Array.from({length:2048},(_,i)=>i%17===0?
  [{id:1,velocity:[i%2,0,0]}]:[]);
const tape=sealIntegerReplay(initial,frames,{build:BASE}),replay=[];
for(let i=0;i<WARMUPS+REPEATS;i++){
  const t=performance.now(),v=verifyIntegerReplay(tape,{expectedBuild:BASE});
  const ms=performance.now()-t;
  assert.ok(v.match&&v.complete&&v.unconsumed===0);
  if(i>=WARMUPS)replay.push(ms);
}
workloads.push({name:'integer-replay',ticks:frames.length,
  digest:tape.digest,complete:true,samplesMs:replay,medianMs:median(replay)});
for(const cells of [6,64,256]){
  const times=[],digests=[];
  for(let i=0;i<WARMUPS+REPEATS;i++){
    const lattice=new NexusLattice({cells,seed:0x4e455853});
    const t=performance.now();
    lattice.forward(32);
    const digest=sha(lattice.registers());
    lattice.rewind(32);
    const ms=performance.now()-t;
    assert.equal(lattice.mismatchesFromSeed(),0,'NEXUS inverse mismatch');
    if(i>=WARMUPS){times.push(ms);digests.push(digest);}
  }
  assert.equal(new Set(digests).size,1,'NEXUS forward state non-deterministic');
  workloads.push({name:'nexus-lattice',cells,rounds:32,sha256:digests[0],
    inverseMismatches:0,samplesMs:times,medianMs:median(times)});
}
const mass=5.9722e24,radius=6771e3,speed=circularSpeedSI(mass,radius);
const orbitResults=[];
for(let i=0;i<WARMUPS+REPEATS;i++){
  const orbit=new KeplerOrbit({mass,position:[radius,0,0],velocity:[0,speed,0]});
  const energy=orbit.energy(),t=performance.now();
  for(let tick=0;tick<512;tick++)orbit.step(10);
  const ms=performance.now()-t,drift=Math.abs(orbit.energy()-energy)/Math.abs(energy);
  assert.ok(drift<1e-7,'Kepler orbital energy drift exceeded benchmark bound');
  if(i>=WARMUPS)orbitResults.push({ms,relativeEnergyDrift:drift,
    finalPosition:orbit.snapshot().position});
}
const expectedOrbit=orbitResults[0].finalPosition;
for(const observation of orbitResults)
  assert.deepEqual(observation.finalPosition,expectedOrbit,'Kepler identical-input drift');
workloads.push({name:'kepler-orbit',steps:512,dtSeconds:10,
  medianMs:median(orbitResults.map(x=>x.ms)),
  samplesMs:orbitResults.map(x=>x.ms),
  maxRelativeEnergyDrift:Math.max(...orbitResults.map(x=>x.relativeEnergyDrift)),
  finalPosition:expectedOrbit});
const sourceSHA256={};
for(const name of ['range2d','integer-replay','nexus-lattice','orbital-physics']){
  sourceSHA256['modules/'+name+'/index.js']=sha(readFileSync(
    new URL('../modules/'+name+'/index.js',import.meta.url)));
}
const report={schemaVersion:1,
  kind:'qsol.vanillajs.bloat-nexus-uff.serial-workloads.v1',
  sourcePins:{vanillajsBase:BASE,bloatOps:'6f290dc818759ca49bcdec54b31d738b33c7946f',
    corpoWars3dPr10:'a81b7b03d0c8b730b830f9d92459ef2193793b7f',
    nexus:'ac9ef5ac79008b46be3351c57cab946b93dd37e8',
    uff:'596cd732df61587aa1a9801cad1ec13483b1347f'},
  sourceSHA256,environment:{node:process.version,platform:platform(),
    arch:arch(),release:release(),cpu:cpus()[0]?.model},
  protocol:{warmups:WARMUPS,pairedTrials:REPEATS,execution:'serial single Node process',
    timingGate:false,gpu:'not measured',scope:'function execution includes validation and allocations'},
  workloads};
if(process.argv.includes('--check')){
  assert.equal(workloads.length,8);
  assert.equal(workloads[0].strategies.reference.samplesMs.length,REPEATS);
  assert.equal(workloads.at(-1).steps,512);
}
console.log(JSON.stringify(report,null,2));
