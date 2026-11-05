import test from 'node:test';
import assert from 'node:assert/strict';
import {IntegerEngine, replayInteger, integerChecksum} from '../modules/integer-engine/index.js';
import {IntegerCollider, createIntegerBody} from '../modules/integer-physics/index.js';
import {IntegerClock} from '../modules/integer-time/index.js';
import {INT_MAX} from '../modules/integer-math/index.js';
const body = (id = 1, position = [0, 10, 0]) => ({id, position, halfSize: [1, 1, 1], velocity: [0, 0, 0]});
const wall = (id = 1) => ({id, min: [5, -20, -20], max: [6, 20, 20]});

test('axis sweeps stop fast bodies at thin walls with deterministic ties and slide', () => {
  const collider = new IntegerCollider([wall(8), wall(2)]);
  const result = collider.move(body(), [10000, -5, 2]);
  assert.deepEqual(result.body.position, [4, 5, 2]);
  assert.deepEqual(result.contacts, [{boxId: 2, axis: 0, normal: -1}]);
  assert.deepEqual(collider.move(body(1, [10, 10, 0]), [-10000, 0, 0]).body.position, [7, 10, 0]);
  assert.deepEqual(collider.move(body(1, [4, 10, 0]), [-2, 0, 0]).body.position, [2, 10, 0]);
  assert.throws(() => collider.move(body(1, [5, 10, 0]), [1, 0, 0]));
  assert.deepEqual(collider.move(body(1, [0, 21, 0]), [100, 0, 0]).body.position, [100, 21, 0], 'grazing face is not penetration');
});
test('exhaustive small one-axis sweeps agree with unit-step collision oracle', () => {
  const boxes = [{id: 1, min: [4, -2, -2], max: [6, 2, 2]}, {id: 2, min: [-6, -2, -2], max: [-4, 2, 2]}];
  const collider = new IntegerCollider(boxes);
  for (let x = -10; x <= 10; x++) for (let d = -20; d <= 20; d++) {
    const penetrates = value => boxes.some(b => value + 1 > b.min[0] && value - 1 < b.max[0]);
    if (penetrates(x)) continue;
    let expected = x;
    for (let n = 0; n < Math.abs(d); n++) { const next = expected + Math.sign(d); if (penetrates(next)) break; expected = next; }
    const moved = collider.move(body(1, [x, 0, 0]), [d, 0, 0]);
    assert.equal(moved.body.position[0], expected, `x=${x}, d=${d}`);
  }
});
test('scene/body validation and isolation reject malformed geometry', () => {
  assert.throws(() => new IntegerCollider([wall(), wall()]));
  assert.throws(() => new IntegerCollider([{id: 1, min: [0, 0, 0], max: [0, 1, 1]}]));
  assert.throws(() => createIntegerBody({...body(), halfSize: [0, 1, 1]}));
  assert.throws(() => createIntegerBody(body(1, [INT_MAX, 0, 0])));
  assert.throws(() => new IntegerEngine({bodies: [body(), body()]}));
  const original = wall(), collider = new IntegerCollider([original]); original.min[0] = 100;
  assert.equal(collider.boxes[0].min[0], 5); assert.throws(() => collider.boxes[0].min[0] = 100);
});
test('a failed later body or command leaves the entire tick and RNG unchanged', () => {
  const engine = new IntegerEngine({bodies: [body(), body(2, [INT_MAX - 2, 0, 0])], seed: 83}), before = engine.serialize();
  assert.throws(() => engine.step([{id: 1, velocity: [2, 0, 0]}, {id: 2, velocity: [4, 0, 0]}]));
  assert.equal(engine.serialize(), before);
  for (const commands of [[{id: 3}], [{id: 1}, {id: 1}], [{id: 1, velocity: [1.5, 0, 0]}], [{id: 1, acceleration: undefined}], [{id: 1, typo: true}]]) {
    assert.throws(() => engine.step(commands)); assert.equal(engine.serialize(), before);
  }
  const detached = engine.bodies; detached[0].position[0] = 99; assert.equal(engine.serialize(), before);
});
test('canonical snapshots, shuffled IDs and 10000-tick replay/save continuation match exactly', () => {
  const make = bodies => new IntegerEngine({bodies, boxes: [wall(9), wall(3)], seed: 0});
  const engine = make([body(2), body(1)]), other = make([body(1), body(2)]), initial = engine.snapshot(), frames = [];
  for (let i = 0; i < 10000; i++) {
    const commands = [{id: 2, velocity: [i % 2 ? -1 : 1, 0, 0]}, {id: 1, velocity: [i % 3 ? 1 : -1, 0, 0]}];
    frames.push(commands); engine.step(commands); other.step([...commands].reverse());
  }
  assert.equal(engine.serialize(), other.serialize());
  const middle = replayInteger(initial, frames.slice(0, 5000));
  const restored = IntegerEngine.fromSnapshot(JSON.parse(middle.serialize()));
  for (const frame of frames.slice(5000)) restored.step(frame);
  assert.equal(restored.serialize(), engine.serialize()); assert.equal(integerChecksum(restored), integerChecksum(engine));
  assert.equal(replayInteger(initial, frames).serialize(), engine.serialize());
});
test('snapshot schemas, counter overflow, missing fields and invalid states fail closed', () => {
  const engine = new IntegerEngine({bodies: [body()]});
  for (const change of [s => s.scale++, s => s.tick = -1, s => s.tick = 1.1, s => s.randomState = -1,
    s => s.extra = 1, s => delete s.bodies[0].velocity, s => s.bodies[0].position[0] = Infinity,
    s => s.schema = 'vanillajs-integer-engine/2', s => s.randomState = undefined,
    s => s.bodies[0].position = undefined, s => s.bodies[0].halfSize = undefined, s => s.bodies[0].velocity = undefined]) {
    const s = engine.snapshot(); change(s); assert.throws(() => IntegerEngine.fromSnapshot(s));
  }
  const s = engine.snapshot(); s.tick = INT_MAX;
  const end = IntegerEngine.fromSnapshot(s), before = end.serialize(); assert.throws(() => end.step()); assert.equal(end.serialize(), before);
});
test('integer clock produces exactly 120 ticks per second across frame partitions', () => {
  const run = intervals => {
    const c = new IntegerClock({maxFrameUs: 1000000, maxSteps: 1000}), e = new IntegerEngine({bodies: [body()]});
    for (const us of intervals) c.advance(us, tick => { assert.equal(tick, e.tick + 1); e.step([{id: 1, velocity: [1, 0, 0]}]); });
    return [c.ticks, c.phase, e.serialize()];
  };
  assert.deepEqual(run([1000000]), run([...Array(1000).fill(1000)]));
  assert.deepEqual(run([1000000]), run([333333, 333333, 333334]));
  assert.equal(run([1000000])[0], 120);
});
test('clock bounds catch-up, discards debt, cancels on pause and rejects reentrancy', () => {
  const c = new IntegerClock({maxSteps: 2}); let ticks = 0;
  assert.deepEqual(c.advance(1000000, () => ticks++), {steps: 2, phase: 0, denominator: 1000000, clampedUs: 750000, discardedTicks: 28});
  c.advance(8334, () => c.setPaused(true)); assert.equal(c.phase, 0); assert.equal(c.paused, true);
  c.advance(999999, () => assert.fail()); c.setPaused(false); assert.equal(c.advance(0, () => ticks++).steps, 0);
  assert.throws(() => c.advance(1.2, () => {}));
  assert.throws(() => c.advance(8334, () => c.advance(0, () => {})), /recursive/);
  assert.equal(c.paused, true); assert.equal(c.phase, 0);
  const before = c.ticks; c.setPaused(false); c.advance(8334, () => {}); assert.equal(c.ticks, before + 1);
  const d = new IntegerClock(); assert.throws(() => d.advance(8334, () => d.reset()), /cannot reset/);
  assert.equal(d.ticks, 0); assert.equal(d.paused, true);
});
