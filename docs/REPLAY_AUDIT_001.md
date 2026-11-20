# REPLAY-AUDIT-001 — Cross-Lab Receipts (P6)

**Experimental scope:** source-bound, bounded replay for FPS, air combat, racing and integer simulation. Original Apache-2.0 implementation based on VANILLAJS main at `e9121ea7297b0aeca1da131b695e7c3371a98745`. This is a software replay protocol, not an independently certified proof, authoritative server, network stack, or new physics implementation.

## Authority and input admission

- `createReplayPlan` accepts exact inert `qsol.vanillajs.replay-audit.plan.v1` records (`format,build,kind,model,frames`) with explicit lowercase 40-hex Git SHA build pins. The consumer must independently confirm its checked-out source matches the pin; a caller-supplied string cannot attest what executable ran.
- FPS calls the real `Combat3D` step for actor/weapon/timer and hit events at 60 simulation ticks/s; fixed tick-start poses are part of the source model, and frame commands carry actor ID, weapon ID, muzzle, direction, fire and reload.
- Air calls TRAJECTORY-001's actual SENSE-linked lock and guided swept contact at 120 ticks/s. One empty command list denotes one accepted tick; trailing ticks after terminal hit/expiry reject, rather than creating a partial PASS.
- Racing uses `createVehicle().spawn/step` at 120 ticks/s and a deliberately scoped, trusted flat-surface adapter with source-controlled height/friction. This does not claim to replay arbitrary HORIZON courses, scene graphs, or camera state. Extending to a complex race world requires a separately reviewed matching world authority.
- Integer calls the existing `integer-replay` preflight and real `IntegerEngine` to execute the accepted integer body tape. The integer model is **integer-exact**; floating models are only **same-runtime deterministic**, not cross-browser bit-identical.
- Strict data fields; 1–128 admitted frames; 128 KiB source bound, 256 KiB complete receipt bound, no sparse arrays, executable accessors, nonfinite numbers, unknown model input, ambient clocks, renderer callbacks, network imports or game-owned damage assumptions.

## Receipt verification and trust boundary

`sealReplayReceipt(plan)` admits every command before simulation, executes the actual engine, and returns `qsol.vanillajs.replay-audit.receipt.v1`. The receipt includes build/model/tape source, mode, simulation tick rate, tick count, each tick's authoritative events and SHA-256 state digest, and complete source/trace/final SHA-256 digests.

`verifyReplayReceipt(receipt,{expectedBuild})` requires the independently known exact build pin, source schema and complete tape. It **re-executes** the model and compares every event and state checksum, returning `match` and `complete`. It never trusts or accepts a user-supplied `PASS` marker. Malformed/stale/truncated input throws, while structurally valid altered evidence yields `match:false`.

`exportReplayReceipt` accepts only locally executed receipts. `importReplayReceipt` independently replays before accepting, so a failed import cannot replace previously accepted evidence in the lab.

**Integrity is not provenance attestation.** SHA-256 is a deterministic comparator, not a signature or proof that claimed source bytes, external licensing, runtime, hardware or review were authentic. A malicious actor can rehash forged records; verification relies on the independent trusted engine and pinned checkout.

`auditReplayPresentation(plan,[30,60,144])` reruns the authoritative command tape separately for three visual sample rates. Render/sample cadence never enters the physics step and may yield different presentation sample counts, but accepted ticks, event trace and final-state hash must agree. No native physical-GPU FPS claim is made.

## Evidence Chamber and quality gates

The original [Evidence Chamber](../demos/replay-audit-lab/index.html) offers FPS, guided-air, flat racing and integer fixtures. Its interactive controls record, verify, export, import, deliberately corrupt a receipt, and compare presentation rates. Canvas rendering is read-only; all event authority remains with the native engines. Example records pin the reviewed baseline SHA as **declared provenance**, not proof of the new PR checkout.

~~~sh
node --test tests/replay-audit.test.js tests/integer-replay.test.js tests/combat3d.test.js tests/trajectory.test.js tests/vehicle3d.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
~~~

The unfiltered, isolated Chromium workflow must execute the actual complete offline package, independently verify cross-model records, download/reimport and tampering, check JavaScript/network errors, and retain screenshot, manifest SHA-256 and execution receipts. Existing simulation contracts and published historical evidence are preserved. Merge/release require independent exact-head review and owner authorization.
