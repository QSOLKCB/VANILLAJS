// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from '../../modules/time/index.js';
import {VERTICES, EDGES, FACES, delta16, xor16, unpackState, tetrahedron, faceResiduals, orbit16} from '../../experiments/arch-omi/index.js';
import {createOmiSession, stepOmiSession, parseHex16} from './experiment.js';

const $ = id => document.getElementById(id), hex = value => value.toString(16).toUpperCase().padStart(4,'0');
const clock = new FixedClock(), canvas = $('atlas');
let session = createOmiSession(), running = false, started = false, failed = false, last = performance.now();
let selectedFace = 0, fault = false, gesture = null, drawn = 0, shownWord = -1, shownCount = -1, shownSteps = -1;
let ctx = canvas.getContext('2d'), pixels = ctx?.createImageData(256,256);
clock.setPaused(true);
const colours = {0:[14,20,26],1:[133,200,240],2:[240,187,120],4:[199,161,236],8:[181,230,162]};
const vertexColours = ['#85c8f0','#f0bb78','#c7a1ec','#b5e6a2'];
const points = [[210,42],[53,274],[367,274],[210,190]];
const edgeOffsets = [[-12,0],[12,0],[13,0],[0,23],[-8,2],[9,2]];
const vertexLabels = [[210,13],[53,316],[367,316],[210,226]];
function svg(tag, attributes, text = '') {
  const node = document.createElementNS('http://www.w3.org/2000/svg',tag);
  for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,value);
  node.textContent = text; return node;
}
const faceShapes = FACES.map((_, opposite) => {
  const vertices = points.filter((_,i) => i !== opposite);
  const node = svg('polygon',{points:vertices.map(p=>p.join(',')).join(' '),fill:vertexColours[opposite],class:'face-fill'});
  $('faces-drawing').append(node); return node;
});
const edgeDrawings = EDGES.map(([a,b],i) => {
  const line = svg('line',{x1:points[a][0],y1:points[a][1],x2:points[b][0],y2:points[b][1],class:'edge'});
  const label = svg('text',{x:(points[a][0]+points[b][0])/2+edgeOffsets[i][0],y:(points[a][1]+points[b][1])/2+edgeOffsets[i][1],class:'edge-label'});
  $('edges-drawing').append(line,label); return {line,label};
});
const vertexValues = points.map(([cx,cy],i) => {
  const circle = svg('circle',{cx,cy,r:19,fill:vertexColours[i]});
  const value = svg('text',{x:cx,y:cy,class:'vertex-value'});
  const name = svg('text',{x:vertexLabels[i][0],y:vertexLabels[i][1],class:'vertex-name'},VERTICES[i]);
  $('vertices-drawing').append(circle,value,name); return value;
});
const faceButtons = VERTICES.map((name,i) => {
  const button = document.createElement('button'), label = document.createElement('span'), result = document.createElement('b');
  label.textContent = `Opp. ${name}`; button.append(label,result);
  button.addEventListener('click',()=>{selectedFace=i;renderBench();}); $('faces').append(button); return button;
});
const bitButtons = Array.from({length:16},(_,i) => {
  const bit = 15-i, button = document.createElement('button'); button.dataset.bit=bit;
  button.addEventListener('click',()=>{setWord(session.word^(1<<bit));announce(`Bit ${bit} toggled.`);});
  $('bits').append(button); return button;
});
function announce(text) { $('message').textContent=text; }
function status() {
  $('status').textContent=failed?'STOPPED':running?'RUNNING':started?'PAUSED':'READY';
  $('run').disabled=running||failed; $('pause').disabled=!running;
  $('run').textContent=started?'Resume experiment ↗':'Run experiment ↗';
}
function pause() { gesture=null; running=false; clock.setPaused(true); last=performance.now(); status(); }
function setWord(value) {
  unpackState(value); pause(); session.word=value; session.phase=0; session.deltaSteps=0;
  $('seed').value=hex(value); renderBench(); drawAtlas();
}
function deltaStep() {
  pause(); session.word=delta16(session.word); session.phase=0; session.deltaSteps++;
  $('seed').value=hex(session.word); renderBench(); drawAtlas(); announce('Applied one Δ step.');
}
function applyXor() {
  try {
    const mask=parseHex16($('xor-mask').value), next=xor16(session.word,mask);
    session.mask=mask; setWord(next); announce(`Applied XOR ${hex(mask)}. Apply it again to restore the previous word.`);
  } catch (error) { announce(error.message); }
}
function renderBench() {
  shownWord=session.word;shownSteps=session.deltaSteps;
  const shape=tetrahedron(session.word), observed=[...shape.edges]; if(fault)observed[0]^=1;
  const residuals=faceResiduals(observed), orbit=orbit16(session.word);
  $('word').textContent='0x'+hex(session.word); $('decimal').textContent=String(session.word);
  $('period').textContent=orbit.period; $('delta-steps').textContent=session.deltaSteps;
  if(document.activeElement!==$('seed'))$('seed').value=hex(session.word);
  bitButtons.forEach((button,i)=>{const bit=15-i,on=(session.word>>>bit)&1;button.textContent=on;button.setAttribute('aria-pressed',String(Boolean(on)));button.setAttribute('aria-label',`Bit ${bit}: ${on}. Toggle.`);});
  faceShapes.forEach((node,i)=>node.classList.toggle('selected',i===selectedFace));
  vertexValues.forEach((node,i)=>node.textContent=shape.vertices[i].toString(16).toUpperCase());
  edgeDrawings.forEach(({line,label},i)=>{
    line.classList.toggle('highlight',FACES[selectedFace].includes(i)); line.classList.toggle('faulty',fault&&i===0);
    label.textContent=observed[i].toString(16).toUpperCase();
  });
  faceButtons.forEach((button,i)=>{
    button.lastElementChild.textContent='0x'+residuals[i].toString(16).toUpperCase();
    button.setAttribute('aria-pressed',String(selectedFace===i)); button.classList.toggle('bad',residuals[i]!==0);
    button.setAttribute('aria-label',`Face opposite ${VERTICES[i]}, XOR residual ${residuals[i]}`);
  });
  $('closure').textContent=`${residuals.filter(v=>v===0).length} / 4 faces close`;
  $('closure').style.color=fault?'var(--gold)':'var(--mint)';
  $('fault').setAttribute('aria-pressed',String(fault)); $('fault').textContent=fault?'Clear observed edge fault':'Flip one observed edge bit';
  $('orbit').replaceChildren(...orbit.states.map(value=>{
    const button=document.createElement('button');button.textContent='0x'+hex(value);
    button.addEventListener('click',()=>{setWord(value);announce('Orbit state selected.');});return button;
  }));
}
function renderSurvey() {
  const summary=session.survey.summary(); shownCount=summary.processed;
  $('survey-status').textContent=summary.status.toUpperCase();
  $('survey-count').textContent=`${summary.processed.toLocaleString('en-US')} / 65,536`;
  $('survey-percent').textContent=Math.floor(summary.processed/65536*100)+'%'; $('survey-progress').value=summary.processed;
  for(const period of [1,2,4,8])$('count-'+period).textContent=summary.periodStates[period].toLocaleString('en-US');
  for(const [id,key] of [['unique','uniqueOutputs'],['return-eight','returnAfter8'],['closed-faces','closedFaces'],['edge-patterns','edgePatterns']])$(id).textContent=summary[key].toLocaleString('en-US');
  const complete=summary.status==='complete'; $('counts-label').textContent=complete?'ALL 65,536 STATES':'STATES COUNTED SO FAR';
  $('finding').textContent=complete?'Δ⁸(x) = x holds for every word. But 4,096 words return sooner: “returns after eight” does not mean “minimal period eight”.':'Run the census to inspect every word. Dark pixels have not been counted yet.';
}
function drawAtlas() {
  if(!ctx)return;
  const total=session.survey.processed;
  if(drawn===0)for(let i=0;i<65536;i++)pixels.data.set([...colours[0],255],i*4);
  for(let i=drawn;i<total;i++)pixels.data.set([...colours[session.survey.periodAt(i)],255],i*4);
  drawn=total;ctx.putImageData(pixels,0,0);ctx.strokeStyle='#ffffff';ctx.lineWidth=1;
  ctx.strokeRect((session.word&255)-1.5,(session.word>>>8)-1.5,4,4);
}
$('run').addEventListener('click',()=>{running=true;started=true;clock.setPaused(false);last=performance.now();status();announce('Running Δ at two steps per second and surveying the state space.');});
$('pause').addEventListener('click',()=>{pause();announce('Paused. The word and partial census are preserved.');});
$('reset').addEventListener('click',()=>{
  pause(); session.survey.cancel();session=createOmiSession();clock.reset();started=false;fault=false;selectedFace=0;drawn=0;
  $('seed').value='1234';$('xor-mask').value='5A3C';renderBench();renderSurvey();drawAtlas();status();announce('Reset to 0x1234. The census is ready to start again.');
});
$('load').addEventListener('click',()=>{try{const value=parseHex16($('seed').value);setWord(value);announce('Word loaded.');}catch(error){announce(error.message);}});
$('step').addEventListener('click',deltaStep);$('xor').addEventListener('click',applyXor);
$('common').addEventListener('click',()=>{setWord(xor16(session.word,0xffff));announce('All four nibbles XOR F. The six edge differences are unchanged.');});
$('fault').addEventListener('click',()=>{fault=!fault;renderBench();announce(fault?'One observed edge bit changed; two face checks fail.':'Observed edges restored.');});
canvas.addEventListener('pointerdown',event=>{if(event.isPrimary&&event.button===0){gesture={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};canvas.focus({preventScroll:true});}});
canvas.addEventListener('pointermove',event=>{if(gesture?.id===event.pointerId&&Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>6)gesture.moved=true;});
canvas.addEventListener('pointerup',event=>{
  const g=gesture;gesture=null;if(!g||g.id!==event.pointerId||g.moved)return;
  const bounds=canvas.getBoundingClientRect(),x=Math.floor((event.clientX-bounds.left)/bounds.width*256),y=Math.floor((event.clientY-bounds.top)/bounds.height*256);
  if(x>=0&&x<256&&y>=0&&y<256){setWord(y*256+x);announce('Atlas word selected.');}
});
canvas.addEventListener('pointercancel',()=>{gesture=null;});
canvas.addEventListener('keydown',event=>{
  const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-256,ArrowDown:256};
  if(event.repeat){if(Object.hasOwn(offsets,event.code)||['Space','KeyX'].includes(event.code))event.preventDefault();return;}
  if(Object.hasOwn(offsets,event.code)){event.preventDefault();setWord(Math.max(0,Math.min(65535,session.word+offsets[event.code])));}
  else if(event.code==='Space'){event.preventDefault();deltaStep();}else if(event.code==='KeyX'){event.preventDefault();applyXor();}
});
window.addEventListener('keydown',event=>{if(event.code==='Escape'&&!event.repeat){event.preventDefault();pause();}});
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
function unavailable(text){$('canvas-error').hidden=false;$('canvas-error').textContent=text;canvas.tabIndex=-1;}
if(!ctx)unavailable('Canvas 2D is unavailable. The word controls, diagram and numerical census still work.');
canvas.addEventListener('contextlost',event=>{event.preventDefault();pause();ctx=null;canvas.blur();unavailable('Atlas drawing context was lost. Reload to restore it. The numerical controls remain available.');});
renderBench();renderSurvey();drawAtlas();status();
function frame(now){
  try{clock.advance(Math.max(0,(now-last)/1000),dt=>stepOmiSession(session,dt));}catch(error){failed=true;pause();announce('Experiment stopped: '+error.message);}
  last=now;const changedWord=shownWord!==session.word,changedCount=shownCount!==session.survey.processed;
  if(changedWord||shownSteps!==session.deltaSteps)renderBench();if(changedCount)renderSurvey();if(changedWord||changedCount)drawAtlas();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
