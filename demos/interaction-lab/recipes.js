// SPDX-License-Identifier: Apache-2.0
// Game/domain data belongs here. None of the reusable modules knows these rules.
import {aabb} from '../../modules/collision/index.js';
import {ProjectileSystem} from '../../modules/projectiles/index.js';
import {createInteractionResolver} from '../../modules/interactions/index.js';
import {createBody,flightConfig,stepFlight,snapshot} from '../../modules/flight/index.js';
import {rotate,scale} from '../../modules/math/index.js';

export const LABS={
  space:{name:'Target practice',subtitle:'06 DOF / CONDITIONAL SHIELDS',
    description:'Take the controls. Probe the shield, open the field, then land four hits on each drone.'},
  bench:{name:'Reaction Bench',subtitle:'MATERIALS / EXPLAINABLE OUTCOMES',
    description:'Send a hydrogen probe. Change the chamber conditions and discover why a reaction succeeds—or does not.'}
};
export const SCIENCE_SOURCES=[
  {title:'Purdue University — The Chemistry of Hydrogen',url:'https://chemed.chem.purdue.edu/demos/demosheets/10.1.html'},
  {title:'Royal Society of Chemistry — Neon',url:'https://periodic-table.rsc.org/element/10/neon'}
];
export const SPACE_RULES=[{
  id:'pulse-hull',match:{source:'pulse',target:'drone'},
  requires:[
    {scope:'target',key:'alive',equals:true,code:'target-spent',message:'The hull is already disabled. Reset the range to restore it.'},
    {scope:'context',key:'shields',equals:false,code:'shield-active',message:'The shield absorbs the pulse. Open the shield field and try again.'}
  ],effects:[{type:'damage',amount:25}],reason:{code:'hull-hit',message:'Shield open. The pulse removes 25 hull points.'}
}];
export const BENCH_RULES=[{
  id:'hydrogen-oxygen',match:{source:'hydrogen',target:'oxygen'},
  requires:[
    {scope:'context',key:'oxygen',equals:true,code:'needs-oxygen',message:'Oxygen is absent from this chamber. Hydrogen needs an oxidizer for this reaction.'},
    {scope:'context',key:'ignition',equals:true,code:'needs-ignition',message:'Ignition energy is missing in this simplified model.'}
  ],effects:[{type:'product',formula:'H2O'}],reason:{code:'water-formed',message:'Water forms: 2H₂ + O₂ → 2H₂O. The reaction releases energy.'}
},{
  id:'hydrogen-neon',match:{source:'hydrogen',target:'neon'},outcome:'resisted',
  effects:[],reason:{code:'inert-neon',message:'No reaction in this model. Neon is chemically unreactive under ordinary conditions.'}
},{
  id:'hydrogen-empty',match:{source:'hydrogen',target:'empty'},
  requires:[{scope:'target',key:'oxygen',equals:true,code:'empty-chamber',message:'This chamber has no oxygen. Ignition alone cannot supply the missing reactant.'}],
  effects:[{type:'product',formula:'H2O'}],reason:{code:'water-formed',message:'Water forms.'}
}];
function solid(id,center,size,color) {
  return {id,center,size,color,box:aabb(center.map((v,i)=>v-size[i]/2),center.map((v,i)=>v+size[i]/2))};
}
export function createLab(kind='space') {
  if (!Object.hasOwn(LABS,kind)) throw new RangeError('unknown lab');
  const targets=kind==='space'
    ? [0,-11,11].map((x,i)=>({...solid(`drone-${i+1}`,[x,0,-30-i*6],[4,4,2],[.42,.78,.68]),kind:'drone',label:`Drone 0${i+1}`,health:100,alive:true}))
    : [
      {...solid('oxygen',[0,0,-24],[4,4,3],[.94,.62,.33]),kind:'oxygen',label:'O₂ chamber'},
      {...solid('neon',[-11,0,-30],[4,4,3],[.57,.55,.91]),kind:'neon',label:'Ne / neon'},
      {...solid('empty',[11,0,-30],[4,4,3],[.36,.49,.57]),kind:'empty',label:'Empty chamber',oxygen:false}
    ];
  const walls=[
    solid('wall-floor',[0,-6,-32],[64,1,112],[.12,.19,.23]),
    solid('wall-left',[-32,10,-32],[1,32,112],[.10,.16,.21]),
    solid('wall-right',[32,10,-32],[1,32,112],[.10,.16,.21]),
    solid('wall-back',[0,10,-88],[64,32,1],[.12,.18,.23]),
    solid('wall-front',[0,10,24],[64,32,1],[.12,.18,.23]),
    solid('wall-roof',[0,26,-32],[64,1,112],[.08,.13,.18])
  ];
  const body=createBody({position:[0,0,12]});
  return {kind,targets,walls,colliders:[...walls,...targets],body,previous:snapshot(body),
    config:flightConfig({assisted:kind==='bench',acceleration:12,angularAcceleration:2,turnSpeed:1.1}),
    context:kind==='space'?{shields:true}:{oxygen:true,ignition:false},
    resolver:createInteractionResolver(kind==='space'?SPACE_RULES:BENCH_RULES),
    projectiles:new ProjectileSystem({capacity:64}),elapsed:0,cooldown:0,shots:0,hits:0,applied:0,expired:0,products:0,
    history:[],flashes:[],selected:targets[0].id};
}
export function focusTarget(session,id) {
  const target=session.targets.find(t=>t.id===id);
  if (!target) throw new RangeError('unknown target');
  session.selected=id;
  session.body=createBody({position:[target.center[0],0,12]});session.previous=snapshot(session.body);
  session.projectiles.clear();session.cooldown=0;session.flashes=[];
}
function record(session,event) {
  session.history.unshift(event);session.history.length=Math.min(session.history.length,8);
}
export function stepLab(session,input={},dt) {
  if (!Number.isFinite(dt) || dt<0 || dt>.05) throw new RangeError('lab dt must be 0..0.05 seconds');
  if (dt===0) return [];
  session.previous=snapshot(session.body);
  if (input.fire && session.cooldown<=1e-12) {
    const fired=session.projectiles.spawn({position:session.body.position,
      velocity:scale(rotate(session.body.orientation,[0,0,-1]),100),lifetime:1.5,halfSize:.08,
      data:{kind:session.kind==='space'?'pulse':'hydrogen'}});
    if (fired.accepted) {session.shots++;session.cooldown=.25;}
  }
  stepFlight(session.body,{...input,thrust:session.kind==='space'?(input.thrust??[0,0,0]):[0,0,0]},dt,
    session.config,session.colliders.map(c=>c.box));
  session.flashes=session.flashes.filter(f=>session.elapsed-f.at<.35);
  const events=session.projectiles.step(dt,session.colliders);
  for (const event of events) {
    if (event.type==='expired') {session.expired++;continue;}
    session.hits++;
    const target=session.targets.find(t=>t.id===event.hit.id);
    const result=target?session.resolver.evaluate({source:event.data,target,context:session.context}):
      {status:'blocked',ruleId:null,effects:[],reasons:[{code:'wall-hit',message:'The range wall stopped this shot before it reached a specimen.'}]};
    if (result.status==='applied') {
      session.applied++;
      for (const effect of result.effects) {
        if (effect.type==='damage') {target.health=Math.max(0,target.health-effect.amount);target.alive=target.health>0;}
        if (effect.type==='product') session.products++;
      }
    }
    const at=session.elapsed+event.time;
    record(session,{...result,at,projectileId:event.projectileId,targetId:event.hit.id});
    session.flashes.push({at,position:event.hit.point,status:result.status});
  }
  // Visual feedback is bounded even when a consumer injects the full shot capacity.
  session.flashes=session.flashes.slice(-64);
  session.cooldown=Math.max(0,session.cooldown-dt);session.elapsed+=dt;
  return events;
}
