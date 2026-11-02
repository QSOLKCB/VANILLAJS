// SPDX-License-Identifier: Apache-2.0
import {FixedClock} from '../../modules/time/index.js';
import {EDGES, VERTICES, orbit16, tetrahedron} from '../../experiments/arch-omi/index.js';
import {BrassMachine, MAX_DETENTS, STAGES} from './machine.js';

const $ = id => document.getElementById(id);
const hex = n => '0x' + n.toString(16).toUpperCase().padStart(4, '0');
const svgNS = 'http://www.w3.org/2000/svg';
function svg(tag, attributes, parent, text) {
  const node = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  parent.append(node); return node;
}
function gear(radius, teeth) {
  const points = [];
  for (let i = 0; i < teeth * 4; i++) {
    const angle = i * Math.PI / (teeth * 2), r = radius - (i % 4 < 2 ? 0 : 7);
    points.push(`${Math.cos(angle) * r},${Math.sin(angle) * r}`);
  }
  return 'M' + points.join('L') + 'Z';
}
const centers = [[205,195], [675,195], [205,515], [675,515]];
const drums = centers.map(([x,y], index) => {
  const mount = svg('g', {transform:`translate(${x} ${y})`}, $('drums'));
  svg('text', {y:-116, class:'drum-label'}, mount, VERTICES[index]);
  svg('circle', {r:106, class:'drum-rim'}, mount);
  const rotor = svg('g', {class:'drum-rotor'}, mount);
  svg('path', {d:gear(100,32), fill:'url(#brass)'}, rotor);
  svg('circle', {r:89, class:'drum-face'}, rotor);
  svg('circle', {r:58, class:'drum-groove'}, rotor);
  for (let digit = 0; digit < 16; digit++) {
    svg('text', {transform:`rotate(${digit * 22.5})`, y:-72, class:'drum-digit'}, rotor, digit.toString(16).toUpperCase());
  }
  svg('path', {d:'M-9-104H9L0-91Z', class:'drum-pointer'}, mount);
  svg('rect', {x:-33,y:-29,width:66,height:58,rx:5,class:'drum-window'}, mount);
  const value = svg('text', {y:15,class:'drum-value'}, mount, index+1);
  svg('text', {y:126,class:'drum-bits'}, mount, `BITS ${15-index*4}—${12-index*4}`);
  return {rotor, value};
});
const edgePositions = [[440,186],[205,355],[310,266],[570,266],[675,355],[440,515]];
const edges = edgePositions.map(([x,y], i) => {
  const g = svg('g', {class:'edge-number',transform:`translate(${x} ${y})`}, $('edge-values'));
  svg('title', {}, g, VERTICES[EDGES[i][0]] + ' XOR ' + VERTICES[EDGES[i][1]]);
  svg('rect', {x:-15,y:-12,width:30,height:24,rx:4}, g);
  return svg('text', {y:5}, g, '0');
});
$('cam-teeth').setAttribute('d', gear(119, 32));
const marks = Array.from({length:8}, (_,i) => {
  const a = i * Math.PI / 4;
  return svg('text', {x:Math.sin(a)*130,y:-Math.cos(a)*130+4,class:'cam-mark'}, $('cam-marks'), i);
});
const laneInfo = [['capture','X · CAPTURE'],['a','A · ROTATE LEFT 1'],['b','B · ROTATE LEFT 3'],
  ['c','C · ROTATE RIGHT 2'],['mix','M · XOR ACCUMULATOR'],['output','Y · M XOR 5A3C']];
const lanes = laneInfo.map(([key,label]) => {
  const row = document.createElement('div'); row.className = 'register-row'; row.dataset.register = key;
  const heading = document.createElement('div'); heading.className = 'register-label';
  const name = document.createElement('span'); name.textContent = label;
  const value = document.createElement('output'); value.setAttribute('aria-label', label);
  heading.append(name,value);
  const strip = document.createElement('div'); strip.className = 'bit-strip'; strip.setAttribute('aria-hidden','true');
  const bits = Array.from({length:16}, () => {const bit = document.createElement('i');strip.append(bit);return bit;});
  row.append(heading,strip); $('registers').append(row); return {key,row,value,strip,bits};
});

