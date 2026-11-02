// Development-only exhaustive evidence; never packaged into the runtime.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {BrassMachine, MOTOR_RATES, MAX_DETENTS} from '../demos/ancient-machine/machine.js';
import {referenceDelta} from './omi-oracle.js';
const table=Buffer.alloc(65536*2);
let held=0,oracleMatches=0,reverseMatches=0,replayCases=0;
for(let seed=0;seed<65536;seed++){
  const machine=new BrassMachine({seed});
  for(let n=0;n<7;n++){machine.move();assert.equal(machine.snapshot().word,seed);held++;}
  machine.move();const result=machine.snapshot().word;
  assert.equal(result,referenceDelta(seed));oracleMatches++;table.writeUInt16LE(result,seed*2);
  machine.move(-8);assert.equal(machine.snapshot().word,seed);assert.equal(machine.snapshot().detents,0);reverseMatches++;
}
for(const seed of [0x1234,0x1477,0x0063,0x0005])for(const rate of MOTOR_RATES)for(let phase=0;phase<8;phase++){
  const machine=new BrassMachine({seed,detents:32768*8+phase,ticksPerDetent:rate,subTick:rate-1});
  const restored=BrassMachine.fromReplay(JSON.parse(JSON.stringify(machine.exportReplay())));
  assert.deepEqual(restored.snapshot(),machine.snapshot());
  for(let tick=0;tick<rate*9;tick++){machine.tick();restored.tick();}
  assert.deepEqual(restored.snapshot(),machine.snapshot());replayCases++;
}
const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const report={schemaVersion:1,version,runtime:process.version,experiment:'ARCH-OMI-001 / Brass Engine',
  attribution:"Brian Thorne's ARCH OMI; independently authored mechanical presentation",
  domain:65536,preLatchWordChecks:held,stagedOracleMatches:oracleMatches,reverseRoundTrips:reverseMatches,
  partialReplayCases:replayCases,simulationHz:120,ticksPerDetent:[...MOTOR_RATES],maxDetents:MAX_DETENTS,
  transitionTable:{encoding:'ascending input; uint16 little-endian outputs',bytes:table.length,sha256:createHash('sha256').update(table).digest('hex')},
  scope:'Executed finite-domain checks in the recorded Node runtime; no historical reconstruction, physical analog solver or full OMI protocol claim.'};
if(process.argv.includes('--check')){
  const expected=JSON.parse(await readFile(new URL('../docs/OMI_MACHINE_EVIDENCE.json',import.meta.url),'utf8'));
  const withoutRuntime=({runtime,...rest})=>rest;assert.deepEqual(withoutRuntime(report),withoutRuntime(expected));
}
console.log(JSON.stringify(report,null,2));
