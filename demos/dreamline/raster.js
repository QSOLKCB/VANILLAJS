// SPDX-License-Identifier: Apache-2.0
// A native Canvas film receiver for HORIZON meshes. Screen-space depth is reciprocal
// camera distance; clip in camera space before projection. This owns no physics.
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>a.map(x=>x/Math.hypot(...a));
const near=.35;
function clip(points){
  const out=[];
  for(let i=0;i<3;i++){
    const a=points[i],b=points[(i+1)%3];
    if(a[2]>=near)out.push(a);
    if((a[2]>=near)!==(b[2]>=near)){
      const t=(near-a[2])/(b[2]-a[2]);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),near]);
    }
  }
  return out;
}
export class FilmRaster {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});}
  begin(camera,fov){
    const {width:w,height:h}=this.canvas;
    if(!this.image||this.image.width!==w||this.image.height!==h){
      this.image=this.ctx.createImageData(w,h);this.depth=new Float32Array(w*h);
      this.pixels=new Uint32Array(this.image.data.buffer);
    }
    this.depth.fill(0);this.eye=camera.position;
    this.forward=unit(camera.target.map((x,i)=>x-this.eye[i]));
    this.right=unit(cross(this.forward,[0,1,0]));this.up=cross(this.right,this.forward);
    this.focal=h/(2*Math.tan(fov/2));
    for(let y=0;y<h;y++){
      const t=Math.min(1,y/(h*.7)),r=31+145*t,g=74+127*t,b=104+92*t;
      this.pixels.fill((255<<24)|(b<<16)|(g<<8)|Math.round(r),y*w,(y+1)*w);
    }
  }
  draw(batch,matrix,material=batch.material){
    const v=batch.vertices, base=material.color, eye=this.eye;
    for(let i=0;i<v.length;i+=33){
      let nx=v[i+3],ny=v[i+4],nz=v[i+5];
      if(matrix){const m=matrix,n=unit([m[0]*nx+m[4]*ny+m[8]*nz,m[1]*nx+m[5]*ny+m[9]*nz,m[2]*nx+m[6]*ny+m[10]*nz]);[nx,ny,nz]=n;}
      const light=.61+.42*Math.max(0,-.43*nx+.83*ny+.35*nz)+(material.emission||0)*.22;
      const points=[];
      for(let j=i;j<i+33;j+=11){
        let x=v[j],y=v[j+1],z=v[j+2];
        if(matrix){const m=matrix;[x,y,z]=[x*m[0]+y*m[4]+z*m[8]+m[12],x*m[1]+y*m[5]+z*m[9]+m[13],x*m[2]+y*m[6]+z*m[10]+m[14]];}
        const d=[x-eye[0],y-eye[1],z-eye[2]];points.push([dot(d,this.right),dot(d,this.up),dot(d,this.forward)]);
      }
      const depths=points.map(p=>p[2]);if(Math.max(...depths)<near)continue;
      const poly=Math.min(...depths)>=near?points:clip(points);if(poly.length<3)continue;
      const haze=Math.min(.66,(depths[0]+depths[1]+depths[2])*.00075),fog=[147,182,184];
      const rgb=base.map((k,ch)=>Math.max(0,Math.min(255,Math.round(264*Math.sqrt(Math.max(0,k*v[i+6+ch]))*light*(1-haze)+fog[ch]*haze))));
      const ink=(255<<24)|(rgb[2]<<16)|(rgb[1]<<8)|rgb[0],w=this.image.width,h=this.image.height;
      const projected=poly.map(([x,y,z])=>[w/2+x*this.focal/z,h/2-y*this.focal/z,1/z]);
      for(let n=1;n+1<projected.length;n++)this.triangle(projected[0],projected[n],projected[n+1],ink);
    }
  }
  triangle(a,b,c,ink){
    const w=this.image.width,h=this.image.height;
    const xmin=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),xmax=Math.min(w-1,Math.ceil(Math.max(a[0],b[0],c[0])));
    const ymin=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),ymax=Math.min(h-1,Math.ceil(Math.max(a[1],b[1],c[1])));
    if(xmin>xmax||ymin>ymax)return;
    const bx=b[0]-a[0],by=b[1]-a[1],cx=c[0]-a[0],cy=c[1]-a[1],area=bx*cy-by*cx;
    if(Math.abs(area)<1e-8)return;
    const ux=cy/area,vx=-by/area,uy=-cx/area,vy=bx/area;
    for(let y=ymin;y<=ymax;y++){
      let u=(xmin+.5-a[0])*ux+(y+.5-a[1])*uy,v=(xmin+.5-a[0])*vx+(y+.5-a[1])*vy;
      for(let x=xmin,at=y*w+x;x<=xmax;x++,at++,u+=ux,v+=vx){
        if(u<0||v<0||u+v>1)continue;
        const z=a[2]+u*(b[2]-a[2])+v*(c[2]-a[2]);
        if(z>this.depth[at]){this.depth[at]=z;this.pixels[at]=ink;}
      }
    }
  }
  finish(){this.ctx.putImageData(this.image,0,0);}
}
