// SPDX-License-Identifier: Apache-2.0
// HORIZON-010: deterministic, presentation-only roadside details.
// Integer-metre scheduling and stable chunk order; native road/contact is immutable.
import {raceBatchBounds} from './race-visibility.js';
import {ScenicRoad} from '../../modules/scenic3d/index.js';

const STEP=Object.freeze({low:48,high:24}),CHUNK_METRES=240,MAX_VERTICES=20000,MAX_BATCHES=48;
const kinds=['posts','reflectors','signs','ink'];
const themes=Object.freeze({
  coast:{post:[.67,.73,.76],reflector:[1,.83,.47],sign:[1,.68,.30],ink:[.14,.20,.24]},
  alpine:{post:[.83,.86,.89],reflector:[1,.80,.40],sign:[.94,.66,.30],ink:[.17,.23,.29]},
  dusk:{post:[.62,.65,.70],reflector:[1,.69,.35],sign:[.96,.48,.23],ink:[.16,.13,.19]}
});
const materials=Object.freeze({
  posts:{color:[.66,.73,.76],roughness:.43,metalness:.48},
  reflectors:{color:[1,.89,.70],roughness:.30,metalness:.12,emission:.42},
  signs:{color:[.96,.83,.63],roughness:.62,metalness:.05,emission:.12},
  ink:{color:[.13,.15,.18],roughness:.86,metalness:0}
});
const add=(a,b,t=1)=>[a[0]+b[0]*t,a[1]+b[1]*t,a[2]+b[2]*t];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function triangle(out,a,b,c,color){
  const x=sub(b,a),y=sub(c,a),n=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]],length=Math.hypot(...n);
  if(!(length>1e-8)||![...a,...b,...c].every(Number.isFinite))throw RangeError('Degenerate roadside triangle');
  const normal=n.map(value=>value/length);
  for(const point of [a,b,c])out.push(...point,...normal,...color,0,0);
}
function quad(out,a,b,c,d,color){triangle(out,a,b,c,color);triangle(out,a,c,d,color);}
function box(out,center,size,color){
  const p=[];for(let i=0;i<8;i++)p.push([0,1,2].map(axis=>center[axis]+size[axis]*((i>>axis&1)-.5)));
  for(const face of [[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]])
    quad(out,...face.map(i=>p[i]),color);
}
function roadFrame(road,distance){
  const point=road.sample(distance,0),before=road.sample(Math.max(0,distance-2),0),after=road.sample(Math.min(road.length,distance+2),0);
  const dx=after.position[0]-before.position[0],dz=after.position[2]-before.position[2],n=Math.hypot(dx,dz);
  if(!(n>1e-8))throw RangeError('Degenerate roadside heading');
  return {point,right:[-dz/n,0,dx/n],back:[-dx/n,0,-dz/n]};
}
function signQuad(out,origin,right,back,coords,color,depth=.06){
  const at=([x,y])=>add(add(add(origin,right,x),[0,y,0]),back,depth);
  quad(out,...coords.map(at),color);
}
/** All scene positions are selected by integral metre station indices.
 * Road sampling retains the existing validated bank/grade; none of these
 * vertices participate in physical support, barrier or checkpoint tests.
 */
