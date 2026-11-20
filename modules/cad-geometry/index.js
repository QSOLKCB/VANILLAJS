// SPDX-License-Identifier: Apache-2.0
// CAD-001: small, native-JS parametric surfaces for editor and renderer.
// Adapted from the surface-of-revolution concept and triangulation of
// DabbleCAD src/renderer/core/shapes.js (DabbleCAD — Copyright 2026 DJMcNewgent;
// Apache License, Version 2.0; original NOTICE preserved in docs/DABBLECAD_NOTICE.md)
// @ 9cfd20b0a973275c7f7411afb6e7c355f8a863cc.
// Coordinates deliberately changed from DabbleCAD Z-up millimetres to
// VANILLAJS +Y-up metres. No THREE/Manifold/WASM or donor assets imported.
export const CAD_LIMITS=Object.freeze({profiles:8,segments:24,vertices:1536,radius:5,height:10});
const owned=new WeakSet();
function plain(v,keys,name){
  if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v)))
    throw TypeError(name+' must be a plain record');
  const all=Object.getOwnPropertyDescriptors(v);
  if(Reflect.ownKeys(all).some(k=>typeof k!=='string'||!keys.includes(k)||
      !Object.hasOwn(all[k],'value')||!all[k].enumerable))throw TypeError(name+' invalid field');
}
function finite(v,lo,hi,name){
  if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw RangeError(name+' invalid finite range');
  return v;
}
function dense(a,min,max,name){
  if(!Array.isArray(a)||Object.getPrototypeOf(a)!==Array.prototype||a.length<min||
    a.length>max||Reflect.ownKeys(a).length!==a.length+1)
    throw TypeError(name+' needs a bounded dense plain array');
  const descriptors=Object.getOwnPropertyDescriptors(a);
  return Array.from({length:a.length},(_,i)=>{
    if(!descriptors[i]||!descriptors[i].enumerable||!Object.hasOwn(descriptors[i],'value'))
      throw TypeError(name+' accessor or hole');
    return descriptors[i].value;
  });
}
function pair(value){
  const [r,y]=dense(value,2,2,'profile point');
  return Object.freeze([finite(r,0,CAD_LIMITS.radius,'radius'),
    finite(y,-CAD_LIMITS.height,CAD_LIMITS.height,'height')]);
}
const axis=(r,y,theta)=>[r*Math.cos(theta),y,r*Math.sin(theta)];
function triangle(out,a,b,c,uvs){
  for(let k=0;k<3;k++)out.push(...[a,b,c][k],...uvs[k]);
}
function mesh(out,source){
  if(!out.length||out.length%15||out.length/5>CAD_LIMITS.vertices||
    !out.every(n=>Number.isFinite(n)&&Math.abs(n)<=100))
    throw RangeError('parametric mesh exceeds finite vertex budget');
  const vertices=Object.freeze(out);
  const result=Object.freeze({vertices,vertexCount:out.length/5,
    triangleCount:out.length/15,source});
  owned.add(result);return result;
}
/**
 * Revolve an authored radial (radius,y) outline around world +Y.
 * Profile strictly increases in y and stays inside the bounded scene domain.
 * Both end planes are capped; radii zero at ends become pointed caps.
 * Triangles point outward (counterclockwise viewed from outside). UVs are
 * finite [0,1]; no coincident degenerate triangles are emitted.
 */
