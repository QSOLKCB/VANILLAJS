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
  // Keep the established CAD-001 domain/ordering validator first, including
  // its specific rejection for non-increasing authored elevations.
  const model=revolveProfile({profile,segments:options.segments});
  // The strict OBJ writer then rounds every elevation to six decimal places.
  // Distinct accepted Y values can collapse at that export boundary, creating
  // degenerate triangles and preventing later profile recovery.
  // Mirror cadMeshOBJ's numberText(), including canonical signed zero.
  for(let i=1;i<profile.length;i++){
    if(Number(numberText(profile[i-1][1]))>=Number(numberText(profile[i][1])))
      throw RangeError('adjacent CAD ring elevations collapse at six-decimal OBJ precision');
  }
  // Recovery reads each radius from the vertex at theta=0, where x=radius.
  for(const [radius] of profile){
    if(radius>0&&numberText(radius)==='0')
      throw RangeError('positive CAD ring radius collapses to the axis at six-decimal OBJ precision');
  }
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


// CAD-003 GEOMETRY FORGE — original bounded convex extrusions and chamfers.
// Reuses CAD-001's owned XYZ/UV mesh, strict OBJ and Float32 paths.
// No general-purpose CSG, third-party geometry runtime or collision changes.
export const FORGE_LIMITS=Object.freeze({corners:12,coordinate:5,height:10,bevel:1,meshVertices:CAD_LIMITS.vertices});
function forgePoint(value){
  const [x,z]=dense(value,2,2,'convex footprint vertex');
  return Object.freeze([
    finite(x,-FORGE_LIMITS.coordinate,FORGE_LIMITS.coordinate,'footprint X'),
    finite(z,-FORGE_LIMITS.coordinate,FORGE_LIMITS.coordinate,'footprint Z')
  ]);
}
function areaXZ(points){
  let sum=0;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    sum+=a[0]*b[1]-b[0]*a[1];
  }
  return sum/2;
}
function convexFootprint(source){
  const points=Object.freeze(dense(source,3,FORGE_LIMITS.corners,'convex footprint').map(forgePoint));
  if(areaXZ(points)<.001)throw RangeError('footprint requires positive CCW area');
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],
      c=points[(i+2)%points.length],
      ab=[b[0]-a[0],b[1]-a[1]],bc=[c[0]-b[0],c[1]-b[1]],
      bend=ab[0]*bc[1]-ab[1]*bc[0];
    if(Math.hypot(...ab)<.01||bend<.0001)
      throw RangeError('footprint must be strictly convex without tiny edges');
    // Local positive turns do NOT imply global convexity or simplicity.
    // E.g. a pentagram has consistent local winding but edges cross.
    // A strictly convex CCW polygon puts every non-endpoint vertex to
    // the interior (left) of EVERY directed supporting edge.
    for(let j=0;j<points.length;j++){
      if(j===i||j===(i+1)%points.length)continue;
      const p=points[j],halfPlane=ab[0]*(p[1]-a[1])-ab[1]*(p[0]-a[0]);
      if(halfPlane<.0001)
        throw RangeError('footprint must be simple and globally strictly convex');
    }
  }
  return points;
}
// Inset the true supporting edge lines, rather than scaling from centroid.
// CCW X/Z input has interior to the LEFT of every edge.
function insetFootprint(points,bevel){
  if(bevel===0)return points;
  const inward=points.map((p,i)=>{
    const q=points[(i+1)%points.length],dx=q[0]-p[0],dz=q[1]-p[1],n=Math.hypot(dx,dz);
    return [-dz/n,dx/n];
  });
  const result=points.map((p,i)=>{
    const prev=inward[(i+inward.length-1)%inward.length],
      next=inward[i],den=1+prev[0]*next[0]+prev[1]*next[1];
    if(den<.01)throw RangeError('bevel exceeds stable convex corner domain');
    const scale=bevel/den;
    return [p[0]+(prev[0]+next[0])*scale,p[1]+(prev[1]+next[1])*scale];
  });
  if(areaXZ(result)<.001)throw RangeError('bevel collapses footprint area');
  for(let i=0;i<result.length;i++){
    const a=result[i],b=result[(i+1)%result.length],
      c=result[(i+2)%result.length];
    if(Math.hypot(b[0]-a[0],b[1]-a[1])<.01||
       (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])<.0001)
      throw RangeError('bevel collapses convex edges');
    for(let j=0;j<points.length;j++){
      const edge=inward[j],p=points[j];
      if((a[0]-p[0])*edge[0]+(a[1]-p[1])*edge[1]<bevel-1e-8)
        throw RangeError('bevel leaves convex footprint');
    }
  }
  return result;
}
function forgeRings(options){
  plain(options,['footprint','height','bevel'],'forge options');
  const footprint=convexFootprint(options.footprint),
    height=finite(options.height,.2,FORGE_LIMITS.height,'height'),
    bevel=finite(options.bevel??0,0,FORGE_LIMITS.bevel,'bevel');
  if(bevel>0&&(bevel<.001||bevel>=height/2-.001))
    throw RangeError('bevel requires at least 0.001 m and vertical clearance');
  const inner=insetFootprint(footprint,bevel);
  const ring=bevel>0?
    [{p:inner,y:-height/2},{p:footprint,y:-height/2+bevel},
      {p:footprint,y:height/2-bevel},{p:inner,y:height/2}]:
    [{p:footprint,y:-height/2},{p:footprint,y:height/2}];
  return {footprint,height,bevel,rings:ring};
}
/**
 * Vertical extrusion of 3–12 strictly CCW convex X/Z vertices, SI metres.
 * Bevel is a real edge-parallel inset chamfer, with +Y-up outward winding.
 * The result uses the same exact OBJ, RGB and Asset Foundry path as CAD-001.
 */
