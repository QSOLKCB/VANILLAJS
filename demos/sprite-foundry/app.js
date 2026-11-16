// SPDX-License-Identifier: Apache-2.0
import {SPRITE_MAX_BYTES,generateSprite,validateSpriteProject,parseSpriteProject,serializeSpriteProject,
  rgbaFrame,paintSpritePixel,fillSpritePixels,setSpritePalette,duplicateSpriteFrame,moveSpriteFrame,
  removeSpriteFrame,setSpriteDuration,spriteFrameAt,buildSpriteAtlas} from '../../modules/sprite2d/index.js';
import {examples,exampleSprite,palettes} from './examples.js';
const $=id=>document.getElementById(id),canvas=$('pixel-canvas'),ctx=canvas.getContext('2d'),
  preview=$('preview'),previewContext=preview.getContext('2d'),scratch=document.createElement('canvas'),
  scratchContext=scratch.getContext('2d');
if(!ctx||!previewContext||!scratchContext)throw new Error('Canvas 2D is required');
let project=exampleSprite(),frame=0,color=1,tool='pencil',cursor={x:0,y:0},gesture=null,
  undo=[],redo=[],revision=0,playing=false,raf=0,started=0,lastPreview=-1,disposed=false;
const status=text=>$('status').textContent=text;
const snapshot=()=>({project:serializeSpriteProject(project),frame});
function restore(saved){
  project=parseSpriteProject(saved.project);frame=saved.frame;revision++;
  color=Math.min(color,project.recipe.palette.length-1);
  cursor={x:Math.min(cursor.x,project.recipe.size-1),y:Math.min(cursor.y,project.recipe.size-1)};
  drawAll(true);
}
function remember(saved){undo.push(saved);if(undo.length>20)undo.shift();redo=[];}
function cancelGesture(){
  if(!gesture)return;
  const saved=gesture.before,id=gesture.id;gesture=null;
  if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
  project=parseSpriteProject(saved.project);frame=saved.frame;drawAll();
}
function commit(next,message,{selected=frame,reset=false}={}){
  const accepted=validateSpriteProject(next);cancelGesture();remember(snapshot());
  project=accepted;frame=Math.min(selected,project.frames.length-1);revision++;
  color=Math.min(color,project.recipe.palette.length-1);cursor.x=Math.min(cursor.x,project.recipe.size-1);cursor.y=Math.min(cursor.y,project.recipe.size-1);
  if(reset)stopAnimation();
  drawAll(true);status(message);
}
const action=fn=>async event=>{
  try{await fn(event);}catch(error){status('Not applied: '+error.message+'. Your accepted sprite is unchanged.');}
};
function putSource(bytes,size){scratch.width=scratch.height=size;scratchContext.putImageData(new ImageData(new Uint8ClampedArray(bytes),size,size),0,0);}
function drawEditor(){
  const size=project.recipe.size,zoom=Number($('zoom').value),side=size*zoom;
  canvas.width=canvas.height=side;canvas.style.setProperty('--canvas-side',side+'px');
  ctx.imageSmoothingEnabled=false;
  if($('onion').checked&&frame>0){putSource(rgbaFrame(project,frame-1),size);ctx.globalAlpha=.22;ctx.drawImage(scratch,0,0,side,side);ctx.globalAlpha=1;}
  putSource(rgbaFrame(project,frame),size);ctx.drawImage(scratch,0,0,side,side);
  ctx.strokeStyle='#51445b24';ctx.lineWidth=1;
  for(let i=1;i<size;i++){ctx.beginPath();ctx.moveTo(i*zoom+.5,0);ctx.lineTo(i*zoom+.5,side);ctx.moveTo(0,i*zoom+.5);ctx.lineTo(side,i*zoom+.5);ctx.stroke();}
  if(document.activeElement===canvas){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(cursor.x*zoom+2,cursor.y*zoom+2,zoom-4,zoom-4);ctx.strokeStyle='#282834';ctx.lineWidth=1;ctx.strokeRect(cursor.x*zoom+.5,cursor.y*zoom+.5,zoom-1,zoom-1);}
  $('cursor-note').textContent='Pixel '+(cursor.x+1)+', '+(cursor.y+1);
  canvas.setAttribute('aria-label','Pixel editor, '+size+' by '+size+', cursor column '+(cursor.x+1)+', row '+(cursor.y+1));
}
function drawPreview(index){
  lastPreview=index;const size=project.recipe.size;
  previewContext.clearRect(0,0,preview.width,preview.height);previewContext.imageSmoothingEnabled=false;
  putSource(rgbaFrame(project,index),size);previewContext.drawImage(scratch,16,16,160,160);
  $('preview-note').textContent=(playing?'Playing':'Paused')+' · frame '+(index+1);
}
function swatches(){
  $('palette').replaceChildren(...project.recipe.palette.map((rgba,index)=>{
    const button=document.createElement('button');button.type='button';button.dataset.index=index;
    button.style.backgroundColor='rgba('+rgba[0]+','+rgba[1]+','+rgba[2]+','+rgba[3]/255+')';
    button.setAttribute('aria-label',index===0?'Transparent eraser':'Palette colour '+index);
    button.setAttribute('aria-pressed',String(index===color));button.onclick=()=>{color=index;swatches();syncColor();};
    return button;
  }));
}
function syncColor(){
  const c=project.recipe.palette[color];$('color').value='#'+c.slice(0,3).map(n=>n.toString(16).padStart(2,'0')).join('');
  $('alpha').value=c[3];$('color').disabled=$('alpha').disabled=$('apply-color').disabled=color===0;
}
function timeline(){
  $('timeline').replaceChildren(...project.frames.map((entry,index)=>{
    const button=document.createElement('button');button.dataset.frame=index;
    button.setAttribute('aria-label','Frame '+(index+1)+', '+entry.durationMs+' milliseconds');
    button.setAttribute('aria-pressed',String(index===frame));
    const thumb=document.createElement('canvas');thumb.width=thumb.height=project.recipe.size;
    thumb.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgbaFrame(project,index)),project.recipe.size,project.recipe.size),0,0);
    button.append(thumb,document.createTextNode(String(index+1).padStart(2,'0')));
    button.onclick=()=>{cancelGesture();frame=index;stopAnimation();drawAll();};return button;
  }));
}
function drawAll(sync=false){
  if(disposed)return;
  drawEditor();drawPreview(frame);timeline();swatches();syncColor();
  $('size-note').textContent=project.recipe.size+' × '+project.recipe.size;
  $('pixel-count').textContent=(project.recipe.size**2)+' source pixels';
  $('frame-note').textContent='FRAME '+String(frame+1).padStart(2,'0')+' / '+String(project.frames.length).padStart(2,'0');
  $('duration').value=project.frames[frame].durationMs;
  $('undo').disabled=!undo.length;$('redo').disabled=!redo.length;
  $('duplicate').disabled=project.frames.length>=16;$('delete-frame').disabled=project.frames.length===1;
  $('move-left').disabled=frame===0;$('move-right').disabled=frame===project.frames.length-1;
  for(const id of ['pencil','erase','fill'])$(id).setAttribute('aria-pressed',String(tool===id));
  if(sync){
    $('kind').value=project.recipe.kind;$('size').value=project.recipe.size;$('frame-count').value=project.frames.length;
    $('seed').value=project.recipe.seed;$('symmetry').checked=project.recipe.symmetry;
    $('sprite-name').value=project.name;$('license').value=project.license;
  }
}
function stopAnimation(){playing=false;cancelAnimationFrame(raf);raf=0;$('animate').textContent='▶ Play animation';$('animate').setAttribute('aria-pressed','false');}
function animate(now){
  if(!playing||disposed)return;
  const index=spriteFrameAt(project,Math.max(0,Math.floor(now-started)));
  if(index!==lastPreview)drawPreview(index);raf=requestAnimationFrame(animate);
}
$('animate').onclick=()=>{
  cancelGesture();
  if(playing){stopAnimation();drawPreview(frame);return;}
  playing=true;started=performance.now();lastPreview=-1;
  $('animate').textContent='Ⅱ Pause animation';$('animate').setAttribute('aria-pressed','true');raf=requestAnimationFrame(animate);
};
for(const entry of examples){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name;$('example').append(option);}
$('load-example').onclick=action(()=>commit(exampleSprite($('example').value),'Loaded original example. Edit a pixel, duplicate a frame, then export.',{selected:0,reset:true}));
$('generate').onclick=action(()=>commit(generateSprite({
  kind:$('kind').value,size:Number($('size').value),seed:Number($('seed').value),symmetry:$('symmetry').checked,
  frameCount:Number($('frame-count').value),palette:project.recipe.palette
},{name:project.name,license:project.license}),'Generated from the validated seed and palette. Undo restores previous edits.',{selected:0,reset:true}));
for(const id of ['pencil','erase','fill'])$(id).onclick=()=>{cancelGesture();tool=id;drawAll();};
function applyAt(point){
  cursor=point;const paint=tool==='erase'?0:color;
  project=(tool==='fill'?fillSpritePixels:paintSpritePixel)(project,frame,point.x,point.y,paint);drawEditor();drawPreview(frame);
}
function pointAt(event){
  const rect=canvas.getBoundingClientRect(),x=Math.floor((event.clientX-rect.left)/rect.width*project.recipe.size),
    y=Math.floor((event.clientY-rect.top)/rect.height*project.recipe.size);
  return x>=0&&y>=0&&x<project.recipe.size&&y<project.recipe.size?{x,y}:null;
}
canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0||gesture)return;const point=pointAt(event);if(!point)return;
  event.preventDefault();stopAnimation();canvas.focus();gesture={id:event.pointerId,before:snapshot(),last:point};
  canvas.setPointerCapture(event.pointerId);applyAt(point);
});
canvas.addEventListener('pointermove',event=>{
  if(!gesture||gesture.id!==event.pointerId||tool==='fill')return;const point=pointAt(event);if(!point)return;
  // Bounded interpolation keeps fast pointer strokes contiguous in pixel space.
  let {x,y}=gesture.last;const dx=Math.abs(point.x-x),dy=-Math.abs(point.y-y),sx=x<point.x?1:-1,sy=y<point.y?1:-1;let error=dx+dy;
  for(let budget=0;budget<128;budget++){
    applyAt({x,y});if(x===point.x&&y===point.y)break;const twice=error*2;
    if(twice>=dy){error+=dy;x+=sx;}if(twice<=dx){error+=dx;y+=sy;}
  }
  gesture.last=point;
});
canvas.addEventListener('pointerup',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;
  const before=gesture.before;gesture=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  if(before.project!==serializeSpriteProject(project)){remember(before);revision++;}
  drawAll();status('Pixel edit committed. Undo is available.');
});
canvas.addEventListener('pointercancel',cancelGesture);canvas.addEventListener('lostpointercapture',cancelGesture);
canvas.addEventListener('keydown',event=>{
  const arrows={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},move=arrows[event.key];
  if(move){event.preventDefault();cursor={x:Math.max(0,Math.min(project.recipe.size-1,cursor.x+move[0])),y:Math.max(0,Math.min(project.recipe.size-1,cursor.y+move[1]))};drawEditor();}
  else if(event.key===' '&&!event.repeat){event.preventDefault();cancelGesture();const before=snapshot();applyAt(cursor);remember(before);revision++;drawAll();status('Painted column '+(cursor.x+1)+', row '+(cursor.y+1)+'.');}
  else if(event.key==='Escape'){cancelGesture();stopAnimation();drawAll();}
});
canvas.addEventListener('focus',drawEditor);canvas.addEventListener('blur',()=>{cancelGesture();drawEditor();});
$('zoom').onchange=drawEditor;$('onion').onchange=drawEditor;
$('undo').onclick=()=>{cancelGesture();if(!undo.length)return;redo.push(snapshot());const previous=undo.pop();stopAnimation();restore(previous);status('Undid edit.');};
$('redo').onclick=()=>{cancelGesture();if(!redo.length)return;undo.push(snapshot());const next=redo.pop();stopAnimation();restore(next);status('Redid edit.');};
$('duplicate').onclick=action(()=>commit(duplicateSpriteFrame(project,frame),'Duplicated frame. Draw a change to make it move.',{selected:frame+1}));
$('move-left').onclick=action(()=>commit(moveSpriteFrame(project,frame,frame-1),'Moved frame earlier.',{selected:frame-1}));
$('move-right').onclick=action(()=>commit(moveSpriteFrame(project,frame,frame+1),'Moved frame later.',{selected:frame+1}));
$('delete-frame').onclick=action(()=>commit(removeSpriteFrame(project,frame),'Deleted selected frame.'));
$('apply-duration').onclick=action(()=>commit(setSpriteDuration(project,frame,Number($('duration').value)),'Changed frame duration.'));
const hex=raw=>[1,3,5].map(i=>parseInt(raw.slice(i,i+2),16));
$('apply-color').onclick=action(()=>{
  const palette=project.recipe.palette.map(c=>[...c]);palette[color]=[...hex($('color').value),Number($('alpha').value)];
  commit(setSpritePalette(project,palette),'Updated palette; pixel indices and frame order preserved.');
});
$('apply-palette').onclick=action(()=>commit(setSpritePalette(project,palettes[$('palette-preset').value]),'Applied palette variation without changing the drawing.'));
$('apply-meta').onclick=action(()=>commit({...project,name:$('sprite-name').value,license:$('license').value},'Applied sprite name and licence.'));
function filename(extension){return (project.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'sprite')+extension;}
function download(name,bytes,type='application/json'){
  const url=URL.createObjectURL(bytes instanceof Blob?bytes:new Blob([bytes],{type})),link=document.createElement('a');
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function png(name,bytes,width,height){
  const target=document.createElement('canvas');target.width=width;target.height=height;
  const context=target.getContext('2d');if(!context)throw Error('PNG export needs Canvas 2D');
  context.putImageData(new ImageData(new Uint8ClampedArray(bytes),width,height),0,0);
  const blob=await new Promise(resolve=>target.toBlob(resolve,'image/png'));
  if(!blob)throw Error('The browser could not encode a PNG');download(name,blob,'image/png');
}
$('export-project').onclick=action(()=>{cancelGesture();download(filename('.sprite.json'),serializeSpriteProject(project));status('Saved editable sprite data, palette, frames and declared licence.');});
$('import-project').onchange=action(async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  if(file.size>SPRITE_MAX_BYTES)throw new RangeError('sprite project exceeds 256 KiB');
  const at=revision,raw=await file.text(),accepted=parseSpriteProject(raw);
  if(at!==revision)throw Error('The sprite changed while this file was loading; select the file again');
  commit(accepted,'Validated project imported. All frames and palette restored.',{selected:0,reset:true});
});
$('export-png').onclick=action(async()=>{cancelGesture();await png(filename('-frame-'+(frame+1)+'.png'),rgbaFrame(project,frame),project.recipe.size,project.recipe.size);status('Exported transparent frame PNG. Source RGBA identity is exact; PNG encoder bytes may differ by browser.');});
$('export-sheet').onclick=action(async()=>{cancelGesture();const atlas=buildSpriteAtlas(project);await png(filename('-sheet.png'),atlas.rgba,atlas.metadata.width,atlas.metadata.height);status('Exported transparent spritesheet. Export the matching atlas JSON for frame positions and masks.');});
$('export-atlas').onclick=action(()=>{cancelGesture();download(filename('-atlas.json'),JSON.stringify(buildSpriteAtlas(project).metadata));status('Exported atlas coordinates, frame timing, alpha masks and tight bounds. Masks do not create physics bodies.');});
$('export-opaque').onclick=action(async()=>{
  cancelGesture();const bytes=rgbaFrame(project,frame),background=hex($('background').value);
  for(let i=0;i<bytes.length;i+=4){const alpha=bytes[i+3];for(let c=0;c<3;c++)bytes[i+c]=Math.round((bytes[i+c]*alpha+background[c]*(255-alpha))/255);bytes[i+3]=255;}
  await png(filename('-workbench-opaque.png'),bytes,project.recipe.size,project.recipe.size);
  status('Exported an explicitly flattened opaque frame. Import PNG in Asset Foundry; choose the matching licence there.');
});
function suspend(){cancelGesture();stopAnimation();drawAll();}
window.addEventListener('blur',suspend);
document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});
window.addEventListener('pagehide',event=>{suspend();if(!event.persisted)disposed=true;});
window.addEventListener('pageshow',event=>{if(event.persisted&&!disposed){drawAll();status('Restored workshop. Animation remains paused.');}});
globalThis.__spriteFoundry=Object.freeze({
  snapshot:()=>({project:serializeSpriteProject(project),frame,color,tool,revision,playing,previewFrame:lastPreview,undo:undo.length,redo:redo.length,gesture:!!gesture}),
  refresh:()=>drawAll(true)
});
drawAll(true);status('Relay Cadet is ready. Draw a pixel, duplicate a frame, and make it yours.');
document.documentElement.dataset.labReady='sprite-foundry';
