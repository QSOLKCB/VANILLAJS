# RTX5060TI-002 — adaptive queries and retained rendering

**Immutable evidence archive** from the owner's explicitly dispatched, headed RTX 5060 Ti test. This directory is a separate receipt from [RTX5060TI-001](../RTX5060TI-001/README.md); the original ZIP and digest are unchanged.

## Identity

| Field | Exact value |
| --- | --- |
| GitHub Actions run | [42310094400, attempt 1](https://github.com/QSOLKCB/VANILLAJS/actions/runs/42310094400) |
| Measure job | [128209103727](https://github.com/QSOLKCB/VANILLAJS/actions/runs/42310094400/job/128209103727) |
| Artifact ID | `13547124252` |
| Archived ZIP | `vanillajs-rtx5060ti-adaptive-42310094400-1.zip` |
| Archived ZIP size | **17,130 bytes** |
| ZIP SHA-256 | `79d4a9cd7f1ca546b5d4bd12f0b264273b622da1dcafe70ae1e6aad998cedaef` |
| Git blob SHA-1 (expected) | `2f570ff7789fb313b2e8d6b68ff3b31c2a2996ff` |
| Exact candidate `main` | `b39b0bd0db5ba9b467b9e47aede4edc4dd156e9f` |
| Frozen historical baseline | `1f965f4e5b6669de0f954e3a39b11aa679e56720` |
| Historical receipt source | `240617e8bc1a935f05eaf75a10531f194f72a173` |
| Original RTX5060TI-001 ZIP SHA-256 | `1a45f75dcc6050189591f0de187745325076712ee4e60e9168ef9c6a5d75f1b8` |

GitHub Actions reported success, native NVIDIA GeForce RTX 5060 Ti with driver `595.99.02`, and SHA-256 verified the original immutable archive. The artifact was downloaded from GitHub and independently checked for exact outer bytes, CRC, membership, all seven internal checksums, and recorded source lineage before incorporation. The ZIP is preserved byte-for-byte; **do not unzip, repack, regenerate or overwrite it** in the repository.

The eight original ZIP members are `EXPERIMENT.json`, `SUMMARY.md`, `SHA256SUMS`, `adaptive-browser.json`, `adaptive-serial.json`, `fullpath/report.json`, `fullpath/SUMMARY.md`, and `fullpath/SHA256SUMS`.

## Recorded observations

### New serial 2D circle-query workload

| Circles | Brute-force | Grid | Adaptive |
| ---: | ---: | ---: | ---: |
| 14 | 0.2 ms | 0.3 ms | 0.3 ms |
| 26 | 0.4 ms | 0.3 ms | 0.4 ms |
| 58 | 1.1 ms | 0.3 ms | 0.3 ms |
| 128 | 1.7 ms | 0.3 ms | 0.3 ms |

These medians are from headed native Chromium with 250 queries per trial, two warm-ups and seven alternating paired measurements. The 32-item adaptive switch is a workload-specific heuristic, not a universal optimum.

### New retained-versus-forced-fresh WebGL workload

For 32 submitted frames per trial, the median CPU-plus-driver completion interval was **17.5 ms forced-fresh** versus **3.7 ms retained**, around **4.73× lower** on this synthetic workload. Both strategies produced the same recorded framebuffer SHA-256:

`585d83fc4727162003cb381ffe1613895aa1b3a443c0708d69641159609dec2a`

The original full-path comparison also passed source-backed geometry/collision parity and three native rendered scene checks. Its same-protocol historical baseline-versus-candidate medians were **68.4 → 13.2 ms** for CPU geometry preparation and **72.1 → 2.1 ms** for static collision queries; FPS callback/frame observations and submitted draw/upload counts did not demonstrate an FPS gain.

## Trust boundary

- This is an owner-run hardware and browser observation, **not cryptographic GPU attestation**. NVIDIA identity was checked using both `nvidia-smi` and browser renderer information.
- GPU scenes were measured with `gl.finish()`; the measured duration includes CPU, driver and compositor costs, **not dedicated GPU timer-query results**. One run does not establish portable speedups.
- The *new* adaptive and cuboid workloads have no equivalent measurements in RTX5060TI-001. Compare fresh and retained strategies **within this new run**, not across incompatible historical benchmarks.
- Raw samples, runtime identity, original manifest and JSON reports remain inside the frozen ZIP. Report negatives and ties as readily as improvements.
- GitHub's retained Actions artifact may expire; this copy is the long-term evidence source.

## Offline verification

```sh
python3 scripts/verify-rtx-adaptive-receipt.py
(cd evidence/RTX5060TI-002 && sha256sum -c SHA256SUMS)
```

The standard-library verifier checks the exact outer digest and byte-for-byte checksum manifest, ZIP CRC/membership and seven internal checksum entries, original nested checksum chain, candidate/historical source pins, native device record, and complete paired native measurements. Hosted CI validates this **archive**; it does not rerun a physical GPU benchmark.