export function revolveProfile(options){
  plain(options,['profile','segments'],'revolve options');
  const profile=dense(options.profile,2,CAD_LIMITS.profiles,'profile').map(pair);
  const segments=finite(options.segments,3,CAD_LIMITS.segments,'segments');
  if(!Number.isSafeInteger(segments))throw RangeError('segments must be an integer');
  if(profile.some((p,i)=>i>0&&(p[1]<=profile[i-1][1]||
      p[0]===0&&profile[i-1][0]===0)))
    throw RangeError('profile height must increase; adjacent zero-radius segments invalid');
  if(!profile.some(p=>p[0]>0))throw RangeError('profile cannot lie on its axis');
  const yLow=profile[0][1],height=profile.at(-1)[1]-yLow,out=[];
  for(let j=0;j<profile.length-1;j++){
    const [r0,y0]=profile[j],[r1,y1]=profile[j+1],v0=(y0-yLow)/height,v1=(y1-yLow)/height;
    for(let i=0;i<segments;i++){
      const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments,u=i/segments,un=(i+1)/segments;
      const b0=axis(r0,y0,a),b1=axis(r0,y0,b),
        t0=axis(r1,y1,a),t1=axis(r1,y1,b);
      if(r0===0)triangle(out,b0,t0,t1,[[u,v0],[u,v1],[un,v1]]);
      else if(r1===0)triangle(out,b0,t0,b1,[[u,v0],[u,v1],[un,v0]]);
      else{
        triangle(out,b0,t0,b1,[[u,v0],[u,v1],[un,v0]]);
        triangle(out,b1,t0,t1,[[un,v0],[u,v1],[un,v1]]);
      }
    }
  }
  // Bottom cap normal -Y, top cap normal +Y, both fixed by winding.
  for(const [index,top] of [[0,false],[profile.length-1,true]]){
    const [r,y]=profile[index];if(r===0)continue;
    const center=[0,y,0];
    for(let i=0;i<segments;i++){
      const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments;
      const p0=axis(r,y,a),p1=axis(r,y,b);
      const u0=[.5+Math.cos(a)*.5,.5+Math.sin(a)*.5],
        u1=[.5+Math.cos(b)*.5,.5+Math.sin(b)*.5],uc=[.5,.5];
      if(top)triangle(out,center,p1,p0,[uc,u1,u0]);
      else triangle(out,center,p0,p1,[uc,u0,u1]);
    }
  }
  return mesh(out,'lathe');
}
/** Original bounded game/CAD presets derived from an attributed lathe model. */
export function createCADPrimitive(options){
  plain(options,['kind','radius','height','segments'],'CAD primitive');
  const kind=options.kind;
  if(!['column','cone','urn'].includes(kind))throw RangeError('unsupported CAD primitive');
  const radius=finite(options.radius??.8,.1,CAD_LIMITS.radius,'radius'),
    height=finite(options.height??2,.2,CAD_LIMITS.height,'height'),
    segments=options.segments??16;
  const profiles={
    column:[[radius,0],[radius,height]],
    cone:[[radius,0],[0,height]],
    urn:[[radius*.57,0],[radius*.66,height*.14],[radius,height*.48],
      [radius*.79,height*.78],[radius*.74,height]]
  };
  // Centre around the editor entity pivot. Placing at y=height/2 rests on ground.
  const profile=profiles[kind].map(([r,y])=>[r,y-height/2]);
  const model=revolveProfile({profile,segments});
  const result=Object.freeze({kind,vertexCount:model.vertexCount,
    triangleCount:model.triangleCount,vertices:model.vertices,
    radius,height,segments});
  owned.add(result);return result;
}
const numberText=n=>{
  // Rounding tiny negative trigonometric residuals can produce a literal
  // "-0". JSON and the project serializer canonicalise that to +0, so emit
  // +0 at the OBJ boundary and retain byte-stable source/asset roundtrips.
  const value=n.toFixed(6).replace(/\.?0+$/,'');
  return value==='-0'?'0':value;
};
/** Portable bounded OBJ subset directly compatible with the Asset Foundry.
 * One v/vt pair per vertex; no external files, materials, normal or JS payload.
 */
export function cadMeshOBJ(value){
  if(!owned.has(value))throw TypeError('generated CAD mesh required');
  const v=value.vertices,n=value.vertexCount;
  const lines=['# SPDX-License-Identifier: Apache-2.0',
    '# Generated by QSOL-IMC CAD-001; DabbleCAD profile-method attribution in docs/CAD_001.md',
    'o qsol-parametric'];
  for(let i=0;i<v.length;i+=5)lines.push('v '+v.slice(i,i+3).map(numberText).join(' '));
  for(let i=0;i<v.length;i+=5)lines.push('vt '+v.slice(i+3,i+5).map(numberText).join(' '));
  for(let i=0;i<n;i+=3)lines.push('f '+[i+1,i+2,i+3].map(j=>j+'/'+j).join(' '));
  const text=lines.join('\n')+'\n';
  if(new TextEncoder().encode(text).length>64*1024)throw RangeError('OBJ exceeds Asset Foundry limit');
  return text;
}
/** Direct native XYZ/RGB interleaved stream for existing WebGL renderers. */
export function cadColorStream(value,color){
  if(!owned.has(value))throw TypeError('generated CAD mesh required');
  const rgb=dense(color,3,3,'RGB').map(v=>finite(v,0,1,'colour'));
  const out=new Float32Array(value.vertexCount*6);
  for(let i=0;i<value.vertexCount;i++){
    const p=i*5,o=i*6;
    out[o]=value.vertices[p];out[o+1]=value.vertices[p+1];out[o+2]=value.vertices[p+2];
    out[o+3]=rgb[0];out[o+4]=rgb[1];out[o+5]=rgb[2];
  }
  return out;
}


