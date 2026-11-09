# QFLOAT-001 — source-pinned evidence freeze

**State:** historical executed evidence. The proposed research tag is
`qfloat-001-research.1`, **not** the existing production release `v1.5.0`.
No new performance claim or formal proof is made by this record.

## Immutable observed execution

- Original VANILLAJS source checkout and executed GitHub Actions HEAD:
  `16f252aaea93b8956d2055e49689372164b2b356`.
- Original ARCADE deployed byte comparison source:
  `f29b780734a50171d55ae2f770930db8a487b31c`.
- Owner-dispatched workflow:
  [QFLOAT-001 run 42626854784](https://github.com/QSOLKCB/VANILLAJS/actions/runs/42626854784).
- Original Actions artifact: ID **13677814398**, name
  `vanillajs-qfloat-arcade-42626854784-1`.
- Original artifact ZIP SHA-256:
  `c0c2e23254147caa4e2a8a6e2a4682a8466868f7285b3df5429df8d250323005`.
- Original source report: PASS with zero recorded browser errors and zero
  recorded failures; real headed Chromium 156.0.8078.79 with Playwright
  1.64.0 and Node v22.18.0 on runner `ubuntu` / AMD Ryzen 9 5950X.
- Nine observed acceptance checks: exact decimal/int32 quantization;
  live Canvas2D pixels; initially paused focus loss without keyup; 81920
  raw-integer step; concurrent keyboard aliases; live 60 Hz timer/pause;
  invalid speed rejection/reset; invalid decimal rejection; and 390-pixel
  viewport width without horizontal overflow.

**Executed versus inferred:** these are actual passing browser assertions
and source byte identities, not a formal completeness theorem, frame-rate
benchmark, guarantee of hardware acceleration, or entire ARCADE 3 campaign
replay. The renderer used headed Chromium; the checked arithmetic still
used integer Q16.16 authoritative state.

## Preservation inventory

| Original artifact member | SHA-256 | Preservation status |
| --- | --- | --- |
| `QFLOAT_ARCADE_REPORT.json` | `9f0ffeca4d86f7795cdad8cc3d4c02ac6c98cb7dbe788fe822f109f174a18cf0` | Exact bytes checked into this Git directory |
| `SUMMARY.md` | `fce353cc0bf34148e5b8f438b6eda0c5c1004e80f461ac8606be9d685259b063` | Exact bytes checked into this Git directory |
| `qfloat-desktop.png` | `b2f3b9f2f28aad643c3a1cb723cfeae387ba089cbcb76177be0cd56444191d40` | Original binary in ZIP, **not yet committed to Git** |
| `qfloat-mobile.png` | `fdc18ff5dc1fedf7fad3657a3374d0a4b2de93f3b297d64949ad3b3f8e2346fb` | Original binary in ZIP, **not yet committed to Git** |

The original SHA256SUMS is retained byte-for-byte in this directory.
**Do not claim that the screenshot bytes are frozen in Git**. Their
full-byte preservation depends on attaching the original ZIP to the
GitHub prerelease after the proposed research tag has passed review.

## Independent read-only checks

Text-only integrity, automatically run on PR/CI:

```sh
python3 scripts/verify-qfloat-freeze.py
node --test tests/qfloat-freeze.test.js
```

Complete verification of the original ZIP, including both PNGs:

```sh
python3 scripts/verify-qfloat-freeze.py \
  --archive /path/to/vanillajs-qfloat-arcade-42626854784-1.zip
```

The verifier reports `scope=text-receipts-only` when the original ZIP is
not supplied; it reports `scope=complete-original-artifact` and
`screenshotsVerified=2` **only** after checking the original ZIP SHA-256,
all four member hashes, exact text bytes, member list and size bounds.

## Research-context linkage

- [VANILLAJS PR #60](https://github.com/QSOLKCB/VANILLAJS/pull/60) —
  Q16-ECMA-001 Lean **bounded int32** projection and JavaScript
  counterexamples. This is **not** a proof of full ECMAScript source refinement.
- [VANILLAJS PR #61](https://github.com/QSOLKCB/VANILLAJS/pull/61) —
  native QFloat integer facade and owner-only ARCADE browser witness.
- [ARCADE PR #16](https://github.com/QSOLKCB/ARCADE/pull/16) —
  original deployed QFloat Lab and focus/tick/cleanup correctness fixes.
- The unchanged authoritative production kernel is
  `modules/integer-math/index.js`, Git blob
  `d457b0154d9dfc8b50fd593b5e9dff75e1ea66b9`.

## Gate: PR → review → green CI → protected tag → prerelease

1. Review this evidence-only PR and require green hosted CI.
2. Merge without altering the original report or its SHA256SUMS.
3. Tag the resulting evidence commit **`qfloat-001-research.1`**.
   Do not retarget, delete, or overwrite existing production tags.
4. Protect that tag name/pattern against rewriting and deletion using
   repository rulesets/authorized maintainer policy.
5. Publish a **GitHub prerelease** from the verified tag and attach the
   original unmodified ZIP as a release asset. Confirm it matches the
   exact ZIP hash above *before* publishing.
6. Reference this report and the original action run; never label the
   later freeze commit as the earlier executed browser source commit.

The original Actions artifact has a short retention period. Preserve the
downloaded ZIP before its expiry. The current repository contains the
original textual receipts and manifest, **not** the binary screenshot
archive. The prerelease asset is the durable binary-storage gate.

**QSOL-IMC — Make amazing alien tech and put it under Apache-2.0.**
