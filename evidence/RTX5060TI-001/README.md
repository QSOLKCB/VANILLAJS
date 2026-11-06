# VANILLAJS RTX5060TI-001 — physical GPU validation receipt

**Record:** original, byte-preserved RTX 5060 Ti hardware validation archive. This records a successful measurement, not independent cryptographic hardware attestation.

| Field | Frozen value |
| --- | --- |
| Receipt identifier | VANILLAJS RTX5060TI-001 |
| Candidate source commit | 240617e8bc1a935f05eaf75a10531f194f72a173 |
| Pinned pre-optimisation baseline | 1f965f4e5b6669de0f954e3a39b11aa679e56720 |
| GitHub Actions run | 42203888152 (workflow_dispatch on main; success) |
| GitHub Actions job | 127845582526 (measure; success) |
| Original Actions artifact | 13496226015 / vanillajs-rtx5060ti-42203888152 |
| Exact ZIP size | 10,974 bytes |
| Outer ZIP SHA-256 | 1a45f75dcc6050189591f0de187745325076712ee4e60e9168ef9c6a5d75f1b8 |
| Git binary blob SHA-1 | 691e9e812d789da47b72dae49c433889fdf95370 |
| Observation (UTC) | 2026-11-06T10:38:01.304Z |
| Reported NVIDIA device and driver | GeForce RTX 5060 Ti, 595.99.02 |
| Browser and test tooling | Chrome 156.0.8078.79; Playwright 1.64.0 |

## Contents and provenance

The ZIP is the exact artifact uploaded by the successful GitHub Actions workflow, **not reconstructed or recompressed**. Its SHA-256 matches the supplied original digest, the GitHub artifact digest and the independently computed digest. The ZIP contains exactly three members: report.json, SUMMARY.md and SHA256SUMS. Both internal checksums verify, and the report contains the raw paired observations.

- [Successful workflow and logs](https://github.com/QSOLKCB/VANILLAJS/actions/runs/42203888152)
- [Exact candidate commit](https://github.com/QSOLKCB/VANILLAJS/commit/240617e8bc1a935f05eaf75a10531f194f72a173)
- [Original Actions artifact (temporary availability)](https://github.com/QSOLKCB/VANILLAJS/actions/runs/42203888152/artifacts/13496226015)

## Recorded results and boundaries

The hardware gate identified headed native NVIDIA WebGL rather than SwiftShader. Three fixed GPU pixel scenes passed parity, and geometry/collision receipt hashes matched for seven paired trials. Fourteen FPS trials each recorded 240 completed callbacks.

| Workload observation | Baseline median | Candidate median |
| --- | ---: | ---: |
| CPU geometry preparation | 69.3 ms | 13.2 ms |
| Static collision (index construction included) | 77.5 ms | 2.2 ms |
| FPS Lab JavaScript frame callback | 0.3 ms | 0.3 ms |
| FPS Lab frame interval p95 | 16.8 ms | 16.8 ms |
| GPU upload submissions | 1,486,080 B | 1,486,080 B |
| Draw calls | 960 | 960 |

The faster geometry and collision timings are from the defined **synthetic workloads**. The collision index is opt-in, so these figures are not evidence of proportionally higher game FPS. Submitted GPU bytes do not measure actual PCIe traffic. Memory values use CDP statistical allocation sampling and do not represent exact process allocations.

The SHA-256 verifies bytes, **not** signatures, actor identity, TPM hardware attestation, or immutable Git branch/tag policy. Git object content is hash-addressed, but branch refs can be moved and unreferenced objects may eventually be garbage-collected. Do not modify or normalise this numbered record. Future hardware measurements get new numbered receipts and separate source pins. Merge through the normal reviewed PR gate; do not move release tags for this preservation task.

## Offline verification

From the repository root, with Python 3 and no third-party dependencies:

~~~sh
python3 scripts/verify-rtx-receipt.py
(cd evidence/RTX5060TI-001 && sha256sum -c SHA256SUMS)
~~~

The verifier fails closed on altered archive bytes, unexpected archive members, mismatched inner checksums, mismatched source pins, wrong protocol/sample counts, bad renderer identity or mismatched paired kernel receipts. CI runs it read-only. It does **not** recreate measurements, contact GitHub or attest that the physical hardware statements are cryptographically authentic.
