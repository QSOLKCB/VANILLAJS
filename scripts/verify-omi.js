// Reproducible finite-domain experiment. Node tooling is never packaged.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {delta16, packState, unpackState, OMICRON} from '../experiments/arch-omi/index.js';
import {OmiSurvey} from '../demos/omi-lab/experiment.js';
import {referenceDelta} from './omi-oracle.js';

const survey = new OmiSurvey(); while (survey.status === 'building') survey.step(1024);
const summary = survey.summary(), table = Buffer.alloc(65536 * 2), reference = new Uint16Array(65536);
for (let word = 0; word < 65536; word++) {
  reference[word] = referenceDelta(word);
  assert.equal(delta16(word), reference[word], `independent delta disagreement at ${word}`);
  assert.equal(packState(unpackState(word)), word);
  table.writeUInt16LE(reference[word], word * 2);
}
// Independently enumerate cycles using the oracle's complete transition table.
const visited = new Uint8Array(65536), cycles = {};
for (let start = 0; start < 65536; start++) {
  if (visited[start]) continue;
  let word = start, length = 0;
  do { assert.equal(visited[word], 0, 'non-permutation tail'); visited[word] = 1; word = reference[word]; length++; } while (word !== start);
  cycles[length] = (cycles[length] ?? 0) + 1;
}
for (const [period,count] of Object.entries(summary.periodStates)) assert.equal(cycles[period] * Number(period), count);
assert.equal(summary.returnAfter8, 65536); assert.equal(summary.closedFaces, 262144);
const {version} = JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const report = {
  schemaVersion:1, experiment:'ARCH-OMI-001', version, runtime:process.version,
  references:{portal:'5d2ebac312a8d44413af2a67ca9061e66594d9c8',canon:'b63fcf4286a9630bd9a641625d3103453c9687d5'},
  encoding:'FS/GS/RS/US = high-to-low four-bit nibbles; edges are pairwise XOR differences; faces are opposite vertices.',
  deltaConstant:OMICRON, ...summary, cycleCounts:cycles,
  independentOracleMatches:65536, packingRoundTrips:65536,
  transitionTable:{encoding:'65536 unsigned 16-bit outputs, ascending input, little-endian',bytes:table.length,sha256:createHash('sha256').update(table).digest('hex')},
  claims:{returnsAfterEight:true,everyMinimalPeriodIsEight:false,shorterPeriodStates:4096,
    uniqueEdgePatterns:4096,statesPerEdgePattern:16},
  limits:'Finite integer enumeration only; no physics, cryptographic, compression, randomness or performance claim.'
};
if (process.argv.includes('--check')) {
  const recorded = JSON.parse(await readFile(new URL('../docs/OMI_EVIDENCE.json',import.meta.url),'utf8'));
  const {runtime:actualRuntime,...actual} = report, {runtime:recordedRuntime,...expected} = recorded;
  assert.deepEqual(actual,expected,'OMI evidence differs; inspect the changed result before updating the record.');
}
console.log(JSON.stringify(report,null,2));
