// SPDX-License-Identifier: Apache-2.0
// Small deterministic cross-genre 2D lab. World axes +X right, +Y up,
// while the map's row index increases toward the bottom of the Canvas.
import {createBody2D,stepBody2D,MOTION2D_SCALE} from '../../modules/motion2d/index.js';
import {NavigationGrid,findPath} from '../../modules/navigation/index.js';
export const LAB2D_WIDTH=26,LAB2D_HEIGHT=17,LAB2D_TICK_LIMIT=900;
export const LAB2D_MODES=Object.freeze(['rts','shmup','platform','car']);
const S=MOTION2D_SCALE,MAX_X=(LAB2D_WIDTH-1)*S,MAX_Y=(LAB2D_HEIGHT-1)*S;
const blocked=[];
for(let y=0;y<LAB2D_HEIGHT;y++)if(y!==7)blocked.push([12,y]);
export const RTS2D_GRID=new NavigationGrid({width:LAB2D_WIDTH,
  height:LAB2D_HEIGHT,blocked});
const RTS_ROUTE=findPath(RTS2D_GRID,[1,2],[24,14],{maxExpanded:4096});
if(RTS_ROUTE.status!=='found')throw Error('RTS fixture route is missing');
const frozenRoute=Object.freeze(RTS_ROUTE.path.map(p=>Object.freeze(p)));
const coord=cell=>[cell[0]*S,(LAB2D_HEIGHT-1-cell[1])*S];
const bounds={minX:0,maxX:MAX_X,minY:0,maxY:MAX_Y};
const sign=n=>n>0?1:n<0?-1:0;
const cellAt=(x,y)=>[Math.floor((x+S/2)/S),
  LAB2D_HEIGHT-1-Math.floor((y+S/2)/S)];
function obstacle(x,y){
  const cell=cellAt(x,y);
  return !RTS2D_GRID.walkable(cell);
}
export function createLab2D(kind='rts'){
  if(!LAB2D_MODES.includes(kind))throw new RangeError('unsupported 2D lab mode');
  const p=kind==='rts'?coord([1,2]):kind==='platform'?[2*S,0]:
    kind==='car'?[4*S,7*S]:[13*S,3*S];
  const body=createBody2D({x:p[0],y:p[1],grounded:kind==='platform'});
  return {kind,tick:0,body,score:0,shots:[],nextShot:1,
    waypoint:1,trail:[],status:'ready'};
}
/** Stateful model supplied to this function is never mutated.
 * 60 logical ticks per second; rendering is a separate adapter.
 */
export function stepLab2D(current,input={}){
  if(!current||!LAB2D_MODES.includes(current.kind))throw new TypeError('invalid lab state');
  if(current.tick>=LAB2D_TICK_LIMIT)return {...current,status:'limit'};
  const kind=current.kind,tick=current.tick+1,control={...input};
  let waypoint=current.waypoint;
  if(kind==='rts'){
    const target=coord(frozenRoute[Math.min(waypoint,frozenRoute.length-1)]);
    const dx=target[0]-current.body.x,dy=target[1]-current.body.y;
    if(Math.abs(dx)<=S/8&&Math.abs(dy)<=S/8&&waypoint<frozenRoute.length-1)
      waypoint++;
    const next=coord(frozenRoute[Math.min(waypoint,frozenRoute.length-1)]);
    control.x=sign(next[0]-current.body.x);
    control.y=sign(next[1]-current.body.y);
  }
  if(typeof control.fire!=='undefined'&&typeof control.fire!=='boolean')
    throw new TypeError('fire must be boolean');
  const body=stepBody2D(current.body,control,
    {profile:kind,bounds,groundY:0,blockedAt:kind==='rts'?obstacle:null});
  let score=current.score,shots=current.shots.map(shot=>({...shot,y:shot.y+80}))
    .filter(shot=>shot.y<=MAX_Y);
  let nextShot=current.nextShot;
  if(kind==='shmup'&&control.fire&&tick%8===0&&shots.length<32){
    shots.push({id:nextShot++,x:body.x,y:body.y});
  }
  if(kind==='rts'&&waypoint===frozenRoute.length-1){
    const goal=coord(frozenRoute.at(-1));
    if(Math.abs(body.x-goal[0])<=S/4&&Math.abs(body.y-goal[1])<=S/4)
      score=1;
  }
  const trail=tick%8===0?[...current.trail,{x:body.x,y:body.y}].slice(-32):
    current.trail;
  return {kind,tick,body,score,shots,nextShot,waypoint,trail,
    status:tick>=LAB2D_TICK_LIMIT?'limit':'running'};
}
export function snapshotLab2D(state){
  return {schemaVersion:1,kind:state.kind,tick:state.tick,
    body:{...state.body},score:state.score,waypoint:state.waypoint,
    nextShot:state.nextShot,shots:state.shots.map(s=>({...s})),
    trail:state.trail.map(p=>({...p})),status:state.status,
    ...(state.kind==='rts'?{route:frozenRoute.map(p=>[...p])}:{} )};
}
export function rtsRoute2D(){return frozenRoute.map(p=>[...p]);}
