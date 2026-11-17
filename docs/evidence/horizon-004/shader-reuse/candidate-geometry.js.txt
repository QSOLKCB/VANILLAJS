// SPDX-License-Identifier: Apache-2.0
// Original bounded scenery and vehicle presentation. SI metres, +Y up, -Z forward.
// Pure data/geometry: this module does not advance or approximate vehicle dynamics.
import {seededRandom,multiplyMatrices} from '../math/index.js';
import {Heightfield} from '../terrain/index.js';
export const SCENIC_FORMAT='qsol.vanillajs.scenic3d.v1';
export const SCENIC_BYTES=32768;
export const SCENIC_PROFILES=Object.freeze({low:Object.freeze({roadSteps:8,terrainCells:56,trees:30,wheelSegments:12,maxVertices:100000}),high:Object.freeze({roadSteps:8,terrainCells:56,trees:84,wheelSegments:24,maxVertices:280000})});
const ID=/^[a-z][a-z0-9-]{0,31}$/;
const copy=x=>JSON.parse(JSON.stringify(x));
function record(v,keys,label,optional=false){
  if(!v||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw new TypeError(label+' requires a plain record');
  const ds=Object.getOwnPropertyDescriptors(v),actual=Reflect.ownKeys(ds);
  if(actual.some(k=>typeof k!=='string'||!keys.includes(k)||!Object.hasOwn(ds[k],'value')||!ds[k].enumerable)||(!optional&&keys.some(k=>!Object.hasOwn(ds,k))))throw new TypeError(label+' contains missing, unknown or executable fields');
}
function list(v,min,max,label){
  if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length<min||v.length>max||Reflect.ownKeys(v).length!==v.length+1)throw new TypeError(label+' requires a bounded dense array');
  for(let i=0;i<v.length;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw new TypeError(label+' contains missing or executable elements');}return v;
}
function num(v,lo,hi,label){if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw new RangeError(label+' outside supported bounds');return v;}
function vec(v,n,lo,hi,label){return list(v,n,n,label).map(x=>num(x,lo,hi,label));}
function choice(v,values,label){if(!values.includes(v))throw new TypeError(label+' unsupported');return v;}
function frozen(v){if(v&&typeof v==='object'){for(const child of Object.values(v))frozen(child);Object.freeze(v);}return v;}
const sub=(a,b)=>a.map((x,i)=>x-b[i]),add=(a,b)=>a.map((x,i)=>x+b[i]),scale=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function unit(v){const n=Math.hypot(...v);if(n<1e-9)throw new RangeError('degenerate scenic geometry');return scale(v,1/n);}
const lerp=(a,b,t)=>a+(b-a)*t;
const point=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));
const f32=p=>p.map(Math.fround);
function triangleNormal(a,b,c){return unit(cross(sub(b,a),sub(c,a)));}
function triangle(out,a,b,c,color=[1,1,1],uv=[[0,0],[1,0],[0,1]]){
  const normal=triangleNormal(a,b,c);for(let i=0;i<3;i++)out.push(...[a,b,c][i],...normal,...color,...uv[i]);
}
function quad(out,a,b,c,d,color=[1,1,1],uv=[[0,0],[1,0],[1,1],[0,1]]){triangle(out,a,b,c,color,[uv[0],uv[1],uv[2]]);triangle(out,a,c,d,color,[uv[0],uv[2],uv[3]]);}
// Shared-vertex area-weighted normals affect lighting only. Heightfield and road
// contact still expose their original planar normals and unchanged triangle positions.
function smoothMeshNormals(vertices){
  const normals=new Map(),key=p=>p.join(':');
  // Use the exact shipped Float32 positions, including shared pole/seam positions.
  for(let i=0;i<vertices.length;i+=11)for(let k=0;k<3;k++)vertices[i+k]=Math.fround(vertices[i+k]);
  for(let i=0;i<vertices.length;i+=33){const p=[0,11,22].map(j=>vertices.slice(i+j,i+j+3)),n=cross(sub(p[1],p[0]),sub(p[2],p[0]));for(const point of p){const k=key(point),sum=normals.get(k)??[0,0,0];normals.set(k,add(sum,n));}}
  for(let i=0;i<vertices.length;i+=11){const n=unit(normals.get(key(vertices.slice(i,i+3))));for(let k=0;k<3;k++)vertices[i+k+3]=n[k];}
}
function boundsOf(vertices){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<vertices.length;i+=11)for(let k=0;k<3;k++){min[k]=Math.min(min[k],vertices[i+k]);max[k]=Math.max(max[k],vertices[i+k]);}return {min,max};}
function material(color,roughness=.85,pattern='none',extra={}){return {color,roughness,metalness:0,opacity:1,emission:0,pattern,patternScale:1,...extra};}
function matrix(position=[0,0,0],yaw=0,pitch=0,roll=0){
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch),cz=Math.cos(roll),sz=Math.sin(roll);
  const y=new Float32Array([cy,0,-sy,0,0,1,0,0,sy,0,cy,0,...position,1]);
  const x=new Float32Array([1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,0,0,1]);
  const z=new Float32Array([cz,sz,0,0,-sz,cz,0,0,0,0,1,0,0,0,0,1]);
  return multiplyMatrices(multiplyMatrices(y,x),z);
}
function transform(m,p){return [0,1,2].map(r=>m[r]*p[0]+m[4+r]*p[1]+m[8+r]*p[2]+m[12+r]);}
function box(out,center,size,color=[1,1,1],yaw=0,roll=0,pitch=0){
  const m=matrix(center,yaw,pitch,roll),v=[];for(let i=0;i<8;i++)v.push(transform(m,size.map((s,k)=>s*((i>>k&1)-.5))));
  for(const f of [[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]])quad(out,...f.map(i=>v[i]),color);
}
function crown(out,center,radii,phase,color,segments,rings){
  const at=(i,j)=>{const a=i/segments*Math.PI*2,b=(j/rings-.5)*Math.PI,c=Math.cos(b),lobes=1+.10*Math.cos(a*3+phase)*c*c+.055*Math.sin(a*5-phase)*c;return [center[0]+Math.cos(a)*c*radii[0]*lobes,center[1]+Math.sin(b)*radii[1],center[2]+Math.sin(a)*c*radii[2]*lobes];};
  for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){
    const a=at(i,j),b=at(i,j+1),c=at(i+1,j+1),d=at(i+1,j),tint=color.map((v,k)=>Math.min(1,v*(.91+.09*Math.sin(i*.7+j*.8+phase+k*.4))));
    if(j===0)triangle(out,a,b,c,tint);else if(j===rings-1)triangle(out,a,c,d,tint);else quad(out,a,b,c,d,tint);
  }
}
function admit(value){
  record(value,['format','version','name','seed','profile','environment','road'],'scenery');
  if(value.format!==SCENIC_FORMAT||value.version!==1)throw new TypeError('unsupported scenery format/version');
  if(typeof value.name!=='string'||value.name.trim()!==value.name||!value.name||value.name.length>64||/[\u0000-\u001f\u007f]/.test(value.name))throw new TypeError('scenery name requires bounded plain text');
  if(!Number.isSafeInteger(value.seed)||value.seed<0||value.seed>0xffffffff)throw new RangeError('seed must be uint32');
  const profile=choice(value.profile,Object.keys(SCENIC_PROFILES),'profile'),environment=choice(value.environment,['coast','alpine','dusk'],'environment');
  const road=list(value.road,4,32,'road').map(p=>{record(p,['id','x','y','z','width','bank','structure','surface'],'road knot');if(typeof p.id!=='string'||!ID.test(p.id))throw new TypeError('invalid road surface ID');return {id:p.id,x:num(p.x,-1200,1200,'road x'),y:num(p.y,-20,180,'road y'),z:num(p.z,-1200,1200,'road z'),width:num(p.width,5,18,'full road width'),bank:num(p.bank,-.4,.4,'road bank'),structure:choice(p.structure,['ground','bridge','tunnel'],'structure'),surface:choice(p.surface,['asphalt','gravel'],'surface')};});
  if(new Set(road.map(p=>p.id)).size!==road.length)throw new TypeError('duplicate road surface ID');
  let length=0;for(let i=1;i<road.length;i++){const a=road[i-1],b=road[i],d=Math.hypot(b.x-a.x,b.z-a.z);if(d<8||d>200||Math.abs(b.y-a.y)>d*.7)throw new RangeError('road knots need 8..200 m horizontal separation and bounded grade');length+=d;}if(length>2400)throw new RangeError('road length budget');
  const result={format:SCENIC_FORMAT,version:1,name:value.name,seed:value.seed,profile,environment,road};if(new TextEncoder().encode(JSON.stringify(result)).length>SCENIC_BYTES)throw new RangeError('scenery byte budget');return result;
}
function catmull(a,b,c,d,t){return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);}
function roadRows(recipe){
  const points=recipe.road,steps=SCENIC_PROFILES[recipe.profile].roadSteps,rows=[];
  for(let segment=0;segment<points.length-1;segment++)for(let j=0;j<steps;j++){
    const t=j/steps,a=points[Math.max(0,segment-1)],b=points[segment],c=points[segment+1],d=points[Math.min(points.length-1,segment+2)];
    rows.push({center:['x','y','z'].map(k=>catmull(a[k],b[k],c[k],d[k],t)),width:lerp(b.width,c.width,t),bank:lerp(b.bank,c.bank,t),surfaceId:b.id,structure:b.structure,surface:b.surface,segment});
  }
  const end=points.at(-1);rows.push({center:[end.x,end.y,end.z],width:end.width,bank:end.bank,surfaceId:points.at(-2).id,structure:points.at(-2).structure,surface:points.at(-2).surface,segment:points.length-2});
  let distance=0;for(let i=0;i<rows.length;i++){
    const row=rows[i],before=rows[Math.max(0,i-1)].center,after=rows[Math.min(rows.length-1,i+1)].center,tangent=unit(sub(after,before));
    const yaw=Math.atan2(-tangent[0],-tangent[2]),right=[Math.cos(yaw)*Math.cos(row.bank),Math.sin(row.bank),-Math.sin(yaw)*Math.cos(row.bank)];
    if(i)distance+=Math.hypot(...sub(row.center,rows[i-1].center));row.distance=distance;row.tangent=tangent;
    row.left=f32(add(row.center,scale(right,-row.width/2)));row.right=f32(add(row.center,scale(right,row.width/2)));row.center=f32(row.center);
    if([...row.left,...row.right].some(v=>!Number.isFinite(v)||Math.abs(v)>2000))throw new RangeError('road generated coordinate budget');
  }
  return rows;
}
function roadTriangles(rows){
  const triangles=[];for(let i=0;i<rows.length-1;i++){
    const a=rows[i],b=rows[i+1],corners=[a.left,a.right,b.right,b.left];
    // Every interpolated cross-section must remain inside the two road faces.
    // Upward individual triangles alone do not exclude a concave strip.
    for(let k=0;k<4;k++)if(cross(sub(corners[(k+1)%4],corners[k]),sub(corners[(k+2)%4],corners[(k+1)%4]))[1]<-1e-9)throw new RangeError('road cross-section must be convex in XZ');
    for(const [triangle,points,uv] of [[0,[a.left,a.right,b.left],[[0,a.distance/6],[1,a.distance/6],[0,b.distance/6]]],[1,[a.right,b.right,b.left],[[1,a.distance/6],[1,b.distance/6],[0,b.distance/6]]]]){
      const normal=triangleNormal(...points);if(normal[1]<.15)throw new RangeError('road folds or exceeds supported slope');
      triangles.push({surfaceId:a.surfaceId,surface:a.surface,structure:a.structure,segment:a.segment,strip:i,triangle,points,normal,uv});
    }
  }return triangles;
}
function roadWeights(points,x,z){
  const [a,b,c]=points,den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
  const wa=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,wb=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
  return [wa,wb,1-wa-wb];
}
function sampleResult(points,normal,tangent,weights,fields){
  const position=[0,1,2].map(k=>points.reduce((s,p,i)=>s+p[k]*weights[i],0)),forward=unit(sub(tangent,scale(normal,dot(tangent,normal)))),right=unit(cross(forward,normal));
  return {...fields,position,normal:[...normal],yaw:Math.atan2(-forward[0],-forward[2]),pitch:Math.asin(Math.max(-1,Math.min(1,forward[1]))),roll:Math.atan2(right[1],normal[1])};
}
export function validateScenery(value){const result=admit(value);roadTriangles(roadRows(result));return frozen(result);}
export function parseScenery(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>SCENIC_BYTES)throw new RangeError('scenery import byte budget');return validateScenery(JSON.parse(text));}
export function serializeScenery(value){return JSON.stringify(validateScenery(value));}
export class ScenicRoad{
  #recipe;#rows;#triangles;
  constructor(recipe){this.#recipe=validateScenery(recipe);this.#rows=roadRows(this.#recipe);this.#triangles=roadTriangles(this.#rows);}
  get length(){return this.#rows.at(-1).distance;}
  get stationCount(){return this.#rows.length;}
  stations(){return copy(this.#rows);}
  triangles(){return copy(this.#triangles);}
  mesh(surface=null){if(surface!==null&&!['asphalt','gravel'].includes(surface))throw new TypeError('unknown surface');const out=[];for(const t of this.#triangles)if(surface===null||surface===t.surface)triangle(out,...t.points,[1,1,1],t.uv);return new Float32Array(out);}
  sample(distance,lateral=0){
    num(distance,0,this.length,'road distance');num(lateral,-9,9,'lateral offset');let i=this.#rows.length-2;for(let n=0;n<this.#rows.length-1;n++)if(distance<this.#rows[n+1].distance){i=n;break;}
    const a=this.#rows[i],b=this.#rows[i+1],u=(distance-a.distance)/(b.distance-a.distance),left=point(a.left,b.left,u),right=point(a.right,b.right,u),across=sub(right,left),width=Math.hypot(...across);
    // Metres along the physical cross-section, followed by a vertical lift onto
    // the actual rendered face. Unit-square weights skew tapered sections.
    if(Math.abs(lateral)>width/2+2e-4)throw new RangeError('offset outside road');
    const offset=Math.max(-width/2,Math.min(width/2,lateral)),target=add(point(left,right,.5),scale(across,offset/width));
    for(let j=0;j<2;j++){
      const t=this.#triangles[i*2+j],weights=roadWeights(t.points,target[0],target[2]);if(Math.min(...weights)<-1e-8)continue;
      return sampleResult(t.points,t.normal,sub(b.center,a.center),weights,{distance,lateral,surfaceId:t.surfaceId,surface:t.surface,structure:t.structure,segment:t.segment,triangle:t.triangle});
    }
    throw new RangeError('cross-section lies outside the triangulated road');
  }
  sampleAt(x,z,options={}){
    num(x,-2000,2000,'sample x');num(z,-2000,2000,'sample z');record(options,['surfaceId','maxY'],'road query',true);const maxY=num(options.maxY??2000,-2000,2000,'maximum query height');
    if(options.surfaceId!==undefined&&(typeof options.surfaceId!=='string'||!this.#recipe.road.slice(0,-1).some(p=>p.id===options.surfaceId)))throw new TypeError('unknown road surface ID');
    let hit=null;for(const t of this.#triangles){if(options.surfaceId!==undefined&&t.surfaceId!==options.surfaceId)continue;const weights=roadWeights(t.points,x,z);if(Math.min(...weights)<-1e-8)continue;
      const rows=this.#rows,hitData=sampleResult(t.points,t.normal,sub(rows[t.strip+1].center,rows[t.strip].center),weights,{surfaceId:t.surfaceId,surface:t.surface,structure:t.structure,segment:t.segment,triangle:t.triangle});if(hitData.position[1]<=maxY+1e-7&&(!hit||hitData.position[1]>hit.position[1]))hit=hitData;
    }return hit;
  }
}
function sceneMaterials(environment){const dusk=environment==='dusk',alpine=environment==='alpine';return {
  terrain:material(alpine?[.35,.43,.37]:[.30,.42,.24],.95,'grass',{patternScale:.6}),asphalt:material([.19,.22,.24],.82,'asphalt',{patternScale:4}),gravel:material([.50,.43,.33],.98,'asphalt',{patternScale:2}),
  markings:material([.9,.85,.65],.65),stone:material([.50,.48,.43],.95,'stone',{patternScale:.4}),trunk:material([.29,.19,.12]),foliage:material(dusk?[.10,.22,.19]:[.14,.31,.21],.95,'grass'),
  building:material([.71,.65,.49],.9,'stone',{patternScale:.6}),roof:material([.39,.20,.14],.85),glass:material([.16,.36,.45],.12,'glass',{opacity:.65,metalness:.25}),metal:material([.44,.49,.47],.3,'none',{metalness:.7}),water:material([.10,.37,.43],.16,'glass',{metalness:.45,opacity:.82}),
};}
export function buildScenicWorld(value){
  const recipe=validateScenery(value),profile=SCENIC_PROFILES[recipe.profile],road=new ScenicRoad(recipe),rows=road.stations(),materials=sceneMaterials(recipe.environment),data=new Map();
  const batch=id=>{if(!data.has(id))data.set(id,[]);return data.get(id);};
  const minX=Math.min(...rows.map(p=>p.center[0]))-150,maxX=Math.max(...rows.map(p=>p.center[0]))+150,minZ=Math.min(...rows.map(p=>p.center[2]))-90,maxZ=Math.max(...rows.map(p=>p.center[2]))+90;
  const cells=profile.terrainCells,cell=2**Math.ceil(Math.log2(Math.max(maxX-minX,maxZ-minZ)/cells)),size=cell*cells,originX=Math.floor((minX+maxX-size)/2/cell)*cell,originZ=Math.floor((minZ+maxZ-size)/2/cell)*cell,random=seededRandom(recipe.seed),phase=random()*Math.PI*2,heights=[];
  for(let iz=0;iz<=cells;iz++)for(let ix=0;ix<=cells;ix++){
    const x=originX+ix*cell,z=originZ+iz*cell;let nearest=rows[0],distance=Infinity;for(const row of rows){const d=Math.hypot(x-row.center[0],z-row.center[2]);if(d<distance){distance=d;nearest=row;}}
    const mountain=Math.max(0,-x-45)*.24;let height=5+mountain+Math.sin(x*.034+phase)*7+Math.cos(z*.025-phase)*6+Math.sin((x+z)*.05)*2;
    if(recipe.environment==='coast'&&x>55)height-=Math.min(27,(x-55)*.25);
    const floor=nearest.center[1]-(nearest.structure==='bridge'?19:2.5);if(distance<nearest.width/2+18)height=Math.min(height,floor+(distance-nearest.width/2-3)*.12);
    heights.push(Math.fround(Math.max(-18,height)));
  }
  const terrain=new Heightfield({cellsX:cells,cellsZ:cells,cellSize:cell,originX,originZ,heights});
  for(let z=0;z<cells;z++)for(let x=0;x<cells;x++)for(const t of terrain.triangleAt(x,z))triangle(batch('terrain'),...t,[1,1,1],t.map(p=>[p[0]/8,p[2]/8]));
  for(const surface of ['asphalt','gravel']){const mesh=road.mesh(surface);if(mesh.length)data.set(surface,Array.from(mesh));}
  for(let i=0;i<rows.length-1;i++){
    const a=rows[i],b=rows[i+1],normal=road.sample((a.distance+b.distance)/2).normal;
    for(const side of [-1,1]){const edge=r=>add(side<0?r.left:r.right,scale(normal,.018));const p=edge(a),q=edge(b),inside=scale(unit(sub(a.right,a.left)),side<0?.13:-.13);quad(batch('markings'),...(side<0?[p,add(p,inside),add(q,inside),q]:[p,q,add(q,inside),add(p,inside)]));}
    if(i%2===0){const p=road.sample(a.distance,.06),q=road.sample(Math.min(b.distance,road.length),.06),r=road.sample(Math.min(b.distance,road.length),-.06),s=road.sample(a.distance,-.06);quad(batch('markings'),... [s,p,q,r].map(v=>add(v.position,scale(v.normal,.024))));}
    if(a.structure!=='bridge')for(const side of [-1,1]){
      const edge=r=>side<0?r.left:r.right,outer=r=>{const p=add(edge(r),scale(unit(sub(r.right,r.left)),side*3));return [p[0],terrain.sample(p[0],p[2]).height,p[2]];};
      const p=edge(a),q=edge(b),r=outer(b),s=outer(a),points=side<0?[p,q,r,s]:[p,s,r,q];quad(batch('terrain'),...points,[1,1,1],points.map(v=>[v[0]/8,v[2]/8]));
    }
    if(a.structure==='bridge'){
      const middle=point(a.center,b.center,.5),length=Math.hypot(...sub(b.center,a.center)),yaw=Math.atan2(-(b.center[0]-a.center[0]),-(b.center[2]-a.center[2])),pitch=Math.atan2(b.center[1]-a.center[1],Math.hypot(b.center[0]-a.center[0],b.center[2]-a.center[2]));box(batch('stone'),[middle[0],middle[1]-.55,middle[2]],[a.width+.9,.9,length+.25],[1,1,1],yaw,a.bank,pitch);
      for(const side of [-1,1]){const p=side<0?a.left:a.right,q=side<0?b.left:b.right,edge=point(p,q,.5);for(const height of [.42,.92])box(batch('metal'),[edge[0],edge[1]+height,edge[2]],[.10,.09,length+.15],[.82,.88,.91],yaw,a.bank,pitch);if(i%2===0)box(batch('metal'),[p[0],p[1]+.44,p[2]],[.12,.95,.12],[.75,.80,.82]);}
      if(i%4===0){const left=add(a.left,[0,-.82,0]),right=add(b.right,[0,-.82,0]);pipe(batch('metal'),left,right,.10,[.6,.67,.68],recipe.profile==='high'?6:4);pipe(batch('metal'),add(a.right,[0,-.82,0]),add(b.left,[0,-.82,0]),.10,[.6,.67,.68],recipe.profile==='high'?6:4);}
      if(i%4===0)for(const side of [-1,1]){const p=side<0?a.left:a.right,h=terrain.sample(p[0],p[2]).height,high=Math.max(.2,p[1]-h);box(batch('stone'),[p[0],h+high/2,p[2]],[1.0,high,1.4]);}
    }
    if(a.structure==='tunnel'){
      const segments=recipe.profile==='high'?24:12;
      const arch=(row,t,shell)=>{const angle=Math.PI*t;const offset=(row.width/2+.8+shell*.45)*Math.cos(angle),height=.5+(5.4+shell*.4)*Math.sin(angle),right=unit(sub(row.right,row.left));return add(row.center,add(scale(right,offset),[0,height,0]));};
      for(let k=0;k<segments;k++){const t=k/segments,u=(k+1)/segments;quad(batch('stone'),arch(a,t,0),arch(a,u,0),arch(b,u,0),arch(b,t,0),[.70,.74,.77]);quad(batch('stone'),arch(a,t,1),arch(b,t,1),arch(b,u,1),arch(a,u,1));
        if(i===0||rows[i-1].structure!=='tunnel')quad(batch('stone'),arch(a,t,0),arch(a,t,1),arch(a,u,1),arch(a,u,0));
        if(i===rows.length-2||b.structure!=='tunnel')quad(batch('stone'),arch(b,t,0),arch(b,u,0),arch(b,u,1),arch(b,t,1));}
      if(i%4===0){
        const frame=[];for(let k=0;k<=segments;k++)frame.push(arch(a,k/segments,-.16));line(batch('stone'),frame,.13,[.88,.87,.82],recipe.profile==='high'?6:4);
        for(const side of [-1,1]){const p=add(a.center,add(scale(unit(sub(a.right,a.left)),side*(a.width*.39)),[0,3.6,0]));box(batch('markings'),p,[.26,.09,1.0],[1,.95,.78]);}
      }
    }
  }
  if(recipe.environment==='coast')quad(batch('water'),[originX,-9,originZ],[originX,-9,originZ+size],[originX+size,-9,originZ+size],[originX+size,-9,originZ],[1,1,1],[[0,0],[0,20],[20,20],[20,0]]);
  let treeCount=0;for(let n=0;n<profile.trees;n++){
    const sample=road.sample(road.length*(.02+random()*.96)),side=random()<.5?-1:1,offset=side*(15+random()*80),x=sample.position[0]+Math.cos(sample.yaw)*offset,z=sample.position[2]-Math.sin(sample.yaw)*offset;if(x<originX||x>originX+size||z<originZ||z>originZ+size)continue;const h=terrain.sample(x,z).height;if(h< -6)continue;treeCount++;
    const height=5+random()*8,r=1.8+random()*1.7,twist=random()*Math.PI*2,broadleaf=random()>(recipe.environment==='alpine'?.72:.35),tint=[.70+random()*.22,.78+random()*.20,.66+random()*.24],high=recipe.profile==='high',bend=[Math.cos(twist)*.35,0,Math.sin(twist)*.35],fork=add([x,h+height*.55,z],bend);
    pipe(batch('trunk'),[x,h,z],fork,.19,[.83,.78,.70],high?6:5,0);
    if(broadleaf){
      for(let k=0;k<(high?3:2);k++){const angle=twist+k*2.3999632297,spread=k===0?0:r*.68,center=[x+Math.cos(angle)*spread,h+height*(k===0?.80:.69+(k%2)*.12),z+Math.sin(angle)*spread],scale=k===0?1.12:.79;pipe(batch('trunk'),fork,center,.075,[.8,.76,.68],high?5:4,0);crown(batch('foliage'),center,[r*scale,height*.25*scale,r*scale],angle,tint,high?8:6,4);}
    }else{
      for(let k=0;k<(high?3:2);k++){const f=k/(high?3:2),center=[x+bend[0]*(k+1),h+height*(.39+.52*f),z+bend[2]*(k+1)];crown(batch('foliage'),center,[r*(1-.68*f),height*.25,r*(.92-.6*f)],twist+k,tint,high?8:6,4);}
    }
  }
  for(const ratio of [.025,.18,.72,.94]){
    const s=road.sample(road.length*ratio),x=s.position[0]+Math.cos(s.yaw)*21,z=s.position[2]-Math.sin(s.yaw)*21,h=terrain.sample(x,z).height;box(batch('building'),[x,h+2,z],[7,4,5]);
    const a=[x-4,h+4,z-3],b=[x+4,h+4,z-3],c=[x+4,h+4,z+3],d=[x-4,h+4,z+3],p=[x,h+6,z-3],q=[x,h+6,z+3];quad(batch('roof'),a,p,q,d);quad(batch('roof'),p,b,c,q);triangle(batch('roof'),a,b,p);triangle(batch('roof'),d,q,c);
    for(const dx of [-2,2])quad(batch('glass'),[x+dx-.6,h+1.4,z-2.51],[x+dx+.6,h+1.4,z-2.51],[x+dx+.6,h+2.7,z-2.51],[x+dx-.6,h+2.7,z-2.51]);
  }
  for(const id of ['terrain','foliage'])if(data.has(id))smoothMeshNormals(data.get(id));
  const batches=[...data].filter(([,v])=>v.length).map(([id,v])=>({id,material:materials[id],vertices:new Float32Array(v)}));const vertices=batches.reduce((sum,b)=>sum+b.vertices.length/11,0);if(vertices>profile.maxVertices)throw new RangeError('scenery vertex budget');
  const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(const batch of batches){const b=boundsOf(batch.vertices);for(let k=0;k<3;k++){bounds.min[k]=Math.min(bounds.min[k],b.min[k]);bounds.max[k]=Math.max(bounds.max[k],b.max[k]);}}
  return {recipe,batches,road,terrain,bounds,stats:{vertices,batches:batches.length,roadTriangles:road.triangles().length,terrainCells:cells*cells,trees:treeCount}};
}
const vehicleInfo=new WeakMap();
const VEHICLES=Object.freeze({sport:{length:4.4,width:1.95,height:1.25,wheelbase:2.62,track:1.76,wheelRadius:.34},touring:{length:4.9,width:1.88,height:1.52,wheelbase:2.85,track:1.68,wheelRadius:.35},utility:{length:4.7,width:2.08,height:1.86,wheelbase:2.72,track:1.84,wheelRadius:.42}});
// Smooth normals are presentation data; authoritative road faces retain exact normals.
function smoothTriangle(out,points,normals,color=[1,1,1],uv=[[0,0],[1,0],[0,1]]){
  for(let i=0;i<3;i++)out.push(...points[i],...normals[i],...color,...uv[i]);
}
function surface(out,fn,columns,rows,outward,color=[1,1,1]){
  const h=1e-4,grid=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){
    const u=i/columns,v=j/rows,p=fn(u,v),du=sub(fn(Math.min(1,u+h),v),fn(Math.max(0,u-h),v)),dv=sub(fn(u,Math.min(1,v+h)),fn(u,Math.max(0,v-h))),n=unit(cross(du,dv));
    grid.push({p,n:dot(n,outward)<0?scale(n,-1):n,uv:[u,v]});
  }
  for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
    const a=grid[j*(columns+1)+i],b=grid[j*(columns+1)+i+1],c=grid[(j+1)*(columns+1)+i+1],d=grid[(j+1)*(columns+1)+i],reverse=dot(triangleNormal(a.p,b.p,c.p),outward)<0;
    for(const tri of reverse?[[a,c,b],[a,d,c]]:[[a,b,c],[a,c,d]])smoothTriangle(out,tri.map(x=>x.p),tri.map(x=>x.n),color,tri.map(x=>x.uv));
  }
}
function pipe(out,a,b,radius,color=[1,1,1],segments=6,caps=3){
  const axis=unit(sub(b,a)),u=unit(cross(axis,Math.abs(axis[1])>.9?[1,0,0]:[0,1,0])),v=cross(axis,u),at=(p,t)=>add(p,add(scale(u,Math.cos(t)*radius),scale(v,Math.sin(t)*radius)));
  for(let i=0;i<segments;i++){const t=i/segments*Math.PI*2,T=(i+1)/segments*Math.PI*2,p=at(a,t),q=at(a,T),r=at(b,T),s=at(b,t);quad(out,p,q,r,s,color);if(caps&1)triangle(out,a,q,p,color);if(caps&2)triangle(out,b,s,r,color);}
}
function line(out,points,radius,color=[1,1,1],segments=6){for(let i=1;i<points.length;i++)pipe(out,points[i-1],points[i],radius,color,segments,(i===1?1:0)|(i===points.length-1?2:0));}
function sectionValue(knots,z,column){
  let i=knots.length-2;for(let n=0;n<knots.length-1;n++)if(z<=knots[n+1][0]){i=n;break;}
  const slope=n=>(knots[n+1][column]-knots[n][column])/(knots[n+1][0]-knots[n][0]);
  // Monotone cubic Hermite slopes are continuous across sections and do not overshoot.
  const tangent=n=>{if(n===0)return slope(0);if(n===knots.length-1)return slope(n-1);const a=slope(n-1),b=slope(n);if(a*b<=0)return 0;const h0=knots[n][0]-knots[n-1][0],h1=knots[n+1][0]-knots[n][0],w0=2*h1+h0,w1=h1+2*h0;return (w0+w1)/(w0/a+w1/b);};
  const a=knots[i],b=knots[i+1],h=b[0]-a[0],t=Math.max(0,Math.min(1,(z-a[0])/h)),t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*a[column]+(t3-2*t2+t)*h*tangent(i)+(-2*t3+3*t2)*b[column]+(t3-t2)*h*tangent(i+1);
}
function wheelGeometry(radius,width,segments,spokes){
  const tire=[],alloy=[],profile=[[-.47,.58],[-.50,.75],[-.46,.90],[-.32,.98],[-.18,1],[.18,1],[.32,.98],[.46,.90],[.50,.75],[.47,.58]].map(([x,r])=>[x*width,r*radius]);
  const point=(k,t)=>[profile[k][0],Math.cos(t)*profile[k][1],Math.sin(t)*profile[k][1]];
  const normal=(k,t)=>{const before=profile[Math.max(0,k-1)],after=profile[Math.min(profile.length-1,k+1)],dx=after[0]-before[0],dr=after[1]-before[1];return unit([-dr,Math.cos(t)*dx,Math.sin(t)*dx]);};
  // Start with the full-radius tread, then the rounded shoulders and sidewalls.
  for(const k of [4,0,1,2,3,5,6,7,8])for(let i=0;i<segments;i++){
    const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2,p=[point(k,a),point(k,b),point(k+1,b),point(k+1,a)],n=[normal(k,a),normal(k,b),normal(k+1,b),normal(k+1,a)],tint=k===4&&i%4===0?[.88,.89,.9]:[1,1,1];
    smoothTriangle(tire,[p[0],p[1],p[2]],[n[0],n[1],n[2]],tint);smoothTriangle(tire,[p[0],p[2],p[3]],[n[0],n[2],n[3]],tint);
  }
  const radial=(x,r,t)=>[x,Math.cos(t)*r,Math.sin(t)*r];
  for(const side of [-1,1]){
    const x=side*(width/2+.004),disc=x-side*.028,front=points=>side>0?points:points.reverse();
    for(let i=0;i<segments;i++){
      const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
      triangle(alloy,[disc,0,0],...front([radial(disc,radius*.61,a),radial(disc,radius*.61,b)]),[.23,.26,.29]);
      quad(alloy,...front([radial(x,radius*.69,a),radial(x,radius*.69,b),radial(x,radius*.59,b),radial(x,radius*.59,a)]),[.94,.96,1]);
      triangle(alloy,[x+side*.012,0,0],...front([radial(x+side*.012,radius*.20,a),radial(x+side*.012,radius*.20,b)]),[.74,.78,.84]);
    }
    for(let i=0;i<spokes;i++){
      const a=i/spokes*Math.PI*2;
      quad(alloy,...front([radial(x,radius*.15,a-.24),radial(x,radius*.62,a-.09),radial(x,radius*.62,a+.09),radial(x,radius*.15,a+.24)]));
      const bolt=radial(x+side*.014,radius*.12,a);for(let j=0;j<6;j++){const b=j/6*Math.PI*2,c=(j+1)/6*Math.PI*2;triangle(alloy,bolt,...front([[bolt[0],bolt[1]+Math.cos(b)*radius*.025,bolt[2]+Math.sin(b)*radius*.025],[bolt[0],bolt[1]+Math.cos(c)*radius*.025,bolt[2]+Math.sin(c)*radius*.025]]),[.25,.28,.32]);}
    }
  }
  return {tire,alloy};
}
export function buildVehicleVisual(classId='sport',options={}){
  choice(classId,Object.keys(VEHICLES),'vehicle class');record(options,['paint','profile'],'vehicle visual',true);const paint=vec(options.paint??[.10,.60,.65],3,0,1,'paint'),profile=choice(options.profile??'high',Object.keys(SCENIC_PROFILES),'profile'),d={...VEHICLES[classId]},parts=[];
  const part=(id,group,vertices,mat,wheel=null)=>parts.push({id,group,vertices:new Float32Array(vertices),material:mat,wheel});
  const body=[],glass=[],trim=[],lamp=[],brake=[],l=d.length,w=d.width/2,high=profile==='high',sport=classId==='sport',utility=classId==='utility',deck=utility?.98:classId==='touring'?.89:.77;
  const shape=[[-1,.82,.28,deck*.73,.10],[-.93,.91,.27,deck*.77,.12],[-.72,.99,.27,deck*.95,.095],[-.45,1,.28,deck+.015,.075],[-.13,.95,.29,deck+.02,.09],[.2,.96,.29,deck+.02,.09],[.58,1,.30,deck+.015,.09],[.84,.96,.32,deck*.95,.10],[1,.87,.34,deck*.85,.09]];
  const widthAt=z=>w*sectionValue(shape,z/(l/2),1),beltAt=z=>sectionValue(shape,z/(l/2),3),crownAt=z=>sectionValue(shape,z/(l/2),4);
  const bottomAt=z=>{let y=sectionValue(shape,z/(l/2),2);for(const axle of [-d.wheelbase/2,d.wheelbase/2]){const dz=z-axle,r=d.wheelRadius+.065;if(Math.abs(dz)<r)y=Math.max(y,d.wheelRadius+Math.sqrt(Math.max(0,r*r-dz*dz)));}return y;};
  const top=(u,v)=>{const z=(v-.5)*l,a=(u-.5)*Math.PI;return [Math.sin(a)*widthAt(z),beltAt(z)+Math.cos(a)*crownAt(z)+Math.max(0,bottomAt(z)+.055-beltAt(z))*Math.sin(a)**6,z];};
  surface(body,top,high?16:12,high?40:28,[0,1,0]);
  // Real open wheel arches: the lower boundary follows the four tyre clearances.
  for(const side of [-1,1]){
    const sidePanel=(u,v)=>{const z=(v-.5)*l,bottom=bottomAt(z),belt=Math.max(beltAt(z),bottom+.055);return [side*widthAt(z)*(.965+.035*Math.sin(u*Math.PI/2)),lerp(bottom,belt,u),z];};
    surface(body,sidePanel,3,high?72:48,[side,0,0]);
    for(const axle of [-d.wheelbase/2,d.wheelbase/2]){
      const arch=[];for(let i=0;i<=24;i++){const a=i/24*Math.PI,z=axle-Math.cos(a)*(d.wheelRadius+.065);arch.push([side*widthAt(z)*.967,d.wheelRadius+Math.sin(a)*(d.wheelRadius+.065),z]);}line(body,arch,.018,[.92,.95,.97],4);
    }
  }
  // Flat cap normals are intentional fascia creases, not approximated collision surfaces.
  for(const [v,reverse] of [[0,true],[1,false]]){
    const z=(v-.5)*l,ring=[[-widthAt(z)*.965,bottomAt(z),z]];for(let i=0;i<=28;i++)ring.push(top(i/28,v));ring.push([widthAt(z)*.965,bottomAt(z),z]);const center=[0,(bottomAt(z)+beltAt(z))*.5,z];
    for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];triangle(body,center,...(reverse?[a,b]:[b,a]));}
  }
  const cabinFront=sport?-.69:utility?-1.12:-1.0,cabinBack=sport?1.39:utility?1.70:1.58,roofFront=sport?-.13:utility?-.71:-.45,roofBack=sport?.61:utility?1.14:.88,cw=w*(utility?.83:.78),rw=w*(utility?.74:.64),baseY=deck+.07;
  const roof=(u,v)=>[(u*2-1)*rw,d.height-.065*(2*u-1)**2-.025*(2*v-1)**2,lerp(roofFront,roofBack,v)];
  surface(body,roof,high?12:10,high?8:6,[0,1,0]);
  const wind=(u,v)=>{const x=(2*u-1)*lerp(cw,rw,v),y=lerp(baseY,roof(u,0)[1],v),z=lerp(cabinFront,roofFront,v)-.07*Math.sin(Math.PI*u)*Math.sin(Math.PI*v);return [x,y,z];};
  const rear=(u,v)=>[(2*u-1)*lerp(cw,rw,v),lerp(baseY,roof(u,1)[1],v),lerp(cabinBack,roofBack,v)+.055*Math.sin(Math.PI*u)*Math.sin(Math.PI*v)];
  surface(glass,wind,high?12:10,high?6:4,[0,0,-1]);surface(glass,rear,high?12:10,high?6:4,[0,0,1]);
  for(const side of [-1,1]){
    const sideWindow=(u,v)=>[side*(lerp(cw,rw,v)+.018*Math.sin(Math.PI*u)*Math.sin(Math.PI*v)),lerp(baseY,lerp(roof(side<0?0:1,0)[1],roof(side<0?0:1,1)[1],u),v),lerp(lerp(cabinFront,cabinBack,u),lerp(roofFront,roofBack,u),v)];
    surface(glass,sideWindow,high?10:8,4,[side,0,0]);
    const seal=(fn,where)=>Array.from({length:13},(_,i)=>fn(where===null?i/12:where,where===null?0:i/12));
    line(trim,seal(sideWindow,null),.014);line(body,seal(sideWindow,0),.027);line(body,seal(sideWindow,1),.035);line(body,Array.from({length:13},(_,i)=>sideWindow(i/12,1)),.026);
    if(!sport)line(trim,[sideWindow(.56,0),sideWindow(.56,1)],.022);
    const seamZ=sport?.65:.78,seam=[];for(let i=0;i<=12;i++){const z=lerp(cabinFront+.08,seamZ,i/12);seam.push([side*widthAt(z)*.985,.42,z]);}line(trim,seam,.007,[.65,.68,.7],4);
    line(trim,[[side*widthAt(seamZ)*.985,.42,seamZ],[side*widthAt(seamZ)*.997,deck-.06,seamZ]],.007,[.65,.68,.7],4);
    pipe(trim,[side*widthAt(seamZ)*1.004,deck-.10,seamZ-.23],[side*widthAt(seamZ)*1.004,deck-.10,seamZ-.07],.014,[.6,.63,.68]);
    // A compact curved mirror shell and a separate retained dark stalk.
    const mirror=[side*w*1.035,deck+.18,cabinFront+.18];pipe(trim,[side*cw,deck+.12,cabinFront+.12],mirror,.025);
    const mirrorFn=(u,v)=>{const angle=u*Math.PI*2,lat=(v-.5)*Math.PI*.94;return [mirror[0]+.10*Math.cos(lat)*Math.cos(angle),mirror[1]+.065*Math.sin(lat),mirror[2]+.15*Math.cos(lat)*Math.sin(angle)];};
    // Each half uses a stable outward orientation; small mirrored shells are faceted trim.
    const mirrorSteps=high?10:8;for(let i=0;i<mirrorSteps;i++)for(let j=0;j<4;j++){const a=mirrorFn(i/mirrorSteps,j/4),b=mirrorFn((i+1)/mirrorSteps,j/4),c=mirrorFn((i+1)/mirrorSteps,(j+1)/4),e=mirrorFn(i/mirrorSteps,(j+1)/4);quad(body,a,e,c,b);}
    const x0=side*w*.34,x1=side*w*.79,z=-l/2-.014,lo=deck*.76,hi=lo+.105;
    const polygon=[[x0,lo,z],[x1,lo+.025,z],[x1,hi-.015,z],[x0,hi,z]],housing=polygon.map(p=>[p[0]+side*.025,p[1]+(p[1]>(lo+hi)/2?.018:-.018),p[2]+.004]);
    const outward=points=>side<0?points:points.reverse();quad(trim,...outward(housing));quad(lamp,...outward(polygon));
    for(const y of [deck*.85,deck*.85+.065]){const rearLamp=[[x0,y,l/2+.014],[x0,y+.025,l/2+.014],[x1,y+.025,l/2+.014],[x1,y,l/2+.014]];quad(brake,...outward(rearLamp));}
  }
  // The front intake, splitter and rear diffuser are curved ribbons with planar fascia detail.
  for(const [z,face] of [[-l/2-.018,-1],[l/2+.018,1]]){
    const grille=[[-w*.48,.36,z],[w*.48,.36,z],[w*.43,.53,z],[-w*.43,.53,z]];quad(trim,...(face<0?grille.reverse():grille));
    for(let i=-3;i<=3;i++)pipe(trim,[i*w*.12,.37,z+face*.006],[i*w*.11,.51,z+face*.006],.008,[.42,.45,.49],4);
    const splitter=[];for(let i=0;i<=20;i++){const x=(i/20*2-1)*w*.86;splitter.push([x,.30+.035*(x/w)**2,z-face*.035*(x/w)**2]);}line(trim,splitter,.025,[.65,.68,.7]);
  }
  if(sport){const lip=[];for(let i=0;i<=20;i++){const x=(i/20*2-1)*w*.81;lip.push([x,deck+.12-.045*(x/w)**2,l*.42]);}line(body,lip,.033);}
  if(utility)for(const side of [-1,1])line(trim,[[side*rw,d.height+.035,roofFront-.02],[side*rw,d.height+.055,roofFront+.20],[side*rw,d.height+.055,roofBack-.12],[side*rw,d.height+.035,roofBack+.08]],.025);
  part('body','body',body,material(paint,.21,'none',{metalness:.68}));part('windows','glass',glass,material([.085,.16,.21],.07,'glass',{opacity:.94,metalness:.28}));part('trim','trim',trim,material([.045,.055,.065],.42,'none',{metalness:.45}));part('headlights','lamp',lamp,material([.93,.97,1],.18,'none',{emission:.55}));part('tail-lights','brake',brake,material([.72,.025,.018],.22,'none',{emission:.06}));
  const wheels=[];for(const [index,[side,front]] of [[-1,true],[1,true],[-1,false],[1,false]].entries()){
    const id=(front?'front':'rear')+(side<0?'-left':'-right'),wheel={id,index,front,position:[side*d.track/2,d.wheelRadius,(front?-1:1)*d.wheelbase/2],radius:d.wheelRadius,width:sport?.28:.25};wheels.push(wheel);const geometry=wheelGeometry(wheel.radius,wheel.width,SCENIC_PROFILES[profile].wheelSegments,sport?5:utility?6:7);
    part(id+'-tire','wheel',geometry.tire,material([.035,.041,.047],.88),index);part(id+'-alloy','wheel',geometry.alloy,material([.72,.76,.81],.19,'none',{metalness:.85}),index);
  }
  const all=[];for(const part of parts){const offset=part.wheel===null?[0,0,0]:wheels[part.wheel].position;for(let i=0;i<part.vertices.length;i+=11)all.push(part.vertices[i]+offset[0],part.vertices[i+1]+offset[1],part.vertices[i+2]+offset[2],...part.vertices.slice(i+3,i+11));frozen(part.material);Object.freeze(part);}Object.freeze(parts);
  const vertices=parts.reduce((s,p)=>s+p.vertices.length/11,0);if(vertices>(high?48000:28000))throw new RangeError('vehicle visual vertex budget');
  const visual=Object.freeze({classId,profile,dimensions:frozen(d),parts,wheels:frozen(wheels),stats:frozen({vertices,parts:parts.length}),bounds:frozen(boundsOf(all))});vehicleInfo.set(visual,true);return visual;
}
export function vehicleDraws(visual,pose={}){
  if(!vehicleInfo.has(visual))throw new TypeError('vehicleDraws requires a generated visual');
  record(pose,['position','yaw','pitch','roll','wheelSpin','steer','compression','brake'],'vehicle pose',true);
  const position=vec(pose.position??[0,0,0],3,-2000,2000,'vehicle position'),yaw=num(pose.yaw??0,-Math.PI*4,Math.PI*4,'yaw'),pitch=num(pose.pitch??0,-Math.PI,Math.PI,'pitch'),roll=num(pose.roll??0,-Math.PI,Math.PI,'roll'),spin=num(pose.wheelSpin??0,-1000000,1000000,'wheel spin'),steer=num(pose.steer??0,-.65,.65,'steer'),compression=vec(pose.compression??[0,0,0,0],4,0,.25,'compression'),brake=num(pose.brake??0,0,1,'brake'),root=matrix(position,yaw,pitch,roll);
  const wheelMatrices=visual.wheels.map(w=>multiplyMatrices(root,multiplyMatrices(matrix(add(w.position,[0,compression[w.index],0]),w.front?steer:0),matrix([0,0,0],0,spin))));
  return visual.parts.map(part=>({part,matrix:part.wheel===null?root:wheelMatrices[part.wheel],material:part.group==='brake'?{...part.material,emission:.06+brake*2}:part.material}));
}
export function createRoadShadow(road,options={}){
  if(!(road instanceof ScenicRoad))throw new TypeError('ScenicRoad required');record(options,['distance','lateral','width','length','offset'],'road shadow',true);
  const distance=num(options.distance,0,road.length,'shadow distance'),lateral=num(options.lateral??0,-6,6,'shadow offset'),width=num(options.width??3,.2,5,'shadow width'),length=num(options.length??5,.2,10,'shadow length'),offset=num(options.offset??.025,.005,.1,'shadow lift');if(distance<length/2||distance>road.length-length/2)throw new RangeError('shadow extends beyond road');
  const out=[];for(let i=0;i<4;i++)for(let j=0;j<2;j++){
    const p=(u,v)=>{const s=road.sample(distance+(u-.5)*length,lateral+(v-.5)*width);return add(s.position,scale(s.normal,offset));};const u=i/4,v=j/2,U=(i+1)/4,V=(j+1)/2;quad(out,p(u,v),p(u,V),p(U,V),p(U,v),[1,1,1],[[v,u],[V,u],[V,U],[v,U]]);
  }return new Float32Array(out);
}
