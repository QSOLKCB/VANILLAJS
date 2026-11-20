// SPDX-License-Identifier: Apache-2.0
// PROJECTION25D-001 — original bounded OBJ geometry-only offline converter.
// No filesystem, MTL lookup or browser dependencies in this pure parsing function.
export const LIT_MESH_FORMAT='qsol.vanillajs.lit-mesh.v1';
const MAX_BYTES=512*1024,MAX_POSITIONS=8192,MAX_FACES=4096,MAX_RENDER_VERTICES=24576;
const num=(text,label)=>{const n=Number(text);if(!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(text)||!Number.isFinite(n)||Math.abs(n)>10000)throw RangeError(label+' must be finite and bounded');return n;};
const f32=(n,label)=>{const v=Math.fround(n);if(!Number.isFinite(v)||Math.abs(v)>10000)throw RangeError(label+' out of Float32 bounds');return v;};
function index(token,length,label){
  if(!/^-?[1-9]\d*$/.test(token))throw TypeError(label+' index invalid');
  const n=Number(token);if(!Number.isSafeInteger(n))throw RangeError(label+' index unsafe');
  const i=n>0?n-1:length+n;if(i<0||i>=length)throw RangeError(label+' index outside prior definitions');return i;
}
function vertexReference(token,positions,uvs,normals){
  const m=/^(-?[1-9]\d*)(?:\/(-?[1-9]\d*)?(?:\/(-?[1-9]\d*))?)?$/.exec(token);
  if(!m)throw TypeError('invalid OBJ face reference');
  const v=index(m[1],positions.length,'position');
  const uv=m[2]===undefined?null:index(m[2],uvs.length,'texture');
  if(m[3]!==undefined)index(m[3],normals.length,'normal');
  return {position:positions[v],uv:uv===null?[0,0]:uvs[uv]};
}
/** Convert a strict, bounded triangle/quad OBJ into lit renderer XYZ/normal/RGB/UV.
 * Geometry-only: OBJ normals are validated but independently recomputed flat;
 * MTL textures and external material files are intentionally never loaded.
 */
export function convertObjToLitMesh(text,{scale=1}={}){
  if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>MAX_BYTES)throw RangeError('OBJ exceeds 512 KiB text budget');
  if(typeof scale!=='number'||!Number.isFinite(scale)||scale<.001||scale>100)throw RangeError('scale must be 0.001..100');
  const positions=[],uvs=[],normals=[],packed=[];
  let faces=0,triangles=0;
  const lines=text.replace(/\r\n?/g,'\n').split('\n');
  if(lines.length>16000)throw RangeError('OBJ line budget exceeded');
  const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  function triangle(refs){
    if(packed.length/11+3>MAX_RENDER_VERTICES)throw RangeError('render vertex budget exceeded');
    const points=refs.map(r=>r.position.map(v=>f32(v*scale,'position')));
    const [a,b,c]=points;
    const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);
    const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const len=Math.hypot(...cross);if(!Number.isFinite(len)||len<1e-8)throw RangeError('degenerate or collapsed OBJ triangle');
    const normal=cross.map(v=>f32(v/len,'normal'));
    for(let i=0;i<3;i++){
      for(let k=0;k<3;k++){bounds.min[k]=Math.min(bounds.min[k],points[i][k]);bounds.max[k]=Math.max(bounds.max[k],points[i][k]);}
      packed.push(...points[i],...normal,1,1,1,f32(refs[i].uv[0],'U'),f32(refs[i].uv[1],'V'));
    }
    triangles++;
  }
  for(let li=0;li<lines.length;li++){
    const line=lines[li].split('#',1)[0].trim();if(!line)continue;
    const words=line.split(/\s+/),op=words.shift();
    switch(op){
      case 'v':
        if(words.length!==3||positions.length>=MAX_POSITIONS)throw RangeError('position must be XYZ within budget');
        positions.push(words.map(w=>num(w,'position')));break;
      case 'vt':
        if((words.length!==2&&words.length!==3)||uvs.length>=MAX_POSITIONS)throw RangeError('texture coordinates invalid');
        uvs.push(words.map(w=>num(w,'texture')).slice(0,2));break;
      case 'vn':
        if(words.length!==3||normals.length>=MAX_POSITIONS)throw RangeError('normal invalid');
        normals.push(words.map(w=>num(w,'normal')));break;
      case 'f':{
        if((words.length!==3&&words.length!==4)||faces++>=MAX_FACES)throw RangeError('only bounded triangles and quads are supported');
        const refs=words.map(w=>vertexReference(w,positions,uvs,normals));
        if(refs.length===4){
          const p=refs.map(r=>r.position),cross=(a,b,c)=>{
            const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);
            return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
          };
          const n0=cross(p[0],p[1],p[2]),n1=cross(p[0],p[2],p[3]);
          if(n0.reduce((sum,v,i)=>sum+v*n1[i],0)<=0)throw RangeError('concave or self-crossing quad');
        }
        triangle([refs[0],refs[1],refs[2]]);
        if(refs.length===4)triangle([refs[0],refs[2],refs[3]]);
        break;
      }
      case 'o':case 'g':case 's':case 'usemtl':case 'mtllib':
        // Metadata/material references are ignored, not resolved or bundled.
        if(!words.length)throw TypeError(op+' must have a value');break;
      default:throw TypeError('unsupported OBJ directive on line '+(li+1)+': '+op);
    }
  }
  if(!triangles)throw RangeError('OBJ has no triangles');
  return {format:LIT_MESH_FORMAT,version:1,stride:11,layout:'xyz-normal-rgb-uv',
    vertices:packed,bounds,stats:{sourceVertices:positions.length,sourceFaces:faces,triangles,renderVertices:packed.length/11}};
}
