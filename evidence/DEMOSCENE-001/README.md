# DEMOSCENE-001 execution evidence

These are local execution records for the original v2.4.0 proposal. They are
content-bound observations, not a signature or an Assembly competition submission.
GitHub Actions records hosted PR execution separately. No personal GPU runner,
paid service, new infrastructure or Playwright installation was used.

Environment: Node v24.22.1, Linux x64; existing Playwright 1.57.0 and system
Chromium 156.0.8078.79 using SwiftShader. Headless audio output is not an audition
of physical speakers. Firefox, Safari, physical mobile devices and hardware GPU
performance were not tested. Geometry hashes are scoped to the recorded runtime;
GPU pixel hashes are diagnostic only.

## Reproduce

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
node scripts/demoscene-evidence.mjs
node scripts/demoscene-budget.mjs
node scripts/demoscene-world.mjs --preset machine-remembers --seed 1983 --out ./demo-output
node scripts/browser-check.js
```

Use the repository's existing external Playwright installation for browser checks.
This environment sets `NODE_PATH=/opt/codex/cua_node/lib/node_modules` and
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`; those are environment-specific
paths, not runtime dependencies. The existing research-capsule fixture suite also
passed all 15 tests after adding the new packaged lab entry.

## Deterministic source, audio and timeline

[execution.json](execution.json) records hashes for every delivered source/asset,
the canonical project, full score, full PCM and complete WAV. It evaluates every
one of the 3,000 nominal frames, hashes their command stream and records maximum
geometry counts. The measured maxima are 31,932 triangle vertices, 1,152 line
vertices and 480 points. Terminal sample 2,880,000 has zero geometry.

The complete 2,880,000-sample score has eight different phrase hashes, a zero last
sample, minimum −6,732 and maximum 7,256, with no PCM16 saturation. The unit suite
compares the entire WAV data payload with irregular independently rendered sample
partitions. Browser export matches the same complete WAV, not an initial snippet.

- PCM16LE SHA-256: `25682ceb7ba79478c0e7199989a3586bd6bfc34d8b85c7ddb91c19382e0119e4`
- WAV SHA-256: `4d8742d369894c598e05d5639358b5d3e48642305af8634cca6db60eb2356fe3`

`scripts/verify-demoscene.mjs`, invoked by the source check, rejects stale source,
project or audio receipts. Float command hashes are compared to the archive only
on the same Node/platform/architecture; other runtimes independently compare fresh
and retained computations instead of asserting unsupported cross-runtime equality.

## Browser and creator evidence

The targeted packaged run passed actual play/pause/seek/restart, coherent audio
node cancellation, full WAV/project downloads, invalid-import preservation during
playback, quality parity, fullscreen, mobile layout and the visible Workbench
capture/keyframe/effect/undo/redo/export/import workflow. Offline reload plays the
production. A separate server retains a real older worker and incompatible cached
audio2d source while the content-hashed new graph starts. An aborted startup import
shows a usable reload button and recovers after the import becomes available.

| Time | Screenshot | State |
| --- | --- | --- |
| 4 s | [Opening](demoscene-4s.png) | Wireframe cubes and boot-era bars |
| 18 s | [Blocks](demoscene-18s.png) | Assembling mechanical corridor |
| 30 s | [Geometry](demoscene-30s.png) | Deep rings, tunnel and plasma wall |
| 42 s | [Cathedral](demoscene-42s.png) | Repeated industrial ribs and geometric core |
| 55 s | [Title](demoscene-55s.png) | Generated extruded typography and scroller |
| 60 s | [Ending](demoscene-60s.png) | Black canvas and completion interface |

[Workbench](demoscene-workbench.png) and [mobile](demoscene-mobile.png) show the
actual native UI. [Visual witness JSON](demoscene-visual-witness.json) separates
sample/command hashes from noncanonical pixel observations. All six sampled GPU
states differ, and the terminal canvas has zero bright pixels.

The optional intro is tested both with opt-out and skip, and the generated portable
package is served independently with a different seed and real audio playback.
No prerecorded frames, downloaded music or replacement renderer are involved.

## Size accounting

[byte-budget.json](byte-budget.json) inventories the full native production,
including required runtime, embedded shaders, HTML, styles, data, licences and
identity receipt. At this snapshot: **212,945 uncompressed bytes**, **57,282 gzip-9
container bytes**, **45,635 Brotli-11 container bytes**. The separate inert source
description is 6,215 bytes. Compression observations name their container format
and are not self-contained executable entries. No 4K/64K pass is claimed. The
diagnostic report itself is not part of the runtime inventory. WAV export is
generated on demand rather than bloating public precache.

## Attempts and limits

The [first browser attempt](attempts/browser-first.log) found mobile horizontal
overflow. Its [before screenshot](attempts/mobile-before.png) is preserved. An
explicit stage width fixes the aspect-ratio/min-height interaction; the subsequent
mobile check passes. Other hardening covers a failed audio-source start and
strict fixed-act effect descriptors. Earlier attempts are not relabelled as passes.

The existing full Node suite passes **964 tests**. Later targeted tests cover the
small audio-start/schema hardening. Source/catalogue, offline integrity and capsule
checks pass. All seven local browser groups passed; the final Demoscene-only
run rechecked the later audio/schema hardening and portable runtime. The full live
playback reached sample 2,880,000 with one source start, a released source, zero
terminal geometry and no browser errors. Its 66,043 ms observation includes initial
score preparation and automation, not a rendering-performance benchmark. The initial
PR snapshot `0c217bc1d26fe0a9edd4d888f4ce42e9ff5abfc3` passed all eight hosted
workflows; the PR checks identify the status of subsequent commits. Frozen RTX/formal archives
and the browser witness reuse policy remain unchanged. Games2 is clean and unchanged.

## Final review regressions

Review of commit `19eeef201a129b94d48ad337bfb0e19670337576` found three UI lifecycle
issues. The subsequent targeted browser run verifies their corrections:

- A valid import retains mute and a zero gain; the visible mute state agrees with playback.
- Persisted pagehide pauses without destroying the renderer; persisted pageshow resumes rendering and requires an explicit play gesture. Playwright disables BFCache by default, so this is a controlled PageTransitionEvent lifecycle fixture, not a claimed native cache hit.
- A valid 0.14-second editor time rounds to integer sample 6,720 before drawing an accepted edit. Out-of-range preview times reject before history or the active preview changes.

[review-fixes.json](review-fixes.json) records the original findings and the
regression paths. The full WAV and all authored scene/camera identities are
unchanged; source receipts and the byte inventory were regenerated for these fixes.
