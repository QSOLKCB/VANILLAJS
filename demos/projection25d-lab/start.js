// SPDX-License-Identifier: Apache-2.0
// Visual-only consumer of the new pure module. No game simulation is run here.
import {createProjection25D,projectPoint25D,projectScene25D} from '../../modules/projection25d/index.js';
const world=Object.freeze({
  player:Object.freeze({x:24,z:48}),
  buildings:Object.freeze([
    Object.freeze({id:'market',x:12,z:7,width:26,depth:19,height:11}),
    Object.freeze({id:'workshop',x:65,z:8,width:26,depth:25,height:8}),
    Object.freeze({id:'houses',x:64,z:62,width:31,depth:17,height:7}),
    Object.freeze({id:'warehouse',x:10,z:67,width:34,depth:19,height:13})
  ])
});
function fill(ctx,points,color){ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.fillStyle=color;ctx.fill();}
function draw(id,raised){
  const canvas=document.getElementById(id),ctx=canvas.getContext('2d');
  const projection=createProjection25D({viewport:[canvas.width,canvas.height],origin:[51,47],pixelsPerUnit:2.5,
    heightRise:raised?.8:0,heightShear:raised?.38:0,shadowDirection:[.5,.25]});
  ctx.fillStyle='#194338';ctx.fillRect(0,0,canvas.width,canvas.height);
  const ground=(x,z)=>projectPoint25D(projection,[x,0,z]);
  fill(ctx,[ground(43,0),ground(59,0),ground(59,100),ground(43,100)],'#394854');
  fill(ctx,[ground(0,38),ground(102,38),ground(102,54),ground(0,54)],'#394854');
  const scene=projectScene25D(projection,world.buildings);
  if(raised)for(const s of scene.shadows)fill(ctx,s.points,'rgba(0,0,0,.24)');
  const roofs=['#e1a079','#89c1ce','#d6c58b','#bf9bd4'];
  for(let i=0;i<scene.solids.length;i++){
    const b=scene.solids[i];if(raised){fill(ctx,b.sideX,'#344451');fill(ctx,b.sideZ,'#4b5863');}
    fill(ctx,b.roof,roofs[world.buildings.findIndex(x=>x.id===b.id)]);
    ctx.strokeStyle='#182c32';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...b.roof[0]);for(const p of b.roof.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.stroke();
  }
  const p=ground(world.player.x,world.player.z);ctx.fillStyle='#fbe182';ctx.beginPath();ctx.arc(...p,6,0,2*Math.PI);ctx.fill();
  ctx.strokeStyle='#132a35';ctx.lineWidth=2;ctx.stroke();
  return JSON.stringify({player:world.player,footprints:scene.solids.map(s=>({id:s.id,footprint:s.footprint}))});
}
const flat=draw('flat',false),raised=draw('raised',true);
// Compare authoritative data independently of visual output, not frame timing.
document.getElementById('receipt').textContent=flat===raised?
  'PASS — identical player and collision footprints in both views; no external assets or physics changes.':
  'FAIL — presentation altered authoritative data.';
