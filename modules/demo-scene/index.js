// SPDX-License-Identifier: Apache-2.0
import {sampleKeys,demoSample,smooth} from '../demo-timeline/index.js';
// Reusable absolute-time choreography and a bounded XYZ/RGB geometry writer.
// Metres, +Y up, -Z forward. Euler rotations are radians, X then Y then Z.
export const MAX_DEMO_VERTICES=100000;
const faces=[[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]],shades=[.7,.9,.58,1,.8,.65],tri=[0,1,2,0,2,3];
const edges=[[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
export function transformPoint(p,position,rotation,scale){
  let [x,y,z]=p.map((v,i)=>v*scale[i]);let c=Math.cos(rotation[0]),s=Math.sin(rotation[0]);[y,z]=[y*c-z*s,y*s+z*c];c=Math.cos(rotation[1]);s=Math.sin(rotation[1]);[x,z]=[x*c+z*s,-x*s+z*c];c=Math.cos(rotation[2]);s=Math.sin(rotation[2]);[x,y]=[x*c-y*s,x*s+y*c];return [x+position[0],y+position[1],z+position[2]];
}
export function effectInstances(effect,sample,{position=[0,0,0],rotation=[0,0,0],scale=[1,1,1],copies=1,color=[1,1,1],pulse=0}={}){
  demoSample(sample);if(!Number.isInteger(copies)||copies<1||copies>48)throw new RangeError('1..48 copies');
  if(!['rotate','lattice','radial','tunnel','extrude','dissolve'].includes(effect))throw new TypeError('unknown effect');
  const t=sample/48000,result=[];
  for(let i=0;i<copies;i++){const p=[...position],r=[...rotation],s=[...scale],a=i/copies*Math.PI*2;
    if(effect==='rotate'){r[0]+=.17*t;r[1]+=.29*t;r[2]+=.08*t;p[0]+=(i-(copies-1)/2)*2.5;}
    if(effect==='lattice'){p[0]+=(i%4-1.5)*3;p[1]+=Math.floor(i/4)%3*3;p[2]-=Math.floor(i/12)*4;r[1]+=.14*t;}
    if(effect==='radial'){p[0]+=Math.cos(a)*8;p[2]+=Math.sin(a)*8;r[1]-=a;s[1]*=1+pulse*2;}
    if(effect==='tunnel'){p[0]+=Math.sin(a+t*.2)*6;p[1]+=Math.cos(a+t*.2)*6;p[2]-=i*1.6;r[2]-=a;s[1]*=1+pulse;}
    if(effect==='extrude'){p[0]+=(i-(copies-1)/2)*2;s[1]*=1+3*(.5+.5*Math.sin(t+i*.5))+pulse;}
    if(effect==='dissolve'){const d=smooth((sample%576000)/576000);p[0]+=Math.sin(i*7.31)*20*d;p[1]+=Math.cos(i*3.17)*15*d;p[2]+=Math.sin(i*5.83)*20*d;s.forEach((v,k)=>s[k]=v*(1-d*.95));}
    result.push({position:p,rotation:r,scale:s,color:[...color]});
  }return result;
}
export function compositionCommands(project,sample,pulse=0){
  const commands=[];for(const n of project.nodes){const state=sampleKeys(n.keys,sample);for(const transform of effectInstances(n.effect,sample,{...state,copies:n.copies,color:n.color,pulse}))commands.push({...transform,meshes:n.meshes});}return commands;
}
export class DemoGeometry {
  constructor(){this.triangles=new Float32Array(MAX_DEMO_VERTICES*6);this.lines=new Float32Array(24000*6);this.points=new Float32Array(12000*6);this.reset();}
  reset(){this.counts={triangles:0,lines:0,points:0};return this;}
  vertex(kind,p,c){const at=this.counts[kind],a=this[kind];if(at+6>a.length)throw new RangeError('geometry work budget');a.set(p,at);a.set(c,at+3);this.counts[kind]+=6;}
  box(position,scale,color,rotation=[0,0,0],wire=false){
    const corners=Array.from({length:8},(_,i)=>transformPoint([i&1?.5:-.5,i&2?.5:-.5,i&4?.5:-.5],position,rotation,scale));
    if(wire){for(const edge of edges)for(const i of edge)this.vertex('lines',corners[i],color);}
    else for(let f=0;f<6;f++){const c=color.map(v=>v*shades[f]);for(const i of tri)this.vertex('triangles',corners[faces[f][i]],c);}return this;
  }
  mesh(vertices,transform){for(let i=0;i<vertices.length;i+=3)this.vertex('triangles',transformPoint(vertices.slice(i,i+3),transform.position,transform.rotation,transform.scale),transform.color);return this;}
  line(a,b,color){this.vertex('lines',a,color);this.vertex('lines',b,color);}
  point(p,c){this.vertex('points',p,c);}
  view(kind){return this[kind].subarray(0,this.counts[kind]);}
  composition(project,commands){for(const c of commands){if(c.meshes.length)for(const id of c.meshes)this.mesh(project.meshes.find(m=>m.id===id).vertices,c);else this.box(c.position,c.scale,c.color,c.rotation);}return this;}
}
// Original 5x7 block alphabet. These are authored geometry masks, not font rasterisation.
const glyphs={
  A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01111','10000','10000','10111','10001','10001','01110'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],J:['00111','00010','00010','00010','10010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','11001','10101','10011','10011','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','10101','01010'],X:['10001','10001','01010','00100','01010','10001','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
  '0':['01110','10011','10101','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],'2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],'4':['10010','10010','10010','11111','00010','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],'6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],'8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110'],
  '-':['00000','00000','00000','11111','00000','00000','00000'],'.':['00000','00000','00000','00000','00000','00110','00110'],':':['00000','00100','00100','00000','00100','00100','00000'],'!':['00100','00100','00100','00100','00100','00000','00100'],'?':['01110','10001','00001','00010','00100','00000','00100'],',':['00000','00000','00000','00000','00100','00100','01000'],'/':['00001','00010','00010','00100','01000','01000','10000'],' ':[]};
export function textVoxels(text,{size=1,center=true}={}){if(typeof text!=='string'||text.length>96||!Number.isFinite(size)||size<=0||size>10)throw new TypeError('bounded glyph text required');const points=[];for(let i=0;i<text.length;i++){const rows=glyphs[text[i]];if(!rows)throw new TypeError('unsupported glyph');for(let y=0;y<rows.length;y++)for(let x=0;x<5;x++)if(rows[y][x]==='1')points.push([(i*6+x-(center?(text.length*6-2)/2:0))*size,(3-y)*size,0]);}return points;}
