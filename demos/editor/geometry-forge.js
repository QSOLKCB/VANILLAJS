// SPDX-License-Identifier: Apache-2.0
// CAD-003 Geometry Forge workshop. Native Canvas2D/DOM adapter; no runtime
// dependencies, network, evaluation, physics changes or source import.
import {createForgeExtrusion,forgePresetFootprint,inspectForgeTriangles,
  forgeVolumeReference,cadMeshOBJ} from '../../modules/cad-geometry/index.js';

const byId=(root,id)=>root.querySelector('#'+id);
const DECIMAL=/^-?(?:\d{1,2})(?:\.\d{1,8})?$/;
export function parseForgeFootprint(text){
  if(typeof text!=='string'||text.length>384)throw TypeError('bounded footprint text required');
  const rows=text.split(';').map(x=>x.trim());
  if(rows.length<3||rows.length>12||rows.some(x=>!x))
    throw RangeError('footprint requires 3–12 rows separated by semicolons');
  return rows.map(row=>{
    const cells=row.split(',').map(x=>x.trim());
    if(cells.length!==2||!cells.every(x=>DECIMAL.test(x)))
      throw TypeError('enter x,z numeric pairs only; no scripting');
    return cells.map(Number);
  });
}
export function mountGeometryForge(root,{readAsset,isPlaying,onCommit}){
  if(!root||typeof readAsset!=='function'||typeof isPlaying!=='function'||
      typeof onCommit!=='function')throw TypeError('Geometry Forge requires editor adapters');
  const canvas=byId(root,'forge-footprint-canvas'),ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Canvas2D required for the geometry workplane');
  let candidate=null,busy=false,version=0,report=null;
  const $=id=>byId(root,id);
  const options=()=>{
    const kind=$('forge-kind').value,width=Number($('forge-width').value),
      depth=Number($('forge-depth').value),height=Number($('forge-height').value),
      bevel=Number($('forge-bevel').value);
    if($('forge-custom').checked){
      return {footprint:parseForgeFootprint($('forge-outline').value),height,bevel};
    }
    return forgePresetFootprint({kind,width,depth,height,bevel});
  };
  function draw(options,diagnostic){
    const w=canvas.width,h=canvas.height;
    ctx.fillStyle='#0d2530';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#294a56';ctx.lineWidth=1;
    for(let i=0;i<=10;i++){
      const p=i*w/10;ctx.beginPath();ctx.moveTo(p,0);ctx.lineTo(p,h);ctx.stroke();
      const q=i*h/10;ctx.beginPath();ctx.moveTo(0,q);ctx.lineTo(w,q);ctx.stroke();
    }
    ctx.strokeStyle='#82aeb4';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();
    const pts=options.footprint.map(([x,z])=>[w/2+x*24,h/2+z*24]);
    ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.closePath();ctx.fillStyle='rgba(136,231,182,.25)';ctx.fill();
    ctx.strokeStyle='#a0efc8';ctx.lineWidth=3;ctx.stroke();
    pts.forEach(([x,y],i)=>{
      ctx.beginPath();ctx.arc(x,y,5,0,2*Math.PI);ctx.fillStyle='#ffe0a5';ctx.fill();
      ctx.fillStyle='#dcefeb';ctx.font='12px ui-monospace,monospace';ctx.fillText(String(i+1),x+8,y-7);
    });
    ctx.fillStyle='#b4d8d1';ctx.font='11px ui-monospace,monospace';
    ctx.fillText('X →',w-39,h-9);ctx.fillText('+Z ↓',7,h-9);
    if(options.bevel>0){
      ctx.fillStyle='#ffe0a5';ctx.fillText('BEVEL '+options.bevel.toFixed(2)+' m',9,17);
    }
    ctx.fillStyle='#cce2dc';ctx.fillText(diagnostic.triangles+' TRIANGLES',w-115,17);
  }
  function output(label,kind=''){
    $('forge-status').textContent=label;
    $('forge-status').dataset.status=kind;
  }
  function preview(){
    if(busy)return;
    try{
      const opts=options(),mesh=createForgeExtrusion(opts),
        diag=inspectForgeTriangles(mesh),reference=forgeVolumeReference(opts);
      if(!diag.closed||diag.euler!==2||
          Math.abs(diag.volume-reference)>Math.max(1e-8,reference*1e-8))
        throw Error('Geometry verification refused to certify this extrusion');
      candidate={opts,mesh,diag,reference};
      draw(opts,diag);
      $('forge-diagnostics').textContent='CLOSED · '+diag.triangles+
        ' faces · volume '+diag.volume.toFixed(4)+' m³ · '+diag.boundaryEdges+
        ' open edges · Euler '+diag.euler+' · 0 topology errors';
      output('Preview verified. Generate to add a new independent mesh asset.','ready');
    }catch(error){
      candidate=null;
      $('forge-diagnostics').textContent='Geometry invalid; no scene changes committed.';
      output('Forge rejected: '+error.message,'error');
    }
  }
  for(const id of ['forge-kind','forge-width','forge-depth','forge-height','forge-bevel',
    'forge-custom','forge-outline']){
    $(id).addEventListener(id==='forge-outline'?'input':'change',()=>{version++;preview();});
  }
  $('forge-inspect').addEventListener('click',()=>{
    try{
      const asset=readAsset();
      if(asset?.kind!=='mesh')throw TypeError('select a mesh asset or scene object');
      const diag=inspectForgeTriangles(asset.vertices);
      $('forge-inspection').textContent='Selected '+asset.name+': '+
        (diag.closed?'CLOSED':'OPEN/INVALID')+' · volume '+diag.volume.toFixed(4)+
        ' m³ · area '+diag.area.toFixed(4)+' m² · triangles '+diag.triangles+
        ' · boundaries '+diag.boundaryEdges+' · winding errors '+
        diag.orientationErrors+' · nonmanifold '+diag.nonManifoldEdges+
        ' · degenerate '+diag.degenerate+' · Euler '+diag.euler;
    }catch(error){$('forge-inspection').textContent='Inspect rejected: '+error.message;}
  });
  $('forge-commit').addEventListener('click',async()=>{
    if(busy||isPlaying())return;
    const ticket=++version;
    try{
      const opts=options(),mesh=createForgeExtrusion(opts),
        diag=inspectForgeTriangles(mesh),reference=forgeVolumeReference(opts);
      if(!diag.closed||diag.euler!==2||
          Math.abs(diag.volume-reference)>Math.max(1e-8,reference*1e-8))
        throw Error('Unverified extrusion cannot enter Asset Foundry');
      busy=true;sync();
      const accepted=await onCommit({
        model:mesh,height:opts.height,name:'Forge '+($('forge-custom').checked?'Custom':$('forge-kind').value),
        sourceName:'cad-forge.obj',request:ticket,
        expectedVolume:reference,diagnostic:diag
      });
      if(ticket===version)output(accepted?.accepted===false?'Forge cancelled: source scene changed':
        'Geometry Forge: saved '+diag.triangles+'-triangle mesh as new asset.',
        accepted?.accepted===false?'error':'ready');
    }catch(error){if(ticket===version)output('Forge rejected: '+error.message,'error');}
    finally{busy=false;sync();}
  });
  function sync(){
    for(const input of root.querySelectorAll('input,textarea,select,button'))
      input.disabled=busy||isPlaying();
    $('forge-outline').hidden=!$('forge-custom').checked;
    $('forge-outline-label').hidden=!$('forge-custom').checked;
    canvas.style.opacity=busy||isPlaying()?'.55':'1';
  }
  sync();preview();
  return Object.freeze({sync,snapshot:()=>Object.freeze({
    valid:!!candidate,busy,version,
    triangles:candidate?.diag.triangles??null,
    volume:candidate?.diag.volume??null,
    closed:candidate?.diag.closed??false
  })});
}
