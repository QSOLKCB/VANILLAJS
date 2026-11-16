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
function cone(out,center,radius,height,color,segments=8){
  for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;const p=[center[0]+Math.cos(a)*radius,center[1],center[2]+Math.sin(a)*radius],q=[center[0]+Math.cos(b)*radius,center[1],center[2]+Math.sin(b)*radius];triangle(out,p,[center[0],center[1]+height,center[2]],q,color);triangle(out,p,q,center,color);}
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
    const a=rows[i],b=rows[i+1];for(const [triangle,points,uv] of [[0,[a.left,a.right,b.left],[[0,a.distance/6],[1,a.distance/6],[0,b.distance/6]]],[1,[a.right,b.right,b.left],[[1,a.distance/6],[1,b.distance/6],[0,b.distance/6]]]]){
      const normal=triangleNormal(...points);if(normal[1]<.15)throw new RangeError('road folds or exceeds supported slope');
      triangles.push({surfaceId:a.surfaceId,surface:a.surface,structure:a.structure,segment:a.segment,strip:i,triangle,points,normal,uv});
    }
  }return triangles;
}
function sampleResult(points,normal,tangent,weights,fields){
  const position=[0,1,2].map(k=>points.reduce((s,p,i)=>s+p[k]*weights[i],0)),forward=unit(sub(tangent,scale(normal,dot(tangent,normal)))),right=unit(cross(forward,normal));
  return {...fields,position,normal:[...normal],yaw:Math.atan2(-forward[0],-forward[2]),pitch:Math.asin(Math.max(-1,Math.min(1,forward[1]))),roll:Math.atan2(right[1],normal[1])};
}
export function validateScenery(value){const result=admit(value);roadTriangles(roadRows(result));return frozen(result);}
export function parseScenery(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>SCENIC_BYTES)throw new RangeError('scenery import byte budget');return validateScenery(JSON.parse(text));}
export function serializeScenery(value){return JSON.stringify(validateScenery(value));}
export function starterScenery(){
  const xyz=[[0,4,0],[0,5,-35],[-12,8,-75],[-38,16,-112],[-42,24,-155],[-15,27,-195],[27,26,-230],[50,19,-270],[39,13,-315],[8,10,-355],[-20,14,-395],[-8,21,-435],[27,28,-475]];
  return validateScenery({format:SCENIC_FORMAT,version:1,name:'Cape Aster — the high road',seed:7331,profile:'high',environment:'coast',road:xyz.map(([x,y,z],i)=>({id:'span-'+i,x,y,z,width:i===0?10:9,bank:[0,.02,.08,.13,.09,-.05,-.12,-.1,.03,.09,.04,-.05,0][i],structure:i===4||i===5?'bridge':i===8||i===9?'tunnel':'ground',surface:'asphalt'}))});
}
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
    const a=this.#rows[i],b=this.#rows[i+1],u=(distance-a.distance)/(b.distance-a.distance),width=lerp(a.width,b.width,u);if(Math.abs(lateral)>width/2)throw new RangeError('offset outside road');const v=.5+lateral/width,first=u+v<=1,t=this.#triangles[i*2+(first?0:1)],weights=first?[1-u-v,v,u]:[1-u,u+v-1,1-v];
    return sampleResult(t.points,t.normal,sub(b.center,a.center),weights,{distance,lateral,surfaceId:t.surfaceId,surface:t.surface,structure:t.structure,segment:t.segment,triangle:t.triangle});
  }
  sampleAt(x,z,options={}){
    num(x,-2000,2000,'sample x');num(z,-2000,2000,'sample z');record(options,['surfaceId','maxY'],'road query',true);const maxY=num(options.maxY??2000,-2000,2000,'maximum query height');
    if(options.surfaceId!==undefined&&(typeof options.surfaceId!=='string'||!this.#recipe.road.slice(0,-1).some(p=>p.id===options.surfaceId)))throw new TypeError('unknown road surface ID');
    let hit=null;for(const t of this.#triangles){if(options.surfaceId!==undefined&&t.surfaceId!==options.surfaceId)continue;const [a,b,c]=t.points,den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);const wa=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,wb=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,wc=1-wa-wb;if(Math.min(wa,wb,wc)<-1e-8)continue;
      const rows=this.#rows,hitData=sampleResult(t.points,t.normal,sub(rows[t.strip+1].center,rows[t.strip].center),[wa,wb,wc],{surfaceId:t.surfaceId,surface:t.surface,structure:t.structure,segment:t.segment,triangle:t.triangle});if(hitData.position[1]<=maxY+1e-7&&(!hit||hitData.position[1]>hit.position[1]))hit=hitData;
    }return hit;
  }
}
function sceneMaterials(environment){const dusk=environment==='dusk',alpine=environment==='alpine';return {
  terrain:material(alpine?[.35,.43,.37]:[.30,.42,.24],.95,'grass',{patternScale:.6}),asphalt:material([.19,.22,.24],.82,'asphalt',{patternScale:4}),gravel:material([.56,.48,.36],.98,'stone',{patternScale:2}),
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
      const p=edge(a),q=edge(b),r=outer(b),s=outer(a);quad(batch('terrain'),...(side<0?[p,s,r,q]:[p,q,r,s]),[1,1,1]);
    }
    if(a.structure==='bridge'){
      const middle=point(a.center,b.center,.5),length=Math.hypot(...sub(b.center,a.center)),yaw=Math.atan2(-(b.center[0]-a.center[0]),-(b.center[2]-a.center[2])),pitch=Math.atan2(b.center[1]-a.center[1],Math.hypot(b.center[0]-a.center[0],b.center[2]-a.center[2]));box(batch('stone'),[middle[0],middle[1]-.55,middle[2]],[a.width+.9,.9,length+.25],[1,1,1],yaw,a.bank,pitch);
      for(const side of [-1,1]){const edge=point(side<0?a.left:a.right,side<0?b.left:b.right,.5);box(batch('metal'),[edge[0],edge[1]+.8,edge[2]],[.12,.14,length+.15],[1,1,1],yaw,a.bank,pitch);}
      if(i%4===0)for(const side of [-1,1]){const p=side<0?a.left:a.right,h=terrain.sample(p[0],p[2]).height,high=Math.max(.2,p[1]-h);box(batch('stone'),[p[0],h+high/2,p[2]],[1.0,high,1.4]);}
    }
    if(a.structure==='tunnel'){
      const segments=recipe.profile==='high'?12:8;
      const arch=(row,t,shell)=>{const angle=Math.PI*t;const offset=(row.width/2+.8+shell*.45)*Math.cos(angle),height=.5+(5.4+shell*.4)*Math.sin(angle),right=unit(sub(row.right,row.left));return add(row.center,add(scale(right,offset),[0,height,0]));};
      for(let k=0;k<segments;k++){const t=k/segments,u=(k+1)/segments;quad(batch('stone'),arch(a,t,0),arch(a,u,0),arch(b,u,0),arch(b,t,0));quad(batch('stone'),arch(a,t,1),arch(b,t,1),arch(b,u,1),arch(a,u,1));
        if(i===0||rows[i-1].structure!=='tunnel')quad(batch('stone'),arch(a,t,0),arch(a,t,1),arch(a,u,1),arch(a,u,0));
        if(i===rows.length-2||b.structure!=='tunnel')quad(batch('stone'),arch(b,t,0),arch(b,u,0),arch(b,u,1),arch(b,t,1));}
      if(i%4===0){const p=add(a.center,[0,4.7,0]);box(batch('markings'),p,[.5,.08,.4],[1,.83,.5]);}
    }
  }
  if(recipe.environment==='coast')quad(batch('water'),[originX,-9,originZ],[originX,-9,originZ+size],[originX+size,-9,originZ+size],[originX+size,-9,originZ],[1,1,1],[[0,0],[0,20],[20,20],[20,0]]);
  let treeCount=0;for(let n=0;n<profile.trees;n++){
    const sample=road.sample(road.length*(.02+random()*.96)),side=random()<.5?-1:1,offset=side*(15+random()*80),x=sample.position[0]+Math.cos(sample.yaw)*offset,z=sample.position[2]-Math.sin(sample.yaw)*offset;if(x<originX||x>originX+size||z<originZ||z>originZ+size)continue;const h=terrain.sample(x,z).height;if(h< -6)continue;treeCount++;
    const height=5+random()*8,r=1.8+random()*1.7;box(batch('trunk'),[x,h+height*.35,z],[.5,height*.7,.5]);for(let k=0;k<3;k++)cone(batch('foliage'),[x,h+height*(.24+k*.2),z],r*(1-k*.2),height*.48,[.75+random()*.25,.85+random()*.15,.8],recipe.profile==='high'?9:6);
  }
  for(const ratio of [.025,.18,.72,.94]){
    const s=road.sample(road.length*ratio),x=s.position[0]+Math.cos(s.yaw)*21,z=s.position[2]-Math.sin(s.yaw)*21,h=terrain.sample(x,z).height;box(batch('building'),[x,h+2,z],[7,4,5]);
    const a=[x-4,h+4,z-3],b=[x+4,h+4,z-3],c=[x+4,h+4,z+3],d=[x-4,h+4,z+3],p=[x,h+6,z-3],q=[x,h+6,z+3];quad(batch('roof'),a,p,q,d);quad(batch('roof'),p,b,c,q);triangle(batch('roof'),a,b,p);triangle(batch('roof'),d,q,c);
    for(const dx of [-2,2])quad(batch('glass'),[x+dx-.6,h+1.4,z-2.51],[x+dx+.6,h+1.4,z-2.51],[x+dx+.6,h+2.7,z-2.51],[x+dx-.6,h+2.7,z-2.51]);
  }
  const batches=[...data].filter(([,v])=>v.length).map(([id,v])=>({id,material:materials[id],vertices:new Float32Array(v)}));const vertices=batches.reduce((sum,b)=>sum+b.vertices.length/11,0);if(vertices>profile.maxVertices)throw new RangeError('scenery vertex budget');
  const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(const batch of batches){const b=boundsOf(batch.vertices);for(let k=0;k<3;k++){bounds.min[k]=Math.min(bounds.min[k],b.min[k]);bounds.max[k]=Math.max(bounds.max[k],b.max[k]);}}
  return {recipe,batches,road,terrain,bounds,stats:{vertices,batches:batches.length,roadTriangles:road.triangles().length,terrainCells:cells*cells,trees:treeCount}};
}
const vehicleInfo=new WeakMap();
const VEHICLES=Object.freeze({sport:{length:4.4,width:1.95,height:1.25,wheelbase:2.62,track:1.76,wheelRadius:.34},touring:{length:4.9,width:1.88,height:1.52,wheelbase:2.85,track:1.68,wheelRadius:.35},utility:{length:4.7,width:2.08,height:1.86,wheelbase:2.72,track:1.84,wheelRadius:.42}});
function loft(out,sections,color=[1,1,1]){
  const rings=sections.map(s=>{const [z,w,bottom,top]=s;return [[-w*.84,bottom,z],[w*.84,bottom,z],[w,bottom+.16,z],[w,top-.12,z],[w*.82,top,z],[-w*.82,top,z],[-w,top-.12,z],[-w,bottom+.16,z]];});
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<8;i++){const n=(i+1)%8;quad(out,rings[j][i],rings[j][n],rings[j+1][n],rings[j+1][i],color);}
  for(const [ring,reverse] of [[rings[0],true],[rings.at(-1),false]]){const center=scale(ring.reduce((s,p)=>add(s,p),[0,0,0]),1/8);for(let i=0;i<8;i++){const a=ring[i],b=ring[(i+1)%8];triangle(out,center,...(reverse?[b,a]:[a,b]),color);}}
}
function wheelGeometry(radius,width,segments){
  const tire=[],alloy=[];for(let i=0;i<segments;i++){
    const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2,p=(x,r,t)=>[x,Math.cos(t)*r,Math.sin(t)*r];
    quad(tire,p(-width/2,radius,a),p(-width/2,radius,b),p(width/2,radius,b),p(width/2,radius,a),i%3===0?[.78,.78,.78]:[1,1,1]);
    for(const side of [-1,1]){
      const x=side*width/2,points=[p(x,radius,a),p(x,radius,b),p(x,radius*.58,b),p(x,radius*.58,a)];quad(tire,...(side>0?points:points.reverse()));
      const hub=[x+side*.004,0,0],u=p(x+side*.004,radius*.57,a),v=p(x+side*.004,radius*.57,b);triangle(alloy,hub,...(side>0?[u,v]:[v,u]),i%4<2?[.82,.85,.9]:[.18,.21,.24]);
    }
  }return {tire,alloy};
}
export function buildVehicleVisual(classId='sport',options={}){
  choice(classId,Object.keys(VEHICLES),'vehicle class');record(options,['paint','profile'],'vehicle visual',true);const paint=vec(options.paint??[.10,.60,.65],3,0,1,'paint'),profile=choice(options.profile??'high',Object.keys(SCENIC_PROFILES),'profile'),d={...VEHICLES[classId]},parts=[];
  const part=(id,group,vertices,mat,wheel=null)=>parts.push({id,group,vertices:new Float32Array(vertices),material:mat,wheel});
  const body=[],l=d.length,w=d.width/2,deck=classId==='utility'?.98:classId==='touring'?.89:.77;
  loft(body,[[-l/2,w*.72,.28,deck*.78],[-l*.42,w*.94,.27,deck],[-l*.17,w,.28,deck+.10],[l*.18,w,.28,deck+.10],[l*.43,w*.94,.3,deck],[l/2,w*.78,.34,deck*.88]]);
  const cabinFront=classId==='sport'?-l*.12:-l*.22,cabinBack=classId==='utility'?l*.38:l*.27,roofFront=classId==='sport'?-.22:-.45,roofBack=classId==='sport'?.65:classId==='touring'?.83:1.12,cw=w*.78,rw=w*.64;
  const glass=[];const frontLeft=[-cw,deck+.07,cabinFront],frontRight=[cw,deck+.07,cabinFront],roofFL=[-rw,d.height,roofFront],roofFR=[rw,d.height,roofFront],roofBL=[-rw,d.height,roofBack],roofBR=[rw,d.height,roofBack],backLeft=[-cw,deck+.05,cabinBack],backRight=[cw,deck+.05,cabinBack];
  quad(glass,frontLeft,roofFL,roofFR,frontRight);quad(glass,roofBL,backLeft,backRight,roofBR);quad(glass,frontLeft,backLeft,roofBL,roofFL);quad(glass,frontRight,roofFR,roofBR,backRight);quad(body,roofFL,roofBL,roofBR,roofFR);
  const trim=[],lamp=[],brake=[];for(const side of [-1,1]){
    box(trim,[side*w*.99,deck*.73,.14],[.022,.018,l*.38]);box(trim,[side*w*.99,.48,.35],[.024,.32,.025]);box(trim,[side*cw,deck+.19,cabinBack-.12],[.025,.24,.035]);box(trim,[side*w*1.04,deck+.18,cabinFront+.25],[.22,.12,.32]);box(body,[side*w*.42,deck+.023,-l*.33],[.035,.02,l*.2]);
    const x0=side*w*.45,x1=side*w*.8,front=[[x0,.53,-l/2-.012],[x1,.54,-l/2-.012],[x1,.68,-l/2-.012],[x0,.66,-l/2-.012]],rear=[[x0,.58,l/2+.012],[x0,.73,l/2+.012],[x1,.73,l/2+.012],[x1,.58,l/2+.012]];quad(lamp,...(side<0?front:front.reverse()));quad(brake,...(side<0?rear:rear.reverse()));
  }
  box(trim,[0,.35,-l/2+.06],[d.width*.75,.13,.2]);box(trim,[0,.41,l/2-.02],[d.width*.82,.16,.18]);box(trim,[0,.52,-l/2-.018],[d.width*.34,.19,.03]);
  if(classId==='sport'){for(const x of [-w*.66,w*.66])box(trim,[x,deck+.16,l*.4],[.06,.32,.12]);box(body,[0,deck+.32,l*.4],[d.width*.97,.07,.34]);}
  if(classId==='utility')for(const x of [-rw,rw])box(trim,[x,d.height+.06,(roofFront+roofBack)/2],[.045,.12,roofBack-roofFront+.25]);
  part('body','body',body,material(paint,.23,'none',{metalness:.65}));part('windows','glass',glass,material([.18,.32,.40],.08,'glass',{opacity:.75,metalness:.35}));part('trim','trim',trim,material([.055,.07,.08],.48,'none',{metalness:.35}));part('headlights','lamp',lamp,material([1,.93,.70],.2,'none',{emission:.7}));part('tail-lights','brake',brake,material([.72,.025,.018],.22,'none',{emission:.06}));
  const wheels=[];for(const [index,[side,front]] of [[-1,true],[1,true],[-1,false],[1,false]].entries()){
    const id=(front?'front':'rear')+(side<0?'-left':'-right'),wheel={id,index,front,position:[side*d.track/2,d.wheelRadius,(front?-1:1)*d.wheelbase/2],radius:d.wheelRadius,width:classId==='sport'?.28:.25};wheels.push(wheel);const geometry=wheelGeometry(wheel.radius,wheel.width,SCENIC_PROFILES[profile].wheelSegments);
    part(id+'-tire','wheel',geometry.tire,material([.045,.052,.058],.94),index);part(id+'-alloy','wheel',geometry.alloy,material([.72,.76,.81],.19,'none',{metalness:.85}),index);
  }
  const all=[];for(const part of parts){const offset=part.wheel===null?[0,0,0]:wheels[part.wheel].position;for(let i=0;i<part.vertices.length;i+=11)all.push(part.vertices[i]+offset[0],part.vertices[i+1]+offset[1],part.vertices[i+2]+offset[2],...part.vertices.slice(i+3,i+11));frozen(part.material);Object.freeze(part);}Object.freeze(parts);
  const visual=Object.freeze({classId,profile,dimensions:frozen(d),parts,wheels:frozen(wheels),stats:frozen({vertices:parts.reduce((s,p)=>s+p.vertices.length/11,0),parts:parts.length}),bounds:frozen(boundsOf(all))});vehicleInfo.set(visual,true);return visual;
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
