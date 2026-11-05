# QSOL geometry batching — RUNE/GALAXY memory-wall experiment

Status: additive experimental implementation; CI and independent review required.

This patch is stacked on top of PR #13 and implements one narrow transferable idea from `QSOLKCB/RUNE` and `QSOLKCB/GALAXY`: **minimize transient allocation and redundant copying in a repeated geometry-generation path**. Donor sources include `RUNE/README.md` and `GALAXY/docs/CPU-SIMD.md`; no donor source is copied.

## Contract

- Existing `boxVertices(center,size,color)` and `ringVertices(position,radius,color,segments=48)` continue returning new arrays with identical vertex data.
- Optional `out` array arguments append the same vertices to a caller-owned array, in the same order, and return that same array: `boxVertices(center,size,color,out)` and `ringVertices(position,radius,color,segments,out)`.
- The FPS Lab's dynamic platforms, moving targets, checkpoint rings, projectile boxes and impact rings now stream into their frame's two shared geometry groups. Array construction and `...spread` copying per primitive are avoided; the two frame arrays remain freshly allocated and the renderer still performs a Float32 GPU upload.
- No quantization, arithmetic reassociation, approximate inverse-square-root, collision shortcut, simulation-state mutation, scene-order change, or borrowed mutable GPU storage is introduced.

## Evidence boundary

`tests/geometry-batch.test.js` compares original append-by-spread assembly to the direct append assembly for deterministic mixed frames, signed zero, custom segment counts and exact Float32 upload byte parity. Existing rendered-pixel tests and OPT receipt checks remain part of the normal CI workflow.

`scripts/geometry-batch-workload.js --check` records paired seven-trial isolated CPU geometry assembly observations with no timing threshold. It does not measure a WebGL driver, GPU, actual game FPS, garbage-collector pauses, or peak memory. Memory traffic is reduced structurally through eliminated per-primitive result arrays; quantify allocation/GC changes separately before making a numerical memory claim.

## Further donor opportunities — not implemented

- `GALAXY` procedural GPU vertex generation: requires separate shader/pixel parity and GPU testing; can introduce GPU arithmetic instead of CPU work.
- `GAMES/VECTOR_ZERO` staged immutable geometry and instance transforms: high-potential scene architecture, but external Three.js runtime is deliberately **not** imported.
- `YANG-MILLS` spatial blocking, `LATTICE` 3×3×3 structures, and ternary frustum classification: mathematical analogies are not validated broad-phase accelerators. Benchmark conservative classifications on real scenes, then compare against a known-exact linear scan.
- `LHC`, `486`, `BLOCH`, `VIZ`, `QNTOY`, `NS`, `E8_MUSIC`, `SONIFICATION`, `SPECTRAL`: useful for independent oracle/replay, procedural visuals and diagnostics, but not substitutes for measured render-path improvements.

## Reproduction

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/geometry-workload.js --check
node scripts/geometry-batch-workload.js --check
```

Run the packaged browser suite and confirm pixel parity, click/pointer lifecycle, shader errors and context-loss paths remain unaffected. Do not merge this dependent PR before its base PR passes review.