let machine = new BrassMachine(), running = false, last = null, revision = 0;
let pointer = null, completed = null;
const held = new Set(), clock = new FixedClock(); clock.setPaused(true);
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
$('reduced-motion').checked = motionPreference.matches;
function tell(message, error = false) {$('message').textContent = message;$('message').classList.toggle('error',error);}
function cancelControls() {pointer = null; completed = null; held.clear();}
function pause(label = 'PAUSED') {
  running = false; clock.setPaused(true); last = null; cancelControls();
  $('status').textContent = label; $('status-light').classList.remove('running');
  $('motor').textContent = 'Run motor'; $('motor').setAttribute('aria-pressed','false');
}
function drawMotion(state) {
  const angle = 45 * (state.phase + ($('reduced-motion').checked ? 0 : state.subTick / state.ticksPerDetent));
  $('cam').setAttribute('transform', `rotate(${angle})`);
  $('crank-arm').setAttribute('transform', `rotate(${angle})`);
  $('subtick').textContent = `${String(state.subTick).padStart(2,'0')} / ${state.ticksPerDetent}`;
}
function render() {
  const s = machine.snapshot(), relation = tetrahedron(s.word);
  $('word').textContent = hex(s.word); $('turns').textContent = String(s.turns).padStart(5,'0');
  $('detents').textContent = String(s.detents).padStart(6,'0');
  $('detent-label').textContent = `DETENT ${s.phase} / 8`; $('stage').textContent = STAGES[s.phase];
  $('period').textContent = `PERIOD ${orbit16(s.word).period}`;
  for (let i = 0; i < 4; i++) {
    drums[i].value.textContent = s.nibbles[i].toString(16).toUpperCase();
    drums[i].rotor.setAttribute('transform', `rotate(${-22.5*s.nibbles[i]})`);
  }
  relation.edges.forEach((edge,i) => {edges[i].textContent = edge.toString(16).toUpperCase();});
  $('faces').textContent = relation.residuals.map((r,i) => `${VERTICES[i]} ${r}`).join(' · ');
  marks.forEach((mark,i) => mark.classList.toggle('active', i === s.phase));
  const activeLane = ['', 'capture','a','b','c','mix','mix','output'][s.phase];
  for (const lane of lanes) {
    const value = s.registers[lane.key];
    lane.value.textContent = value === null ? '— — — —' : hex(value);
    lane.strip.classList.toggle('pending',value === null); lane.row.classList.toggle('active',lane.key === activeLane);
    lane.bits.forEach((bit,i) => bit.classList.toggle('on',value !== null && ((value >>> (15-i)) & 1) === 1));
  }
  $('back').disabled = s.detents === 0; $('step').disabled = $('crank').disabled = s.detents === MAX_DETENTS;
  $('turn').disabled = s.detents > MAX_DETENTS - 8; $('motor').disabled = s.detents === MAX_DETENTS;
  $('receipts').replaceChildren();
  const receipts = machine.receipts();
  for (const receipt of receipts) {
    const row = document.createElement('tr');
    for (const value of [String(receipt.turn).padStart(5,'0'),hex(receipt.input),hex(receipt.output)]) {
      const cell = document.createElement('td');cell.textContent = value;row.append(cell);
    }
    $('receipts').append(row);
  }
  if (!receipts.length) {
    const row = document.createElement('tr'), cell = document.createElement('td');
    cell.colSpan = 3;cell.textContent = 'No completed revolutions yet.';row.append(cell);$('receipts').append(row);
  }
  drawMotion(s);
}
function move(amount) {
  revision++; pause();
  const moved = machine.move(amount); render();
  tell(moved ? `Detent ${machine.snapshot().detents}. ${STAGES[machine.snapshot().phase]}.` : 'The counter has reached its limit. Rewind or load a word.');
}
function toggleMotor() {
  revision++;
  if (running) {pause();tell('Motor paused. Every register and the crank position are held.');return;}
  if (machine.snapshot().detents === MAX_DETENTS) {tell('The turn counter is full. Rewind or load a word.');return;}
  cancelControls(); running = true; last = null; clock.setPaused(false);
  $('status').textContent = 'RUNNING';$('status-light').classList.add('running');
  $('motor').textContent = 'Pause motor';$('motor').setAttribute('aria-pressed','true');
  tell('The motor is turning. The eighth detent latches each new word.');
}
function loadSeed(seed) {
  const next = new BrassMachine({seed,ticksPerDetent:machine.snapshot().ticksPerDetent});
  revision++;pause('AT REST');machine = next;$('seed').value = hex(seed).slice(2);render();
  tell(`Loaded ${hex(seed)}. The complete mechanism is rewound.`);
}
$('seed-form').addEventListener('submit',event => {
  event.preventDefault();const value = $('seed').value.trim();
  if (!/^(?:0x)?[0-9a-f]{1,4}$/i.test(value)) {tell('Enter one to four hexadecimal digits (0000–FFFF). The mechanism was not changed.',true);return;}
  loadSeed(Number.parseInt(value.replace(/^0x/i,''),16));
});
document.querySelectorAll('[data-seed]').forEach(button => button.addEventListener('click',()=>loadSeed(Number.parseInt(button.dataset.seed,16))));
$('back').addEventListener('click',()=>move(-1));$('step').addEventListener('click',()=>move(1));
$('turn').addEventListener('click',()=>move(8));$('crank').addEventListener('click',()=>move(1));
$('motor').addEventListener('click',toggleMotor);
$('reset').addEventListener('click',()=>loadSeed(machine.snapshot().seed));
$('rate').addEventListener('change',()=>{revision++;pause();machine.setRate(Number($('rate').value));render();tell('Motor rate changed. The crank is aligned to its current detent.');});
$('reduced-motion').addEventListener('change',()=>drawMotion(machine.snapshot()));
$('save').addEventListener('click',()=>{
  revision++;pause();
  const blob = new Blob([JSON.stringify(machine.exportReplay(),null,2)+'\n'],{type:'application/json'});
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url;link.download = 'omi-brass-replay.json';document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);tell('Replay saved locally. The mechanism is paused at the saved position.');
});
$('restore').addEventListener('click',()=>{revision++;pause();$('replay-file').click();});
$('replay-file').addEventListener('change',async()=>{
  const file = $('replay-file').files[0];$('replay-file').value = '';if (!file) return;
  const ticket = ++revision;pause();
  try {
    if (file.size > 16384) throw new RangeError('Replay files must be at most 16 KiB.');
    const next = BrassMachine.fromReplay(JSON.parse(await file.text()));
    if (ticket !== revision) return; // Do not replace newer input after an async read.
    machine = next;$('seed').value = hex(machine.snapshot().seed).slice(2);
    $('rate').value = String(machine.snapshot().ticksPerDetent);render();
    tell('Replay restored. The engine is paused at the recorded motor position.');
  } catch (error) {if (ticket === revision) tell(`Replay rejected. ${error.message} The mechanism was not changed.`,true);}
});

