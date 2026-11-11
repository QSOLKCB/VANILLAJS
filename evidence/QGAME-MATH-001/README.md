# QGAME-MATH-001 executed evidence

Local observations on 2026-11-12. These are executed results, not inferred
physical properties, universal proofs or protected-branch attestations.

The feature began at verified main / PR #77 merge
`c506cdfcefe2a68928cfa7025528a82ed11d44a9`. The local observations were collected
with the implementation present as uncommitted work; the observation explicitly
records `dirty: true` and SHA-256 of all declared runtime/reference/contract
inputs. The final PR commit identifies the delivered source. Compare those
hashes rather than treating the base Git SHA as the new implementation SHA.
Hosted CI reruns at the PR revision. No donor Ada/Rust/Python proof/build suites,
owner GPU runner, deployment, release or research deposit were invoked.

| Executed check | Result / evidence |
| --- | --- |
| Complete Node suite | 661 tests passed, zero failed/skipped; [summary](node-summary.log) |
| Static module contracts | 253 JS files, 50 modules, two research experiments; [check](check-final.log) |
| Build and offline manifest | 150 packaged files; [build](build-final.log), [integrity](offline-final.log) |
| Independent new oracle | 81 matrices, 48 inverses, 3,888 affine states, 6,561 products, 32 events, 384,000 PCM samples, two Decimal trajectories; [log](qgame-oracle-final.log) |
| Existing ALIEN 001–006 oracles | All six passed; recorded before the deliberate pin mismatch was repaired in [retained attempt](attempts/alien-oracles.log) |
| Existing formal source gate | Unchanged pins; [pin check](pins-final.log) |
| Existing Lean correspondence | 21 model theorems, 856 observations, all six negative controls; [report](alien-formal.json) |
| Pinned real browser preflight | Playwright 1.64.0, Chromium 156.0.8078.4; [log](browser-preflight-attempt-2.log) |
| Complete packaged browser suite | All seven suites passed; [log](browser-full.log) |
| New browser lab | Desktop, touch-emulated mobile, 320/390px, imports/downloads, keyboard, pause, fallback, offline; [targeted log](browser-qgame-attempt-3.log) |
| Existing browser race regression | Delayed initialization passes; missing initialization fails as expected; [log](alien-browser-regression.log) |
| Cache policy | All suites refuse reuse for unqualified new harness/assets; [decisions](browser-cache-policy.json) |

The new numerical test also injects a failure during the second staged particle
after the first has completed all eight substeps. State, history and events
remain unchanged; the next valid tick starts at one. The injection is a
transaction test, not an observed naturally occurring orbit instability.

## Numerical and workload observations

[Full source-bound observation](qgame-observation.json) records Node v22.18.0,
Linux x64, AMD Ryzen 9 5950X and every input digest. Against the independent
60-digit Decimal fixtures, maximum absolute errors across position, velocity
and specific energy were:

- gentle: `4.263256414560601e-14`
- swift: `1.1191048088221578e-13`

Gate: `5e-10 + 5e-11 * abs(reference)`. These bounds concern the two finite
32-transition fixtures, not all possible configurations or machines.

Reference PCM SHA-256:
`d0b1437e0e54cc6e96574d45f2afe522c6abd961def7d74d8f79094869a7db7b`.
The independent Python generator directly computes integer triangle samples;
the JavaScript test checks all 384,000 PCM16 samples through their byte digest.

Complete graph + 32-transition + eight-second reference-WAV workloads were
measured 15 times after three warmups. Median durations were about 31.8 ms
(two coordinates) and 38.2 ms (four coordinates); every repeat preserved its
output digest. This shared host was also running checks. Timings are local
capacity observations, not isolated benchmarks, paired optimization evidence,
speedup claims or a guarantee for other devices. No optimization was promoted.

## Retained failed attempts and corrections

1. [Chromium sandbox attempt](attempts/browser-preflight-attempt-1.log): required
   local IPC was denied (`Operation not permitted`). The existing pinned browser
   passed outside that sandbox; no browser installation or runner dispatch.
2. [Initial full Node run](attempts/node-attempt-1.log): sandboxed child-process
   execution stalled. The process was identified by PID and task checkout before
   termination. The unchanged command later completed outside the sandbox.
3. [First browser assertion](attempts/browser-research-attempt-1.log): the new
   verifier incorrectly expected `02→20`. The independently checked result is
   `21→12`; only the expectation changed.
4. [Import assertion race](attempts/browser-qgame-attempt-2.log): the verifier read
   the tick before asynchronous File.text completed. It now waits for the
   imported run's zero tick before asserting. Application validation was intact.
5. [Formal pin rejection](attempts/alien-formal.log): editing the established
   Flight Lab workflow changed a pinned input. That edit was removed. New oracle
   CI lives in a separate workflow. The formal manifest, source gates, old
   workflow and browser policy were not repinned or weakened.
6. [Environment note](attempts/environment-note.txt): the initial profiling
   subprocess hit `spawnSync git EPERM`; the retained profile came from the
   subsequent successful run. A partial/empty profile was not treated as PASS.

Screenshots are generated as `browser-artifacts/qgame-desktop.png`,
`qgame-390.png` and `qgame-320.png` by the committed verifier and are included
in the existing Flight Lab CI artifact. They were visually inspected locally.
Mobile coverage is Chromium touch emulation; physical mobile devices,
Firefox/Safari, actual sound hardware and GPU compute were not verified.
