// SPDX-License-Identifier: Apache-2.0
// Original Signal Garden rules. Reusable motion/collision belongs to tilemap;
// collectible, danger and exit meanings belong only to this example game.
import {validateTilemap,Tilemap} from '../../modules/tilemap/index.js';
import {validateSpriteProject} from '../../modules/sprite2d/index.js';
import {createBody2D} from '../../modules/motion2d/index.js';

export const GAME_MAKER_FORMAT='qsol.vanillajs.game-maker.v1';
export const GAME_MAKER_BYTES=1024*1024;
export const PLAYER_SHAPE=Object.freeze({halfWidth:80,halfHeight:112});
export const PLAYER_MOTOR=Object.freeze({speed:24,acceleration:6,drag:6,jumpSpeed:72,gravity:4,fallSpeed:80});
const exact=(value,keys)=>{
  if(!value||!['object'].includes(typeof value)||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw TypeError('Project must be a plain data record');
  const own=Reflect.ownKeys(value);
  if(own.length!==keys.length||own.some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(Object.getOwnPropertyDescriptor(value,k)??{},'value')))throw TypeError('Unknown, missing or executable project field');
};
export function validateProject(value){
  exact(value,['format','version','name','map','playerSprite']);
  if(value.format!==GAME_MAKER_FORMAT||value.version!==1)throw RangeError('Unsupported Game Maker project');
  if(typeof value.name!=='string'||!value.name.trim()||value.name.length>64||/[\u0000-\u001f\u007f]/.test(value.name))throw RangeError('Name must contain 1–64 visible characters');
  const map=validateTilemap(value.map),playerSprite=validateSpriteProject(value.playerSprite);
  if(map.spawns.length>1||map.spawns.some(s=>s.id!=='player'))throw RangeError('Signal Garden supports one spawn named player');
  const occupied=new Set();
  for(const t of map.triggers){
    if(!['collect','hazard','exit'].includes(t.tag))throw RangeError('Unsupported game trigger: '+t.tag);
    const cell=t.column+','+t.row;if(occupied.has(cell))throw RangeError('Only one game trigger per tile');occupied.add(cell);
  }
  if(map.triggers.filter(t=>t.tag==='exit').length>1)throw RangeError('Signal Garden supports one exit');
  const project={format:GAME_MAKER_FORMAT,version:1,name:value.name,map,playerSprite};
  if(new TextEncoder().encode(JSON.stringify(project)).length>GAME_MAKER_BYTES)throw RangeError('Project exceeds 1 MiB');
  return project;
}
export function parseProject(raw){
  if(typeof raw!=='string'||new TextEncoder().encode(raw).length>GAME_MAKER_BYTES)throw RangeError('Project exceeds 1 MiB');
  return validateProject(JSON.parse(raw));
}
export function serializeProject(value){const raw=JSON.stringify(validateProject(value));if(new TextEncoder().encode(raw).length>=GAME_MAKER_BYTES)return raw;return raw+'\n';}
export function projectIssues(value){
  const p=validateProject(value),issues=[];
  if(p.map.spawns.length!==1)issues.push('Place the player spawn.');
  if(!p.map.triggers.some(t=>t.tag==='exit'))issues.push('Place the exit portal.');
  if(!p.map.collision.some(Boolean))issues.push('Paint at least one solid floor tile.');
  return issues;
}
export function assertPlayable(value){const project=validateProject(value),issues=projectIssues(project);if(issues.length)throw Error(issues.join(' '));return project;}
function controls(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['x','jump'].includes(k))||!Number.isInteger(value.x)||Math.abs(value.x)>1||typeof value.jump!=='boolean')throw TypeError('Supply x = -1, 0 or 1 and boolean jump');
  return value;
}
export class GameRuntime{
  constructor(value){this.project=assertPlayable(value);this.map=new Tilemap(this.project.map);this.restart();}
  restart(){const spawn=this.project.map.spawns[0],point=this.map.tileToWorld(spawn.column,spawn.row);this.state={tick:0,status:'playing',body:createBody2D(point),collected:[],events:[]};return this.snapshot();}
  snapshot(){return structuredClone(this.state);}
  step(input){
    controls(input);if(this.state.status!=='playing')return this.snapshot();
    if(this.state.tick>=216000)throw RangeError('Restart after the bounded one-hour session');
    const old=this.state,{body}=this.map.step(old.body,input,{...PLAYER_SHAPE,profile:'platform',motor:PLAYER_MOTOR});
    const state={tick:old.tick+1,status:'playing',body,collected:[...old.collected],events:[]};
    if(input.jump&&old.body.grounded&&!body.grounded)state.events.push('jump');
    // Each marker uses a small game-owned box inside its whole tile. Movement
    // speed is bounded below a tile per tick; terrain itself uses swept AABBs.
    for(const t of this.project.map.triggers){
      const point=this.map.tileToWorld(t.column,t.row),half=t.tag==='hazard'?90:56;
      if(Math.abs(body.x-point.x)>=PLAYER_SHAPE.halfWidth+half||Math.abs(body.y-point.y)>=PLAYER_SHAPE.halfHeight+half)continue;
      if(t.tag==='hazard'){state.status='lost';state.events.push('lost');break;}
      if(t.tag==='collect'&&!state.collected.includes(t.id)){state.collected.push(t.id);state.events.push('collect');}
    }
    if(state.status==='playing'&&state.collected.length===this.project.map.triggers.filter(t=>t.tag==='collect').length){
      const exit=this.project.map.triggers.find(t=>t.tag==='exit'),point=this.map.tileToWorld(exit.column,exit.row);
      if(Math.abs(body.x-point.x)<PLAYER_SHAPE.halfWidth+56&&Math.abs(body.y-point.y)<PLAYER_SHAPE.halfHeight+112){state.status='won';state.events.push('won');}
    }
    this.state=state;return this.snapshot();
  }
}