// Only completed button gestures activate. Late releases after blur/Escape and
// drags across a control cannot advance a detent or restart the motor.
document.addEventListener('pointerdown',event=>{
  const target = event.target.closest('button');
  pointer = target && event.button === 0 ? {target,id:event.pointerId,x:event.clientX,y:event.clientY} : null;
  completed = null;
},true);
document.addEventListener('pointermove',event=>{
  if (pointer && pointer.id === event.pointerId && Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>10) pointer = null;
},true);
document.addEventListener('pointerup',event=>{
  completed = pointer && pointer.id === event.pointerId && pointer.target === event.target.closest('button') ? pointer.target : null;
  pointer = null;
},true);
document.addEventListener('pointercancel',()=>{pointer = null;completed = null;},true);
document.addEventListener('click',event=>{
  const target = event.target.closest('button');
  if (target && event.detail > 0 && completed !== target) {event.preventDefault();event.stopImmediatePropagation();}
  completed = null;
},true);
document.addEventListener('keydown',event=>{
  if (event.code === 'Escape') {
    event.preventDefault();if (!event.repeat) {revision++;pause();tell('Paused. Press or tap a control deliberately to continue.');}return;
  }
  if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  const crank = event.target === $('crank'), button = event.target.closest('button');
  const command = crank && ['ArrowLeft','ArrowRight','Space','Enter'].includes(event.code);
  if (!command && !(button && ['Space','Enter'].includes(event.code))) return;
  event.preventDefault();
  if (event.repeat || held.has(event.code)) return;
  held.add(event.code);
  if (command) {
    if (event.code === 'Space') toggleMotor();
    else move(event.code === 'ArrowLeft' ? -1 : event.code === 'Enter' ? 8 : 1);
  } else if (!button.disabled) button.click();
},true);
document.addEventListener('keyup',event=>{
  held.delete(event.code);
  if (event.target.closest('button') && ['Space','Enter'].includes(event.code)) event.preventDefault();
},true);
window.addEventListener('blur',()=>{revision++;pause();});
document.addEventListener('visibilitychange',()=>{if (document.hidden) {revision++;pause();}});
function frame(now) {
  if (running) {
    const before = machine.snapshot().detents;
    clock.advance(last === null ? 0 : Math.max(0,(now-last)/1000),()=>{
      machine.tick();
      if (machine.snapshot().detents === MAX_DETENTS) {pause('COUNTER FULL');tell('65,535 revolutions complete. Rewind or load a word to continue.');}
    });
    if (machine.snapshot().detents !== before) render();else drawMotion(machine.snapshot());
  }
  last = now;requestAnimationFrame(frame);
}
pause('AT REST');render();requestAnimationFrame(frame);
