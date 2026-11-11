# ALIEN COURSE BRIDGE — exact drone-course authoring

**Status: experimental, opt-in, authoring-only.** Introduced after the immutable VANILLAJS v1.6.0 ALIEN MATH release. This does not alter the historical evidence, authoritative integer simulation, replay contracts, Lean/SPARK proof assets or owner-only GPU workflow policies.

## Goal

Provide a reusable game-authoring module for finite drone-race course definitions. Centre, altitude, depth and aperture dimensions are **canonical decimal strings**. The module uses ALIEN-MATH-001 bounded exact rationals, ALIEN-MATH-002 explicit checked quantization, then exposes closed axis-aligned XY aperture checks and ordered swept crossings.

- Implementation: modules/exact-course/index.js
- API: compileCourseQ16(source, {rounding, overflow})
- Predicates: crossesGateQ16(compiledGate, fromRaw, toRaw) and advanceCourseQ16(compiledCourse, nextGate, fromRaw, toRaw)
- Interactive lab: demos/alien-course-lab/index.html
- Independent reference: scripts/alien_course_oracle.py using Python standard library fractions.Fraction
- Planned consumer: QSOLKCB/DRONE-RACER PR #2; the live DRONE-RACER does not yet use this module.

## Source and coordinate contract

A source course is a plain data-only record with exact own properties id, version and gates. Version must be 1. Each gate is a plain data-only record with exactly id, x, y, z, width, height. All five geometric fields are canonical decimal strings, not JavaScript numbers. Accessor properties, unexpected keys, missing fields, duplicate gate IDs, sparse arrays and out-of-bounds values are rejected.

Right-handed geometry uses +Y up and -Z forward, with rectangular apertures on constant-Z planes. Gate centres are bounded to 200 metres from X origin and Y within 0–200 m. Width and height are 2–100 m. Z planes decrease by at least 4 m from Z=0, remaining at least -32767 m. There are 2–64 ordered gates. This contract does not support arbitrary oriented 3D gate planes.

Aperture edges are calculated in exact rationals as x ± width/2 and y ± height/2 before conversion. Explicit policies rounding and overflow are required. Six rounding modes and reject/opt-in saturate match ALIEN-MATH-002. For exact mode, saturation is forbidden. All compiled coordinates are checked signed-int32 raw Q16.16 Numbers. No implicit float conversion exists.

The returned frozen course and gates carry private in-memory admission identities. JSON export is inspectable data, not a serialized executable capability: consuming programs must revalidate source definitions and compile their own admission-bound objects.

## Swept collision classification

Inputs are three-element [xRaw,yRaw,zRaw] vectors of signed-int32 Q16 values. A checkpoint requires a forward -Z segment crossing the plane. The exact segment intersection is tested against the inclusive closed aperture by widened BigInt cross-products. No intermediate Q16 rounding or numeric float tolerance is applied.

advanceCourseQ16 handles multiple eligible gates crossed during the same tick and stops at the first missed gate. It returns nextGate, crossed and finished without changing a player's tick count or movement.

This classifies a quantized discrete path, not continuous flight physics. DRONE-RACER has established its separately tested Float64-to-Q16 conversion boundary and still retains floating-point flight. The new MOD-SDK-002 exact-circuit module supports directional cardinal courses independently of the original v1 gate contract. No cross-browser bit-exact replay or universal ECMAScript refinement is claimed.

## Reproduction

    node --test tests/alien-course.test.js
    uv run --no-project python scripts/alien_course_oracle.py
    node --test tests/*.test.js
    node scripts/check.js
    node scripts/build.js
    node scripts/verify-offline.js

Finite checks include exact boundaries, multi-gate and missed-gate sweeps, unsupported rounding, hostile record shapes, frozen objects and independent Python Fraction comparisons. They do not constitute a general formal proof.

## Future Mod SDK

The new module is a building block for data-only course mods. The stable VANILLAJS Mod SDK remains on the roadmap: versioned registration, lifecycle, modifiable labs, game creation guides, editor integration, independent validation and local/offline packaging. Same-origin JavaScript extensions are trusted code, not a security sandbox.

**This is not a product. This is INDEPENDENCE.**
