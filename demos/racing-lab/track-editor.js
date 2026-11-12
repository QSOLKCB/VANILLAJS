// SPDX-License-Identifier: Apache-2.0
// RACING-002B — browser-owned editor for validated, inert local track packs.
import {ENVIRONMENTS,SECTION_LENGTH,SPRINT_LENGTH,environmentTheme,
  parseTrackJSON,serializeTrack,starterTrack,trackCenter,trackHalfWidth,validateTrack} from './track.js';

const $=id=>document.getElementById(id),distance=SECTION_LENGTH*4;
const trackModes=new Set(['tour','sprint','circuit']);
const colors={coast:'#62ddcd',canyon:'#f9a66b',forest:'#8fd49c',night:'#b29af4'};
const fresh=()=>JSON.parse(JSON.stringify(starterTrack()));

export function setupTrackFoundry({apply,clear}){
  if(typeof apply!=='function'||typeof clear!=='function')
    throw new TypeError('Track Foundry requires apply and clear callbacks');
  let draft=fresh(),dragGate=-1,generation=0;
  const canvas=$('track-preview'),ctx=canvas.getContext('2d');
  const title=$('track-name'),environment=$('track-environment'),
    target=$('track-target'),message=$('track-message'),
    sections=$('track-sections'),gates=$('track-gates'),picker=$('track-import');
  const note=(text,invalid=false)=>{
    message.textContent=text;
    message.dataset.invalid=String(invalid);
  };
  const validOrMessage=()=>{
    try{return validateTrack(draft);}
    catch(error){note(error.message,true);return null;}
  };
  function updateFields(){
    title.value=draft.name;environment.value=draft.environment;
    sections.replaceChildren();
    draft.sections.forEach((section,index)=>{
      const row=document.createElement('div');row.className='track-row';
      const label=document.createElement('strong');
      label.textContent='STAGE '+(index+1);
      row.append(label);
      for(const [property,min,max,step] of
        [['curve',-1,1,.05],['width',8,16,.5],['fork',6,14,.5]]){
        const wrap=document.createElement('label'),input=document.createElement('input');
        wrap.textContent=property.toUpperCase()+' ';
        Object.assign(input,{type:'number',min:String(min),max:String(max),step:String(step),
          value:String(section[property])});
        input.dataset.section=String(index);input.dataset.property=property;
        wrap.append(input);row.append(wrap);
      }
      sections.append(row);
    });
    gates.replaceChildren();
    draft.gates.forEach((gate,index)=>{
      const row=document.createElement('label');row.className='gate-row';
      row.textContent='G'+(index+1);
      for(const property of ['x','z']){
        const input=document.createElement('input');
        Object.assign(input,{type:'number',min:'-70',max:'70',step:'1',value:String(gate[property])});
        input.setAttribute('aria-label','Gate '+(index+1)+' '+property.toUpperCase());
        input.dataset.gate=String(index);input.dataset.property=property;
        row.append(input);
      }
      gates.append(row);
    });
    draw();
  }
  function mutate(change){
    change();
    const accepted=validOrMessage();
    if(accepted){draft=JSON.parse(JSON.stringify(accepted));note('Draft valid · '+draft.name);}
    draw();
  }
  function background(){
    if(!ctx)return;
    const {width:w,height:h}=canvas;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#081827';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#2b4755';ctx.lineWidth=1;
    for(let y=30;y<h;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    for(let x=40;x<w;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    ctx.fillStyle='#9ebecd';ctx.font='12px monospace';
    ctx.fillText('TRACK FOUNDRY · '+draft.environment.toUpperCase(),16,22);
  }
  function road(){
    if(!ctx)return;
    const height=canvas.height,width=canvas.width;
    const x=s=>24+s/distance*(width-48),y=v=>height/2-v*1.5;
    const paths=target.value==='tour'?
      Array.from({length:8},(_,bits)=>[0,1,2].map(i=>(bits>>i)&1?'right':'left')):[[]];
    for(const [index,route] of paths.entries()){
      const primary=target.value!=='tour'||index===0;
      for(const side of [-1,1]){
        ctx.strokeStyle=primary?(side<0?'#ffb96f':'#5dedcf'):'#496779';
        ctx.lineWidth=primary?2.5:1;
        ctx.beginPath();
        for(let s=0;s<=distance;s+=12){
          const center=trackCenter(draft,s,route),half=trackHalfWidth(draft,s);
          if(s===0)ctx.moveTo(x(s),y(center+side*half));
          else ctx.lineTo(x(s),y(center+side*half));
        }
        ctx.stroke();
      }
      ctx.strokeStyle=primary?'#e5f7ee':'#6c8290';ctx.lineWidth=primary?2.2:1;
      ctx.beginPath();
      for(let s=0;s<=distance;s+=12){
        const cx=x(s),cy=y(trackCenter(draft,s,route));
        if(s===0)ctx.moveTo(cx,cy);else ctx.lineTo(cx,cy);
      }
      ctx.stroke();
    }
    for(let i=1;i<4;i++){
      const sx=x(i*SECTION_LENGTH);
      ctx.strokeStyle='#ffdd97';ctx.setLineDash([3,4]);
      ctx.beginPath();ctx.moveTo(sx,40);ctx.lineTo(sx,height-15);ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle='#ffdd97';ctx.fillText('FORK '+i,sx-24,height-13);
    }
    ctx.fillStyle=colors[draft.environment];
    ctx.fillText(target.value==='sprint'?'3D SPRINT ROAD · 4,800 m authored preview':
      'PSEUDO-3D TOUR · 8 PHYSICALLY DISTINCT BRANCH HISTORIES',16,height-37);
  }
  const gateX=x=>canvas.width/2+x*2.3,gateY=z=>canvas.height/2+z*1.7;
  function drawGates(){
    if(!ctx)return;
    ctx.fillStyle='#14212f';ctx.fillRect(0,0,canvas.width,canvas.height);
    background();
    ctx.fillStyle=colors[draft.environment];ctx.font='12px monospace';
    ctx.fillText('DRAG GATES TO RE-SHAPE THE CIRCUIT',16,canvas.height-14);
    ctx.strokeStyle='#61d4cb';ctx.lineWidth=18;ctx.lineJoin='round';
    ctx.beginPath();
    draft.gates.forEach((g,i)=>{
      if(i===0)ctx.moveTo(gateX(g.x),gateY(g.z));
      else ctx.lineTo(gateX(g.x),gateY(g.z));
    });
    ctx.closePath();ctx.stroke();
    ctx.strokeStyle='#e9f5f5';ctx.lineWidth=2;ctx.stroke();
    draft.gates.forEach((g,i)=>{
      ctx.beginPath();ctx.arc(gateX(g.x),gateY(g.z),8,0,Math.PI*2);
      ctx.fillStyle=i===dragGate?'#ffd180':'#53dcc8';ctx.fill();
      ctx.fillStyle='#0b1a25';ctx.font='bold 10px monospace';
      ctx.fillText(String(i+1),gateX(g.x)-3,gateY(g.z)+3);
    });
  }
  function draw(){
    if(!ctx)return;
    background();if(target.value==='circuit')drawGates();else road();
    gates.hidden=target.value!=='circuit';
  }
  title.addEventListener('input',()=>mutate(()=>{draft.name=title.value;}));
  environment.addEventListener('change',()=>mutate(()=>{draft.environment=environment.value;}));
  target.addEventListener('change',draw);
  sections.addEventListener('change',event=>{
    const input=event.target;
    if(!(input instanceof HTMLInputElement))return;
    const i=Number(input.dataset.section),key=input.dataset.property;
    if(!['curve','width','fork'].includes(key)||!Number.isInteger(i)||i<0||i>=4)return;
    mutate(()=>{draft.sections[i][key]=input.valueAsNumber;});
  });
  gates.addEventListener('change',event=>{
    const input=event.target;
    if(!(input instanceof HTMLInputElement))return;
    const i=Number(input.dataset.gate),key=input.dataset.property;
    if(!['x','z'].includes(key)||!Number.isInteger(i)||i<0||i>=8)return;
    mutate(()=>{draft.gates[i][key]=input.valueAsNumber;});
  });
  const position=event=>{
    const b=canvas.getBoundingClientRect();
    return {x:(event.clientX-b.left)*canvas.width/b.width,
      y:(event.clientY-b.top)*canvas.height/b.height};
  };
  canvas.addEventListener('pointerdown',event=>{
    if(target.value!=='circuit')return;
    const pos=position(event);
    const i=draft.gates.findIndex(g=>Math.hypot(pos.x-gateX(g.x),pos.y-gateY(g.z))<15);
    if(i<0)return;
    dragGate=i;canvas.setPointerCapture(event.pointerId);draw();
  });
  canvas.addEventListener('pointermove',event=>{
    if(dragGate<0)return;
    const pos=position(event);
    draft.gates[dragGate].x=Math.round(Math.max(-70,Math.min(70,(pos.x-canvas.width/2)/2.3)));
    draft.gates[dragGate].z=Math.round(Math.max(-70,Math.min(70,(pos.y-canvas.height/2)/1.7)));
    draw();
  });
  const endDrag=()=>{
    if(dragGate<0)return;
    dragGate=-1;updateFields();
    if(validOrMessage())note('Gate placement valid');
  };
  canvas.addEventListener('pointerup',endDrag);
  canvas.addEventListener('pointercancel',endDrag);
  canvas.addEventListener('lostpointercapture',endDrag);
  $('track-new').addEventListener('click',()=>{generation++;draft=fresh();updateFields();note('Reset to the original editable track');});
  $('track-apply').addEventListener('click',()=>{
    const valid=validOrMessage();if(!valid)return;
    if(!trackModes.has(target.value)){note('Select a supported racing mode',true);return;}
    apply(target.value,valid);
    note('Applied '+valid.name+' to '+target.value+' · new race created');
  });
  $('track-clear').addEventListener('click',()=>{
    clear();note('Using original built-in tracks again');
  });
  $('track-export').addEventListener('click',()=>{
    const valid=validOrMessage();if(!valid)return;
    const url=URL.createObjectURL(new Blob([serializeTrack(valid)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='vanillajs-track-v1.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    note('Exported validated inert-data track pack');
  });
  picker.addEventListener('change',async()=>{
    const file=picker.files?.[0],epoch=++generation;
    if(!file)return;
    try{
      if(file.size>16*1024)throw new RangeError('track file exceeds 16 KiB');
      const candidate=parseTrackJSON(await file.text());
      if(epoch!==generation)return; // Late reads never overwrite a newer draft.
      draft=JSON.parse(JSON.stringify(candidate));updateFields();
      note('Imported '+draft.name+' · review before applying');
    }catch(error){if(epoch===generation)note('Import rejected: '+error.message,true);}
    finally{picker.value='';}
  });
  updateFields();
  note('Track Foundry ready · edit, validate, then apply or export');
}
