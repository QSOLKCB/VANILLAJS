// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {CHUNK_BYTES, createReplayInbox, receiptPackets, REPLAY_WIRE} from '../api/replay/wire.js';
import {readPairingCode, SIGNAL_LIMIT} from '../api/replay/peer.js';
import {exportReplayReceipt, REPLAY_LIMITS, sealReplayReceipt} from '../modules/replay-audit/index.js';
import {BASE_BUILD, replayExamples} from '../demos/replay-audit-lab/scenarios.js';

const otherPin = 'a'.repeat(40);
const racing = await sealReplayReceipt(replayExamples().racing);
const bytes = new TextEncoder().encode(exportReplayReceipt(racing));
const frames = [...receiptPackets(racing, BASE_BUILD)];
const header = (size, build = BASE_BUILD) => JSON.stringify({protocol: REPLAY_WIRE, build, bytes: size});

// Independent sender for negative controls. The receiver must verify the tape
// even when its transport metadata, sequence numbers and byte counts are valid.
function frameData(bytes, pin = BASE_BUILD) {
  const packets = [header(bytes.length, pin)];
  for (let start = 0; start < bytes.length; start += CHUNK_BYTES) {
    const chunk = bytes.slice(start, start + CHUNK_BYTES);
    const index = packets.length - 1;
    packets.push(Uint8Array.of(index >> 8, index & 255, ...chunk).buffer);
  }
  return packets;
}
async function deliver(inbox, packets) {
  let result = null;
  for (const packet of packets) result = await inbox.receive(packet);
  return result;
}

test('owned multi-chunk receipt crosses the wire and is independently executable and exportable', async () => {
  assert.ok(frames.length >= 3);
  assert.deepEqual(frames, frameData(bytes));
  const inbox = createReplayInbox(BASE_BUILD);
  for (const [index, packet] of frames.slice(0, -1).entries()) {
    assert.equal(await inbox.receive(packet), null);
    assert.equal(inbox.received, index * CHUNK_BYTES);
    assert.equal(inbox.state, 'receiving');
  }
  const pending = inbox.receive(frames.at(-1));
  assert.equal(inbox.state, 'verifying');
  const received = await pending;
  assert.equal(inbox.state, 'verified');
  assert.equal(inbox.received, bytes.length);
  assert.notEqual(received, racing);
  assert.equal(exportReplayReceipt(received), exportReplayReceipt(racing));
  await assert.rejects(inbox.receive(frames[0]));
  assert.equal(inbox.state, 'verified');
  assert.throws(() => [...receiptPackets({...racing}, BASE_BUILD)]);
  assert.throws(() => [...receiptPackets(racing, otherPin)]);
});

test('the receiver pins the build before allocation and enforces one bounded header', async () => {
  for (const bad of [null, BASE_BUILD + '\n', BASE_BUILD.toUpperCase()]) assert.throws(() => createReplayInbox(bad));
  for (const bad of [null, new ArrayBuffer(2), '{}', ' '.repeat(161), header(0), header(-1), header(1.2),
    header(REPLAY_LIMITS.receiptBytes + 1), header(1, otherPin), header(4).replace('v1', 'v2'),
    header(5).replace('}', ',"extra":1}')]) {
    const inbox = createReplayInbox(BASE_BUILD);
    await assert.rejects(inbox.receive(bad));
    assert.equal(inbox.received, 0);
    assert.equal(inbox.total, 0);
    assert.equal(inbox.state, 'rejected');
  }
  const bounded = createReplayInbox(BASE_BUILD);
  await bounded.receive(header(REPLAY_LIMITS.receiptBytes));
  assert.equal(bounded.total, 262144);
  await assert.rejects(bounded.receive(header(1)));
});

test('truncation, gaps, repeats, oversize packets and malformed UTF-8 never admit a receipt', async () => {
  for (const packets of [[frames[0], frames[2]], [frames[0], frames[1], frames[1]],
    [frames[0], frames[1].slice(0, 100)], [frames[0], new ArrayBuffer(CHUNK_BYTES + 3)],
    [header(1), Uint8Array.of(0, 0, 255).buffer], [header(2), 'ok']]) {
    const inbox = createReplayInbox(BASE_BUILD);
    await assert.rejects(deliver(inbox, packets));
    assert.equal(inbox.state, 'rejected');
  }
  const truncated = createReplayInbox(BASE_BUILD);
  assert.equal(await deliver(truncated, frames.slice(0, -1)), null);
  truncated.close();
  await assert.rejects(truncated.receive(frames.at(-1)));
  assert.equal(truncated.state, 'closed');
});

test('valid transport metadata cannot confer replay authority or override an inner build', async () => {
  const forged = JSON.parse(exportReplayReceipt(racing));
  forged.trace[0].stateSha256 = '0'.repeat(64);
  for (const value of [forged, {...racing, build: otherPin}, {...racing, truncated: true}]) {
    const inbox = createReplayInbox(BASE_BUILD);
    await assert.rejects(deliver(inbox, frameData(new TextEncoder().encode(JSON.stringify(value)))));
    assert.equal(inbox.state, 'rejected');
  }
});

test('disconnect and excess input invalidate a verification already in flight', async () => {
  for (const close of [true, false]) {
    const inbox = createReplayInbox(BASE_BUILD);
    await deliver(inbox, frames.slice(0, -1));
    const old = inbox.receive(frames.at(-1));
    if (close) inbox.close();
    else await assert.rejects(inbox.receive(frames[1]));
    await assert.rejects(old, /cancelled/);
    assert.equal(inbox.state, close ? 'closed' : 'rejected');
  }
});

test('manual pairing codes admit one host-candidate data channel and the expected role', () => {
  const sdp = 'v=0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\na=candidate:1 1 UDP 1 local.test 50123 typ host\r\n';
  const offer = {type: 'offer', sdp};
  assert.deepEqual(readPairingCode(JSON.stringify(offer), 'offer'), offer);
  for (const value of [{...offer, type: 'answer'}, {...offer, extra: 1}, {...offer, sdp: ''},
    {...offer, sdp: sdp.replace('typ host', 'typ relay')}, {...offer, sdp: sdp + 'm=audio 9 UDP/TLS/RTP/SAVPF 0\r\n'}]) {
    assert.throws(() => readPairingCode(JSON.stringify(value), 'offer'));
  }
  assert.throws(() => readPairingCode(' '.repeat(SIGNAL_LIMIT + 1), 'answer'));
});