export function createForgeExtrusion(options){
  const {footprint,height,bevel,rings}=forgeRings(options);
  const out=[],n=footprint.length;
  const vtx=(p,y)=>[p[0],y,p[1]];
  const capUV=p=>[.5+p[0]/(2*FORGE_LIMITS.coordinate),.5+p[1]/(2*FORGE_LIMITS.coordinate)];
  // Caps: in a right-handed +Y-up frame, CCW X/Z faces DOWN.
  // Reverse the top winding, retain bottom winding.
  for(const [r,top] of [[rings[0],false],[rings.at(-1),true]]){
    for(let i=1;i<n-1;i++){
      const p0=r.p[0],p1=r.p[i],p2=r.p[i+1];
      if(top)triangle(out,vtx(p0,r.y),vtx(p2,r.y),vtx(p1,r.y),
        [capUV(p0),capUV(p2),capUV(p1)]);
      else triangle(out,vtx(p0,r.y),vtx(p1,r.y),vtx(p2,r.y),
        [capUV(p0),capUV(p1),capUV(p2)]);
    }
  }
  // Corresponding ring edges are joined as outward-wound non-overlapping quads.
  const lengths=[0];for(let i=0;i<n;i++){
    const a=footprint[i],b=footprint[(i+1)%n];
    lengths.push(lengths.at(-1)+Math.hypot(b[0]-a[0],b[1]-a[1]));
  }
  for(let j=0;j<rings.length-1;j++){
    const lo=rings[j],hi=rings[j+1];
    for(let i=0;i<n;i++){
      const k=(i+1)%n,u=lengths[i]/lengths[n],un=lengths[i+1]/lengths[n],
        v0=(lo.y+height/2)/height,v1=(hi.y+height/2)/height,
        a=vtx(lo.p[i],lo.y),b=vtx(lo.p[k],lo.y),
        c=vtx(hi.p[i],hi.y),d=vtx(hi.p[k],hi.y);
      triangle(out,a,c,b,[[u,v0],[u,v1],[un,v0]]);
      triangle(out,b,c,d,[[un,v0],[u,v1],[un,v1]]);
    }
  }
  const result=mesh(out,'forge-extrusion');
  // Keep data separate from the renderer asset stream, which uses only XYZ/UV.
  return result;
}
/** Original industrial presets; all feed the same validated convex polygon API. */
export function forgePresetFootprint(options){
  plain(options,['kind','width','depth','height','bevel'],'forge preset');
  const kind=options.kind;
  if(!['wall','platform','tower','wedge'].includes(kind))throw RangeError('unknown Geometry Forge shape');
  const width=finite(options.width??2,.2,8,'width'),
    depth=finite(options.depth??2,.2,8,'depth'),
    height=finite(options.height??2,.2,FORGE_LIMITS.height,'height'),
    bevel=finite(options.bevel??0,0,FORGE_LIMITS.bevel,'bevel');
  const x=width/2,z=depth/2;
  let footprint;
  if(kind==='wedge')footprint=[[-x,-z],[x,-z],[-x,z]];
  else if(kind==='tower')footprint=Array.from({length:6},(_,i)=>{
    const a=i*2*Math.PI/6;return [x*Math.cos(a),z*Math.sin(a)];
  });
  else footprint=[[-x,-z],[x,-z],[x,z],[-x,z]];
  const validated=forgeRings({footprint,height,bevel});
  return Object.freeze({footprint:Object.freeze(validated.footprint),
    height:validated.height,bevel:validated.bevel});
}
export function createForgePreset(options){
  return createForgeExtrusion(forgePresetFootprint(options));
}
/** Explicitly diagnostic: signed tetrahedral volume plus edge incidence.
 * Accepts source-owned meshes or dense xyzuv triangle arrays from Asset Foundry.
 * Vertices are welded at the same 6-digit precision as the native OBJ writer;
 * malformed, open, non-manifold or reversed objects are reported, not repaired.
 */
