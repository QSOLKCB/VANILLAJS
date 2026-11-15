// SPDX-License-Identifier: Apache-2.0
// Spooky v0.1.0's station/upgrades loop, re-authored for a fictional naval arcade.
export const WIDTH=1152,HEIGHT=720,MUZZLE={x:576,y:616};
export const STATIONS=[
  {id:'cannon',name:'Close defence',short:'AUTOCANNON',tag:'01',weapon:'TWIN / 35',role:'FORWARD GUN DECK',description:'Twin barrels. A wall of tracers.',tip:'Lead the aircraft. The small diamond estimates an intercept. Fire short bursts; release to cool the barrels.'},
  {id:'flak',name:'Cloud breaker',short:'FLAK BATTERY',tag:'02',weapon:'FUSE / 76',role:'AIRBURST DIRECTOR',description:'Put a storm in their flight path.',tip:'Shells take half a second to reach your aim point. Lead a group; the proximity fuse bursts early beside a target.'},
  {id:'missile',name:'Sea spear',short:'GUIDED MISSILES',tag:'03',weapon:'VLS / SEASPEAR',role:'VERTICAL LAUNCH SYSTEM',description:'Acquire. Lock. Intercept.',tip:'Keep the reticle near an aircraft until the lock ring fills. Hold fire to launch; the missile follows that target.'},
  {id:'rail',name:'Lancer',short:'RAILGUN',tag:'04',weapon:'LANCER / COIL',role:'EXPERIMENTAL BATTERY',description:'One charged shot. A line through the sky.',tip:'Hold fire until CHARGED, then release. The beam pierces three aligned aircraft. Releasing early safely vents the charge.'}
];
export const WEAPONS={
  cannon:{damage:26,interval:5,reload:105,magazine:80,heat:4.3,speed:24,radius:3},
  flak:{damage:155,interval:46,reload:135,magazine:8,heat:0,speed:0,radius:78},
  missile:{damage:235,interval:48,reload:150,magazine:5,heat:0,speed:9,radius:63},
  rail:{damage:290,interval:36,reload:130,magazine:5,heat:0,speed:0,radius:4}
};
export const DIFFICULTIES={cadet:{name:'Cadet',count:8,growth:2,speed:.72,damage:.6,spacing:105,cap:4},watch:{name:'Watch officer',count:12,growth:3,speed:1,damage:1,spacing:78,cap:7},storm:{name:'Red alert',count:16,growth:4,speed:1.18,damage:1.2,spacing:60,cap:10}};
export const AIRCRAFT={drone:{name:'Needle drone',hp:48,speed:.64,size:16,damage:6,points:100},fighter:{name:'Manta fighter',hp:100,speed:.9,size:23,damage:9,points:170},bomber:{name:'Albatross bomber',hp:215,speed:.5,size:34,damage:16,points:300},skimmer:{name:'Sea-skimmer',hp:38,speed:1.25,size:13,damage:10,points:140}};
export const UPGRADES=[
  {id:'power',name:'High-energy rounds',icon:'↗',description:'+25% damage per rank.',max:6},
  {id:'cycle',name:'Rapid handling',icon:'»',description:'Faster firing, reloads and rail charging.',max:5},
  {id:'magazine',name:'Deep magazines',icon:'▤',description:'+25% ammunition capacity per rank.',max:5},
  {id:'systems',name:'Fire-control refit',icon:'◎',description:'Improves this station’s specialist system.',max:5},
  {id:'repair',name:'Damage control',icon:'+',description:'Restore 25 ship integrity immediately.',max:Infinity}
];
export const stationForRound=round=>STATIONS[(round-1)%STATIONS.length];
export function upgradeInfo(id,station){const u=UPGRADES.find(x=>x.id===id);return id==='systems'?{...u,description:{cannon:'Cool faster, generate less heat and tighten tracer spread.',flak:'Expand the airburst radius by 18% per rank.',missile:'Acquire locks faster and improve missile turning.',rail:'Pierce one additional aircraft per rank.'}[station]}:u;}
