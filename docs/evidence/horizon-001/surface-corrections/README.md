# Road sampling and embankment corrections — PR #105

Tested implementation: `754d44443dc177d87ac87186be19380a74346c9c`. Previous PR head:
`0d3bb7572a9a8c56a1cafe2564f95c41804ed4e0`.
The following evidence-only commit adds this record. Earlier
[milestone](../README.md) and [world-ownership](../world-ownership/README.md)
evidence is preserved.

## Reproduced failures and corrections

Six initial regression cases **failed before correction**:
[node reproduction](node-before.tap). The reported straight taper returned
X=-0.40625 for zero lateral offset and X=0.7335349462365597 for a requested metre.
The appended embankment triangles had downward/inward normals.

Sampling now constructs the physical cross-section from interpolated rendered
edges, measures signed metres from its midpoint, then uses XZ barycentrics to
obtain the actual rendered triangle's height and normal. The public ±9 m cap is
retained. A maximum 0.0002 m endpoint clamp accommodates Float32 coordinate
rounding. This coordinate is defined before vertical projection, not as a
geodesic distance on a nonplanar strip. The API guide states these boundaries.

A further numeric counterexample showed that two individually upward triangles
can form a concave strip whose interpolated cross-section leaves the mesh.
Validation now rejects such strips instead of permitting unsupported sampling.
This tightens admission in the unreleased candidate without changing format
versions. All previously documented finite/unit limits remain.

Embankment quad orders are reversed on both sides, preserving their diagonal
while exposing the upward surface. The native browser regression **also failed
on the old packaged geometry**: overhead light produced [0,0,0,255] while light
from below produced [76,76,76,255] for the first slope face;
[browser reproduction](browser-before.log). The corrected native test passes
for all four faces, requiring overhead red >40 and below-surface red <5, with
zero WebGL errors and ambient/environment contributions disabled.

The user's exact corrected positions are `[0,2,-1.1572265625]` and
`[1,2,-1.1572265625]`; the four reported normal Y values are all positive:
[recorded results](corrected-reproduction.json).

## Executed verification

- `node --test tests/*.test.js`: **1,090 passed**, zero failures/skips;
  [full TAP, gzip](node.tap.gz). Eleven new independent cases cover widening,
  narrowing, signed offsets, both constant banks, curved/changing-bank geometry,
  independent face planes, station/end boundaries, edge tolerance, concavity
  rejection and outward embankment normals.
- `node scripts/check.js`: **472 JS files, 69 module contracts, 647 links,
  134 imports and 12 workflows** passed; [log](source-check.log).
- `node scripts/build.js` and `node scripts/verify-offline.js`: **913 entries,
  6,182,914 bytes**, verified; [build](build.log), [offline](offline.json),
  [manifest, gzip](package-manifest.json.gz).
- `node scripts/browser-check.js --suites=render,editor`: **both complete
  packaged Chromium groups passed**, including actual bank lighting, retained
  geometry, HORIZON authoring, native recovery, narrow controls, offline startup
  and older-worker isolation; [log](browser.log).
- **27 cache/provenance/receipt tests passed**: [TAP](cache-tests.tap).
  All seven source closures have zero issues: [summary](profile-issues.json),
  [complete local profiles, gzip](source-profiles.json.gz).
- `git diff --check` passed. An evidence-only rebuild retained the complete
  tested manifest byte-for-byte: [parity](package-parity.log).

The other five browser groups and the unchanged Racing Lab smoke were not
rerun for this focused correction; their prior results remain in the original
milestone record. Earlier assertions, timeouts, frozen proof evidence and
browser receipt authority are unchanged. Live pins now include the fixed local
scenery import used by the native lighting regression. Qualification remains
one authenticated reviewed-main execution; these local records are not receipts.

Actual updated [hero](horizon-hero.png) and [overlook](horizon-overlook.png)
captures were inspected. [Resource counts](budgets.json) retain 46,374 high /
32,148 low vertices and 25 mesh draws plus the sky. No hardware FPS is claimed.
Environment: existing Node 22.18.0, external Playwright 1.64.0, Chromium
158.0.8127.18, Linux x64/headless SwiftShader. No installs, physical-device tests,
Games2 changes, merges, tags, releases or deployments occurred.

[Execution and source identities](execution.json).