export function inspectForgeTriangles(input){
  const vertexData=owned.has(input)?input.vertices:input;
  const verts=dense(vertexData,15,CAD_LIMITS.vertices*5,'forge triangle data');
  if(verts.length%15!==0)throw RangeError('whole XYZ/UV triangles required');
  const ids=new Map(),edges=new Map(),weld=[],triangles=verts.length/15;
  let area=0,signedVolume=0,degenerate=0;
  const indexOf=(coords)=>{
    const key=coords.map(numberText).join(',');
    if(!ids.has(key)){ids.set(key,ids.size);weld.push(coords);}
    return ids.get(key);
  };
  const cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],
    a[0]*b[1]-a[1]*b[0]];
  for(let i=0;i<verts.length;i+=15){
    const points=[];
    for(let j=0;j<3;j++){
      const offset=i+j*5,p=verts.slice(offset,offset+3);
      for(let k=0;k<5;k++)finite(verts[offset+k],-100,100,'mesh XYZ/UV');
      points.push(p);
    }
    const [a,b,c]=points,ab=a.map((v,k)=>b[k]-v),
      ac=a.map((v,k)=>c[k]-v),normal=cross3(ab,ac);
    const length=Math.hypot(...normal);
    if(length<1e-10)degenerate++;
    area+=length/2;
    signedVolume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+
      a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
    const idx=points.map(indexOf);
    for(let j=0;j<3;j++){
      const a=idx[j],b=idx[(j+1)%3],key=a<b?a+':'+b:b+':'+a,
        direction=a<b?1:-1,old=edges.get(key);
      if(old){old.count++;old.signed+=direction;}
      else edges.set(key,{count:1,signed:direction});
    }
  }
  let boundaryEdges=0,nonManifoldEdges=0,orientationErrors=0;
  for(const edge of edges.values()){
    if(edge.count===1)boundaryEdges++;
    if(edge.count>2)nonManifoldEdges++;
    if(edge.count===2&&edge.signed!==0)orientationErrors++;
  }
  const closed=boundaryEdges===0&&nonManifoldEdges===0&&
    orientationErrors===0&&degenerate===0&&signedVolume>0;
  return Object.freeze({triangles,weldedVertices:ids.size,edges:edges.size,
    boundaryEdges,nonManifoldEdges,orientationErrors,degenerate,
    area,signedVolume,volume:Math.abs(signedVolume),closed,
    euler:ids.size-edges.size+triangles});
}
/** Independent-of-triangulation reference: integrate XY-section area with
 * Simpson's rule. Linear vertex interpolation gives quadratic polygon area,
 * making Simpson exact in real arithmetic for each bevel and vertical band.
 */
export function forgeVolumeReference(options){
  const {rings}=forgeRings(options);
  let total=0;
  for(let i=0;i<rings.length-1;i++){
    const a=rings[i],b=rings[i+1],mid=a.p.map((p,j)=>[
      (p[0]+b.p[j][0])/2,(p[1]+b.p[j][1])/2]);
    total+=(b.y-a.y)*(areaXZ(a.p)+4*areaXZ(mid)+areaXZ(b.p))/6;
  }
  return total;
}
