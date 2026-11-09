# Repository engineering rules

- QSOL-IMC motto: **Make amazing alien tech and put it under an Apache 2.0 license.**
  Preserve Apache-2.0 SPDX headers and third-party attribution when adapting code.

- Preserve the existing Apache-2.0 licence and provenance notices.
- Runtime code uses native ES modules and browser standards. Keep third-party
  engines, npm runtime dependencies, CDNs and downloaded assets out of the core.
- Add a module only for concrete reusable behaviour. Keep game worlds, fiction,
  progression and DOM layout in demos or consuming games.
- Maintain the one-way dependencies in MODULES.json; update API contracts and
  examples when public behaviour changes. Pure core modules have no DOM, browser
  global, ambient clock or unseeded-random dependencies.
- Use SI units, +Y up, -Z forward, right-handed rotation and xyzw quaternions.
  Document frame conventions and approximation limits explicitly.
- Preserve fixed-step simulation, bounded catch-up and input cancellation on
  pause/focus changes. Gameplay tests must include relevant failure paths.
- Run `node --test tests/*.test.js`, `node scripts/check.js`, and
  `node scripts/build.js` for implementation changes. Browser changes also require
  the packaged Chromium check in CI. Record actual execution separately from
  inferred behaviour and unavailable device coverage.
- Keep public packaging allowlisted. Never include tooling dependencies, secrets,
  browser profiles or temporary preview configuration in the deployed artifact.
- Future features in ROADMAP.md are not implemented APIs. Mark API maturity
  honestly; do not promise cross-browser bit-exactness or unmeasured performance.
- Submit changes through a PR. Do not merge, publish a release or move an existing
  release tag as part of implementation work unless the user authorises it.
