// SPDX-License-Identifier: Apache-2.0
// QEC finite software-conformance fixture is MPL-2.0; see adjacent notice.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transformGF3} from '../modules/gf3-lattice/index.js';
const fixture = JSON.parse(await readFile(
  new URL('./fixtures/qec-qutrit-css-decoupling-v1.json', import.meta.url), 'utf8'));
const periodsSet = [[1,1], [2,2], [2,3], [3,2], [3,3]];
function zero(n) { return Array(n).fill(0); }
function basis(n, index) { const x=zero(n); x[index]=1; return x; }
function finiteColumn(encoded, periods, index) {
  const [width,height] = periods;
  const cells = width*height, rows=encoded.rows, cols=encoded.cols;
  const result=zero(rows*cells);
  const cell=Math.floor(index/cols), species=index%cols;
  const a=Math.floor(cell/height), b=cell%height;
  for (const [r,c,terms] of encoded.entries) {
    if (c !== species) continue;
    for (const [offset,coeff] of terms) {
      const x=((a+offset[0])%width+width)%width;
      const y=((b+offset[1])%height+height)%height;
      const at=(x*height+y)*rows+r;
      result[at]=(result[at]+coeff)%3;
    }
  }
  return result;
}
function expectedAction(c, periods, lane, index, inverse) {
  const encoded=(inverse?c.inverse_actions:c.actions)[lane];
  return finiteColumn(encoded, periods, index);
}
test('fixture identity and claim boundary stay pinned to the QEC research source', () => {
  assert.equal(fixture.schema, 'qec.qutrit-css-decoupling-conformance.v1');
  assert.equal(fixture.prime, 3);
  assert.deepEqual(fixture.circuits.map(c=>c.name), [
    'identity','sum_weight_one','sum_weight_two','swap','mixed','toric_general']);
  assert.equal(fixture.claims.finite_software_conformance_only,true);
  assert.equal(fixture.claims.hardware_demonstrated,false);
  assert.equal(fixture.claims.decoder_promoted,false);
  assert.equal(fixture.provenance.donor_license,'MIT');
  assert.equal(fixture.provenance.donor_commit,'a48048c1097f4d1b37a55eca9a1796a823f0c124');
});
test('all six circuits exactly reproduce GF(3) Laurent actions and inverse actions', () => {
  for (const c of fixture.circuits) for (const periods of periodsSet) {
    const n=c.qudits*periods[0]*periods[1];
    for (let i=0;i<n;i++) for (const lane of ['X','Z']) for (const inverse of [false,true]) {
      const source={x:lane==='X'?basis(n,i):zero(n),z:lane==='Z'?basis(n,i):zero(n)};
      const got=transformGF3({gates:c.gates,qudits:c.qudits,periods,state:source,inverse});
      assert.deepEqual(got[lane.toLowerCase()], expectedAction(c,periods,lane,i,inverse),
        c.name+' '+periods+' '+lane+' inverse='+inverse+' input='+i);
      // The other lane remains zero; the caller's input is untouched.
      assert.deepEqual(got[lane==='X'?'z':'x'],zero(n));
      assert.equal(source[lane.toLowerCase()][i],1);
    }
  }
});
test('forward/inverse replay round-trips arbitrary GF(3) state across all cases', () => {
  let seed=0x1234abcd;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%3;};
  for (const c of fixture.circuits) for (const periods of periodsSet) {
    const n=c.qudits*periods[0]*periods[1];
    const state={x:Array.from({length:n},random),z:Array.from({length:n},random)};
    const untouched=JSON.stringify(state);
    const forward=transformGF3({gates:c.gates,qudits:c.qudits,periods,state});
    const backward=transformGF3({gates:c.gates,qudits:c.qudits,periods,state:forward,inverse:true});
    assert.deepEqual(backward,state,c.name+' '+periods);
    assert.equal(JSON.stringify(state),untouched);
  }
});
test('reject malformed and over-budget circuits without mutating input', () => {
  const state={x:[1,0],z:[0,1]};
  assert.throws(()=>transformGF3({qudits:2,periods:[1,1],gates:[
    {kind:'SUM',control:0,target:0,weight:1,displacement:[0,0]}],state}));
  assert.throws(()=>transformGF3({qudits:2,periods:[1,1],gates:[
    {kind:'SUM',control:0,target:1,weight:1,displacement:[0]}],state}));
  assert.throws(()=>transformGF3({qudits:2,periods:[1,1],gates:[
    {kind:'SWAP',left:0,right:1,unknown:true}],state}));
  assert.throws(()=>transformGF3({qudits:2,periods:[256,256],gates:[],state}));
  assert.throws(()=>transformGF3({qudits:2,periods:[1,1],gates:[],state:{x:new Array(2),z:[0,1]}}));
  assert.deepEqual(state,{x:[1,0],z:[0,1]});
});
