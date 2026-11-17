// SPDX-License-Identifier: Apache-2.0
// HORIZON-009: deterministic, presentation-only retained world tiles.
// No physics geometry, vertex values, materials, or shader data are modified.
const STRIDE=11,TRIANGLE=3*STRIDE;
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=v=>Math.hypot(v[0],v[1],v[2]);
/** Conservative world-space AABB/sphere for an untransformed retained mesh. */
export function raceBatchBounds(vertices){
  if(!(vertices instanceof Float32Array)||vertices.length===0||vertices.length%TRIANGLE)throw TypeError('Complete Float32 race triangles required');
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<vertices.length;i+=STRIDE)for(let k=0;k<3;k++){
    const n=vertices[i+k];if(!Number.isFinite(n))throw TypeError('Finite race vertices required');
    min[k]=Math.min(min[k],n);max[k]=Math.max(max[k],n);
  }
  const center=min.map((v,k)=>(v+max[k])/2),radius=Math.hypot(...max.map((v,k)=>(v-min[k])/2))+0.001;
  return {min,max,center,radius};
}
/** Stable row-major tile buckets, assigning complete source triangles by centroid.
 * All vertices remain bit-for-bit identical and every source triangle appears once.
 * Only the pre-existing opaque terrain/foliage batches are split.
 */
export function partitionRaceWorld(batches,divisions=4){
  if(!Array.isArray(batches)||!Number.isInteger(divisions)||divisions<1||divisions>6)throw RangeError('Bounded race tile grid required');
  const result=[];
  for(const batch of batches){
    if(!['terrain','foliage'].includes(batch.id)||batch.material.opacity!==1||batch.vertices.length===0){result.push(batch);continue;}
    const data=batch.vertices,bounds=raceBatchBounds(data),spanX=Math.max(1e-6,bounds.max[0]-bounds.min[0]),spanZ=Math.max(1e-6,bounds.max[2]-bounds.min[2]);
    const buckets=Array.from({length:divisions*divisions},()=>[]);
    for(let i=0;i<data.length;i+=TRIANGLE){
      const x=(data[i]+data[i+STRIDE]+data[i+2*STRIDE])/3,z=(data[i+2]+data[i+STRIDE+2]+data[i+2*STRIDE+2])/3;
      const ix=clamp(Math.floor((x-bounds.min[0])/spanX*divisions),0,divisions-1),iz=clamp(Math.floor((z-bounds.min[2])/spanZ*divisions),0,divisions-1);
      buckets[iz*divisions+ix].push(i);
    }
    for(let i=0;i<buckets.length;i++){
      const indices=buckets[i];if(!indices.length)continue;
      const vertices=new Float32Array(indices.length*TRIANGLE);
      for(let j=0;j<indices.length;j++)vertices.set(data.subarray(indices[j],indices[j]+TRIANGLE),j*TRIANGLE);
      result.push({...batch,id:batch.id+'-tile-'+Math.floor(i/divisions)+'-'+i%divisions,vertices,visibilityBounds:raceBatchBounds(vertices)});
    }
  }
  return result;
}
/** Fail-open conservative perspective frustum test. No row is excluded when
 * camera parameters are invalid; every tile is accepted on its bounding sphere.
 * Full near/far and four side planes use a radius-normal correction.
 */
export function raceTileVisible(bounds,camera,fov,aspect,near=.08,far=2000){
  if(!bounds||!camera||!Array.isArray(bounds.center)||bounds.center.length!==3||
    !Array.isArray(camera.position)||!Array.isArray(camera.target)||
    ![...camera.position,...camera.target,bounds.radius,...bounds.center,fov,aspect,near,far].every(Number.isFinite)||
    !(fov>0&&fov<Math.PI&&aspect>0&&near>0&&far>near&&bounds.radius>=0))return true;
  const eye=camera.position,forward=camera.target.map((v,k)=>v-eye[k]),n=length(forward);
  if(n<1e-8)return true;
  for(let k=0;k<3;k++)forward[k]/=n;
  let right=cross(forward,[0,1,0]),r=length(right);
  if(r<1e-8){right=cross(forward,[0,0,1]);r=length(right);if(r<1e-8)return true;}
  for(let k=0;k<3;k++)right[k]/=r;
  const up=cross(right,forward),offset=bounds.center.map((v,k)=>v-eye[k]),depth=dot(offset,forward),radius=bounds.radius;
  if(depth+radius<near||depth-radius>far)return false;
  const halfVertical=Math.tan(fov/2),halfHorizontal=halfVertical*aspect;
  // Signed distance from each perspective side plane to a bounding sphere.
  return Math.abs(dot(offset,right))<=depth*halfHorizontal+radius*Math.hypot(1,halfHorizontal)+.001&&
    Math.abs(dot(offset,up))<=depth*halfVertical+radius*Math.hypot(1,halfVertical)+.001;
}
