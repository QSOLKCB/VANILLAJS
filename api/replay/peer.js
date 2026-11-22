// SPDX-License-Identifier: Apache-2.0
import {checkBuild, CHUNK_BYTES, createReplayInbox, receiptPackets, REPLAY_WIRE} from './wire.js';

export const SIGNAL_LIMIT = 24576;
const label = 'replay-receipt';
const ack = REPLAY_WIRE + ' accepted';

export function readPairingCode(text, type) {
  if (!['offer', 'answer'].includes(type) || typeof text !== 'string' || text.length > SIGNAL_LIMIT ||
      /[^\x09\x0a\x0d\x20-\x7e]/.test(text)) throw new Error('Expected a pairing code of at most 24 KiB');
  const code = JSON.parse(text);
  if (!code || code.type !== type || typeof code.sdp !== 'string' || Object.keys(code).length !== 2 ||
      /[^\r\n\x20-\x7e]/.test(code.sdp)) throw new Error('Expected a data-channel ' + type);
  const lines = code.sdp.split(/\r?\n/);
  const media = lines.filter(line => line.startsWith('m='));
  if (media.length !== 1 || !/^m=application /.test(media[0])) throw new Error('Expected one data-only media section');
  const candidates = lines.filter(line => line.startsWith('a=candidate:'));
  if (!candidates.length || candidates.some(line => {
    const fields = line.split(/ +/);
    return fields[6] !== 'typ' || fields[7] !== 'host';
  })) throw new Error('Pairing requires local host candidates');
  return {type, sdp: code.sdp};
}

/** Non-trickle ICE. Capture the complete candidate list before handing a code to the user. */
function gather(pc, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('ICE candidate gathering timed out')), 15000);
    function finish(error) {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', inspect);
      signal.removeEventListener('abort', cancel);
      if (error) reject(error); else resolve();
    }
    function inspect() { if (pc.iceGatheringState === 'complete') finish(); }
    function cancel() { finish(new Error('Pairing closed')); }
    pc.addEventListener('icegatheringstatechange', inspect);
    signal.addEventListener('abort', cancel);
    if (signal.aborted) cancel(); else inspect();
  });
}

/** One sender, one receiver, one independently verified receipt per user-initiated pairing. */
export function createReplayPeer({role, expectedBuild, onChange = () => {}}) {
  if (!['sender', 'receiver'].includes(role) || typeof onChange !== 'function') throw new TypeError('Invalid peer options');
  checkBuild(expectedBuild);
  const pc = new RTCPeerConnection({iceServers: []});
  const controller = new AbortController();
  const inbox = role === 'receiver' ? createReplayInbox(expectedBuild) : null;
  let channel, timer, verified = null, ended = false, state = 'idle';

  function publish(next, message = '') {
    state = next;
    onChange({state, message, received: inbox?.received ?? 0, total: inbox?.total ?? 0, receipt: verified});
  }
  function end(next, message = '') {
    if (ended) return;
    ended = true;
    clearTimeout(timer);
    controller.abort();
    inbox?.close();
    channel?.close();
    pc.close();
    publish(next, message);
  }
  function fail(error) { end('failed', error.message); }
  function deadline(message) {
    clearTimeout(timer);
    timer = setTimeout(() => fail(new Error(message)), 30000);
  }
  function requireState(who, from) {
    if (ended || role !== who || state !== from) throw new Error('Action unavailable in this pairing state');
  }

  async function message(data) {
    if (ended) return;
    try {
      if (role === 'sender') {
        if (state !== 'sent' || data !== ack) throw new Error('Unexpected receiver response');
        end('acknowledged');
        return;
      }
      if (inbox.state === 'header') deadline('Incomplete or unverified transfer timed out');
      const pending = inbox.receive(data);
      if (inbox.state === 'receiving' || inbox.state === 'verifying') publish(inbox.state);
      const candidate = await pending;
      if (!candidate || ended) return;
      verified = candidate;
      clearTimeout(timer);
      publish('verified');
      if (!ended && channel.readyState === 'open') channel.send(ack);
    } catch (error) {
      if (verified) end('verified'); else fail(error);
    }
  }

  function attach(dc) {
    if (ended || channel || dc.label !== label || dc.protocol !== REPLAY_WIRE || !dc.ordered ||
        dc.maxRetransmits !== null || dc.maxPacketLifeTime !== null) {
      dc.close();
      fail(new Error('Expected one ordered, reliable replay channel'));
      return;
    }
    channel = dc;
    dc.binaryType = 'arraybuffer';
    let announced = false;
    const opened = () => {
      if (ended || announced) return;
      announced = true;
      clearTimeout(timer);
      publish('open');
    };
    dc.onopen = opened;
    dc.onmessage = event => { void message(event.data); };
    dc.onerror = () => end(verified ? 'verified' : 'failed', 'Data channel error');
    dc.onclose = () => end(verified ? 'verified' : 'failed', verified ? '' : 'Peer closed the transfer');
    if (dc.readyState === 'open') opened();
  }
  pc.ondatachannel = event => {
    if (role === 'receiver') attach(event.channel);
    else { event.channel.close(); fail(new Error('Unexpected channel from receiver')); }
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') end(verified ? 'verified' : 'failed', 'Peer connection failed');
  };

  async function localCode(type) {
    const description = type === 'offer' ? await pc.createOffer() : await pc.createAnswer();
    await pc.setLocalDescription(description);
    await gather(pc, controller.signal);
    if (ended) throw new Error('Pairing closed');
    const text = JSON.stringify({type, sdp: pc.localDescription.sdp});
    readPairingCode(text, type);
    return text;
  }

  return Object.freeze({
    get state() { return state; },
    async offer() {
      requireState('sender', 'idle');
      try {
        publish('gathering');
        attach(pc.createDataChannel(label, {ordered: true, protocol: REPLAY_WIRE}));
        const text = await localCode('offer');
        publish('offered');
        return text;
      } catch (error) { fail(error); throw error; }
    },
    async answer(text) {
      requireState('receiver', 'idle');
      const offer = readPairingCode(text, 'offer');
      try {
        publish('gathering');
        await pc.setRemoteDescription(offer);
        const answer = await localCode('answer');
        if (state === 'gathering') publish('connecting');
        return answer;
      } catch (error) { fail(error); throw error; }
    },
    async acceptAnswer(text) {
      requireState('sender', 'offered');
      const answer = readPairingCode(text, 'answer');
      try {
        publish('connecting');
        deadline('Peer connection timed out');
        await pc.setRemoteDescription(answer);
      } catch (error) { fail(error); throw error; }
    },
    send(receipt) {
      requireState('sender', 'open');
      const packets = receiptPackets(receipt, expectedBuild);
      const header = packets.next().value; // Admission precedes the first channel write.
      const messageLimit = pc.sctp?.maxMessageSize;
      if (messageLimit > 0 && messageLimit < Math.max(header.length, Math.min(JSON.parse(header).bytes, CHUNK_BYTES) + 2)) {
        throw new Error('Negotiated channel message size is too small for this receipt');
      }
      try {
        channel.send(header);
        for (const packet of packets) channel.send(packet);
        deadline('Peer did not acknowledge the transfer');
        publish('sent');
      } catch (error) { fail(error); throw error; }
    },
    close() { end('closed'); }
  });
}
