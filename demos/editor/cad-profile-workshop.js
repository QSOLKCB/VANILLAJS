// SPDX-License-Identifier: Apache-2.0
// CAD-002 DOM-owned radial profile workshop. No executable project inputs,
// renderer replacement, remote dependencies or direct scene mutation.
import {cadProfilePreset,cadProfileDraft,cadProfileMesh,cadProfileMove,
  cadProfileInsert,cadProfileRemove,cadProfileSegments,cadProfileRecover,
  cadProfileScreen,cadProfileUnproject,CAD_LIMITS} from '../../modules/cad-geometry/index.js';

const $=(root,id)=>root.querySelector('#'+id);
const controlsIds=['cad-profile-preset','cad-profile-load','cad-profile-add','cad-profile-remove',
  'cad-profile-commit','cad-profile-snap','cad-profile-zoom','cad-profile-pan',
  'cad-profile-facets'];
export function mountCADProfileWorkshop(root,{readAsset,isPlaying,onCommit}){
  if(!root||typeof readAsset!=='function'||typeof isPlaying!=='function'||
    typeof onCommit!=='function')throw TypeError('CAD workshop requires real editor adapters');
  const canvas=$(root,'cad-profile-canvas'),ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Canvas2D is required for CAD profile dimensions');
  let draft=cadProfilePreset({kind:'urn',radius:.8,height:2,segments:16}),
    selected=2,busy=false,drag=null,version=0,
    message='Drag a gold ring handle or edit its radius and elevation.';
  const entries=$(root,'cad-profile-points');
  function setError(error){message=error.message??String(error);render();}
  const step=()=>Number($(root,'cad-profile-snap').value);
  const viewport=()=>cadProfileScreen(draft,{
    width:canvas.width,height:canvas.height,
    zoom:Number($(root,'cad-profile-zoom').value),
    panX:Number($(root,'cad-profile-pan').value),panY:0
  });
  function draw(){
    const {width:w,height:h,handles,scale,centerX,centerY}=viewport();
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#102630';ctx.fillRect(0,0,w,h);
    // Render-only grid: never quantises or modifies an authored mesh.
    ctx.strokeStyle='#294451';ctx.lineWidth=1;
    for(let x=-5;x<=5;x+=.5){
      const px=centerX+x*scale;if(px<0||px>w)continue;
      ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,h);ctx.stroke();
    }
    for(let y=-10;y<=10;y+=.5){
      const py=centerY-y*scale;if(py<0||py>h)continue;
      ctx.beginPath();ctx.moveTo(0,py);ctx.lineTo(w,py);ctx.stroke();
    }
    ctx.strokeStyle='#8bc7c0';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(centerX,0);ctx.lineTo(centerX,h);ctx.stroke();
    // Original outline is mirrored only for preview; the engine uses one
    // positive-radius profile revolved about Y.
    ctx.beginPath();
    handles.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    for(let i=handles.length-1;i>=0;i--)ctx.lineTo(2*centerX-handles[i].x,handles[i].y);
    ctx.closePath();ctx.fillStyle='rgba(91,185,176,.22)';ctx.fill();
    ctx.strokeStyle='#9fe6c7';ctx.lineWidth=2;ctx.stroke();
    handles.forEach((p,i)=>{
      ctx.beginPath();ctx.arc(p.x,p.y,i===selected?8:6,0,Math.PI*2);
      ctx.fillStyle=i===selected?'#ffdb9c':'#8adac9';ctx.fill();
      ctx.strokeStyle='#172a31';ctx.lineWidth=2;ctx.stroke();
      ctx.fillStyle='#e2f1e9';ctx.font='12px ui-monospace,monospace';
      ctx.fillText(String(i+1),p.x+10,p.y-8);
    });
    ctx.fillStyle='#b7d6d0';ctx.font='11px ui-monospace,monospace';
    ctx.fillText('RADIUS →',w-85,h-14);
    ctx.fillText('Y ↑',8,15);
  }
  function makeRows(){
    entries.replaceChildren();
    draft.profile.forEach(([r,y],i)=>{
      const row=document.createElement('button');row.type='button';
      row.className='cad-profile-ring';row.dataset.index=String(i);
      row.setAttribute('aria-pressed',String(i===selected));
      row.textContent='Ring '+(i+1)+' · R '+r.toFixed(3)+' m · Y '+y.toFixed(3)+' m';
      row.addEventListener('click',()=>{selected=i;render();});
      entries.append(row);
    });
  }
  function render(){
    if(selected>=draft.profile.length)selected=draft.profile.length-1;
    const current=draft.profile[selected],height=draft.profile.at(-1)[1]-draft.profile[0][1];
    $(root,'cad-profile-radius').value=String(current[0]);
    $(root,'cad-profile-y').value=String(current[1]);
    $(root,'cad-profile-facets').value=String(draft.segments);
    $(root,'cad-profile-summary').textContent=draft.profile.length+' rings · '+
      height.toFixed(3)+' m total · '+draft.triangles+' triangles';
    $(root,'cad-profile-status').textContent=message;
    makeRows();draw();
    for(const id of controlsIds)$(root,id).disabled=busy||isPlaying();
    $(root,'cad-profile-radius').disabled=busy||isPlaying();
    $(root,'cad-profile-y').disabled=busy||isPlaying();
    $(root,'cad-profile-remove').disabled||=draft.profile.length<=2;
    $(root,'cad-profile-add').disabled||=draft.profile.length>=CAD_LIMITS.profiles||
      selected===draft.profile.length-1;
    canvas.style.pointerEvents=busy||isPlaying()?'none':'auto';
  }
  function change(next,note){
    draft=next;version++;message=note;render();
  }
  $(root,'cad-profile-preset').addEventListener('click',()=>{
    try{
      const kind=document.getElementById('cad-kind').value,
        radius=Number(document.getElementById('cad-radius').value),
        height=Number(document.getElementById('cad-height').value),
        segments=Number(document.getElementById('cad-segments').value);
      const next=cadProfilePreset({kind,radius,height,segments});
      selected=Math.floor(next.profile.length/2);change(next,'Editable '+kind+' profile loaded.');
    }catch(error){setError(error);}
  });
  $(root,'cad-profile-load').addEventListener('click',()=>{
    try{
      const asset=readAsset(),next=cadProfileRecover(asset);
      selected=Math.floor(next.profile.length/2);
      change(next,'Recovered rings from selected CAD mesh asset.');
    }catch(error){setError(error);}
  });
  $(root,'cad-profile-add').addEventListener('click',()=>{
    try{const next=cadProfileInsert(draft,{after:selected});
      selected++;change(next,'Inserted one editable radial ring.');}
    catch(error){setError(error);}
  });
  $(root,'cad-profile-remove').addEventListener('click',()=>{
    try{const next=cadProfileRemove(draft,{index:selected});
      selected=Math.min(selected,next.profile.length-1);
      change(next,'Removed selected radial ring.');}
    catch(error){setError(error);}
  });
  function dimensionChange(){
    try{
      const next=cadProfileMove(draft,{index:selected,
        radius:Number($(root,'cad-profile-radius').value),
        y:Number($(root,'cad-profile-y').value),snap:step()});
      change(next,'Updated snapped dimensions without changing scene state.');
    }catch(error){setError(error);}
  }
  $(root,'cad-profile-radius').addEventListener('change',dimensionChange);
  $(root,'cad-profile-y').addEventListener('change',dimensionChange);
  $(root,'cad-profile-facets').addEventListener('change',()=>{
    try{change(cadProfileSegments(draft,Number($(root,'cad-profile-facets').value)),
      'Updated tessellation; no scene mutation.');}catch(error){setError(error);}
  });
  for(const id of ['cad-profile-zoom','cad-profile-pan'])
    $(root,id).addEventListener('change',render);
  const point=(event)=>{
    const bounds=canvas.getBoundingClientRect();
    return {x:(event.clientX-bounds.left)*canvas.width/bounds.width,
      y:(event.clientY-bounds.top)*canvas.height/bounds.height};
  };
  canvas.addEventListener('pointerdown',event=>{
    if(busy||isPlaying()||event.button!==0)return;
    const pos=point(event),handles=viewport().handles;
    let nearest=-1,distance=225;
    for(let i=0;i<handles.length;i++){
      const d=(pos.x-handles[i].x)**2+(pos.y-handles[i].y)**2;
      if(d<distance){nearest=i;distance=d;}
    }
    if(nearest===-1)return;
    drag={pointer:event.pointerId,index:nearest};
    selected=nearest;canvas.setPointerCapture(event.pointerId);
    event.preventDefault();render();
  });
  canvas.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointer||busy||isPlaying())return;
    const world=cadProfileUnproject(viewport(),point(event));
    try{
      const radius=Math.min(CAD_LIMITS.radius,Math.max(0,world.radius)),
        y=Math.min(CAD_LIMITS.height,Math.max(-CAD_LIMITS.height,world.y));
      const next=cadProfileMove(draft,{index:drag.index,radius,y,snap:step()});
      change(next,'Ring '+(selected+1)+' snapped to R '+
        next.profile[selected][0]+' / Y '+next.profile[selected][1]+' m');
    }catch{/* Crossing another ring or invalid geometry is rejected atomically. */}
  });
  const cancel=()=>{drag=null;};
  canvas.addEventListener('pointerup',cancel);
  canvas.addEventListener('pointercancel',cancel);
  canvas.addEventListener('lostpointercapture',cancel);
  $(root,'cad-profile-commit').addEventListener('click',async()=>{
    if(busy||isPlaying())return;
    const candidate=draft,ticket=++version;busy=true;render();
    try{
      const model=cadProfileMesh(candidate);
      const outcome=await onCommit({model,draft:candidate,
        name:'CAD Profile',sourceName:'cad-profile.obj',ticket});
      if(ticket!==version)return;
      message=outcome?.accepted===false?'Profile commit cancelled (scene changed).':
        'Saved new CAD profile variant · '+model.triangleCount+' triangles.';
    }catch(error){message='CAD profile rejected: '+error.message;}
    finally{busy=false;render();}
  });
  render();
  return Object.freeze({sync:render,snapshot:()=>Object.freeze({
    profile:draft.profile.map(p=>[...p]),segments:draft.segments,triangles:draft.triangles,
    busy,selected,version,message
  })});
}
