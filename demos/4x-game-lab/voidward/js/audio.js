// SPDX-License-Identifier: Apache-2.0
// Adapted from QSOLKCB/4XGAMES 030859385ac8929e066702ef8af0518663480653: native VANILLAJS imports.
import { seededRandom, clamp } from '../../../../modules/math/index.js';
import { createSound2D } from '../../../../modules/audio2d/index.js';
import '../vendor/sonification/APP/js/namespace.js';
import '../vendor/sonification/APP/js/math64.js';
import '../vendor/sonification/APP/js/synthesis.js';
globalThis.Arcade = { rng: seededRandom, clamp, V2D: { createSound2D } };
await import('../vendor/arcade/js/audio.js');

// Small adapter over ARCADE's bounded voices and independent audio buses.
// Presentation preferences never enter the authoritative campaign state.
export class Soundscape {
  constructor() {
    this.effects = new globalThis.Arcade.Audio(); this.enabled = false;
    this.notes = new Map(); this.noteBytes = 0; this.timer = null;
    this.part = 0; this.score = []; this.sources = new Set();
    this.setLevels(.55, .8);
  }
  setLevels(music, effects) { this.effects.setLevels(music, effects); }
  get levels() { return { music: this.effects.musicLevel, effects: this.effects.fxLevel }; }
  setScore(score) { this.score = score; this.part = 0; this.stopMusic(); }
  async toggle() { return this.setEnabled(!this.enabled); }
  async setEnabled(enabled) {
    this.enabled = Boolean(enabled); this.effects.setEnabled(this.enabled);
    if (this.enabled) {
      await this.effects.ctx?.resume();
      if (!this.effects.ctx || this.effects.ctx.state !== 'running') {
        this.enabled = false; this.effects.setEnabled(false); throw new Error('Audio is unavailable in this browser.');
      }
      this.play();
    } else this.stopMusic();
    return this.enabled;
  }
  effect(name = 'select') { if (!document.hidden && this.enabled) this.effects.effect(name); }
  stopMusic() {
    clearTimeout(this.timer); this.timer = null;
    for (const source of [...this.sources]) { try { source.stop(); } catch {} source.onended?.(); }
  }
  suspend() { this.stopMusic(); this.effects.suspend(); }
  resume() {
    if (!this.enabled) return;
    this.effects.unlock();
    this.effects.ctx?.resume().then(() => this.play()).catch(() => {});
  }
  play() {
    if (!this.enabled || document.hidden || this.timer || !this.score.length || this.effects.ctx?.state !== 'running') return;
    const ctx = this.effects.ctx, note = this.score[this.part++ % this.score.length];
    const key = `fm/v1/${note.note}/${note.duration}/${ctx.sampleRate}`;
    // A muted music bus schedules silently; it does not allocate notes.
    if (this.effects.musicLevel > 0 && this.sources.size < 4) {
      if (!this.notes.has(key)) {
        const samples = globalThis.QSOLIMC.Synthesis.fm({ frequencyHz: 440 * 2 ** ((note.note - 69) / 12), durationSeconds: note.duration, velocity: .15, sampleRate: ctx.sampleRate, seed: BigInt(note.note) });
        const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate); buffer.getChannelData(0).set(samples);
        const bytes = samples.length * 4;
        while (this.notes.size && (this.notes.size >= 32 || this.noteBytes + bytes > 16 * 1024 * 1024)) {
          const oldest = this.notes.keys().next().value; this.noteBytes -= this.notes.get(oldest).length * 4; this.notes.delete(oldest);
        }
        this.notes.set(key, buffer); this.noteBytes += bytes;
      }
      const source = ctx.createBufferSource(), gain = ctx.createGain(); source.buffer = this.notes.get(key);
      gain.gain.value = 1.15; source.connect(gain); gain.connect(this.effects.music); this.sources.add(source);
      source.onended = () => { if (!this.sources.delete(source)) return; source.disconnect(); gain.disconnect(); }; source.start();
    }
    this.timer = setTimeout(() => { this.timer = null; this.play(); }, note.duration * 1000);
  }
}
