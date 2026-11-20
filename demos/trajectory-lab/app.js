// SPDX-License-Identifier: Apache-2.0
import {createTrajectoryWorld,queryTrajectoryLock,launchTrajectory,stepTrajectory} from '../../modules/trajectory/index.js';
const $=id=>document.getElementById(id),ctx=$('field').getContext('2d');
const actors=[{id:'pilot',position:[0,0,0],velocity:[0,0,0],halfExtents:[1,1,1]},
 {id:'bogey',position:[0,0,-90],velocity:[4,0,0],halfExtents:[2,2,2]}];
const world=createTrajectoryWorld({actors,walls:[]});
const request={ownerId:'pilot',targetId:'bogey',position:[0,0,-2],direction:[0,0,-1],
 speed:90,turnRate:3.8,ttlTicks:240,halfSize:.2};
let state=null,message='Ready.';
function draw(){
 ctx.clearRect(0,0,900,480);ctx.strokeStyle='#24455a';
 for(let i=0;i<900;i+=45){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,480);ctx.stroke();}
 for(let i=0;i<480;i+=40){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(900,i);ctx.stroke();}
 const p=(x,z)=>[450+x*3,430+z*3];const tick=state?.tick||0;
 const bogey=p(4*tick/120,-90),pilot=p(0,0);
 ctx.fillStyle='#77defb';ctx.beginPath();ctx.arc(...pilot,9,0,2*Math.PI);ctx.fill();
 ctx.fillStyle='#ffab68';ctx.beginPath();ctx.arc(...bogey,10,0,2*Math.PI);ctx.fill();
 if(state){ctx.fillStyle=state.status==='hit'?'#a5f997':'#fff3a8';ctx.beginPath();
 ctx.arc(...p(state.position[0],state.position[2]),6,0,2*Math.PI);ctx.fill();}
 $('receipt').textContent=JSON.stringify({message,lock:queryTrajectoryLock(world,request),
  shot:state&&{tick:state.tick,status:state.status,position:state.position,event:state.event}},null,2);
}
$('launch').addEventListener('click',()=>{const r=launchTrajectory(world,request);state=r.state;
 message=r.accepted?'Lock verified. Missile authorised.':'Rejected: '+r.reason;draw();});
$('step').addEventListener('click',()=>{if(!state){message='Acquire lock first.';}else{
 state=stepTrajectory(world,state,Math.min(60,state.ttlTicks-state.tick));
 message='Accepted fixed ticks '+state.tick+'.';}draw();});
$('reset').addEventListener('click',()=>{state=null;message='Ready.';draw();});
draw();
