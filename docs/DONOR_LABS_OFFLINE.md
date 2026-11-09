# Bullet Time Lab + ARCADE Lab — deterministic OPT adaptation

**Status:** laboratories shipped in v1.3.0; v1.4.0 performance and cache-negative-control work is described in [PROOF_OF_SPEED.md](PROOF_OF_SPEED.md). Do not infer a universal
hardware speedup, browser consistency, or a formal proof from this document.

## Source identity and license

- VANILLAJS baseline: `9e643c7f661f3a2dfb1d6f04425562dc676054f9`.
- QSOLKCB/Bullet-Time: `03d4af42107124b581e3404b2396f53cdca52016`;
  `src/game.js`, `src/clock.js`, Apache-2.0.
- QSOLKCB/ARCADE: `2a7d1120ac674d733dff5035e637f3cf8e36bdad`;
  `arcade2/`, `js/games/void.js`, `sw.js`, Apache-2.0.
- QSOLKCB/OPT: `7556dd36acd53ed3ed538fd03b1db44e5c1ec869`;
  OPT-INV-001, OPT-INC-001, OPT-REDUCE-001, OPT-BUDGET-001.
- This adaptation is an independently composed demonstration, not a copy of
  ARCADE cabinets or Bullet-Time's game. It keeps Apache-2.0 source notices.

## What was absent from the existing labs

The existing 2D Foundry exercises RTS movement, shmup, platform and car;
the FPS Lab already has a quarter-speed switch and projectile handling.
These additions isolate **missing** behaviours without replacing those labs:

1. **Bullet Time Lab:** one unchanged 120 Hz real tick samples controls;
   independent world/player/weapon durations respond to focus and dodge
   with a smoothed scale. Swept AABB hits resolve moving actors and static
   cover. The test adapter gives the *same full physical state* with the
   reference full scan or the retained spatial index.
2. **ARCADE Lab:** two independent scenarios, breakable bricks and bank
   bumpers. A fixed-step square-puck sweep, paddle return and collision
   normal reflections produce score/life receipts. An immutable AABB index
   is built once for each static fixture. A destroyed brick becomes a
   query-level ignored ID; **never mutate indexed geometry**.
3. **OPT:** `FrameGate` skips drawing only for identical complete
   tick/mode/renderer-state keys. It must not skip physics or input
   processing. Static index reuse is invariant-bound to an immutable
   complete collider set. Each update reports candidate-vs-full-scan
   work counts, not timing or a universal speedup.

There are deliberate limitations: the lab renders stylized Canvas 2D
projections, not a full 3D engine or a physically exact sphere/rigid-body
solver. Floating-point simulations are deterministic for the tested input
tapes on the same JS implementation; cross-browser bit-exactness is not
claimed. Interpolation, dynamic geometry indexing and multiplayer are out
of scope.

## Separate optimization domains

**Do not conflate CI artifact reuse and browser Service Worker caching.**
They have different trust boundaries and proof obligations.

- CI continues caching **only** pinned Playwright tooling under its
  existing environment/toolchain key. It never caches test pass/fail,
  game state, rendered evidence or compiled outputs across source revisions.
- The packaged browser build computes SHA-256 for every allowlisted
  runtime asset. A generated service worker embeds the entire asset
  path, byte size and digest inventory plus a single version digest over
  that inventory. It verifies every response **before publication** to an
  isolated CacheStorage cache. An incomplete install fails and deletes its
  partial cache; the previous active worker remains available.
- New versions get distinct cache names automatically from content.
  No manual version-bump constant. Existing clients complete on their
  previous worker; no `skipWaiting` or forced replacement. Activation
  removes obsolete caches of the same scoped VANILLAJS worker only.
- Network fallback for a missing known asset is verified against the
  same expected digest before caching/returning. Unknown URLs, requests
  with query parameters, cross-origin resources, Range requests and all
  non-GET requests are left to the network as ordinary browser traffic.
  Cached source must never be interpreted as an authoritative simulation
  state or a substitute for CI execution.

### Service worker availability and limits

Only the **built dist/** contains `service-worker.js` and
`manifest.json`; no worker is installed from an unbuilt source checkout.
`offline/register.js` activates only under HTTPS or loopback HTTP,
requires the generated manifest, and is harmless when service workers
are unavailable. The install caches all packaged static files (16 MiB
build budget). A service worker can reduce repeat downloads and enable
offline navigation **after** initial activation; it does not accelerate
game loops, guarantee speedups or eliminate first-install bandwidth.

Version identity changes with any asset byte, path or size, or any worker-template code byte.
The service worker script itself is also recorded in the post-generation
package manifest. No `npm install`, CDN, third-party runtime dependency,
telemetry, cloud call or storage of user session data is added.

## Correctness and evidence

```sh
node --test tests/time-domains.test.js tests/donor-labs.test.js
node scripts/check.js
node scripts/build.js
node scripts/verify-offline.js
```

The test suite compares **entire physical state/event receipts** for
optimized versus full-scan paths on deterministic tapes (not mere scores).
It checks input validation, domain separation, unchanged state ownership,
and measured candidate counts bounded by full-scan counts. The CI browser
check navigates both labs, exercises controls and loads a lab while
offline after verified service-worker installation.

These tests establish the enumerated fixtures only. Do not promote
runtime gains before paired cold/warm measurements on representative
target machines (OPT-BUDGET-001). Any parity failure requires disabling
index reuse, fixing the invariant, then re-running the full reference
tests. A service-worker install hash mismatch must fail closed.

## Operations and rollback

To disable the offline feature in a subsequent release, remove the
registration script tags and include an explicit, reviewed migration
for previously registered workers/caches; simply removing source
registration does not unregister an existing browser service worker.
For troubleshooting, use browser developer tools to unregister the
VANILLAJS-scoped worker and clear its scoped caches. Do not delete
unrelated application caches.
