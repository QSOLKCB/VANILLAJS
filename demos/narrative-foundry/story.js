// SPDX-License-Identifier: Apache-2.0
// Original VANILLAJS fiction and authored data. No donor story or assets.
const always=()=>({op:'always'});
const choice=(id,label,target,condition=always(),effects=[])=>({id,label,target,condition,effects});
const event=event=>({op:'event',event});
export function lanternStory(){return {
  format:'qsol.vanillajs.narrative.v1',version:1,id:'the-last-lantern',title:'The Last Lantern',start:'arrival',maxSteps:64,
  variables:[{id:'hasLens',type:'boolean',initial:false},{id:'courage',type:'integer',initial:1,min:0,max:5},{id:'route',type:'string',initial:'harbor',values:['harbor','ridge']}],
  objectives:[{id:'restore-light',title:'Give the night a signal'}],events:['lantern-lit','harbor-safe','courier-left','dark-route'],
  nodes:[
    {id:'arrival',title:'One light left',dialogue:'The tide has swallowed the road. On the headland, one silent lantern waits above the harbor. A courier is searching the dark for a signal. You have until dawn.',ending:false,onEnter:[],choices:[
      choice('find-lens','Search the old workshop','workshop'),choice('take-ridge','Take the high ridge','ridge',{op:'lt',variable:'courage',value:5},[{op:'set',variable:'route',value:'ridge'},{op:'add',variable:'courage',value:1}]),choice('inspect-beacon','Go straight to the lantern','beacon'),choice('leave-dark','Leave a message and turn back','dark')
    ]},
    {id:'workshop',title:'A pocket of daylight',dialogue:'Inside a wooden drawer, a prism holds the last warm colors of the afternoon. You wrap it in your scarf. The lantern might still work.',ending:false,onEnter:[{op:'set',variable:'hasLens',value:true},{op:'objective',objective:'restore-light',status:'active'}],choices:[choice('carry-lens','Carry the prism to the tower','beacon'),choice('return-path','Return to the fork','arrival')]},
    {id:'ridge',title:'Above the weather',dialogue:'The ridge narrows to a ribbon of stone. You cross it slowly and find your nerve. Across the water, the courier raises a shuttered lamp.',ending:false,onEnter:[],choices:[choice('ridge-tower','Climb down to the lantern','beacon')]},
    {id:'beacon',title:'Choose a signal',dialogue:'Two levers remain. One focuses the tower lamp; the other answers the courier. A clear light would guide the harbor home. A brave answer could open a new route.',ending:false,onEnter:[],choices:[
      choice('fit-prism','Fit the prism and light the harbor','harbor',{op:'eq',variable:'hasLens',value:true},[event('lantern-lit'),{op:'objective',objective:'restore-light',status:'complete'}]),
      choice('answer-courier','Answer the courier across the water','courier',{op:'gte',variable:'courage',value:2},[{op:'objective',objective:'restore-light',status:'complete'}]),
      choice('back-workshop','Look for something in the workshop','workshop'),choice('wait-dawn','Wait quietly for dawn','dark')
    ]},
    {id:'harbor',title:'A thousand small windows',dialogue:'The lantern opens. One by one, little windows answer across the harbor. The courier lowers their lamp: everyone has found the way home. Some nights need only one person to keep the light.',ending:true,onEnter:[event('harbor-safe')],choices:[]},
    {id:'courier',title:'The road made of light',dialogue:'Three short flashes. Three answers. The courier marks a safe crossing on the far shore. Tomorrow there will be a new route, and your lantern will be its first landmark.',ending:true,onEnter:[event('courier-left')],choices:[]},
    {id:'dark',title:'A note for the morning',dialogue:'You leave a careful note beneath a stone. The tower stays dark tonight, but its story is not lost. At dawn someone will find the note, and begin again.',ending:true,onEnter:[{op:'objective',objective:'restore-light',status:'failed'},event('dark-route')],choices:[]}
  ]
};}
