// SPDX-License-Identifier: Apache-2.0
// Finite production-source conformance, not a formal ECMAScript refinement.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {ExactRational as R} from '../modules/exact-rational/index.js';
import {point2,orientation2} from '../modules/exact-geometry/index.js';
import {composeD4,transformPoint2,squaredDistance2} from '../modules/exact-d4/index.js';
import {ExactGraph,relabelGraph,characteristicPolynomial} from '../modules/exact-graph/index.js';
const spec=JSON.parse(readFileSync(new URL('../tests/fixtures/alien-math-006-input.json',import.meta.url),'utf8'));
const rational=s=>{const [n,d='1']=s.split('/');return new R(BigInt(n),BigInt(d));};
const points=spec.points.map(([x,y])=>point2(rational(x),rational(y))),values=points.flatMap(p=>[p.x,p.y]),rows=[];
for(const [i,a] of values.entries())for(const [j,b] of values.entries()){
  let quotient;if(b.numerator===0n){assert.throws(()=>a.divide(b),RangeError);quotient='reject-zero';}else quotient=String(a.divide(b));
  rows.push(['ARITH',i,j,a.add(b),a.subtract(b),a.multiply(b),quotient].map(String).join('|'));
}
for(const [i,g] of spec.d4.entries()){
  for(const [j,h] of spec.d4.entries())rows.push(['D4',i,j,spec.d4.indexOf(composeD4(g,h))].join('|'));
  for(const [j,p0] of points.entries()){
    const p=transformPoint2(g,p0);rows.push(['ACTION',i,j,p.x,p.y].map(String).join('|'));
    for(const [k,q0] of points.entries()){
      const q=transformPoint2(g,q0);rows.push(['DIST',i,j,k,squaredDistance2(p,q)].map(String).join('|'));
      for(const [l,t0] of points.entries()){
        const t=transformPoint2(g,t0),area=q.x.subtract(p.x).multiply(t.y.subtract(p.y)).subtract(q.y.subtract(p.y).multiply(t.x.subtract(p.x)));
        assert.equal(orientation2(p,q,t),area.compare(new R(0)));
        rows.push(['AREA',i,j,k,l,area].map(String).join('|'));
      }
    }
  }
}
const edges=[[0,1],[0,2],[1,2]],maskOf=g=>edges.reduce((s,[a,b],i)=>s+(g.adjacency[a].includes(b)?2**i:0),0);
for(const mask of spec.graphMasks){
  const graph=new ExactGraph(3,edges.filter((_,i)=>mask&(1<<i))),poly=g=>characteristicPolynomial(g).map(String).join(',');
  rows.push(['GRAPH3',mask,poly(graph)].join('|'));
  for(const [i,pullback] of spec.pullbackPermutations.entries()){
    // Lean uses new->old adjacency pullback; public JS requires old->new IDs.
    const inverse=pullback.map((_,old)=>pullback.indexOf(old)),g=relabelGraph(graph,inverse);
    rows.push(['RELABEL3',mask,i,maskOf(g),poly(g)].join('|'));
  }
}
process.stdout.write(rows.join('\n')+'\n');
