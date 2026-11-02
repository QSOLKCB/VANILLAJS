import test from 'node:test';
import assert from 'node:assert/strict';
import {OmiSurvey, parseHex16, createOmiSession, stepOmiSession} from '../demos/omi-lab/experiment.js';
import {FixedClock} from '../modules/time/index.js';

test('OMI hex input accepts explicit finite words and rejects ambiguous or oversized input', () => {
  for (const [text,value] of [['0000',0],['ffff',65535],[' 0X5A3C ',0x5a3c],['a',10]]) assert.equal(parseHex16(text),value);
  for (const text of ['', ' ', '10000', '-1', '12.5', '1e+2', 'NaN', '12xz', 12, null]) assert.throws(() => parseHex16(text));
});
test('survey budgets and cancellation bound work, preserve partial status and protect summary ownership', () => {
  const survey = new OmiSurvey(); assert.equal(survey.periodAt(0), 0); assert.equal(survey.step(7).processed, 7);
  for (const n of [0,-1,1.5,1025,Infinity]) assert.throws(() => survey.step(n)); assert.equal(survey.processed,7);
  for (const n of [-1,65536,NaN]) assert.throws(() => survey.periodAt(n));
  const summary = survey.summary(); summary.periodStates[8] = 999; assert.notEqual(survey.summary().periodStates[8], 999);
  survey.cancel(); assert.equal(survey.status, 'cancelled'); assert.equal(survey.step().processed,0); assert.equal(survey.processed,7);
});
test('different survey slices yield the same exhaustive result and atlas classification', () => {
  const surveys = [127,1024].map(budget => {
    const survey = new OmiSurvey(); while (survey.status === 'building') assert.ok(survey.step(budget).processed <= budget); return survey;
  });
  assert.deepEqual(surveys[0].summary(),surveys[1].summary());
  for (let x=0;x<65536;x++) assert.equal(surveys[0].periodAt(x),surveys[1].periodAt(x));
  const summary=surveys[0].summary(); assert.equal(summary.status,'complete'); assert.equal(summary.processed,65536);
  assert.deepEqual(summary.periodStates,{1:8,2:56,4:4032,8:61440}); assert.equal(summary.uniqueOutputs,65536);
  assert.equal(summary.returnAfter8,65536); assert.equal(summary.mirrorReturns,65536); assert.equal(summary.closedFaces,262144);
  assert.equal(summary.edgePatterns,4096); assert.equal(summary.fixedStates.length,8);
  assert.equal(surveys[0].step().processed,0); surveys[0].cancel(); assert.equal(surveys[0].status,'complete');
});
test('pause, zero and rejected ticks preserve the word, animation and partial survey', () => {
  const s=createOmiSession(),clock=new FixedClock(); stepOmiSession(s,1/120); const before={...s,survey:s.survey.summary()};
  clock.setPaused(true); clock.advance(20,dt=>stepOmiSession(s,dt)); stepOmiSession(s,0);
  for(const dt of [-1,Infinity,NaN,.1]) assert.throws(()=>stepOmiSession(s,dt));
  assert.deepEqual({...s,survey:s.survey.summary()},before);
  s.survey.cancel(); const fresh=createOmiSession(); assert.equal(fresh.word,0x1234); assert.equal(fresh.survey.processed,0);
});
test('30/60/144 Hz schedules produce identical OMI words and complete surveys with bounded catch-up', () => {
  const states=[30,60,144].map(hz=>{
    const s=createOmiSession(),clock=new FixedClock(); for(let frame=0;frame<hz*4;frame++)clock.advance(1/hz,dt=>stepOmiSession(s,dt));
    return {...s,survey:s.survey.summary()};
  });
  assert.deepEqual(states[0],states[1]); assert.deepEqual(states[1],states[2]); assert.equal(states[0].deltaSteps,8); assert.equal(states[0].word,0x1234);
  const s=createOmiSession(),clock=new FixedClock(); clock.advance(100,dt=>stepOmiSession(s,dt)); assert.ok(s.survey.processed<=256*clock.maxSteps);
});
