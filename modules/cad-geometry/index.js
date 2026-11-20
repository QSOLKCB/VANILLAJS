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
