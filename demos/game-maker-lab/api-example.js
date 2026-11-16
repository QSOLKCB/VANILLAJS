// SPDX-License-Identifier: Apache-2.0
// Original Ember Relay: public engine imports only; this small game owns its rules.
import {createGameMaker} from '../../api/game-maker/index.js';
import {generateSprite} from '../../modules/sprite2d/index.js';
import {createTilemap,Tilemap} from '../../modules/tilemap/index.js';
import {createBody2D} from '../../modules/motion2d/index.js';
import {Actions,attachKeyboard} from '../../modules/input/index.js';

function startExample(){
const canvas=document.querySelector('#example-canvas'),status=document.querySelector('#example-status');
const playButton=document.querySelector('#example-play'),pauseButton=document.querySelector('#example-pause');
const restartButton=document.querySelector('#example-restart'),disposeButton=document.querySelector('#example-dispose');
const palette=[[0,0,0,0],[35,74,81,255],[143,211,174,255],[240,238,211,255],[245,190,80,255]];
const recipe=kind=>({kind,size:16,seed:27,symmetry:true,frameCount:1,palette});
const hero=generateSprite(recipe('character'),{name:'Ember courier'}),tiles=generateSprite(recipe('terrain'),{name:'Relay floor'});
tiles.frames[0].pixels=Array.from({length:256},(_,i)=>i<32?2:1);
const data=createTilemap({width:12,height:6,name:'Ember Relay',tileset:tiles});
for(let col=0;col<12;col++){data.layers[0].cells[5*12+col]=0;data.collision[5*12+col]=1;}
data.spawns=[{id:'player',column:1,row:4}];
data.triggers=[{id:'ember',column:6,row:3,tag:'collect'},{id:'gate',column:10,row:4,tag:'exit'}];
const world=new Tilemap(data),spawn=world.tileToWorld(1,4),ember=world.tileToWorld(6,3),gate=world.tileToWorld(10,4);
const maker=createGameMaker({canvas,width:384,height:192,pixelsPerUnit:32});
maker.loadSprite('courier',hero);maker.loadTilemap('relay',data);
let body=createBody2D(spawn),collected=false,won=false,running=false,disposed=false,last=null,frame=0;
const actions=new Actions(),keyboard=attachKeyboard(window,actions,{bindings:{KeyA:'left',KeyD:'right',ArrowLeft:'left',ArrowRight:'right',Space:'jump'},enabled:()=>running});
const clear=()=>{keyboard.clear();maker.setInput({});};
function draw(){
  maker.setCamera({x:6,y:3});maker.begin('#102430');maker.tilemap('relay');
  if(!collected)maker.circle(ember.x/256,ember.y/256,.18,'#f5be50');
  maker.rect(gate.x/256-.3,1,.6,1,'#8fd3ae');
  maker.sprite('courier',0,body.x/256-.4,body.y/256-.44,{width:.8,height:1,flipX:body.vx<0});
  maker.text(collected?'Ember collected · reach the gate':'Jump to collect the ember',8,8,{screen:true,size:10});
}
function pause(message='Paused. Press Play to resume.'){
  if(disposed)return;running=false;last=null;cancelAnimationFrame(frame);clear();maker.pause(true);status.textContent=message;
}
function animate(now){
  if(!running||disposed)return;const seconds=last===null?0:Math.max(0,(now-last)/1000);last=now;
  const jumpPressed=actions.consume('jump');
  const input={left:!!actions.value('left'),right:!!actions.value('right'),jump:jumpPressed||!!actions.value('jump')};
  if(jumpPressed)maker.setInput({...input,jump:false});
  maker.setInput(input);
  maker.advance(seconds,(_dt,input)=>{
    body=world.step(body,{x:input.x,jump:input.pressed.jump},{motor:{speed:24,acceleration:6,drag:6,jumpSpeed:72,gravity:4,fallSpeed:80}}).body;
    if(Math.abs(body.x-ember.x)<140&&Math.abs(body.y-ember.y)<192)collected=true;
    if(collected&&Math.abs(body.x-gate.x)<140&&Math.abs(body.y-gate.y)<192){won=true;pause('You delivered the ember. Restart for another run.');}
  });
  draw();if(running)frame=requestAnimationFrame(animate);
}
function restart(){if(disposed)return;pause('Ready. Press Play.');maker.reset();body=createBody2D(spawn);collected=false;won=false;draw();}
function play(){if(disposed)return;if(won)restart();clear();maker.pause(false);running=true;last=null;canvas.focus();cancelAnimationFrame(frame);frame=requestAnimationFrame(animate);status.textContent='Find the ember, then the gate.';}
const blur=()=>pause(),hidden=()=>{if(document.hidden)pause();},pagehide=event=>{if(event.persisted)pause();else dispose();};
function dispose(){
  if(disposed)return;pause('Resources released. Reload this page to play again.');disposed=true;keyboard.dispose();maker.dispose();
  window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',pagehide);
  for(const button of [playButton,pauseButton,restartButton,disposeButton]){button.onclick=null;button.disabled=true;}
}
playButton.onclick=play;pauseButton.onclick=()=>pause();restartButton.onclick=restart;disposeButton.onclick=dispose;
window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',pagehide);
// Read-only inspection is useful when adapting the example; no state setter.
globalThis.gameMakerExample=Object.freeze({snapshot:()=>({body:{...body},collected,won,running,disposed,graphics:maker.snapshot()})});
draw();
}
try{startExample();}catch(error){
  document.querySelector('#example-status').textContent='The example could not start: '+error.message;
  for(const button of document.querySelectorAll('button'))button.disabled=true;
}
