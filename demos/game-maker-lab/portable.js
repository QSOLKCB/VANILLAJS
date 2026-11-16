// SPDX-License-Identifier: Apache-2.0
import {mountGameMakerPlayer} from './player.js';
import {assertPlayable} from './game.js';
/** Explicit portable entry. The exporter supplies validated inert project data. */
export function mountPortable(value){
  const project=assertPlayable(value),get=id=>document.getElementById(id);get('title').textContent=project.name;document.title=project.name+' · VANILLAJS';
  const controls=[get('play'),get('pause'),get('restart'),get('sound')];
  let player=null;
  const status=message=>{get('play-status').textContent=message;};
  function create(){try{
    player=mountGameMakerPlayer({canvas:get('game'),project,onStatus:status,onState:s=>{get('signals').textContent='SIGNALS '+(s.state?.collected.length??0)+' / '+project.map.triggers.filter(t=>t.tag==='collect').length;get('ticks').textContent='TICK '+(s.state?.tick??0);get('sound').textContent=s.sound?'Sound on':'Sound off';get('sound').setAttribute('aria-pressed',String(s.sound));}});
    player.bindTouch(document);get('play').onclick=()=>{try{player.play();}catch(e){status(e.message);}};get('pause').onclick=()=>player.pause();get('restart').onclick=()=>player.restart();get('sound').onclick=()=>player.enableSound();
    for(const control of controls)control.disabled=false;globalThis.__gameMakerPlayer=player;document.documentElement.dataset.gameReady='game-maker';status('Ready. Press Play to start your game.');
  }catch(error){for(const control of controls)control.disabled=true;status('Game could not start: '+error.message);document.documentElement.dataset.gameReady='failed';}}
  create();addEventListener('pagehide',()=>{player?.dispose();player=null;});addEventListener('pageshow',event=>{if(event.persisted)create();});return player;
}
