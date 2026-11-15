/* SPDX-License-Identifier: Apache-2.0 */
import {SubHunt} from './sim.js';
import {SubHuntRenderer} from './render.js';
import {SubHuntController} from './controller.js';
import {SubHuntMusic} from './music.js';
import '../../../offline/register.js';
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const {create, step, STEP, MISSIONS, DIFFICULTIES, POWERUPS, MODES, clamp} = SubHunt;
  const draw = SubHuntRenderer($('game'));
  const keys = new Set(), touch = new Set(), pointers = new Map(), sessionProfiles = new Set();
  const Controller = SubHuntController;
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const neutral = () => ({x:0, y:0, fire:false, sonar:false});
  let difficulty = 'standard', mode = 'campaign';
  let role = 'boat', state = create(role,undefined,difficulty,mode), screen = 'menu', paused = false;
  let last = 0, accumulator = 0, visualTime = 0, toastTime = 0;
  let music = true, musicPlayer = null;
  const sounding = new Set();
  let sound = false, effects = !motionPreference.matches, effectsOverride = false, audio = null, highScore = 0;
  let queuedFire = false, queuedSonar = false, lastWarnSecond = -1;
  let padWasConnected = false, controllerUsed = false, requirePadRelease = false;
  let selectedPadKey = null;
  let previousPad = {fire:false, sonar:false, restart:false, pause:false, menu:false, direction:0};
  let profiles = [], activeProfile = Controller.freshDefault(), profileIdentity = '', activePad = null, calibration = null;
  try {
    const saved = JSON.parse(localStorage.getItem('vanillajs-subhunt-controllers-v1'));
    if (Array.isArray(saved)) profiles = saved.filter(p => typeof p.id === 'string' && Controller.valid(p.profile)).slice(-8);
  } catch {}

  try {
    const savedGame=localStorage.getItem('vanillajs-subhunt-mode-v1');
    if(Object.hasOwn(MODES,savedGame))mode=savedGame;
    const savedMode=localStorage.getItem('vanillajs-subhunt-difficulty-v1');
    if(Object.hasOwn(DIFFICULTIES,savedMode)) difficulty=savedMode;
    const best = Number(localStorage.getItem(bestKey()));
    if (Number.isSafeInteger(best) && best > 0) highScore = best;
    const saved = JSON.parse(localStorage.getItem('vanillajs-subhunt-preferences-v1'));
    if (typeof saved?.sound === 'boolean') sound = saved.sound;
    if (typeof saved?.music === 'boolean') music = saved.music;
    if (typeof saved?.effects === 'boolean') { effects = saved.effects; effectsOverride = true; }
  } catch { /* Storage is optional, including in file mode. */ }
  function savePreferences() {
    try { localStorage.setItem('vanillajs-subhunt-preferences-v1', JSON.stringify({sound, music, ...(effectsOverride ? {effects} : {})})); } catch {}
  }
  function bestKey() { return mode==='pond'?'vanillajs-subhunt-best-pond-'+difficulty+'-v1':difficulty==='standard'?'vanillajs-subhunt-best-v1':'vanillajs-subhunt-best-'+difficulty+'-v1'; }
  function stopAudio() {
    musicPlayer?.stop();
    for(const voice of sounding) { voice.osc.onended=null; voice.osc.stop(); voice.osc.disconnect(); voice.gain.disconnect(); }
    sounding.clear();
  }
  function updateMusic() {
    $('music').textContent=music?'MUSIC ON':'MUSIC OFF';
    $('music').setAttribute('aria-pressed',String(music));
    $('music').setAttribute('aria-label',music?'Disable soundtrack':'Enable soundtrack');
  }
  function musicFailed(error) {
    // Audio is presentation only; failed playback/export cannot stop combat.
    try { musicPlayer?.stop(); } catch { /* The device may itself have failed. */ }
    musicPlayer=null; music=false; updateMusic();
    console.warn('SubHunt soundtrack unavailable:',error);
    toast('Soundtrack unavailable. You can keep playing; try MUSIC again to retry.');
  }
  function selectMode(next) {
    if(screen!=='menu'||!Object.hasOwn(MODES,next))return;
    mode=next;
    try{localStorage.setItem('vanillajs-subhunt-mode-v1',mode);}catch{}
    for(const id of Object.keys(MODES)) { const b=$('mode-'+id);b.classList.toggle('selected',id===mode);b.setAttribute('aria-pressed',String(id===mode)); }
    $('mode-description').textContent=MODES[mode].description;
    selectDifficulty(difficulty);
  }
  function selectDifficulty(next) {
    if(screen!=='menu' || !Object.hasOwn(DIFFICULTIES,next)) return;
    difficulty=next; highScore=0;
    try { const best=Number(localStorage.getItem(bestKey())); if(Number.isSafeInteger(best)&&best>0)highScore=best; localStorage.setItem('vanillajs-subhunt-difficulty-v1',difficulty); } catch {}
    for(const id of Object.keys(DIFFICULTIES)) {
      const button=$('difficulty-'+id); button.classList.toggle('selected',id===difficulty);button.setAttribute('aria-pressed',String(id===difficulty));
    }
    $('difficulty-description').textContent=DIFFICULTIES[difficulty].description;
    state=create(role,undefined,difficulty,mode);draw.reset();hud();
  }
  function tone(frequency, duration=.12, type='sine', volume=.05, slide=0, delay=0) {
    if (!sound || !audio) return;
    const osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime + delay;
    osc.type = type; osc.frequency.setValueAtTime(frequency, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, now + duration);
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    const voice={osc,gain};sounding.add(voice);
    osc.onended=()=>{sounding.delete(voice);osc.disconnect();gain.disconnect();};
    osc.connect(gain); gain.connect(audio.destination); osc.start(now); osc.stop(now + duration);
  }
  function unlockAudio() {
    if (!sound) return;
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); musicPlayer ||= SubHuntMusic.player(audio); audio.resume().catch(() => {}); }
    catch { sound = false; updateSound(); }
  }
  function updateSound() {
    $('sound').textContent = sound ? 'SOUND ON' : 'SOUND OFF';
    $('sound').setAttribute('aria-pressed', String(sound));
    $('sound').setAttribute('aria-label', sound ? 'Mute sound' : 'Enable sound');
  }
  function updateEffects() {
    $('effects').textContent = effects ? 'FX ON' : 'CALM FX';
    $('effects').setAttribute('aria-pressed', String(effects));
    $('effects').setAttribute('aria-label', effects ? 'Reduce visual effects' : 'Enable visual effects');
    document.body.dataset.effects = effects ? 'full' : 'calm';
    draw.reset();
  }
  motionPreference.addEventListener('change', () => {
    if (!effectsOverride) { effects = !motionPreference.matches; updateEffects(); }
  });
  function toast(message) {
    $('toast').textContent = message; $('toast').classList.add('visible'); toastTime = 2.8;
  }
  function overlay(card) {
    $('overlay').hidden = !card;
    for (const id of ['start-card','result-card','pause-card','controller-card']) $(id).hidden = id !== card;
  }
  function selectRole(next) {
    if (role === next) return;
    role = next;
    for (const r of ['boat','sub']) {
      $('role-' + r).classList.toggle('selected', r === role);
      $('role-' + r).setAttribute('aria-pressed', String(r === role));
    }
    state = create(role,undefined,difficulty,mode); draw.reset(); hud();
  }
  function clearInput() {
    keys.clear(); touch.clear(); pointers.clear(); queuedFire = false; queuedSonar = false;
    document.querySelectorAll('[data-control]').forEach(b => b.classList.remove('pressed'));
  }
  function launch() {
    stopAudio(); unlockAudio(); clearInput(); state = create(role,undefined,difficulty,mode); screen = 'playing'; paused = false;
    accumulator = 0; lastWarnSecond = -1; draw.reset(); overlay(null);
    $('pause').disabled = false; $('pause').textContent = 'PAUSE Ⅱ';
    toast(mode==='pond'?'Claim 6 toys before the rival fleet. Sonar clears their shots!':role === 'boat' ? 'Lead your target. Hold fire to drop charges.' : 'Dive to dodge. Fire upward through gaps in the ducks.');
    hud(); document.activeElement?.blur();
    if (matchMedia('(max-width:850px)').matches) document.querySelector('.game-column').scrollIntoView({block:'start'});
  }
  function menu() {
    stopAudio(); screen = 'menu'; paused = false; clearInput(); state = create(role,undefined,difficulty,mode); draw.reset();
    overlay('start-card'); $('pause').disabled = true; $('pause').textContent = 'PAUSE Ⅱ'; $('toast').classList.remove('visible'); toastTime = 0;
    hud(); $('launch').focus();
  }
  function pause(value=!paused) {
    if (screen !== 'playing' || calibration) return;
    paused = value; if(paused)stopAudio();else unlockAudio(); clearInput(); accumulator = 0; overlay(paused ? 'pause-card' : null);
    $('pause').textContent = paused ? 'RESUME ▷' : 'PAUSE Ⅱ'; hud();
    if (paused) $('resume').focus(); else document.activeElement?.blur();
  }
  function finish() {
    stopAudio(); screen = 'result'; clearInput(); overlay('result-card'); $('pause').disabled = true;
    $('toast').classList.remove('visible'); toastTime = 0;
    const won = state.status === 'won', newBest = state.score > highScore;
    highScore = Math.max(highScore, state.score);
    try { localStorage.setItem(bestKey(), String(highScore)); } catch {}
    $('result-label').textContent = MODES[mode].name.toUpperCase()+' / '+DIFFICULTIES[difficulty].name.toUpperCase()+' / '+(newBest ? 'NEW PERSONAL BEST' : won ? 'TUB SECURED' : 'OPERATION REPORT');
    $('result-title').textContent = won ? 'You rule the tub.' : state.lossReason==='outscored'?'The toys got away.':state.lossReason === 'timeout' ? 'The water ran cold.' : 'Bath time over.';
    $('result-copy').textContent = won ? 'The porcelain is peaceful again. Hull remaining: ' + state.player.hp + ' / 5.' :
      (state.lossReason==='outscored'?'The rival fleet claimed six toys first. ':state.lossReason === 'timeout' ? 'Sector time expired. ' : 'Your hull gave out. ') + 'Try leading your shots and save a sonar pulse for incoming weapons.';
    $('report-score').textContent = state.score.toLocaleString();
    $('report-kills-label').textContent=mode==='pond'?'TOYS / RIVAL TOYS':'VESSELS SUNK';
    $('report-kills').textContent = mode==='pond'?state.stats.toys+' / '+state.stats.rivalToys:state.kills + ' / 12';
    $('report-accuracy').textContent = (state.stats.shots ? Math.round(state.stats.hits / state.stats.shots * 100) : 0) + '%';
    $('report-pings').textContent = state.stats.pings;
    $('report-pickups').textContent=state.stats.pickups;
    $('report-blocked').textContent=state.stats.blocked;
    $('again').focus(); hud();
  }
  function events() {
    draw.ingest(state.events, {effects});
    for (const e of state.events) {
      if (e.type === 'fire') tone(role === 'boat' ? 140 : 420, .18, 'triangle', .04, 65);
      if (e.type === 'sonar') { tone(900, .65, 'sine', .065, 420); tone(650, .45, 'sine', .025, 400, .2); }
      if (e.type === 'sink') { tone(90, .4, 'sawtooth', .025, 30); tone(720, .18, 'sine', .035); }
      if (e.type === 'toy') tone(700,.18,'triangle',.035,1100);
      if (e.type === 'rivalToy') tone(200,.12,'triangle',.025,100);
      if (e.type === 'pickup') {tone(660,.16,'triangle',.04);tone(880,.25,'triangle',.03,0,.1);toast(e.text+' COLLECTED');}
      if (e.type === 'block') tone(330,.3,'triangle',.04,660);
      if (e.type === 'hit') tone(1100, .1, 'triangle', .035, 600);
      if (e.type === 'damage') tone(160, .25, 'square', .025, 65);
      if (e.type === 'duck') tone(310, .14, 'triangle', .035, 210);
      if (e.type === 'warning') tone(240, .06, 'triangle', .012, 320);
      if (e.type === 'clear' || e.type === 'won') {
        tone(440, .2, 'sine', .04); tone(550, .2, 'sine', .04, 0, .12); tone(660, .4, 'sine', .04, 0, .24);
      }
      if (e.type === 'clear') { $('toast').classList.remove('visible'); toastTime = 0; }
      if (e.type === 'mission') toast('MISSION ' + (state.mission + 1) + ' / ' + e.text.toUpperCase());
    }
  }
  function hud() {
    const p = state.player, seconds = Math.ceil(state.timeLeft);
    $('pause').disabled = screen !== 'playing' || !!calibration;
    $('pause').textContent = paused ? 'RESUME ▷' : 'PAUSE Ⅱ';
    $('status').textContent = screen === 'menu' ? 'AWAITING CAPTAIN' : paused ? 'HOLDING POSITION' :
      state.status === 'won' ? 'TUB SECURED' : state.status === 'lost' ? (state.lossReason==='outscored'?'RIVAL WINS':state.lossReason === 'timeout' ? 'TIME EXPIRED' : 'VESSEL LOST') : state.transition > 0 ? 'SECTOR SECURED' : 'OPERATION LIVE';
    $('hull').textContent = Array.from({length:5}, (_,i) => i < p.hp ? '●' : '○').join(' ');
    $('hull').setAttribute('aria-label', p.hp + ' of 5 hull points');
    $('timer').textContent = String(Math.floor(seconds / 60)).padStart(2,'0') + ':' + String(seconds % 60).padStart(2,'0');
    $('score').textContent = String(state.score).padStart(6,'0');
    $('best-score').textContent = String(highScore).padStart(6,'0');
    $('mode-status').textContent=DIFFICULTIES[difficulty].name.toUpperCase();
    $('race-readout').hidden=mode!=='pond';
    $('race-player').textContent=state.race.player; $('race-ai').textContent=state.race.ai;
    $('race-left').textContent=state.targets.length+' TOYS LEFT · FIRST TO 6';
    $('power-status').textContent=Object.entries(p.powers).filter(([,v])=>v>0).map(([k,v])=>POWERUPS[k].label+' '+Math.ceil(v/60)+'s').join(' / ') || 'COLLECT + PATCH · O SHIELD · R RAPID · 3 VOLLEY';
    $('track-title').textContent=SubHuntMusic.THEMES[state.mission].name;
    $('mission').textContent = 'MISSION 0' + (state.mission + 1) + ' / ' + MISSIONS[state.mission].name.toUpperCase();
    document.querySelector('.scene-label span').textContent = 'SECTOR 0' + (state.mission + 1) + ' / ' + ['THE SHALLOW END','THE BUBBLE BANK','THE PLUGHOLE'][state.mission];
    $('role-brief').textContent = mode==='pond'?(role==='boat'?'Drop charges beside ducks or onto swimming fish.':'Dive beneath fish; fire up at fish and surface ducks.'):role === 'boat' ? 'Hold fire to drop charges. Ping to reveal the subs.' : 'Steer and dive. Fire through gaps in the ducks.';
    $('vessel-name').textContent = role === 'boat' ? 'PATROL BOAT' : 'SUBMARINE';
    $('contacts').textContent = state.enemies.length + (state.enemies.length === 1 ? ' CONTACT' : ' CONTACTS');
    $('weapon-status').textContent = p.cooldown > 0 ? 'RELOADING' : role === 'boat' ? 'CHARGES READY' : 'TORPEDO READY';
    $('ping-status').textContent = p.sonar > 0 ? 'SONAR ' + Math.ceil(p.sonar) + 's' : 'SONAR READY';
    $('depth').textContent = role === 'boat' ? 'SURFACE' : 'DEPTH ' + Math.round((p.y - SubHunt.SURFACE) / 7) + ' CM';
    $('sonar-time').textContent = p.sonar > 0 ? Math.ceil(p.sonar) + 's' : 'READY';
    $('fire-time').textContent = p.cooldown > 0 ? 'LOAD' : 'READY';
    for (const action of ['sonar','fire']) {
      const button = document.querySelector('[data-control="' + action + '"]');
      const remaining = action === 'sonar' ? p.sonar / 7 : p.cooldown / (role === 'boat' ? .48 : .42);
      button.style.setProperty('--charge', (100 * (1 - remaining)) + '%');
      button.classList.toggle('recharging', remaining > 0);
    }
    for (const direction of ['up','down']) document.querySelector('[data-control="' + direction + '"]').disabled = role === 'boat';
    document.querySelector('.console').classList.toggle('critical', p.hp <= 2 && screen === 'playing');
    $('timer').classList.toggle('urgent', seconds <= 15 && screen === 'playing');
    $('sector-banner').hidden = !(screen === 'playing' && !paused && state.transition > 0);
    if (state.transition > 0) $('next-sector').textContent = 'NEXT / ' + MISSIONS[state.mission + 1].name.toUpperCase();
    if (screen === 'playing' && !paused && seconds > 0 && seconds <= 10 && seconds !== lastWarnSecond) tone(480, .08, 'sine', .025);
    if (screen === 'playing' && !paused) lastWarnSecond = seconds;
  }
  function identify(pad) { return pad.id + ' / ' + (pad.mapping || 'raw'); }
  function deviceKey(pad) { return pad.index + ':' + identify(pad); }
  function useProfile(pad) {
    const id = identify(pad);
    if (id !== profileIdentity) {
      profileIdentity = id;
      activeProfile = profiles.find(p => p.id === id)?.profile || Controller.freshDefault();
    }
    $('controller-profile').textContent = profiles.some(p => p.id === id) ? (sessionProfiles.has(id) ? 'Custom USB mapping active for this session' : 'Custom USB mapping saved for this controller') : 'Default map · USB SNES pads can be remapped';
    $('controller-profile').title = pad.id;
  }
  function openSetup() {
    stopAudio(); clearInput();
    if (screen === 'playing') { paused = true; accumulator = 0; }
    calibration = {index:0, waiting:true, baseline:null,
      device:activePad ? deviceKey(activePad) : null, draft:{version:1, buttons:{}, directions:{}}, cancelTime:0};
    overlay('controller-card'); hud(); setupLabel();
    $('controller-cancel').focus();
    document.querySelector('.console').scrollIntoView({block:'nearest'});
  }
  function setupLabel(note) {
    if (!calibration) return;
    const step = Controller.STEPS[calibration.index];
    $('setup-progress').textContent = 'USB CONTROLLER / ' + Math.min(9, calibration.index + 1) + ' OF 9';
    $('setup-title').textContent = step ? 'Press ' + step.label + '.' : 'Release all controls.';
    $('setup-note').textContent = note || (calibration.waiting ? 'Let go of every button and the D-pad first.' : !calibration.baseline ?
      'Release the D-pad and sticks, then press A to confirm centre and assign fire.' :
      'Press once, then release. Your mapping is saved only after all nine inputs.');
  }
  function closeSetup() {
    calibration = null; clearInput(); requirePadRelease = true;
    overlay(screen === 'playing' ? 'pause-card' : screen === 'result' ? 'result-card' : 'start-card'); hud();
    (screen === 'playing' ? $('resume') : screen === 'result' ? $('again') : $('launch')).focus();
  }
  function saveController() {
    profiles = profiles.filter(p => p.id !== profileIdentity);
    profiles.push({id:profileIdentity, profile:activeProfile}); profiles = profiles.slice(-8);
    try { localStorage.setItem('vanillajs-subhunt-controllers-v1', JSON.stringify(profiles)); sessionProfiles.delete(profileIdentity); return true; }
    catch { sessionProfiles.add(profileIdentity); return false; }
  }
  function calibrate(pad, dt) {
    if (!calibration.device) calibration.device = deviceKey(pad);
    if (deviceKey(pad) !== calibration.device) { setupLabel('Reconnect the controller you started with.'); return; }
    const held = Array.from(pad.buttons).filter(b => b.pressed).length;
    calibration.cancelTime = held >= 2 ? calibration.cancelTime + dt : 0;
    if (calibration.cancelTime > .8) { closeSetup(); return; }
    if (calibration.waiting) {
      // No axis baseline exists until the user confirms centre with the first
      // face-button press. In particular, do not wait for axes held at entry.
      if (calibration.baseline ? !Controller.released(pad, calibration.baseline) : held > 0) return;
      calibration.waiting = false;
      if (calibration.index === Controller.STEPS.length) {
        if (Controller.valid(calibration.draft)) {
          activeProfile = calibration.draft; profileIdentity = identify(pad); const saved = saveController();
          closeSetup(); toast(saved ? 'Controller ready. Your USB mapping is saved on this browser.' : 'Controller ready for this session. Browser storage is unavailable.'); useProfile(pad);
        } else { calibration.index = 0; calibration.draft = {version:1, buttons:{}, directions:{}}; setupLabel('Mapping could not be validated. Please start again.'); }
      } else setupLabel();
      return;
    }
    const step = Controller.STEPS[calibration.index], binding = Controller.capture(pad, calibration.baseline || Array.from(pad.axes));
    if (!binding || (step.type === 'button' && binding.kind !== 'button')) return;
    const usedButtons = Object.values(calibration.draft.buttons).concat(Object.values(calibration.draft.directions).filter(b => b.kind === 'button').map(b => b.index));
    const duplicate = binding.kind === 'button' ? usedButtons.includes(binding.index) : Object.values(calibration.draft.directions).some(b => b.kind === 'axis' && b.index === binding.index && Math.abs(b.value-binding.value) < .1);
    if (duplicate) { setupLabel('That input is already assigned. Release it and choose another.'); return; }
    if (!calibration.baseline) calibration.baseline = Array.from(pad.axes);
    if (step.type === 'button') calibration.draft.buttons[step.key] = binding.index;
    else calibration.draft.directions[step.key] = binding;
    calibration.index++; calibration.waiting = true; setupLabel();
  }
  function gamepad(dt) {
    let pads = [];
    try { pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : []; } catch {}
    const pad = pads.find(p => p && p.connected);
    activePad = pad || null;
    $('pad-status').textContent = pad ? '● GAMEPAD CONNECTED' : '○ GAMEPAD READY TO CONNECT';
    if (!pad) {
      if (calibration) setupLabel('Connect your USB pad, then press a button so Chrome can detect it.');
      if (padWasConnected && controllerUsed && screen === 'playing' && !paused) { pause(true); toast('Controller disconnected. Reconnect or resume with keyboard / touch.'); }
      if (padWasConnected) requirePadRelease = true;
      padWasConnected = false; controllerUsed = false; selectedPadKey = null;
      previousPad = {fire:false, sonar:false, restart:false, pause:false, menu:false, direction:0};
      return neutral();
    }
    const nextPadKey = deviceKey(pad);
    if (selectedPadKey !== null && selectedPadKey !== nextPadKey) {
      requirePadRelease = true; controllerUsed = false; clearInput();
      previousPad = {fire:false, sonar:false, restart:false, pause:false, menu:false, direction:0};
      if (screen === 'playing' && !paused) pause(true);
      if (!calibration) toast('Controller changed. Release all controls, then resume.');
    }
    selectedPadKey = nextPadKey;
    padWasConnected = true; useProfile(pad);
    if (calibration) { calibrate(pad, dt); return neutral(); }
    const controls = Controller.read(pad, activeProfile);
    const now = {...controls, vertical:Math.abs(controls.y)>.5?Math.sign(controls.y):0, direction:Math.abs(controls.x) > .5 ? Math.sign(controls.x) : 0};
    if (requirePadRelease) {
      if (!Array.from(pad.buttons).some(b => b.pressed) && !controls.x && !controls.y) requirePadRelease = false;
      previousPad = now; return neutral();
    }
    const edge = key => now[key] && !previousPad[key];
    const beforeScreen = screen, beforePause = paused;
    if (controls.x || controls.y || now.fire || now.sonar || now.restart || now.pause || now.menu) controllerUsed = true;
    if (edge('pause')) {
      if (screen === 'menu' || screen === 'result') launch(); else pause();
    } else if (screen === 'menu') {
      if (edge('menu')) openSetup();
      else {
        if (now.direction && now.direction !== previousPad.direction) selectRole(now.direction < 0 ? 'boat' : 'sub');
        if(now.vertical && now.vertical!==previousPad.vertical) {const modes=Object.keys(DIFFICULTIES);selectDifficulty(modes[(modes.indexOf(difficulty)+now.vertical+modes.length)%modes.length]);}
        if(edge('sonar'))selectMode(mode==='campaign'?'pond':'campaign');
        if (edge('fire') || edge('restart')) launch();
      }
    } else if (screen === 'result') {
      if (edge('sonar') || edge('menu')) menu(); else if (edge('fire') || edge('restart')) launch();
    } else if (paused) {
      if (edge('sonar') || edge('menu')) menu(); else if (edge('restart')) launch(); else if (edge('fire')) pause(false);
    } else if (edge('menu')) pause(true);
    previousPad = now;
    if (calibration || screen !== beforeScreen || paused !== beforePause) return neutral();
    return {x:controls.x, y:controls.y, fire:now.fire || now.restart, sonar:now.sonar};
  }
  function input(pad) {
    const has = (...names) => names.some(k => keys.has(k) || touch.has(k));
    return {x:clamp((has('ArrowRight','KeyD','right') ? 1 : 0) - (has('ArrowLeft','KeyA','left') ? 1 : 0) + pad.x, -1, 1),
      y:clamp((has('ArrowDown','KeyS','down') ? 1 : 0) - (has('ArrowUp','KeyW','up') ? 1 : 0) + pad.y, -1, 1),
      fire:has('Space','fire') || pad.fire || queuedFire, sonar:has('KeyE','sonar') || pad.sonar || queuedSonar};
  }
  const gameplayKeys = ['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','Space','KeyE'];
  window.addEventListener('keydown', e => {
    if (calibration) { if (e.code === 'Escape') closeSetup(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') { if (!e.repeat) pause(); return; }
    if (e.code === 'KeyR' && (paused || screen === 'result')) { if (!e.repeat) launch(); return; }
    if (e.code === 'Space' && e.target.closest?.('button') && !(screen === 'playing' && !paused)) return;
    if (screen === 'playing' && !paused && gameplayKeys.includes(e.code)) {
      e.preventDefault(); keys.add(e.code);
      if (e.code === 'Space') queuedFire = true;
      if (e.code === 'KeyE') queuedSonar = true;
      unlockAudio();
    }
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => { clearInput(); if (screen === 'playing' && !calibration) pause(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); if (screen === 'playing' && !calibration) pause(true); } });
  $('role-boat').addEventListener('click', () => selectRole('boat'));
  $('role-sub').addEventListener('click', () => selectRole('sub'));
  for(const id of Object.keys(MODES)) $('mode-'+id).addEventListener('click',()=>selectMode(id));
  for(const id of Object.keys(DIFFICULTIES)) $('difficulty-'+id).addEventListener('click',()=>selectDifficulty(id));
  $('launch').addEventListener('click', launch); $('again').addEventListener('click', launch); $('restart').addEventListener('click', launch);
  $('change-role').addEventListener('click', menu); $('pause-menu').addEventListener('click', menu);
  $('pause').addEventListener('click', () => pause()); $('resume').addEventListener('click', () => pause(false));
  $('sound').addEventListener('click', () => { sound = !sound; if(!sound)stopAudio(); updateSound(); savePreferences(); unlockAudio(); tone(500); });
  $('music').addEventListener('click',()=>{music=!music;if(!music)musicPlayer?.stop();updateMusic();savePreferences();unlockAudio();});
  $('download-track').addEventListener('click',()=>{
    let wav;
    try { wav=SubHuntMusic.wav(state.mission); }
    catch(error) { musicFailed(error); return; }
    const url=URL.createObjectURL(new Blob([wav],{type:'audio/wav'})), a=document.createElement('a');
    a.href=url;a.download='vanillajs-subhunt-sector-'+(state.mission+1)+'.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('effects').addEventListener('click', () => { effects = !effects; effectsOverride = true; updateEffects(); savePreferences(); });
  $('controller-setup').addEventListener('click', openSetup);
  $('controller-cancel').addEventListener('click', closeSetup);
  $('controller-reset').addEventListener('click', () => {
    if (activePad) {
      profiles = profiles.filter(p => p.id !== identify(activePad)); activeProfile = Controller.freshDefault();
      try { localStorage.setItem('vanillajs-subhunt-controllers-v1', JSON.stringify(profiles)); } catch {}
      useProfile(activePad);
    }
    closeSetup();
  });
  $('fullscreen').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.querySelector('.game-column').requestFullscreen(); }
    catch { toast('Fullscreen is unavailable in this browser.'); }
  });
  for (const b of document.querySelectorAll('[data-control]')) {
    b.addEventListener('pointerdown', e => {
      if (screen !== 'playing' || paused) return;
      e.preventDefault(); b.setPointerCapture(e.pointerId); pointers.set(e.pointerId, b.dataset.control);
      touch.add(b.dataset.control); b.classList.add('pressed');
      if (b.dataset.control === 'fire') queuedFire = true;
      if (b.dataset.control === 'sonar') queuedSonar = true;
      unlockAudio();
    });
    const up = e => {
      pointers.delete(e.pointerId);
      if (!Array.from(pointers.values()).includes(b.dataset.control)) { touch.delete(b.dataset.control); b.classList.remove('pressed'); }
    };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  }
  function frame(now) {
    const dt = Math.min((now - (last || now)) / 1000, .1); last = now;
    const pad = gamepad(dt);
    if (!paused) {
      visualTime += dt;
      if (toastTime > 0) { toastTime -= dt; if (toastTime <= 0) $('toast').classList.remove('visible'); }
    }
    if (screen === 'playing' && !paused) {
      queuedFire ||= pad.fire; queuedSonar ||= pad.sonar; accumulator += dt;
      const controls = input(pad);
      while (accumulator >= STEP && state.status === 'playing') {
        step(state, controls); queuedFire = false; queuedSonar = false; events(); accumulator -= STEP;
      }
      if (state.status !== 'playing') finish();
      hud();
    }
    try { musicPlayer?.sync(state,sound && music && screen==='playing' && !paused && !calibration); }
    catch(error) { musicFailed(error); }
    draw.draw(state, visualTime, paused ? 0 : dt, {effects});
    requestAnimationFrame(frame);
  }
  Object.defineProperty(window, 'subhunt', {value:Object.freeze({snapshot:() => JSON.parse(JSON.stringify({screen, paused, role, difficulty, mode, effects, sound, music, soundtrack:musicPlayer?.snapshot() || null, highScore, controllerProfile:activeProfile, calibration:calibration ? {step:calibration.index, waiting:calibration.waiting} : null, state}))})});
  updateSound(); updateMusic(); updateEffects(); selectMode(mode); hud(); requestAnimationFrame(frame);
})();
