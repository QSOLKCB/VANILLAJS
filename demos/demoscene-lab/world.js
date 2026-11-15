// SPDX-License-Identifier: Apache-2.0
import {seededRandom} from '../../modules/math/index.js';
import {sampleTimeline,sampleKeys,sampleCues,smooth} from '../../modules/demo-timeline/index.js';
import {DemoGeometry,effectInstances,compositionCommands,textVoxels} from '../../modules/demo-scene/index.js';
import {validateDemo} from '../../modules/mod-demo/index.js';
/** Original production direction lives here, outside the reusable engine. */
export class DemoWorld {
  constructor(project){
    this.project=validateDemo(project);const random=seededRandom(project.settings.seed);
    this.stars=Array.from({length:480},()=>[(random()-.5)*180,(random()-.5)*100,-random()*180]);
    this.towers=Array.from({length:96},(_,i)=>({position:[(i%2?1:-1)*(5+Math.floor(i/24)*5),0,-Math.floor(i/2)%12*6],height:3+random()*13,phase:random()*6}));
    this.title=textVoxels(project.settings.text.title,{size:.85}).map(p=>[p[0],p[1]+3,p[2]]);
    this.subtitle=textVoxels(project.settings.text.subtitle,{size:.23}).map(p=>[p[0],p[1]-.8,p[2]]);
    this.scroller=textVoxels(project.settings.text.scroller,{size:.18,center:false});
    this.pool=new DemoGeometry();this.last=null;this.generation=0;this.cacheHits=0;
  }
  commands(sample){
    const p=this.project,state=sampleTimeline(sample),t=state.seconds,u=state.progress,
      pulse=sampleCues(p.cues,sample,p.timeline.cueChannel).strength,c=p.settings.palette,
      boxes=[],lines=[],points=[],camera=sampleKeys(p.timeline.camera,sample),
      add=(position,scale,color,rotation=[0,0,0],wire=false)=>boxes.push({position,scale,color,rotation,wire});
    const fade=state.ended?0:Math.min(smooth(t/1.5),1-smooth((t-58)/2));
    if(fade===0)return {state,camera,pulse,fade,boxes,lines,points,composition:[],effect:p.timeline.scenes[state.act].effect};
    if(state.act===0){
      for(const k of effectInstances('rotate',sample,{scale:[4,4,4],copies:3,color:[.65,.82,.8]}))add(k.position,k.scale,k.color,k.rotation,true);
      for(let i=0;i<10;i++)add([0,-6+i*.23,-5],[30,.12,.1],c[0].map(x=>x*(.25+.2*Math.sin(t*2+i*.5))));
      for(let i=0;i<64;i++)points.push({p:this.stars[i].map((x,j)=>j===2?x*.2:x*.25),c:[.3,.5,.45]});
    }else if(state.act===1){
      // Each column assembles from a cold scaffold, directly from absolute time.
      for(const [i,b] of this.towers.entries()){
        const build=smooth((u-.006*i)*3),height=.2+b.height*build;
        add([b.position[0],height/2-3,b.position[2]],[2,height,2],i%4===0?c[0]:c[3],[0,Math.sin(t*.2+b.phase)*.08,0]);
        add([b.position[0],height-2.8,b.position[2]],[2.1,.12,2.1],c[1]);
      }
      for(let i=0;i<14;i++){const z=-i*5;add([0,8,z],[10,.18,.18],c[0]);for(const x of [-5,5])add([x,2.5,z],[.18,11,.18],c[0]);}
      for(let i=0;i<30;i++){lines.push({a:[-30,-3,-i*4],b:[30,-3,-i*4],c:c[3]});lines.push({a:[(i-15)*2,-3,20],b:[(i-15)*2,-3,-120],c:c[3]});}
      camera.position[0]+=Math.sin(u*Math.PI)*2;
    }else if(state.act===2){
      for(let ring=0;ring<16;ring++)for(let j=0;j<12;j++){
        const a=j/12*Math.PI*2+t*.22+ring*.12,r=6.5+Math.sin(t+ring*.5)+pulse*.6;
        add([Math.cos(a)*r,3+Math.sin(a)*r,-ring*4],[.6,1.6,.7],c[(j+ring)%3],[a*.3,t*.15,a],ring%4===0);
      }
      for(let i=0;i<100;i++){const x=(i%10-5)*2,y=(Math.floor(i/10)-5)*2,v=.5+.5*Math.sin(x*.4+t+Math.cos(y*.6-t));add([x,y+3,-68],[1.6,1.6,.2+v*3],c[1].map((a,j)=>a*v+c[0][j]*(1-v)));}
      camera.position[0]+=Math.sin(t*.5)*1.2;camera.position[1]+=Math.cos(t*.4)*.6;
    }else if(state.act===3){
      // Monumental bilateral industrial architecture and an orbiting core.
      for(let row=0;row<9;row++)for(const side of [-1,1]){
        const x=side*(8+row*.7),z=-row*6,h=18+row*.7;
        add([x,h/2-5,z],[2,h,2],c[3]);add([x,h-5,z],[3,.5,3],c[1]);
        for(let rib=0;rib<4;rib++)add([side*(8-rib*1.7),h-5+rib*1.8,z],[2.5,.5,.7],rib%2?c[1]:c[0],[0,0,-side*.6]);
        add([x,4,z+.1],[.23,16,2.2],c[0].map(v=>v*(.55+pulse)));
      }
      for(const e of effectInstances('radial',sample,{position:[0,7,-16],scale:[.35,4,.35],copies:32,color:c[1],pulse}))add(e.position,e.scale,e.color,e.rotation);
      for(let layer=0;layer<4;layer++)add([0,8,-16],[4+layer*2,4+layer*2,4+layer*2],c[layer%3],[t*.12+layer*.5,t*.19,t*.11],true);
      add([0,-5,-30],[40,.5,100],c[3]);camera.position[0]+=Math.sin(u*Math.PI*2)*3;
    }else{
      const form=smooth((u-.08)/.48),targets=[...this.title,...this.subtitle];
      for(let i=0;i<targets.length;i++){
        const a=i*2.399963,p0=[Math.cos(a)*17,Math.sin(a)*15+4,Math.sin(i*1.71)*20-14],dest=targets[i],pos=p0.map((v,j)=>v+(dest[j]-v)*form);
        if(form<.98)points.push({p:pos,c:c[i%3]});
        else add(pos,[i<this.title.length?.7:.19,i<this.title.length?.7:.19,.65],c[i<this.title.length?0:1]);
      }
      if(u<.3)for(let i=0;i<24;i++)add([Math.sin(i)*12,6,-i*2],[.2,12*(1-u/.3),.2],c[1],[0,u*2,i*.05]);
      if(u>.45){const scroll=(u-.45)/.5*(p.settings.text.scroller.length*1.08+30)-15;for(const point of this.scroller){const x=point[0]-scroll;if(x>-18&&x<18)add([x,point[1]-4,0],[.14,.14,.25],c[2]);}}
    }
    if(state.act>0&&state.act<4)for(let i=0;i<this.stars.length;i++)points.push({p:this.stars[i],c:[.2,.3,.4],detail:i%2});
    const composition=compositionCommands(p,sample,pulse);
    return {state,camera,pulse,fade,boxes,lines,points,composition,effect:p.timeline.scenes[state.act].effect};
  }
  /** Retained buffers; forceFresh bypasses both frame reuse and retained writer. */
  geometry(sample,quality='standard',{forceFresh=false}={}){
    if(!['low','standard'].includes(quality))throw new TypeError('quality');
    if(!forceFresh&&this.last?.sample===sample&&this.last.quality===quality){this.cacheHits++;return this.last;}
    const commands=this.commands(sample),g=forceFresh?new DemoGeometry():this.pool;g.reset();
    const tint=c=>c.map(v=>v*commands.fade);
    for(const b of commands.boxes)g.box(b.position,b.scale,tint(b.color),b.rotation,b.wire);
    for(const l of commands.lines)g.line(l.a,l.b,tint(l.c));
    for(const p of commands.points)if(quality==='standard'||!p.detail)g.point(p.p,tint(p.c));
    for(const c of commands.composition){const transform={...c,color:tint(c.color)};if(c.meshes.length)for(const id of c.meshes)g.mesh(this.project.meshes.find(m=>m.id===id).vertices,transform);else g.box(c.position,c.scale,transform.color,c.rotation);}
    const result={sample,quality,commands,geometry:g};if(!forceFresh){this.last=result;this.generation++;}return result;
  }
}