// CAD-002 — editable *owned* radial sketches. A revision creates a new mesh
// asset; existing game, collider and importer authority is never overwritten.
// No UI, clock, external runtime, code execution or mutable shared caches.
const drafts=new WeakSet();
export const CAD_SNAP_STEPS=Object.freeze([0,.025,.05,.1,.25]);
export function cadProfileDraft(options){
  plain(options,['profile','segments'],'CAD profile');
  const profile=Object.freeze(dense(options.profile,2,CAD_LIMITS.profiles,'profile').map(pair));
  if(profile.at(-1)[1]-profile[0][1]>CAD_LIMITS.height)
    throw RangeError('profile height exceeds 10 metre authoring limit');
  // The strict OBJ writer rounds each authored elevation to six decimal
  // places. An ordered floating-point sketch can otherwise collapse two
  // rings onto the same Y plane on export, creating degenerate triangles
  // and a mesh that CAD-002 cannot subsequently recover.
  // Use the same numberText() boundary as cadMeshOBJ, including signed zero.
  for(let i=1;i<profile.length;i++){
    if(Number(numberText(profile[i-1][1]))>=Number(numberText(profile[i][1])))
      throw RangeError('adjacent CAD ring elevations collapse at six-decimal OBJ precision');
  }
  // The established CAD-001 generator remains the geometry authority.
  const model=revolveProfile({profile,segments:options.segments});
  const out=Object.freeze({profile,segments:options.segments,
    triangles:model.triangleCount,vertices:model.vertexCount});
  drafts.add(out);
  return out;
}
function checkedDraft(draft){
  if(!drafts.has(draft))throw TypeError('owned CAD profile required');
  return draft;
}
function snapNumber(value,step){
  if(!CAD_SNAP_STEPS.includes(step))throw RangeError('unsupported CAD snap step');
  return step===0?value:Number((Math.round(value/step)*step).toFixed(6));
}
/** 3 presets retain CAD-001 geometry identity, with no independent template. */
export function cadProfilePreset(options){
  const primitive=createCADPrimitive(options);
  const {kind,radius,height,segments}=primitive;
  const profile=kind==='column'?[[radius,-height/2],[radius,height/2]]:
    kind==='cone'?[[radius,-height/2],[0,height/2]]:
    [[radius*.57,-height/2],[radius*.66,height*.14-height/2],
      [radius,height*.48-height/2],[radius*.79,height*.78-height/2],
      [radius*.74,height/2]];
  return cadProfileDraft({profile,segments});
}
export function cadProfileMesh(draft){
  const d=checkedDraft(draft);
  return revolveProfile({profile:d.profile.map(p=>[...p]),segments:d.segments});
}
/** Edit a single dimension; cannot reorder rings or create degenerate slivers. */
export function cadProfileMove(draft,change){
  plain(change,['index','radius','y','snap'],'CAD ring edit');
  const {index,radius,y,snap=0}=change,d=checkedDraft(draft);
  if(!Number.isSafeInteger(index)||index<0||index>=d.profile.length)
    throw RangeError('profile point index outside bounds');
  const r=snapNumber(finite(radius,0,CAD_LIMITS.radius,'radius'),snap),
    yPosition=snapNumber(finite(y,-CAD_LIMITS.height,CAD_LIMITS.height,'height'),snap);
  const profile=d.profile.map((p,i)=>i===index?[r,yPosition]:[...p]);
  return cadProfileDraft({profile,segments:d.segments});
}
export function cadProfileInsert(draft,change){
  plain(change,['after'],'CAD ring insertion');
  const {after}=change,d=checkedDraft(draft);
  if(!Number.isSafeInteger(after)||after<0||after>=d.profile.length-1||
    d.profile.length>=CAD_LIMITS.profiles)throw RangeError('profile insertion exceeds bounds');
  const a=d.profile[after],b=d.profile[after+1];
  const mid=[Number(((a[0]+b[0])/2).toFixed(6)),
    Number(((a[1]+b[1])/2).toFixed(6))];
  const profile=d.profile.map(p=>[...p]);profile.splice(after+1,0,mid);
  return cadProfileDraft({profile,segments:d.segments});
}
export function cadProfileRemove(draft,change){
  plain(change,['index'],'CAD ring removal');
  const {index}=change,d=checkedDraft(draft);
  if(!Number.isSafeInteger(index)||index<0||index>=d.profile.length||
    d.profile.length<=2)throw RangeError('profile needs at least two points');
  return cadProfileDraft({profile:d.profile.filter((_,i)=>i!==index).map(p=>[...p]),
    segments:d.segments});
}
export function cadProfileSegments(draft,segments){
  const d=checkedDraft(draft);
  return cadProfileDraft({profile:d.profile.map(p=>[...p]),segments});
}
/**
 * Recover the editable rings from an existing strict CAD-001/002 mesh asset.
 * The original scene/project format is unchanged; immutable OBJ triangles
 * contain the ring positions. Recognition rejects a mismatching geometry and
 * does not blindly trust sourceName. Importers, physics and files stay inert.
 */
