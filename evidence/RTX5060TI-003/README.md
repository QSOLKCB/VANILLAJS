# RTX5060TI-003 — ARCADE FrameGate and two pinned historical comparisons

**Frozen source of record:** the successful explicitly dispatched [GitHub Actions run 42329114286](https://github.com/QSOLKCB/VANILLAJS/actions/runs/42329114286), attempt 1, job [128271297981](https://github.com/QSOLKCB/VANILLAJS/actions/runs/42329114286/job/128271297981). Native NVIDIA RTX 5060 Ti, one self-hosted reviewed-main run.

## Exact artifact identity

| Field | Value |
| --- | --- |
| Run source SHA | `3f5518a168652a003e8db9aa6dc0371ddb4782ea` |
| Workflow artifact ID | `13556233173` |
| Original workflow artifact | `vanillajs-rtx5060ti-arcade-42329114286-1.zip` |
| Archive size | **25,481 bytes** |
| Original SHA-256 | `2b4377fa147fb951d9a918f94716518865e0696da328140e0ac323556f46b5da` |
| Expected Git blob SHA-1 | `4b35e831027783618b6508a898883456c17b6aef` |
| Internal members | 10 |
| Inner checksum entries | 9 |
| Source baseline 001 | `240617e8bc1a935f05eaf75a10531f194f72a173` |
| Source baseline 002 | `b39b0bd0db5ba9b467b9e47aede4edc4dd156e9f` |

The original archive is the canonical byte-level artifact. It must **never be repacked or regenerated**. All nine SHA-256 entries, the two nested checksum manifests, source identities and native GPU parity checks must pass before the receipt is accepted. Preserve negative and tied observations.

## Hardware observations

### Source-pinned comparisons

Both earlier source candidates were rerun under the same current full-path benchmark protocol against commit `3f5518...`, on the same RTX workstation. The older artifact reports are **not** substituted for a current paired run.

| Workload | RTX001 source | New candidate | RTX002 source | New candidate |
| --- | ---: | ---: | ---: | ---: |
| CPU geometry preparation, median | 57.3 ms | 13.7 ms | 57.2 ms | 14.6 ms |
| Static collision, median | 74.4 ms | 2.0 ms | 73.8 ms | 2.2 ms |

Both comparisons preserved native WebGL pixel checks and source-backed CPU geometry/collision receipts. Their frame-interval p95 remained approximately **16.8 ms**. The measurements establish workload-specific CPU savings, not improved display FPS.

### New ARCADE FrameGate workload

| Strategy | Median CPU/driver completion, 48-frame trial | Submitted draw calls |
| --- | ---: | ---: |
| Always draw | 10.4 ms | 48 |
| FrameGate | 10.0 ms | 9 |

Seven alternating paired native trials with two warm-up pairs: nine pixel checkpoints match per trial, 39 of 48 redundant draws omitted (81.25%). Observed wall-time reduction is approximately 3.8%, which is **not** proportional to the reduction in draw calls. The benchmark includes GPU synchronization and pixel readback; it is not a native-game FPS or GPU-only timer measurement. This FrameGate workload has **no RTX001/RTX002 historical equivalent**.

## Reproduction and preservation policy

- Verify the exact archive SHA-256 against GitHub's published digest and the pinned value above.
- Inspect the ZIP without extracting to the repository or rewriting the original. Reject extra/duplicate names, symlink entries, failed CRC, missing member bytes, malformed JSON or checksum drift.
- Validate both nested source-linked comparison reports and all seven paired FrameGate timing/pixel trials.
- Keep RTX5060TI-001 and RTX5060TI-002 byte-for-byte unchanged, with their own pre-existing tests.
- Hosted CI is only an **archive-verification** check. It cannot claim to rerun a native GPU measurement.

Research note: [COMMENT-001 attribution clarification](../COMMENT-001/README.md) is a distinct public-attribution record. No benchmark finding is evidence for or against a copying allegation.
