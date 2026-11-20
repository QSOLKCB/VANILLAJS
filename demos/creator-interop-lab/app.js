// SPDX-License-Identifier: Apache-2.0
// Original offline world editor: authority comes from the imported modules, not canvas.
import {createSceneGraph} from '../../modules/scene-graph/index.js';
import {querySight} from '../../modules/sensing/index.js';
import {CREATOR_FORMAT,createCreatorProject,creatorCADAsset,createCreatorSightWorld,createCreatorTacticsWorld,
 sealCreatorPackage,creatorPackageJSON,openCreatorPackage} from '../../modules/creator-interop/index.js';
const $=id=>document.getElementById(id),ctx=$('field').getContext('2d');
const asset={id:'mesh-1',dimension:'2d',vertices:[[0,0,0],[1,0,0],[0,1,0]],
 triangles:[[0,1,2]],origin:'original',license:'Apache-2.0',sourceRef:'original:qsol'};
function initial(){return createCreatorProject({format:CREATOR_FORMAT,version:1,name:'World Foundry',
 scene:createSceneGraph('World Foundry'),assets:[asset],
 placements:[{id:'prop-1',kind:'prop',assetId:'mesh-1',position:[9,1,-9]},
 {id:'target-1',kind:'target',assetId:null,position:[19,1,-9]}],
 zones:[{id:'wall-1',kind:'occluder',min:[10,0,-12],max:[12,3,-10]}],
 tactical:{width:12,height:10,cellMetres:2,cover:[{id:'cover-1',x:5,z:5,w:1,h:1,height:3}],
 units:[{id:'alpha-1',team:'alpha',cell:[1,1],heading:[1,0]},
 {id:'bravo-1',team:'bravo',cell:[9,8],heading:[-1,0]}],
 objective:[10,5],seed:7}});}
let project=initial(),tool='prop',message='Select a tool and edit the grid. All state changes validate first.';
const left=120,top=60,cell=40,coord=(x,z)=>[(x+.5)*2,1,-(z+.5)*2];
function render(){
 ctx.clearRect(0,0,720,540);ctx.fillStyle='#102b3b';ctx.fillRect(left,top,480,400);
 for(let z=0;z<10;z++)for(let x=0;x<12;x++){
  ctx.strokeStyle='#294b59';ctx.strokeRect(left+x*cell,top+z*cell,cell,cell);
 }
 const place=(p,color,label)=>{const x=left+p[0]/2*cell,z=top+(-p[2])/2*cell;
  ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,z,12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#05212b';
  ctx.font='bold 12px system-ui';ctx.fillText(label,x-9,z+4);};
 for(const z of project.zones){ctx.fillStyle=z.kind==='occluder'?'#997b55':'#357b78';
  const x=left+z.min[0]/2*cell,y=top+(-z.max[2])/2*cell;
  ctx.fillRect(x,y,(z.max[0]-z.min[0])/2*cell,(z.max[2]-z.min[2])/2*cell);}
 for(const p of project.placements)place(p.position,
  p.kind==='target'?'#f9bd73':p.kind==='vehicle'?'#a5caff':'#8edbb2',
  p.kind==='target'?'T':p.kind==='vehicle'?'V':p.assetId?.startsWith('cad-')?'C':'P');
 for(const u of project.tactical.units)place(coord(...u.cell),u.team==='alpha'?'#83e5ff':'#ef8c9c',u.team==='alpha'?'A':'B');
 const targets=project.placements.filter(p=>p.kind==='target').length;
 const reports=querySight(createCreatorSightWorld(project),
  {position:[3,1,-3],direction:[1,0,-1]},{range:100,fov:Math.PI*2});
 const block=reports.filter(r=>r.reason==='occluded').length;
 const tactics=createCreatorTacticsWorld(project);
 $('receipt').textContent=JSON.stringify({message,tool,assets:project.assets.length,
  placements:project.placements.length,zones:project.zones.length,
  targets,occluded:block,tacticalUnits:tactics.unitCount,cover:tactics.coverCount,
  objective:tactics.objective,perception:reports.map(r=>({id:r.id,reason:r.reason,occluderId:r.occluderId}))},null,2);
}
function nextId(prefix,used){
 let i=1;while(used.has(prefix+'-'+i))i++;return prefix+'-'+i;
}
function edit(x,z){
 const draft=structuredClone(project),used=new Set([
 ...draft.assets.map(a=>a.id),...draft.placements.map(a=>a.id),...draft.zones.map(a=>a.id),
 ...draft.tactical.cover.map(a=>a.id),...draft.tactical.units.map(a=>a.id)]);
 const position=coord(x,z);
 if(tool==='wall'){
  draft.zones.push({id:nextId('wall',used),kind:'occluder',
   min:[x*2,0,-(z+1)*2],max:[(x+1)*2,3,-z*2]});
  draft.tactical.cover.push({id:nextId('cover',used),x,z,w:1,h:1,height:3});
 }else if(tool==='cad'){
  const assetId=nextId('cad',used);
  draft.assets.push(creatorCADAsset({id:assetId,kind:'tower',
   options:{width:2,depth:2,height:3,bevel:.1}}));
  used.add(assetId);
  draft.placements.push({id:nextId('prop',used),kind:'prop',assetId,position});
 }else if(tool==='alpha'||tool==='bravo'){
  draft.tactical.units.push({id:nextId(tool,used),team:tool,cell:[x,z],
   heading:tool==='alpha'?[1,0]:[-1,0]});
 }else draft.placements.push({id:nextId(tool,used),kind:tool,
  assetId:tool==='prop'?'mesh-1':null,position});
 try{const proposed=createCreatorProject(draft);project=proposed;
  message='Accepted '+tool+' at '+x+','+z+'.';}
 catch(e){message='Rejected without mutation: '+e.message;}
 render();
}
$('field').addEventListener('click',e=>{
 const box=$('field').getBoundingClientRect(),px=(e.clientX-box.left)*720/box.width,py=(e.clientY-box.top)*540/box.height;
 const x=Math.floor((px-left)/cell),z=Math.floor((py-top)/cell);
 if(x>=0&&x<12&&z>=0&&z<10)edit(x,z);
});
for(const button of document.querySelectorAll('[data-tool]'))button.addEventListener('click',()=>{
 tool=button.dataset.tool;for(const b of document.querySelectorAll('[data-tool]'))
 b.setAttribute('aria-pressed',String(b===button));render();
});
$('export').addEventListener('click',async()=>{
 try{const sealed=await sealCreatorPackage(project),json=creatorPackageJSON(sealed);
  const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
  const link=document.createElement('a');link.download='world-foundry-v1.json';link.href=url;
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
  message='Exported SHA-256 '+sealed.sha256+'.';}
 catch(e){message='Export failed: '+e.message;}render();
});
$('import').addEventListener('change',async e=>{
 try{const file=e.target.files?.[0];if(!file)return;
  if(file.size>262144)throw RangeError('file exceeds 256 KiB');
  const imported=await openCreatorPackage(await file.text());
  // Only replace after the entire import, source receipts and tactical rules validate.
  project=imported;message='Imported verified inert world. No code executed.';}
 catch(error){message='Import rejected without mutation: '+error.message;}
 e.target.value='';render();
});
$('reset').addEventListener('click',()=>{project=initial();message='Workshop reset.';render();});
render();