export function cadProfileRecover(asset){
  plain(asset,['id','kind','name','license','sourceName','sourceSha256','vertices'],'CAD mesh asset');
  if(asset.kind!=='mesh'||asset.license!=='Apache-2.0'||
    !/^cad-(?:urn|column|cone|profile)\.obj$/.test(asset.sourceName))
    throw TypeError('select an Apache-2.0 generated CAD mesh asset');
  const vertices=dense(asset.vertices,15,CAD_LIMITS.vertices*5,'mesh vertices');
  if(vertices.length%15!==0)throw TypeError('CAD triangles required');
  const rings=new Map();
  for(let i=0;i<vertices.length;i+=5){
    const x=finite(vertices[i],-100,100,'mesh x'),
      y=finite(vertices[i+1],-CAD_LIMITS.height,CAD_LIMITS.height,'mesh y'),
      z=finite(vertices[i+2],-100,100,'mesh z');
    finite(vertices[i+3],-100,100,'u');finite(vertices[i+4],-100,100,'v');
    // theta=0 is present on every authored ring, including zero-radius tips.
    if(Math.abs(z)<1e-9&&x>=0)
      rings.set(y,Math.max(rings.get(y)??0,x));
  }
  const profile=[...rings].sort((a,b)=>a[0]-b[0]).map(([y,r])=>[r,y]);
  if(profile.length<2||profile.length>CAD_LIMITS.profiles)throw TypeError('not a bounded CAD radial profile');
  for(let segments=3;segments<=CAD_LIMITS.segments;segments++){
    let draft;
    try{draft=cadProfileDraft({profile,segments});}catch{continue;}
    const rebuilt=cadProfileMesh(draft).vertices;
    if(rebuilt.length!==vertices.length)continue;
    // OBJ rounds every XYZ/UV number to six decimals. XYZ and U stay within
    // one last-place step on reconstruction, but V=(y-y0)/(yN-y0) divides
    // separately rounded ring heights. With each endpoint perturbed by up
    // to half a unit, worst-case normalisation error is bounded by
    // 2e-6/(height-1e-6). Keep strict XYZ/U parity, apply only that derived
    // rounding envelope to V, never unconditionally accept arbitrary UVs.
    const height=profile.at(-1)[1]-profile[0][1];
    const vTolerance=1.000001e-6+
      2.000001e-6/Math.max(height-1e-6,Number.MIN_VALUE);
    let same=true;
    for(let i=0;i<rebuilt.length;i++){
      const rounded=Number(numberText(rebuilt[i])),
        tolerance=i%5===4?vTolerance:1.000001e-6;
      if(Math.abs(rounded-vertices[i])>tolerance){same=false;break;}
    }
    if(same)return draft;
  }
  throw TypeError('mesh is not a recognisable native CAD surface');
}
/** Non-authoritative preview transform, never changes geometry or game state. */
export function cadProfileScreen(draft,options){
  plain(options,['width','height','zoom','panX','panY'],'CAD preview options');
  const {width,height,zoom=1,panX=0,panY=0}=options,d=checkedDraft(draft);
  finite(width,160,1600,'preview width');finite(height,160,1200,'preview height');
  finite(zoom,.5,2,'preview zoom');finite(panX,-100,100,'pan X');finite(panY,-100,100,'pan Y');
  const scale=Math.min((width-60)/5,(height-40)/12)*zoom,
    centerX=40+panX,centerY=height/2+panY;
  return Object.freeze({width,height,zoom,panX,panY,scale,centerX,centerY,
    handles:Object.freeze(d.profile.map(p=>Object.freeze({
      x:centerX+p[0]*scale,y:centerY-p[1]*scale
    })))});
}
export function cadProfileUnproject(screen,point){
  plain(point,['x','y'],'CAD pointer');
  const {x,y}=point;
  if(!screen||!Array.isArray(screen.handles)||!Number.isFinite(screen.scale)||
      screen.scale<=0||!Number.isFinite(screen.centerX)||!Number.isFinite(screen.centerY))
    throw TypeError('CAD preview screen required');
  finite(x,-500,2000,'screen x');finite(y,-500,2000,'screen y');
  return Object.freeze({radius:(x-screen.centerX)/screen.scale,
    y:(screen.centerY-y)/screen.scale});
}
