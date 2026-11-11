// SPDX-License-Identifier: Apache-2.0
import {breadthFirst,depthFirst,relabelGraph,graphInvariants,characteristicPolynomial,closedWalkCounts} from '../../modules/exact-graph/index.js';
import {ExactRational} from '../../modules/exact-rational/index.js';
import {point2} from '../../modules/exact-geometry/index.js';
import {transformPoint2} from '../../modules/exact-d4/index.js';
import {presetGraph} from './presets.js';
const el=id=>document.getElementById(id),canvas=el('graph'),ctx=canvas.getContext('2d');
let graph=presetGraph('grid'),positions=[],traversal=null,visited=0;
const write=(id,value)=>{el(id).textContent=value;};
function resetPositions(){
  const width=graph.vertexCount===9?3:4;
  positions=Array.from({length:graph.vertexCount},(_,i)=>point2(new ExactRational(2*(i%width)-(width-1)),new ExactRational(2*Math.floor(i/width)-(Math.ceil(graph.vertexCount/width)-1))));
}
function selectStart(value=0){
  el('start').replaceChildren();for(let i=0;i<graph.vertexCount;i++){const option=document.createElement('option');option.value=String(i);option.textContent=String(i);el('start').append(option);}
  el('start').value=String(value);el('start').disabled=graph.vertexCount===0;
}
function resetTraversal(){
  visited=0;traversal=graph.vertexCount?(el('mode').value==='bfs'?breadthFirst:depthFirst)(graph,Number(el('start').value)):null;
  write('order',traversal?traversal.order.join(' → '):'∅');write('depth',traversal?traversal.depth.join(', '):'∅');draw();
}
function draw(){
  el('step').disabled=!traversal||visited>=traversal.order.length;
  write('status',traversal?'Visited '+visited+' of '+traversal.order.length+' reachable vertices':'Empty graph · no start vertex');
  if(!ctx){write('drawing-status','Canvas unavailable; exact results and traversal remain available.');return;}
  write('drawing-status','Rational D4 coordinates → illustrative canvas pixels');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const coordinates=positions.map(p=>{const t=transformPoint2(el('symmetry').value,p);return [360+Number(t.x.numerator)*65,300-Number(t.y.numerator)*65];});
  const seen=new Set(traversal?traversal.order.slice(0,visited):[]);
  ctx.strokeStyle='#53717e';ctx.lineWidth=3;
  for(const [a,b] of graph.edges){ctx.beginPath();ctx.moveTo(...coordinates[a]);ctx.lineTo(...coordinates[b]);ctx.stroke();}
  for(let i=0;i<coordinates.length;i++){
    const [x,y]=coordinates[i];ctx.fillStyle=seen.has(i)?'#f3c978':'#9be2be';ctx.beginPath();ctx.arc(x,y,21,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#101820';ctx.font='bold 20px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(i),x,y);
  }
}
function report(){
  const info=graphInvariants(graph);write('edges',JSON.stringify(graph.edges));write('polynomial','['+characteristicPolynomial(graph).map(String).join(', ')+']');
  write('size',info.vertices+' / '+info.edges);write('degrees',info.degreeSequence.join(', ')||'∅');write('components',info.components);
  write('triangles',String(info.triangles));write('density',String(info.density));write('walks',closedWalkCounts(graph,8).map(String).join(', '));
}
el('preset').onchange=()=>{graph=presetGraph(el('preset').value);resetPositions();selectStart();report();resetTraversal();};
el('mode').onchange=resetTraversal;el('start').onchange=resetTraversal;el('symmetry').onchange=draw;
el('step').onclick=()=>{if(traversal&&visited<traversal.order.length)visited++;draw();};
el('reset').onclick=resetTraversal;
el('relabel').onclick=()=>{
  const n=graph.vertexCount,map=Array.from({length:n},(_,i)=>n-1-i),start=n?map[Number(el('start').value)]:0;
  graph=relabelGraph(graph,map);positions=positions.slice().reverse();selectStart(start);report();resetTraversal();
};
resetPositions();selectStart();report();resetTraversal();
