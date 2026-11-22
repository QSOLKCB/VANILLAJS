# REPLAY-TRANSPORT-001 — Replay Exchange

Two browsers exchange one recorded run over an ordered, reliable WebRTC data channel. The receiver independently executes the complete tape with the released [replay-audit API](REPLAY_AUDIT_001.md) before making a receipt available to save. This experimental adapter runs on the v3.1.0 engine. [Open Replay Exchange](../demos/replay-link-lab/index.html).

## Pair two browsers

1. Open the lab on both peers using a secure browser context such as HTTPS or localhost. For a single-machine trial, open a receiver tab using the lab link.
2. Set the roles to **Sender** and **Receiver**. On both, enter the source pin you trust. The two built-in tapes use v3.1.0, `d6da91b91374d28bdd7c201d214f5618b247904c`. Original Evidence Chamber examples declare `e9121ea7297b0aeca1da131b695e7c3371a98745`. For those, select **Saved Evidence Chamber receipt** and enter that pin independently on each side.
3. The sender clicks **Create offer** and gives its complete pairing code to the receiver. The receiver pastes it under **Code from peer**, clicks **Answer offer**, and returns its code. The sender pastes the answer and clicks **Apply answer**. Pairing codes contain network and session details intended for that peer.
4. Once the direct channel opens, the sender selects a tape and clicks **Send replay**. The receiver shows the verified model, tick count, source pin and final state digest. **Save verified JSON** exports that receipt. A sender acknowledgment reports what the other peer said.
5. **Disconnect** starts a fresh pairing. The receiver keeps its last verified receipt across a failed transfer or disconnect. A new successful transfer replaces it. Closing the page ends the in-memory session.

The browser gathers host ICE candidates. The lab uses manual signalling and configures an empty ICE server list. Pairing requires a reachable direct route. Different NATs, firewalls or browser network policies can prevent connection. Each browser can load its installed package from the service worker after the HTTP host goes away. The data channel still requires connectivity between the peers.

## Engine integration

```js
import {createReplayPeer} from '../api/replay/peer.js';

const sender = createReplayPeer({role: 'sender', expectedBuild, onChange: showState});
const offerText = await sender.offer();
// On the other browser, using its own trusted pin:
const receiver = createReplayPeer({role: 'receiver', expectedBuild: localPin, onChange: showResult});
const answerText = await receiver.answer(offerText);
await sender.acceptAnswer(answerText);
// When the sender publishes "open":
sender.send(ownedReplayReceipt);
```

`showResult(update)` may export `update.receipt` through `exportReplayReceipt` once verification succeeds. The receiver reports byte totals while a transfer is pending. Call `close()` to dispose of the channel, peer, timers and partial assembly. Opening the lab alone creates no peer connection.

## Wire format and authority

| Input | Receiver rule |
| --- | --- |
| Offer or answer | At most 24 KiB of ASCII JSON with the expected `type` and `sdp`. Exactly one application media section and gathered host candidates. |
| Channel | One ordered, reliable `replay-receipt` channel with subprotocol `qsol.vanillajs.replay-link.v1`. |
| Header | At most 160 printable ASCII characters. Exact fields `protocol`, `build` and `bytes`. The build must match the receiver's local pin before allocating a buffer. |
| Payload | 1–262,144 UTF-8 bytes. Each binary message starts with a two-byte, big-endian, zero-based sequence number. Chunks carry exactly 8,192 payload bytes except the last. At the ceiling this takes 32 chunks. |
| Completion | Decode valid UTF-8 and call `importReplayReceipt` against the locally selected pin. Missing, repeated, extra or out-of-order chunks while receiving or verifying invalidate the pending tape. |
| Lifetimes | ICE gathering has 15 seconds. Once the sender applies the answer it has 30 seconds to connect. The receiver allows 30 seconds from the first header through verification. The sender allows 30 seconds for the acknowledgment after sending. Manual exchange of the offer and answer has no typing deadline. |

The transport can carry a completed P6 integer, racing, air or FPS receipt. Its authority ends at recorded evidence. A source pin declares the intended model revision. Genuine checkout provenance and trust in the sender's identity require independent evidence. Integer replay uses the existing exact model. Floating receipts retain the engine's same-runtime comparison limits.

## Verification and provenance

```sh
node --test tests/replay-transport.test.js tests/replay-audit.test.js
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
node scripts/replay-transport-browser.mjs
```

The packaged Chromium workflow runs two separate browser processes and profiles on one host, installs both offline caches, then shuts down the HTTP origin before pairing. It checks the selected ICE candidate types, an integer tape, a custom multi-chunk racing tape, byte-identical receiver exports, a rejected local forgery and a receiver-side build mismatch. The artifact contains the receiver ledger and receipt digests. Physical LAN devices and WAN traversal are separate from this single-host test.

The transport, lab and tests are original Apache-2.0 work. They depend on the browser's WebRTC implementation and VANILLAJS's existing replay authority.
