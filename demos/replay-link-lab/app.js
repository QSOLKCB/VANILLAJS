// SPDX-License-Identifier: Apache-2.0
import {checkBuild} from '../../api/replay/wire.js';
import {createReplayPeer} from '../../api/replay/peer.js';
import {exportReplayReceipt, importReplayReceipt, REPLAY_LIMITS, sealReplayReceipt} from '../../modules/replay-audit/index.js';
import {replayExamples} from '../replay-audit-lab/scenarios.js';

const el = id => document.getElementById(id);
const role = el('role'), build = el('build'), source = el('source');
const status = el('status'), progress = el('progress');
let peer = null, lastVerified = null, preparing = false;
const fixtureBuild = build.defaultValue;
const descriptions = {
  gathering: 'Gathering local connection information…', offered: 'Give your offer to the receiver, then paste its answer.',
  connecting: 'Waiting for the peer connection.', open: 'Direct channel open.', receiving: 'Receiving bytes.',
  verifying: 'Replaying the tape locally…', verified: 'Verified by this browser.',
  sent: 'Sent. Waiting for the receiver.', acknowledged: 'Peer reports acceptance.', closed: 'Disconnected.'
};
function controls() {
  const sender = role.value === 'sender', state = peer?.state;
  role.disabled = build.disabled = Boolean(peer);
  el('pair').textContent = sender ? 'Create offer' : 'Answer offer';
  el('pair').disabled = Boolean(peer);
  el('connect').hidden = !sender || state !== 'offered';
  el('reset').disabled = !peer;
  el('sources').hidden = !sender;
  el('send').disabled = !sender || state !== 'open' || preparing;
  source.disabled = el('file').disabled = preparing;
  el('file-row').hidden = source.value !== 'file';
  el('save').disabled = !lastVerified;
  el('instructions').textContent = sender
    ? 'Create an offer, give it to the receiver, then apply its answer. Both browsers must choose the same trusted replay build.'
    : 'Paste the sender’s offer and choose Answer offer. Give your code back to the sender. Pairing codes contain connection details.';
}
function discard() {
  const old = peer;
  peer = null;
  old?.close();
  preparing = false;
  el('local').value = el('remote').value = '';
  progress.hidden = true;
  status.dataset.state = 'idle';
  status.textContent = 'Ready to pair.';
  controls();
}
role.onchange = discard;
source.onchange = controls;
el('reset').onclick = discard;
window.addEventListener('pagehide', discard);
el('pair').onclick = async () => {
  let current;
  try {
    current = createReplayPeer({role: role.value, expectedBuild: checkBuild(build.value),
      onChange(update) {
        if (peer !== current) return;
        status.textContent = update.message || descriptions[update.state] || update.state;
        status.dataset.state = update.state;
        progress.hidden = !update.total;
        progress.max = update.total || 1;
        progress.value = update.received;
        if (update.receipt) {
          lastVerified = update.receipt;
          el('result').textContent = lastVerified.kind + ' · ' + lastVerified.ticks + ' ticks · ' + lastVerified.mode +
            '\nBuild ' + lastVerified.build + '\nFinal SHA-256\n' + lastVerified.finalSha256;
        }
        controls();
      }
    });
    peer = current;
    controls();
    const code = role.value === 'sender' ? await current.offer() : await current.answer(el('remote').value);
    if (peer === current) el('local').value = code;
  } catch (error) {
    if (current && peer !== current) return;
    if (current && current.state === 'idle') { peer = null; current.close(); }
    status.textContent = error.message;
    controls();
  }
};
el('connect').onclick = async () => {
  const current = peer;
  try { await current.acceptAnswer(el('remote').value); }
  catch (error) { if (peer === current) status.textContent = error.message; }
};
el('send').onclick = async () => {
  const current = peer, pin = build.value;
  preparing = true;
  controls();
  try {
    let receipt;
    if (source.value === 'file') {
      const file = el('file').files[0];
      if (!file || file.size > REPLAY_LIMITS.receiptBytes) throw new Error('Choose a receipt of at most 256 KiB');
      receipt = await importReplayReceipt(await file.text(), {expectedBuild: pin});
    } else {
      if (pin !== fixtureBuild) throw new Error('Built-in tapes use the v3.1.0 pin. Choose a saved receipt for another build.');
      receipt = await sealReplayReceipt({...replayExamples()[source.value], build: fixtureBuild});
    }
    if (current === peer) current.send(receipt);
  } catch (error) { if (current === peer) status.textContent = error.message; }
  finally { if (current === peer) { preparing = false; controls(); } }
};
el('save').onclick = () => {
  const url = URL.createObjectURL(new Blob([exportReplayReceipt(lastVerified)], {type: 'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'verified-' + lastVerified.kind + '-replay.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
controls();
