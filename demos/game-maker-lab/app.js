// SPDX-License-Identifier: Apache-2.0
import {parseSpriteProject,rgbaFrame,paintSpritePixel,setSpritePalette} from '../../modules/sprite2d/index.js';
import {emptyProject,starterProject,gardenSprite} from './starter.js';
import {validateProject,parseProject,serializeProject,projectIssues,GAME_MAKER_BYTES} from './game.js';
import {mountGameMakerPlayer} from './player.js';
import {exportGameMaker} from './export.js';

const get=id=>document.getElementById(id),clone=value=>JSON.parse(JSON.stringify(value));
let project=starterProject(),history=[serializeProject(project)],cursor=0,player=null,selected={column:0,row:0},pixel={x:0,y:0},stroke=null,generation=0,activeExport=null,heroChosen=false,tested=false,exported=false,lastStart=null;
const mapCanvas=get('map'),mapContext=mapCanvas.getContext('2d'),spriteCanvas=get('sprite'),spriteContext=spriteCanvas.getContext('2d');
const status=(message,error=false)=>{get('status').textContent=message;get('status').classList.toggle('error',error);};
const run=fn=>{try{return fn();}catch(error){status('Not applied: '+error.message,true);}};
function option(value,label){const element=document.createElement('option');element.value=String(value);element.textContent=label;return element;}
function download(raw,name,type='application/json'){
  const blob=raw instanceof Blob?raw:new Blob([raw],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function playReport(s){
  const game=s.state;get('game-state').textContent=game?(s.running?'PLAYING':game.status==='playing'?'PAUSED':game.status.toUpperCase()):'BUILD';
  get('signals').textContent='SIGNALS '+(game?.collected.length??0)+' / '+project.map.triggers.filter(t=>t.tag==='collect').length;get('ticks').textContent='TICK '+(game?.tick??0);
  get('sound').textContent=s.sound?'Sound on':'Sound off';get('sound').setAttribute('aria-pressed',String(s.sound));
  if(!tested&&game&&lastStart&&game.tick>0&&game.body.x!==lastStart.x){tested=true;updateProgress();}
}
function createPlayer(){
  try{player=mountGameMakerPlayer({canvas:get('game'),project,onState:playReport,onStatus:message=>{get('play-status').textContent=message;}});player.bindTouch(document);get('graphics-fallback').hidden=true;}
  catch(error){player=null;get('graphics-fallback').hidden=false;get('play-status').textContent='Preview unavailable: '+error.message;}
}
function updateProgress(){
  for(const [id,done]of [['stage',projectIssues(project).length===0],['sprite',heroChosen],['test',tested],['export',exported]])get('step-'+id).classList.toggle('done',done);
}
function updateExportControl(){get('export-game').disabled=activeExport!==null||projectIssues(project).length>0;}
function invalidatePending(){
  const canceled=activeExport!==null;generation++;activeExport=null;updateExportControl();
  if(canceled)status('Export canceled.');
  return generation;
}
function sourceSprite(){return get('palette-target').value==='tiles'?project.map.tileset:project.playerSprite;}
function spriteFrame(){return get('palette-target').value==='tiles'?Number(get('tile-index').value):0;}
function sourceCanvas(source,frame){
  const c=document.createElement('canvas');c.width=source.recipe.size;c.height=source.recipe.size;const ctx=c.getContext('2d');if(!ctx)throw Error('Canvas 2D is unavailable');const data=ctx.createImageData(c.width,c.height);data.data.set(rgbaFrame(source,frame));ctx.putImageData(data,0,0);return c;
}
function drawSprite(){
  if(!spriteContext)return;const source=sourceSprite(),size=source.recipe.size;pixel.x=Math.min(pixel.x,size-1);pixel.y=Math.min(pixel.y,size-1);
  spriteContext.clearRect(0,0,160,160);spriteContext.imageSmoothingEnabled=false;const c=sourceCanvas(source,spriteFrame());spriteContext.drawImage(c,0,0,160,160);c.width=c.height=0;
  spriteContext.strokeStyle='#f5be50';spriteContext.lineWidth=1;spriteContext.strokeRect(pixel.x*160/size+.5,pixel.y*160/size+.5,160/size-1,160/size-1);
}
function drawMap(value=project){
  if(!mapContext)return;const map=value.map,size=24;mapCanvas.width=map.width*size;mapCanvas.height=map.height*size;mapContext.fillStyle='#102430';mapContext.fillRect(0,0,mapCanvas.width,mapCanvas.height);mapContext.imageSmoothingEnabled=false;
  const tiles=map.tileset.frames.map((_,i)=>sourceCanvas(map.tileset,i));
  for(const layer of map.layers)for(let i=0;i<layer.cells.length;i++)if(layer.cells[i]>=0){mapContext.globalAlpha=layer.parallax===1?1:.45;mapContext.drawImage(tiles[layer.cells[i]],i%map.width*size,Math.floor(i/map.width)*size,size,size);}
  mapContext.globalAlpha=1;for(const c of tiles)c.width=c.height=0;
  mapContext.strokeStyle='#32505a';mapContext.lineWidth=.5;for(let x=0;x<=map.width;x++){mapContext.beginPath();mapContext.moveTo(x*size,0);mapContext.lineTo(x*size,mapCanvas.height);mapContext.stroke();}for(let y=0;y<=map.height;y++){mapContext.beginPath();mapContext.moveTo(0,y*size);mapContext.lineTo(mapCanvas.width,y*size);mapContext.stroke();}
  for(let i=0;i<map.collision.length;i++)if(map.collision[i]){mapContext.strokeStyle='#8fd3ae';mapContext.lineWidth=2;mapContext.strokeRect(i%map.width*size+2,Math.floor(i/map.width)*size+2,size-4,size-4);}
  for(const m of [...map.spawns.map(s=>({...s,tag:'spawn'})),...map.triggers]){mapContext.fillStyle=({spawn:'#f0eed3',collect:'#f5be50',hazard:'#ef806e',exit:'#64bdd0'})[m.tag];mapContext.fillRect(m.column*size+6,m.row*size+6,size-12,size-12);mapContext.font='bold 10px monospace';mapContext.fillStyle='#102430';mapContext.fillText(({spawn:'P',collect:'+',hazard:'!',exit:'E'})[m.tag],m.column*size+9,m.row*size+16);}
  mapContext.strokeStyle='#f5be50';mapContext.lineWidth=2;mapContext.strokeRect(selected.column*size+1,selected.row*size+1,size-2,size-2);
}
function refresh(){
  get('project-name').value=project.name;get('map-size').textContent=project.map.width+' × '+project.map.height+' TILES';
  const layer=get('layer').value,frame=get('tile-index').value,palette=get('palette-index').value;
  get('layer').replaceChildren(...project.map.layers.map(l=>option(l.id,l.name)));get('layer').value=project.map.layers.some(l=>l.id===layer)?layer:project.map.layers.at(-1).id;
  get('tile-index').replaceChildren(...project.map.tileset.frames.map((_,i)=>option(i,'Frame '+i)));get('tile-index').value=Number(frame)<project.map.tileset.frames.length?frame||'0':'0';
  get('parallax').value=project.map.layers.find(l=>l.id===get('layer').value).parallax;get('camera-follow').checked=project.map.camera.follow;
  get('palette-index').replaceChildren(...sourceSprite().recipe.palette.map((_,i)=>option(i,i===0?'0 · erase':String(i))));get('palette-index').value=Number(palette)<sourceSprite().recipe.palette.length?palette||'2':'1';updatePalette();
  selected.column=Math.min(selected.column,project.map.width-1);selected.row=Math.min(selected.row,project.map.height-1);get('cell-column').max=String(project.map.width-1);get('cell-row').max=String(project.map.height-1);selectionStatus();
  get('project-json').value=serializeProject(project);get('undo').disabled=cursor===0;get('redo').disabled=cursor===history.length-1;
  const issues=projectIssues(project);get('issues').replaceChildren(...(issues.length?issues:['Ready to play. Game rules still need your actual playtest.']).map(message=>{const p=document.createElement('p');p.textContent=message;return p;}));
  get('play').disabled=issues.length>0||!player;updateExportControl();get('pause').disabled=!player;get('restart').disabled=!player;get('sound').disabled=!player;
  updateProgress();drawMap();drawSprite();
}
function updatePalette(){const color=sourceSprite().recipe.palette[Number(get('palette-index').value)||0];get('palette-color').value='#'+color.slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('');get('apply-palette').disabled=Number(get('palette-index').value)===0;}
function selectionStatus(){get('cell-column').value=selected.column;get('cell-row').value=selected.row;get('cell-status').textContent='Selected cell: column '+selected.column+', row '+selected.row+'. Enter applies '+get('tool').selectedOptions[0].textContent+'.';}
function apply(value,message,{remember=true,hero=false}={}){
  const next=validateProject(value),raw=serializeProject(next);invalidatePending();stroke=null;
  if(player)player.setProject(next);project=next;if(!player)createPlayer();tested=false;exported=false;lastStart=null;if(hero)heroChosen=true;
  if(remember&&raw!==history[cursor]){history=history.slice(0,cursor+1);history.push(raw);if(history.length>32)history.shift();cursor=history.length-1;}
  refresh();if(player)playReport(player.snapshot());status(message);
}
function paintCell(value,column,row){
  const m=value.map;if(!Number.isInteger(column)||!Number.isInteger(row)||column<0||row<0||column>=m.width||row>=m.height)throw Error('Select a cell inside the map');
  const i=row*m.width+column,tool=get('tool').value,layer=m.layers.find(l=>l.id===get('layer').value),same=q=>q.column===column&&q.row===row;
  if(tool==='floor'||tool==='tile'){if(tool==='floor'&&layer.parallax!==1)throw Error('Floor painting needs a normal 1× visual layer');layer.cells[i]=Number(get('tile-index').value);if(tool==='floor')m.collision[i]=1;}
  else if(tool==='solid')m.collision[i]=1;else if(tool==='clear-solid')m.collision[i]=0;
  else if(tool==='erase'){layer.cells[i]=-1;m.collision[i]=0;m.spawns=m.spawns.filter(q=>!same(q));m.triggers=m.triggers.filter(q=>!same(q));}
  else if(tool==='spawn')m.spawns=[{id:'player',column,row}];
  else{m.triggers=m.triggers.filter(q=>!same(q)&&(tool!=='exit'||q.tag!=='exit'));m.triggers.push({id:tool+'-'+column+'-'+row,column,row,tag:tool});}
  return value;
}
function applyBrush(){run(()=>{selected={column:Number(get('cell-column').value),row:Number(get('cell-row').value)};apply(paintCell(clone(project),selected.column,selected.row),'Applied '+get('tool').selectedOptions[0].textContent+' at '+selected.column+', '+selected.row+'.');});}
function mapPoint(event){const r=mapCanvas.getBoundingClientRect();return {column:Math.max(0,Math.min(project.map.width-1,Math.floor((event.clientX-r.left)/r.width*project.map.width))),row:Math.max(0,Math.min(project.map.height-1,Math.floor((event.clientY-r.top)/r.height*project.map.height)))};}
mapCanvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();player?.pause();invalidatePending();mapCanvas.focus();mapCanvas.setPointerCapture?.(event.pointerId);selected=mapPoint(event);stroke={id:event.pointerId,value:clone(project),last:selected};run(()=>{paintCell(stroke.value,selected.column,selected.row);drawMap(stroke.value);selectionStatus();});});
mapCanvas.addEventListener('pointermove',event=>{if(stroke?.id!==event.pointerId)return;selected=mapPoint(event);const old=stroke.last,steps=Math.max(Math.abs(selected.column-old.column),Math.abs(selected.row-old.row));run(()=>{for(let n=1;n<=steps;n++)paintCell(stroke.value,Math.round(old.column+(selected.column-old.column)*n/steps),Math.round(old.row+(selected.row-old.row)*n/steps));stroke.last=selected;drawMap(stroke.value);selectionStatus();});});
mapCanvas.addEventListener('pointerup',event=>{if(stroke?.id!==event.pointerId)return;const next=stroke.value;stroke=null;run(()=>apply(next,'Painted the selected cells.'));drawMap();});
for(const type of ['pointercancel','lostpointercapture'])mapCanvas.addEventListener(type,()=>{stroke=null;drawMap();});
mapCanvas.addEventListener('keydown',event=>{if(event.code==='Enter'||event.code==='Space'){event.preventDefault();applyBrush();return;}const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},d=moves[event.code];if(!d)return;event.preventDefault();selected.column=Math.max(0,Math.min(project.map.width-1,selected.column+d[0]));selected.row=Math.max(0,Math.min(project.map.height-1,selected.row+d[1]));selectionStatus();drawMap();});
function paintPixel(){run(()=>{const p=clone(project),target=get('palette-target').value==='tiles'?'tiles':'player',source=target==='tiles'?p.map.tileset:p.playerSprite,next=paintSpritePixel(source,spriteFrame(),pixel.x,pixel.y,Number(get('palette-index').value));if(target==='tiles')p.map.tileset=next;else p.playerSprite=next;apply(p,'Painted original source pixels.',{hero:target==='player'});});}
spriteCanvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();spriteCanvas.focus();const r=spriteCanvas.getBoundingClientRect(),size=sourceSprite().recipe.size;pixel={x:Math.max(0,Math.min(size-1,Math.floor((event.clientX-r.left)/r.width*size))),y:Math.max(0,Math.min(size-1,Math.floor((event.clientY-r.top)/r.height*size)))};paintPixel();});
spriteCanvas.addEventListener('keydown',event=>{if(['Space','Enter'].includes(event.code)){event.preventDefault();paintPixel();return;}const d=({ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]})[event.code];if(d){event.preventDefault();const size=sourceSprite().recipe.size;pixel.x=Math.max(0,Math.min(size-1,pixel.x+d[0]));pixel.y=Math.max(0,Math.min(size-1,pixel.y+d[1]));drawSprite();}});
get('paint-cell').onclick=applyBrush;
get('tool').onchange=selectionStatus;get('layer').onchange=()=>{get('parallax').value=project.map.layers.find(l=>l.id===get('layer').value).parallax;};get('tile-index').onchange=drawSprite;
get('palette-target').onchange=refresh;get('palette-index').onchange=updatePalette;
get('apply-palette').onclick=()=>run(()=>{const p=clone(project),target=get('palette-target').value,source=target==='tiles'?p.map.tileset:p.playerSprite,index=Number(get('palette-index').value);if(index===0)throw Error('Transparent index zero is preserved');const colors=clone(source.recipe.palette),hex=get('palette-color').value;colors[index]=[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),colors[index][3]];if(target==='tiles')p.map.tileset=setSpritePalette(source,colors);else p.playerSprite=setSpritePalette(source,colors);apply(p,'Applied the local RGBA palette.',{hero:target==='player'});});
get('generate').onclick=()=>run(()=>{const p=clone(project);p.playerSprite=gardenSprite(Number(get('seed').value));apply(p,'Generated original hero pixels from the selected seed.',{hero:true});});
get('apply-name').onclick=()=>run(()=>{const p=clone(project);p.name=get('project-name').value;apply(p,'Project renamed.');});
get('empty').onclick=()=>run(()=>{heroChosen=false;apply(emptyProject(),'Empty stage. Lay a floor, then place the player, a signal and a portal.');});
get('starter').onclick=()=>run(()=>{heroChosen=false;apply(starterProject(),'Original Signal Garden restored.');});
get('lay-floor').onclick=()=>run(()=>{const p=clone(project),layer=p.map.layers.find(l=>l.parallax===1);if(!layer)throw Error('Add a normal 1× layer first');for(let x=0;x<p.map.width;x++){const i=(p.map.height-1)*p.map.width+x;layer.cells[i]=0;p.map.collision[i]=1;}apply(p,'Laid a solid bottom-row floor. Place markers one row above it.');});
get('add-layer').onclick=()=>run(()=>{const p=clone(project),n=p.map.layers.length;if(n>=4)throw Error('Four visual layers is the current limit');p.map.layers.push({id:'layer-'+n,name:'Layer '+(n+1),parallax:.5,cells:Array(p.map.width*p.map.height).fill(-1)});apply(p,'Added a separate visual layer.');get('layer').value='layer-'+n;get('parallax').value='.5';});
get('apply-parallax').onclick=()=>run(()=>{const p=clone(project);p.map.layers.find(l=>l.id===get('layer').value).parallax=Number(get('parallax').value);apply(p,'Updated visual parallax. Collision is unchanged.');});
get('camera-follow').onchange=()=>run(()=>{const p=clone(project);p.map.camera.follow=get('camera-follow').checked;apply(p,'Updated camera follow.');});
get('undo').onclick=()=>run(()=>{if(cursor===0)return;const next=cursor-1;apply(parseProject(history[next]),'Undid the last accepted edit.',{remember:false});cursor=next;refresh();});
get('redo').onclick=()=>run(()=>{if(cursor>=history.length-1)return;const next=cursor+1;apply(parseProject(history[next]),'Restored the next accepted edit.',{remember:false});cursor=next;refresh();});
get('play').onclick=()=>run(()=>{player?.play();lastStart=player?.snapshot().state?.body??null;});get('pause').onclick=()=>player?.pause();get('restart').onclick=()=>{invalidatePending();player?.restart();lastStart=null;};get('sound').onclick=()=>player?.enableSound();
get('export-project').onclick=()=>run(()=>{download(serializeProject(project),'signal-garden.project.json');status('Project downloaded. It contains data, not the runnable engine.');});
get('apply-json').onclick=()=>run(()=>apply(parseProject(get('project-json').value),'Validated project JSON applied.'));
async function importFile(input,kind){
  const file=input.files?.[0];input.value='';if(!file)return;const ticket=invalidatePending();
  try{if(file.size>(kind==='sprite'?256*1024:GAME_MAKER_BYTES))throw Error('File exceeds its import byte limit');const raw=await file.text();if(ticket!==generation)return;if(kind==='sprite'){const p=clone(project);p.playerSprite=parseSpriteProject(raw);apply(p,'Validated sprite imported.',{hero:true});}else apply(parseProject(raw),'Validated project imported.');}
  catch(error){if(ticket===generation)status('Not applied: '+error.message,true);}
}
get('import-project').onchange=()=>importFile(get('import-project'),'project');get('import-sprite').onchange=()=>importFile(get('import-sprite'),'sprite');
get('export-game').onclick=async()=>{
  if(activeExport!==null)return;
  const ticket=invalidatePending();activeExport=ticket;updateExportControl();status('Preparing your verified local game package…');
  try{
    const {blob,filename}=await exportGameMaker(validateProject(project));
    if(ticket!==generation||activeExport!==ticket)return;
    download(blob,filename,'application/zip');exported=true;status('Playable game downloaded. Unzip and serve its folder; instructions are inside.');updateProgress();
  }catch(error){if(ticket===generation&&activeExport===ticket)status('Export failed: '+error.message,true);}
  finally{if(activeExport===ticket){activeExport=null;updateExportControl();}}
};
addEventListener('blur',()=>{stroke=null;drawMap();});addEventListener('pagehide',()=>{invalidatePending();stroke=null;player?.dispose();player=null;});
addEventListener('pageshow',event=>{if(event.persisted){createPlayer();refresh();lastStart=null;status('Accepted project restored after navigation. Press Play for a fresh run.');}});
createPlayer();refresh();status('Ready. Play Signal Garden, or start empty and build your own stage.');document.documentElement.dataset.labReady='game-maker-lab';
globalThis.__gameMakerLab=Object.freeze({snapshot:()=>({project:serializeProject(project),selected:{...selected},history:{cursor,length:history.length},progress:{heroChosen,tested,exported},player:player?.snapshot()??null}),refresh});
