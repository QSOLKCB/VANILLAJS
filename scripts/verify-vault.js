// Development-only reproducible puzzle graph evidence; excluded from packaging.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PUZZLES,LEVEL_SET,solvePuzzle,applyCommand} from '../demos/clockwork-vault/puzzles.js';
import {inspectPuzzle} from './vault-oracle.js';
const puzzles=PUZZLES.map((p,index)=>{
  const oracle=inspectPuzzle(p),solved=solvePuzzle(index);
  assert.equal(solved.status,'found');assert.equal(solved.commands.length,oracle.distance);assert.equal(oracle.distance,p.minimum);
  let word=p.seed;for(const op of oracle.solution)word=applyCommand(index,word,op);assert.equal(word,p.target);
  const bytes=Buffer.alloc(65536*4);oracle.distances.forEach((value,i)=>bytes.writeInt32LE(value,i*4));
  return {id:p.id,seed:p.seed,target:p.target,masks:[...p.masks],shortestCommands:oracle.distance,solution:oracle.solution,
    reachableStates:oracle.reachable,examinedEdges:oracle.edges,distanceTableSha256:createHash('sha256').update(bytes).digest('hex')};
});
const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const report={schemaVersion:1,version,runtime:process.version,levelSet:LEVEL_SET,domain:65536,
  attribution:"Brian Thorne's ARCH OMI; original VANILLAJS encoding and puzzle definitions",
  method:'Independent arithmetic delta/XOR, complete FIFO traversal of each reachable component; each completed delta or XOR costs one command. Undo and cam detents are not graph edges.',
  distanceTableEncoding:'65,536 signed int32 little-endian distances in ascending word order; -1 denotes unreachable',
  totalReachableStateVisits:puzzles.reduce((n,p)=>n+p.reachableStates,0),puzzles};
if(process.argv.includes('--check')){
  const expected=JSON.parse(await readFile(new URL('../docs/VAULT_EVIDENCE.json',import.meta.url),'utf8'));
  const comparable=({runtime,...rest})=>rest;assert.deepEqual(comparable(report),comparable(expected));
}
console.log(JSON.stringify(report,null,2));
