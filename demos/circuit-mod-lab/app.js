// SPDX-License-Identifier: Apache-2.0
// Game-authoring demonstration only: no executable mod imports or physics.
import {DataModRegistry,MOD_PACK_KIND} from '../../modules/mod-sdk/index.js';
import {registerCourseMod,activeCompiledCourses,COURSE_ENTRY_KIND} from '../../modules/mod-course/index.js';
import {newCircuitProgress,advanceCircuitQ16} from '../../modules/exact-circuit/index.js';
import {buildLoopPack,firstGateSweep} from './builder.js';
import {SCALE} from '../../modules/integer-math/index.js';

const $=id=>document.getElementById(id);
const starter={
  kind:MOD_PACK_KIND,id:'starter-circuit',version:'1.0.0',requires:[],
  entries:[{id:'circuit',kind:'data',data:{
    kind:COURSE_ENTRY_KIND,
    course:{id:'starter-loop',version:2,laps:2,spawn:['0','8','0'],
      gates:[
        {id:'east',x:'10',y:'8',z:'0',width:'20',height:'14',axis:'x',direction:1},
        {id:'north',x:'30',y:'8',z:'-20',width:'20',height:'14',axis:'z',direction:-1},
        {id:'west',x:'-10',y:'8',z:'-40',width:'20',height:'14',axis:'x',direction:-1},
        {id:'south',x:'0',y:'8',z:'0',width:'20',height:'14',axis:'z',direction:1}
      ],
      obstacles:[{id:'pillar',min:['3','0','-18'],max:['6','10','-15'],color:'#ff9955'}]
    }
  }}]
};
let compiled=null,activeSource=null;
const canvas=$('map'),ctx=canvas.getContext('2d');
function drawMap(c){
  if(!ctx)return;
  const w=canvas.width,h=canvas.height;
  ctx.fillStyle='#071525';ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#1b3b53';ctx.lineWidth=1;
  for(let i=0;i<=w;i+=40){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,h);ctx.stroke();}
  for(let i=0;i<=h;i+=40){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(w,i);ctx.stroke();}
  if(!c)return;
  const points=c.gates.map(g=>[g.axis==='x'?g.planeRaw:g.sideRaw,
    g.axis==='z'?g.planeRaw:g.sideRaw]);
  const xs=points.map(p=>p[0]/SCALE),zs=points.map(p=>p[1]/SCALE);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  const span=Math.max(40,maxX-minX,maxZ-minZ);
  const x=v=>w/2+(v-(minX+maxX)/2)*Math.min(w,h)*.7/span;
  const y=v=>h/2+(v-(minZ+maxZ)/2)*Math.min(w,h)*.7/span;
  ctx.lineWidth=3;ctx.strokeStyle='#3fd5bd';ctx.beginPath();
  points.forEach((p,i)=>{const a=x(p[0]/SCALE),b=y(p[1]/SCALE);
    if(i===0)ctx.moveTo(a,b);else ctx.lineTo(a,b);
  });
  ctx.closePath();ctx.stroke();
  for(let i=0;i<points.length;i++){
    const [a,b]=points[i],xx=x(a/SCALE),yy=y(b/SCALE);
    ctx.beginPath();ctx.arc(xx,yy,8,0,Math.PI*2);ctx.fillStyle=i===0?'#ffd081':'#65f3dc';ctx.fill();
    ctx.fillStyle='#edfaff';ctx.font='14px monospace';ctx.fillText(c.gates[i].id,xx+12,yy-8);
  }
}
function validate(){
  try{
    const source=JSON.parse($('manifest').value),reg=new DataModRegistry();
    registerCourseMod(reg,source);reg.activate(source.id);
    const entries=activeCompiledCourses(reg),course=entries[0]?.compiled;
    if(!course||course.version!==2)throw new TypeError('starter lab requires a v2 circuit');
    compiled=course;activeSource=source;
    $('status').textContent='PASS · '+course.gates.length+' cardinal gates · '+course.laps+' laps · '+course.obstacles.length+' obstacles';
    $('result').textContent=JSON.stringify({
      kind:course.kind,spawnRaw:course.spawnRaw,
      gates:course.gates,obstacles:course.obstacles
    },null,2);
    $('download').disabled=false;$('sweep').disabled=false;
    $('sweep-status').textContent='Valid compiled course. Test the first gate crossing.';
    drawMap(course);
  }catch(error){
    compiled=null;activeSource=null;
    $('status').textContent='REJECTED · '+error.message;
    $('result').textContent='No compiled course';
    $('download').disabled=true;$('sweep').disabled=true;
    $('sweep-status').textContent='Invalid course cannot run a sweep.';
    drawMap(null);
  }
}
$('manifest').value=JSON.stringify(starter,null,2);
$('validate').addEventListener('click',validate);
$('restore').addEventListener('click',()=>{
  $('manifest').value=JSON.stringify(starter,null,2);validate();
});
$('sweep').addEventListener('click',()=>{
  if(!compiled)return;
  const before=newCircuitProgress(compiled);
  const {from,to}=firstGateSweep(compiled);
  const after=advanceCircuitQ16(compiled,before,from,to);
  $('sweep-status').textContent='Exact sweep across first gate: '+after.crossed+
    ' gate; next index '+after.nextGate+'; '+after.completedLaps+' laps complete.';
});
$('download').addEventListener('click',()=>{
  if(!compiled||!activeSource)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(activeSource,null,2)+'\n'],
    {type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=activeSource.id+'.json';
  a.click();URL.revokeObjectURL(url);
});
validate();

$('loop-builder').addEventListener('submit',event=>{
  event.preventDefault();
  try{const pack=buildLoopPack({width:Number($('loop-width').value),depth:Number($('loop-depth').value),aperture:Number($('loop-aperture').value),laps:Number($('loop-laps').value)});
    $('manifest').value=JSON.stringify(pack,null,2);validate();
    $('builder-status').textContent='Loop ready. Test the first gate, then Download JSON. This is course data; a game must supply flight and collision.';
  }catch(error){$('builder-status').textContent='Draft unchanged: '+error.message;}
});
