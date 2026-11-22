// SPDX-License-Identifier: Apache-2.0
import {exportReplayReceipt, importReplayReceipt, REPLAY_LIMITS} from '../../modules/replay-audit/index.js';

export const REPLAY_WIRE = 'qsol.vanillajs.replay-link.v1';
export const CHUNK_BYTES = 8192;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true});

export function checkBuild(build) {
  if (typeof build !== 'string' || build.length !== 40 || /[^0-9a-f]/.test(build)) {
    throw new TypeError('Enter an independently known 40-character lowercase Git SHA');
  }
  return build;
}

/** Each ordered channel carries one owned receipt. Binary chunks split UTF-8 bytes. */
export function* receiptPackets(receipt, expectedBuild) {
  checkBuild(expectedBuild);
  const bytes = encoder.encode(exportReplayReceipt(receipt));
  if (receipt.build !== expectedBuild) throw new Error('Local receipt build mismatch');
  yield JSON.stringify({protocol: REPLAY_WIRE, build: expectedBuild, bytes: bytes.length});
  for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
    const payload = bytes.subarray(offset, offset + CHUNK_BYTES);
    const packet = new Uint8Array(2 + payload.length);
    new DataView(packet.buffer).setUint16(0, offset / CHUNK_BYTES, false);
    packet.set(payload, 2);
    yield packet.buffer;
  }
}

function payloadLength(header, build) {
  if (typeof header !== 'string' || header.length > 160 || /[^\x20-\x7e]/.test(header)) {
    throw new Error('Expected a bounded ASCII transfer header');
  }
  const h = JSON.parse(header);
  if (!h || h.protocol !== REPLAY_WIRE || h.build !== build || Object.keys(h).length !== 3 ||
      !Number.isSafeInteger(h.bytes) || h.bytes < 1 || h.bytes > REPLAY_LIMITS.receiptBytes) {
    throw new Error('Unsupported transfer header, build or byte count');
  }
  return h.bytes;
}

/** Receives bounded bytes. Only local re-execution can return a verified receipt. */
export function createReplayInbox(expectedBuild) {
  checkBuild(expectedBuild);
  let state = 'header', buffer = null, received = 0, total = 0;

  async function receive(packet) {
    if (state === 'closed' || state === 'rejected' || state === 'verified') {
      throw new Error('Transfer already ended');
    }
    try {
      if (state === 'header') {
        total = payloadLength(packet, expectedBuild);
        buffer = new Uint8Array(total);
        state = 'receiving';
        return null;
      }
      const size = Math.min(CHUNK_BYTES, total - received);
      if (state !== 'receiving' || !(packet instanceof ArrayBuffer) || packet.byteLength !== size + 2 ||
          new DataView(packet).getUint16(0, false) !== received / CHUNK_BYTES) {
        throw new Error('Unexpected replay chunk size, sequence or state');
      }
      buffer.set(new Uint8Array(packet, 2), received);
      received += size;
      if (received < total) return null;
      state = 'verifying';
      const text = decoder.decode(buffer);
      buffer = null;
      const receipt = await importReplayReceipt(text, {expectedBuild});
      if (state !== 'verifying') throw new Error('Transfer cancelled during verification');
      state = 'verified';
      return receipt;
    } catch (error) {
      if (state !== 'closed') state = 'rejected';
      buffer = null;
      throw error;
    }
  }

  return Object.freeze({
    receive, get state() { return state; }, get received() { return received; }, get total() { return total; },
    close() { state = 'closed'; buffer = null; }
  });
}
