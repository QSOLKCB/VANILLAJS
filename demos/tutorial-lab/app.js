// SPDX-License-Identifier: Apache-2.0
import {starter,player,withSpeed,inspect,walk,project} from './lesson.js';
import {OptionalRenderer} from '../../modules/render-optional/index.js';
import {SceneMeshes} from '../editor/scene-meshes.js';
import {createSceneVertices,displayWorld,cameraMatrix} from '../editor/viewport.js';
const $=id=>document.getElementById(id),steps=[...document.querySelectorAll('#progress li')];
let scene,renderer,meshes,changed=false,faultSeen=false,tested=false;
function mark(i,done){steps[i].classList.toggle('done',done);steps[i].setAttribute('aria-label',steps[i].textContent+(done?' — completed':' — pending'));}
function draw(state){
  if(!renderer){renderer=new OptionalRenderer($('view'));meshes=new SceneMeshes(renderer);}
  meshes.update(createSceneVertices(displayWorld(scene,state),null));
  // A near-overhead view keeps the player clear of large floor triangles in
  // the existing CPU painter, and shows +X movement left to right.
  renderer.beginFrame({vp:cameraMatrix({yaw:0,pitch:85,distance:16,target:[0,0,0]},800,450)});meshes.draw();renderer.endFrame();
}
function status(message){$('result').textContent=message;}
function edited(){tested=false;$('download').disabled=true;mark(1,false);mark(2,false);mark(3,false);draw();}
function safely(fn){try{fn();}catch(error){tested=false;$('download').disabled=true;status('Could not complete this step: '+error.message);}}
$('load').onclick=()=>safely(()=>{
  scene=starter();changed=false;faultSeen=false;tested=false;
  steps.forEach((_,i)=>mark(i,i===0));
  for(const id of ['speed','apply','test','fault'])$(id).disabled=false;
  $('speed').value=player(scene).components.controller.speed;$('download').disabled=true;
  draw();status('Playground loaded. Choose a different positive speed, apply it, then test.');
});
$('edit').onsubmit=event=>{event.preventDefault();safely(()=>{
  const speed=Number($('speed').value);if($('speed').value.trim()==='')throw Error('Enter a speed.');
  const next=withSpeed(scene,speed);scene=next;changed=speed!==player(starter()).components.controller.speed;
  edited();$('test').disabled=false;const issues=inspect(scene).issues;
  if(issues.some(i=>i.code==='zero-speed'))faultSeen=true;
  status(issues.length?issues.map(i=>i.message).join(' '):'Scene checks passed. Test this edit.');
});};
$('speed').oninput=()=>safely(()=>{edited();$('test').disabled=true;status('Speed changed. Apply this value before testing or downloading.');});
$('fault').onclick=()=>safely(()=>{scene=withSpeed(scene,0);$('speed').value=0;faultSeen=true;edited();$('test').disabled=false;status(inspect(scene).issues.map(i=>i.message).join(' '));});
$('test').onclick=()=>safely(()=>{
  const result=walk(scene);draw(result.state);tested=result.distance>0;
  mark(1,changed&&tested);mark(2,faultSeen&&tested);
  $('download').disabled=!(changed&&faultSeen&&tested);
  status(`Executed ${result.state.tick} fixed steps. Player moved ${result.distance.toFixed(2)} metres. `+(!changed?'Apply a speed different from the starter. ':!faultSeen?'Now try the zero-speed problem. ':'Repaired scene tested; your project is ready to download.'));
});
$('download').onclick=()=>safely(()=>{
  if(!(changed&&faultSeen&&tested))throw Error('Finish the edit, diagnosis and repaired test first.');
  const url=URL.createObjectURL(new Blob([project(scene)],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download='first-scene.vproject.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  mark(3,true);status('Project download requested. Keep the file and open it in the Workbench.');
});

$('load').disabled=false;
status('Load the starter to begin.');