export function createRaceRoadDetails(road,profile='high',environment='coast'){
  // ScenicRoad has already validated the authored knot/grade budget. Its
  // sampled *3D* spline can legitimately exceed the 2400 m horizontal-knot
  // limit; do not impose a second, incompatible length admission rule here.
  if(!(road instanceof ScenicRoad)||!Number.isFinite(road.length)||road.length<=0||
    !Object.hasOwn(STEP,profile)||!Object.hasOwn(themes,environment))
    throw TypeError('Accepted roadside world and graphics profile required');
  const rows=road.stations(),theme=themes[environment],groups=new Map();
  if(!Array.isArray(rows)||rows.length<2)return {batches:[],postPairs:0,warningSigns:0,vertices:0};
  const values=(kind,chunk)=>{
    const key=chunk+':'+kind;
    if(!groups.has(key))groups.set(key,[]);
    return groups.get(key);
  };
  let interval=0,postPairs=0,warningSigns=0,previousSign=-Infinity;
  for(let index=0,distance=18;distance<road.length-12;index++,distance=18+index*STEP[profile]){
    // The road is monotone in authored arc distance even when it doubles back
    // in XZ: a loop cannot rearrange decorative object ordering.
    while(interval<rows.length-2&&rows[interval+1].distance<distance)interval++;
    const a=rows[interval],b=rows[interval+1],t=(distance-a.distance)/(b.distance-a.distance),
      width=a.width+(b.width-a.width)*t;
    const {point,right,back}=roadFrame(road,distance);
    if(point.structure==='bridge'||point.structure==='tunnel')continue;
    const chunk=Math.floor(distance/CHUNK_METRES),edgeOffset=Math.min(width/2-.2,8.8);
    for(const side of [-1,1]){
      const edge=road.sample(distance,side*edgeOffset).position,
        origin=add(edge,right,side*(width/2+2.1-edgeOffset)),
        posts=values('posts',chunk),reflectors=values('reflectors',chunk);
      // Short roadside bollards with two retroreflective faces. The body
      // starts below the road edge; both panels face approaching traffic.
      box(posts,add(origin,[0,.20,0]),[.13,1.65,.13],theme.post);
      const x=.115*side,anchor=add(origin,right,x);
      signQuad(reflectors,anchor,right,back,[[-.095,.77],[.095,.77],[.095,1.10],[-.095,1.10]],theme.reflector,.10);
      signQuad(reflectors,anchor,right,back,[[.095,.77],[-.095,.77],[-.095,1.10],[.095,1.10]],theme.reflector,-.10);
    }
    postPairs++;
    if(distance-previousSign<72||distance<45||distance>road.length-40)continue;
    const prior=road.sample(Math.max(0,distance-10),0).position,
      next=road.sample(Math.min(road.length,distance+10),0).position,
      v=sub(point.position,prior),w=sub(next,point.position),turn=Math.atan2(v[0]*w[2]-v[2]*w[0],v[0]*w[0]+v[2]*w[2]);
    if(Math.abs(turn)<.03)continue;
    // Positive signed curvature bends right: the outer shoulder is left.
    // Keep chevron ink direction tied to 'turn', not the placement side.
    const outside=turn>0?-1:1,edge=road.sample(distance,outside*edgeOffset).position,
      origin=add(edge,right,outside*(width/2+3.8-edgeOffset)),posts=values('posts',chunk);
    // Sign backplate, mount, and high-contrast chevron are two retained
    // material batches rather than thousands of per-object GPU draws.
    box(posts,add(origin,[0,.65,0]),[.12,2.1,.12],theme.post);
    signQuad(values('signs',chunk),add(origin,[0,1.55,0]),right,back,[[-.76,-.40],[.76,-.40],[.76,.40],[-.76,.40]],theme.sign,.05);
    const ink=values('ink',chunk),anchor=add(origin,[0,1.55,0]),dir=turn>0?1:-1;
    const stroke=(y1,y2)=>signQuad(ink,anchor,right,back,[[dir*-.25,y1-.10],[dir*.35,y2-.10],[dir*.35,y2+.10],[dir*-.25,y1+.10]],theme.ink,.075);
    stroke(.19,0);stroke(-.19,0);
    warningSigns++;previousSign=distance;
  }
  const batches=[],orderedChunks=[...new Set([...groups.keys()].map(key=>Number(key.split(':')[0])))].sort((a,b)=>a-b);
  let vertices=0;
  for(const chunk of orderedChunks)for(const kind of kinds){
    const raw=groups.get(chunk+':'+kind);if(!raw?.length)continue;
    const data=new Float32Array(raw);vertices+=data.length/11;
    if(vertices>MAX_VERTICES||batches.length>=MAX_BATCHES)throw RangeError('Roadside graphics budget exceeded');
    batches.push({id:'race-detail-'+chunk+'-'+kind,detailKind:kind,vertices:data,
      material:materials[kind],visibilityBounds:raceBatchBounds(data)});
  }
  return {batches,postPairs,warningSigns,vertices};
}
