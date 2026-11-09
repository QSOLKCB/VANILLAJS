# VANILLAJS v1.4.0 — The Proof of Speed

**Status: development PR; not yet a published release, GPU FPS result or universal speedup claim.**
Baseline: v1.3.0, merge commit 7695492d74a14d590c35aee7c31f5187e61a83a1.

The contract: an optimization may save work and may improve CPU latency on a
specified workload **only when complete reference-output parity passes**.
Regressions are reported rather than hidden.

## Seven source-bound fixtures

| Scenario | Reference | Optimized | Claim boundary |
|---|---|---|---|
| 4×4 grid | Complete segment scan | Reused AABB index | Exposes small-scene overhead |
| 32×32 short rays | Complete segment scan | Reused AABB index | Conservative candidate reduction |
| 32×32 long rays | Complete segment scan | Reused AABB index | Dense intersections |
| Bullet Time Lab | Full-scan cover | Indexed cover | All physical states and events |
| ARCADE Break Blocks | Full-scan rails and bricks | Static index and ignored brick IDs | All physical states and events |
| ARCADE Bank Shots | Full-scan rails and bumpers | Static index | All physical states and events |
| Retained Canvas | Always-render 64×64 CPU raster | FrameGate complete-state key | Every frame's pixel bytes |

The oracle hashes the complete collision receipts, per-tick game-state/event
receipts excluding instrumentation, or every framebuffer byte. The benchmark
refuses to time a fixture with failed parity. Deliberate negative controls
change a hit, a simulation command or pixels and must change the checksum.

Timing uses two warmup pairs and nine alternating AB/BA pairs. The artifact
preserves raw millisecond samples, medians, ratios, Node version, host CPU,
commit and benchmark source SHA-256. No uncalibrated timing threshold blocks
CI. These measurements are not statistical confidence intervals or cross-host
performance guarantees.

Static indexes are constructed once outside timed queries, preserving the
actual immutable-scene reuse contract. Seven separate construction timing
samples are retained. A changing-geometry or cold-start use case must include
this cost. Candidate instrumentation is outside timed queries to avoid charging
an extra index traversal to the optimized path.

The retained Canvas test measures CPU software raster reuse, not native
GPU timing or rendered-game FPS. Native RTX WebGL evidence uses the existing
separately owner-dispatched frame-gate workflow.

## Execution

- node --test tests/proof-speed.test.js tests/offline-worker-proof.test.js
- node scripts/proof-speed.mjs --check
- node scripts/proof-speed.mjs --measure --out proof-speed.json
- sha256sum -c proof-speed.SHA256SUMS
- python3 -m unittest discover -s tests -p 'test_proof_speed_research.py'

## Service Worker torture tests

The actual worker template is executed in a Node VM with mocked CacheStorage
and fetch, testing corrupted install responses, network interruption,
old-version preservation, post-install cache tampering, offline rejection,
online verified recovery, scoped activation and non-GET/query/range bypass.

The worker drains all concurrent install writes before failure cleanup and
verifies cached bytes again on retrieval. This trades some CPU for integrity:
never assume cryptographic validation of a new cache is a performance boost.

Real Chromium/package validation remains mandatory alongside this simulated
state-machine harness. No unrelated users' caches are deleted.

## Three independent GitHub Actions workflows

- proof-speed.yml: automatic hosted CPU witness on PR/main, without API or GPU.
- proof-speed-rtx.yml: owner-only manual main dispatch with explicit RTX device
  permission, preserves native GPU/CPU receipts separately.
- proof-speed-research.yml: owner-only manual main dispatch, with explicit paid
  API authorization and a separately provided OPENAI_API_KEY GitHub secret.
  Never triggers on PR, push or schedule.

The OpenAI research workflow calls Responses with model gpt-6-astra, no tools,
no server-side response storage and no retries. Three bounded critiques cover
statistical inference, CPU/GPU/cache boundaries and adversarial negative controls.
Each request is restricted to 20,000 UTF-8 bytes and 10,000 output tokens.
The budget uses a deliberately inflated US$60/US$300 per million
input/output-token envelope, at most US$12.60 per dispatch versus the owner's
US$30 **total** allocation. Provider pricing is subject to change; this is
an engineering estimate, not a billing guarantee or account-wide budget.
Do not dispatch again without independently reconciling earlier spending.
The owner should additionally enforce spending limits in the OpenAI project.

As of 2026-11-09, the documented Astra Standard rates were US$5/US$25 per
million input/output tokens. The 60/300 figures are deliberately conservative.
Each response keeps usage, model, prompt SHA-256 and an estimated cost, but
a model's critique is not proof of a benchmark speedup. No credits have been
spent by merely preparing these workflows.

## Publication and rollback gates

The standard VANILLAJS suite, packaged Chromium check, exact output oracle,
negative controls, offline package verifier and scoped cache tests must pass.
Raw timing evidence must preserve slower cases. Physical GPU gains cannot be
claimed without native-run evidence. If parity or cache integrity fails, restore
the reference code path or disable the new cache behavior; do not weaken gates.

No merge, release, tag move or archived hardware receipt rewrite is authorized
by this change.

**We didn't invent optimization. We demanded the receipts.**
