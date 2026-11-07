# Appearance composition — source-pinned CorpoWars3d PR #8 adaptation

**Status:** experimental, opt-in, pure JavaScript. No shaders, characters, runtime dependencies, asset libraries or GPU extensions are imported.

## Donor and scope

Source: QSOLKCB/CorpoWars3d PR #8, `src/skins.js`, commit
`7b42cae4d7f46a36f00e86beee35cf4258994dab`, merged as
`678da3a3d94e544c722a540ad218daf1535e7f9e` (Apache-2.0).

PR #8 demonstrates an RGB colour lookup table, byte-indexed outfits, reproducible identifier-based crowd variation, a single procedural emitter consumed by two renderers, and high/low detail models verified against the authoritative hit volume. This VANILLAJS module reimplements that **general design** using caller-provided parts, palette and bounds. It does not import the named characters, game-specific outfits, assets or shader code.

## Contract

`createAppearance({palette,slots,colours,parts,fallen=[],variants={},bounds})` validates and snapshots a declarative model:

- Palette: 1–256 RGB triples, finite components in [0,1]. Slots are unique identifiers, with one palette index each. Inputs are copied into frozen records, so later caller mutations cannot change the model.
- Parts: `x,y,z,w,h,d,slot`, optional `detail:'high'|'both'`, `gaitZ`, `head`, `glow`. Local metres use +Y up and -Z forward. Geometry must fit the advertised `height,halfWidth,minZ,maxZ` hit volume, even at gait extremes. `head:true` parts must reach the declared headshot band (default 82% of height).
- `variants`: alternative palette indices for **explicitly marked** slots. `seedAppearance(uint32Id)` gives three reproducible 16-bit words; stable actor IDs select variations without a clock, implicit RNG or unbounded global cache. Unmarked slots remain unchanged.
- `emitAppearance(model, callback, pose)` emits world-space yaw-oriented cuboids in template order. Callback accepts `(x,y,z,w,h,d,rgb,glow,yaw)`. Pose includes `id,position,yaw,gait,lod,flash,dead`. Low LOD omits high-only parts; dead geometry is independently supplied. No game state is modified.
- `emitAppearanceToStream(model,stream,pose)` sends exactly the same cuboids into the existing retained 12-float `CuboidStream`, with a preflight capacity check. Callback failures during emission are **not transactional**.

These are **presentation-space** bounds. Any consumer with rotating actors is still responsible for world-space collision correctness; this module does not change hit detection, headshot thresholds or physics.

## Minimal example

~~~js
import {createAppearance,emitAppearanceToStream} from './modules/appearance/index.js';
import {CuboidStream} from './modules/cuboid-stream/index.js';

const model=createAppearance({
  palette:[[.1,.2,.3],[.8,.5,.2],[.3,.4,.5]],
  slots:['jacket','accent'],colours:[0,1],
  variants:{jacket:[0,2]},
  bounds:{height:1.9,halfWidth:.5,minZ:-.6,maxZ:.6},
  parts:[
    {x:0,y:.9,z:0,w:.42,h:.7,d:.28,slot:'jacket'},
    {x:0,y:1.6,z:-.12,w:.12,h:.04,d:.02,slot:'accent',detail:'high',glow:.5}
  ]
});
const stream=new CuboidStream();
emitAppearanceToStream(model,stream,{id:17,position:[3,0,-4],yaw:.2});
const packed=stream.snapshot();
~~~

## Verification and performance boundary

`node --test tests/appearance.test.js` checks source immutability, shared LUT indices, seeded variation and invariant slots, high/low/dead emission, headshot and geometry bounds, Float32 stream parity, and invalid-pose rejection.

Full CI still covers the repository-wide Node suite, source-contract checker, build and packaged Chromium. This module does **not** add a native instanced GPU adapter or claim faster FPS. The frozen RTX5060TI-001 and RTX5060TI-002 archives remain unchanged; neither historical receipt contains these new appearance workloads.
