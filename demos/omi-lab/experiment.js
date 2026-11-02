// SPDX-License-Identifier: Apache-2.0
import {OMICRON, delta16, xor16, orbit16, tetrahedron} from '../../experiments/arch-omi/index.js';

export function parseHex16(text) {
  if (typeof text !== 'string' || !/^(?:0x)?[\da-f]{1,4}$/i.test(text.trim())) throw new RangeError('Enter one to four hexadecimal digits (0000–FFFF).');
  return Number.parseInt(text.trim().replace(/^0x/i, ''), 16);
}
/** Demo-owned enumeration, sliced by number of input states, not wall time. */
export class OmiSurvey {
  #periods = new Uint8Array(65536); #outputs = new Uint8Array(65536); #patterns = new Set();
  #counts = {1:0,2:0,4:0,8:0}; #fixed = []; #processed = 0; #unique = 0;
  #returns = 0; #mirrors = 0; #closedFaces = 0; #status = 'building'; #firstShorter = null;
  get status() { return this.#status; }
  get processed() { return this.#processed; }
  periodAt(value) {
    if (!Number.isInteger(value) || value < 0 || value > 65535) throw new RangeError('state outside atlas');
    return this.#periods[value];
  }
  step(maxStates = 256) {
    if (!Number.isInteger(maxStates) || maxStates < 1 || maxStates > 1024) throw new RangeError('survey budget must be 1..1024');
    let processed = 0;
    while (this.#status === 'building' && processed < maxStates) {
      const value = this.#processed, orbit = orbit16(value), shape = tetrahedron(value), output = delta16(value);
      if (orbit.status !== 'closed' || !Object.hasOwn(this.#counts, orbit.period)) throw new Error('Unexpected delta orbit; stop the survey.');
      this.#periods[value] = orbit.period; this.#counts[orbit.period]++;
      if (orbit.period === 1) this.#fixed.push(value);
      if (orbit.period < 8 && this.#firstShorter === null) this.#firstShorter = {word:value, period:orbit.period};
      if (!this.#outputs[output]) { this.#outputs[output] = 1; this.#unique++; }
      this.#patterns.add(shape.edges.reduce((packed, edge) => (packed << 4) | edge, 0));
      this.#closedFaces += shape.residuals.filter(v => v === 0).length;
      let eighth = value; for (let i = 0; i < 8; i++) eighth = delta16(eighth);
      if (eighth === value) this.#returns++;
      if (xor16(xor16(value, OMICRON), OMICRON) === value) this.#mirrors++;
      this.#processed++; processed++;
      if (this.#processed === 65536) this.#status = 'complete';
    }
    return {status:this.#status, processed, total:this.#processed};
  }
  cancel() { if (this.#status === 'building') this.#status = 'cancelled'; }
  summary() {
    return {status:this.#status, processed:this.#processed, periodStates:{...this.#counts},
      uniqueOutputs:this.#unique, returnAfter8:this.#returns, mirrorReturns:this.#mirrors,
      closedFaces:this.#closedFaces, edgePatterns:this.#patterns.size, fixedStates:[...this.#fixed],
      firstShorter:this.#firstShorter && {...this.#firstShorter}};
  }
}
export function createOmiSession() {
  return {word:0x1234, mask:OMICRON, deltaSteps:0, phase:0, elapsed:0, survey:new OmiSurvey()};
}
export function stepOmiSession(session, dt) {
  if (!Number.isFinite(dt) || dt < 0 || dt > .05) throw new RangeError('dt must be 0..0.05 seconds');
  if (dt === 0) return;
  session.survey.step(); session.elapsed += dt; session.phase += dt;
  if (session.phase >= .5 - 1e-12) {
    session.phase = Math.max(0, session.phase - .5); session.word = delta16(session.word); session.deltaSteps++;
  }
}
