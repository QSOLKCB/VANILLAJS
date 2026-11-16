// SPDX-License-Identifier: Apache-2.0
// Original Signal Garden pixels and map. No external art or game-source copying.
import {generateSprite} from '../../modules/sprite2d/index.js';
import {createTilemap} from '../../modules/tilemap/index.js';
import {GAME_MAKER_FORMAT,validateProject} from './game.js';
export const GARDEN_PALETTE=Object.freeze([[0,0,0,0],[24,54,68,255],[62,117,116,255],[140,211,174,255],[245,190,80,255],[240,238,211,255]]);
export function gardenSprite(seed=217){return generateSprite({kind:'character',size:16,seed,symmetry:true,frameCount:2,palette:GARDEN_PALETTE.map(c=>[...c])},{name:'Signal courier',license:'Apache-2.0'});}
export function gardenTiles(){
  const project=generateSprite({kind:'terrain',size:16,seed:28,symmetry:false,frameCount:4,palette:GARDEN_PALETTE.map(c=>[...c])},{name:'Signal Garden tiles',license:'Apache-2.0'});
  for(let f=0;f<4;f++)for(let y=0;y<16;y++)for(let x=0;x<16;x++){
    let color=0;
    if(f===0)color=y<3?3:y===3?2:(x+y*3)%13===0?2:1;
    if(f===1)color=y<3?4:y<7?2:y<9?1:0;
    if(f===2)color=((x===8&&y>=4&&y<=11)||(y===8&&x>=4&&x<=11))?2:0;
    if(f===3)color=y>8&&((x>2&&x<5)||(x>10&&x<13))?3:y===8&&(x===3||x===11)?4:0;
    project.frames[f].pixels[y*16+x]=color;
  }
  return project;
}
export function emptyProject(){return validateProject({format:GAME_MAKER_FORMAT,version:1,name:'My Signal Garden',map:createTilemap({width:24,height:12,name:'Signal Garden',tileset:gardenTiles()}),playerSprite:gardenSprite()});}
export function starterProject(){
  const p=emptyProject();p.name='Signal Garden';const m=p.map;
  m.layers.unshift({id:'distance',name:'Distant signals',parallax:.35,cells:Array(m.width*m.height).fill(-1)});
  for(let c=0;c<m.width;c++){m.layers[1].cells[11*m.width+c]=0;m.collision[11*m.width+c]=1;if(c%5===1)m.layers[0].cells[3*m.width+c]=2;if(c%4===0)m.layers[0].cells[10*m.width+c]=3;}
  m.layers[1].cells[10*m.width+10]=0;m.collision[10*m.width+10]=1;
  m.spawns=[{id:'player',column:2,row:10}];
  m.triggers=[{id:'spark-west',column:5,row:10,tag:'collect'},{id:'spark-center',column:12,row:10,tag:'collect'},{id:'spark-east',column:19,row:10,tag:'collect'},{id:'thorn',column:15,row:10,tag:'hazard'},{id:'portal',column:22,row:10,tag:'exit'}];
  return validateProject(p);
}
