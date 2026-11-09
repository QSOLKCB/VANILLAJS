# QFLOAT-001 — The Floating Illusion: Research Evidence Freeze

**Prerelease:** `qfloat-001-research.1`

This prerelease archives the completed QFloat research witness. It is
**not** a replacement for the existing
[VANILLAJS v1.5.0 — The Component Forge](https://github.com/QSOLKCB/VANILLAJS/releases/tag/v1.5.0).

## What is frozen

- First-party `QFloat` decimal-like authoring facade backed exclusively by
  the established exact, checked signed Q16.16 engine (VANILLAJS PR #61).
- Bounded Lean/ECMAScript signed-int32 projection theorems, executable JS
  counterexamples and their explicit full-refinement limitations
  (VANILLAJS PR #60).
- Successful owner-desktop headed Chromium QFloat Lab witness (Actions
  run `42626854784`): source-pin verification against ARCADE merge
  `f29b780734a50171d55ae2f770930db8a487b31c`, nine passing
  browser assertions, zero recorded failures, decimal quantization,
  input lifecycle checks, Canvas pixels and responsive viewport evidence.
- Original executed VANILLAJS source checkout
  `16f252aaea93b8956d2055e49689372164b2b356`.

The historical browser report, summary and original four-file SHA256SUMS
are preserved in `evidence/QFLOAT-001/`. The two original PNG screenshots
are preserved in the **attached original artifact ZIP**, not reproduced
or altered. Verify the ZIP before trusting these attachments.

## Mandatory release asset

Attach **`vanillajs-qfloat-arcade-42626854784-1.zip`**, unmodified.

ZIP SHA-256:

```text
c0c2e23254147caa4e2a8a6e2a4682a8466868f7285b3df5429df8d250323005
```

Verify all four members and metadata with:

```sh
python3 scripts/verify-qfloat-freeze.py --archive /path/to/vanillajs-qfloat-arcade-42626854784-1.zip
```

If the original binary archive is not attached, the evidence freeze is
**partial** and must not be represented as preserving the PNGs in the
repository or release.

## What this does not claim

This prerelease does not assert universal Lean-to-ECMAScript refinement,
that 0.1 is exactly representable in Q16.16, general GPU performance
uplift, or universal game-state correctness. The original checker is a
bounded mathematical result; the browser witness is executed behavioral
evidence.

The research tag identifies the later evidence-preservation commit,
not the earlier source revision that was executed on the owner's desktop.

No changes were made to the existing v1.5.0 release, its tag or its
production artifacts.

**QSOL-IMC — Make amazing alien tech and put it under Apache-2.0.**
