// SPDX-License-Identifier: Apache-2.0
// Authored proving grounds and their renderer/contact adapter belong to this lab.
import {buildScenicWorld,validateScenery,SCENIC_FORMAT} from '../../modules/scenic3d/index.js';
import {createCapeAsterScenery} from './scenery.js';
const CELL=16;
const material=(color,pattern='none')=>({color,roughness:.9,metalness:0,opacity:1,emission:0,pattern,patternScale:2});
const surfaceIds=new Set(['asphalt','gravel','terrain']);
function normal(a,b,c){const u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n);return n.map(x=>x/length);}
function triangle(out,a,b,c,color=[1,1,1]){const n=normal(a,b,c);for(const p of [a,b,c])out.push(...p,...n,...color,p[0]/8,p[2]/8);}
function quad(out,a,b,c,d,color){triangle(out,a,b,c,color);triangle(out,a,c,d,color);}
function box(out,min,max,color){const p=[];for(let i=0;i<8;i++)p.push(min.map((x,k)=>(i>>k&1)?max[k]:x));for(const face of [[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]])quad(out,...face.map(i=>p[i]),color);}
export function createCourseScenery(course='pad',profile='high'){
  if(!['coast','pad','ramp'].includes(course))throw TypeError('Unknown proving course');
  if(course==='coast'){const scenery=structuredClone(createCapeAsterScenery());scenery.profile=profile;return validateScenery(scenery);}
  return validateScenery({format:SCENIC_FORMAT,version:1,name:course==='pad'?'Aster handling ground':'Aster jump reference',seed:7332,profile,environment:'alpine',road:[0,60,130,200].map((z,i)=>({id:'practice-'+i,x:0,y:4,z:-z||0,width:18,bank:0,structure:'ground',surface:'asphalt'}))});
}
// The sampler uses the exact same Float32 triangle vertices submitted for drawing,
// including the generated shoulder faces. Buildings, foliage, bridge masonry and
// tunnel shells remain decoration; only the contrasting orange boxes are solids.
export function createDriveWorld(scenery,surfaces={asphalt:1,gravel:.65,terrain:.45},course='coast'){
  if(!['coast','pad','ramp'].includes(course))throw TypeError('Unknown proving course');
  if(!surfaces||Object.keys(surfaces).length!==3||Object.keys(surfaces).some(k=>!surfaceIds.has(k))||Object.values(surfaces).some(x=>typeof x!=='number'||!Number.isFinite(x)||x<0||x>2))throw TypeError('Surface friction requires asphalt, gravel and terrain in 0..2');
  const grip={...surfaces},scenic=buildScenicWorld(scenery),batches=[...scenic.batches],barriers=[];
  if(course!=='coast'){
    // Keep the reference pad flat: remove optional decorative objects, and lower
    // every terrain face overlapping it. Contact sampling reads these altered
    // rendered vertices rather than the unmodified source Heightfield.
    for(let i=batches.length-1;i>=0;i--)if(['trunk','foliage','building','roof','glass','asphalt','gravel','markings'].includes(batches[i].id))batches.splice(i,1);
    const terrainIndex=batches.findIndex(batch=>batch.id==='terrain'),terrain=batches[terrainIndex],vertices=new Float32Array(terrain.vertices);
    for(let i=0;i<vertices.length;i+=33){
      const points=[0,11,22].map(j=>Array.from(vertices.slice(i+j,i+j+3)));
      if(Math.min(...points.map(p=>p[0]))>50||Math.max(...points.map(p=>p[0]))< -50||Math.min(...points.map(p=>p[2]))>20||Math.max(...points.map(p=>p[2]))< -210)continue;
      for(const point of points)point[1]=Math.fround(Math.min(point[1],3.8));const n=normal(...points);
      for(let j=0;j<3;j++){vertices.set(points[j],i+j*11);vertices.set(n,i+j*11+3);}
    }
    batches[terrainIndex]={...terrain,vertices};
    const pad=[];quad(pad,[-50,4,-210],[-50,4,20],[50,4,20],[50,4,-210]);
    batches.push({id:'handling-pad',vertices:new Float32Array(pad),material:material([.24,.28,.3],'asphalt')});
    const markings=[];
    for(let z=-200;z<=10;z+=10)quad(markings,[-.12,4.025,z-2],[-.12,4.025,z+2],[.12,4.025,z+2],[.12,4.025,z-2],[.9,.8,.5]);
    for(let x=-40;x<=40;x+=10)quad(markings,[x-.035,4.025,-210],[x-.035,4.025,20],[x+.035,4.025,20],[x+.035,4.025,-210],[.54,.61,.59]);
    batches.push({id:'pad-markings',vertices:new Float32Array(markings),material:material([1,1,1])});
    barriers.push({id:'pad-left',min:[-51,4,-212],max:[-50,5.4,22]},{id:'pad-right',min:[50,4,-212],max:[51,5.4,22]},{id:'pad-start',min:[-50,4,20],max:[50,5.4,21]},{id:'pad-end',min:[-50,4,-211],max:[50,5.4,-210]});
    if(course==='ramp'){
      const ramp=[];quad(ramp,[-7,12,-55],[-7,4,-20],[7,4,-20],[7,12,-55]);
      batches.push({id:'launch-ramp',vertices:new Float32Array(ramp),material:material([.55,.31,.14],'asphalt')});
      const rampSides=[];triangle(rampSides,[-7,4,-55],[-7,4,-20],[-7,12,-55]);triangle(rampSides,[7,4,-55],[7,12,-55],[7,4,-20]);quad(rampSides,[-7,4,-55],[-7,12,-55],[7,12,-55],[7,4,-55]);
      batches.push({id:'ramp-decoration',vertices:new Float32Array(rampSides),material:material([.22,.25,.25])});
    }
  }else{
    const start=scenic.road.sample(0),y=start.position[1];barriers.push({id:'coast-stop',min:[-5,y,4],max:[5,y+1.4,5]});
  }
  const solids=[];for(const barrier of barriers)box(solids,barrier.min,barrier.max,[1,.63,.2]);
  batches.push({id:'contact-barriers',vertices:new Float32Array(solids),material:material([.9,.42,.12])});
  const buckets=new Map();let triangleCount=0,steepFaces=0;
  for(const batch of batches){
    const surface=surfaceIds.has(batch.id)?batch.id:['handling-pad','launch-ramp'].includes(batch.id)?'asphalt':null;if(!surface)continue;
    const data=batch.vertices;
    for(let i=0;i<data.length;i+=33){
      const points=[0,11,22].map(j=>Array.from(data.slice(i+j,i+j+3))),[a,b,c]=points,n=normal(a,b,c);
      // Only upward support faces participate in the vertical suspension query.
      if(n[1]<.15){steepFaces++;continue;}
      const denominator=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
      const t={points,normal:n,denominator,surface,sequence:triangleCount++,id:batch.id+':'+i/33};
      const x0=Math.floor(Math.min(a[0],b[0],c[0])/CELL),x1=Math.floor(Math.max(a[0],b[0],c[0])/CELL),z0=Math.floor(Math.min(a[2],b[2],c[2])/CELL),z1=Math.floor(Math.max(a[2],b[2],c[2])/CELL);
      for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=x+','+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(t);}
    }
  }
  function sampleSurface(x,z,maxY){
    if(![x,z,maxY].every(Number.isFinite)||Math.abs(x)>2000||Math.abs(z)>2000||Math.abs(maxY)>2000)return null;
    const candidates=buckets.get(Math.floor(x/CELL)+','+Math.floor(z/CELL))??[];let hit=null;
    for(const t of candidates){
      const [a,b,c]=t.points,u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/t.denominator,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/t.denominator,w=1-u-v;if(Math.min(u,v,w)<-1e-8)continue;
      const height=u*a[1]+v*b[1]+w*c[1];if(height>maxY+1e-7||(hit&&height<=hit.height))continue;
      hit={height,normal:[...t.normal],friction:grip[t.surface],surfaceId:t.id};
    }return hit;
  }
  const spawn=scenic.road.sample(course==='coast'?12:8);
  return {scenic,batches,physics:{sampleSurface,barriers},spawn,course,stats:{supportTriangles:triangleCount,supportBuckets:buckets.size,unsupportedSteepFaces:steepFaces,barriers:barriers.length}};
}
