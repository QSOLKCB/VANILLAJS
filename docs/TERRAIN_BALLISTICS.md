# Game-to-engine extraction — terrain and ballistics

**Status:** experimental, opt-in. Neither existing FPS movement nor the integer engine changes.

## Provenance

| Pinned original (Apache-2.0) | New reusable implementation |
| --- | --- |
| QSOLKCB/Ski-Shooter @ 9864a6cdd741a5cb9938d6de610711be7aaeedc9, site/src/world.js | modules/terrain/index.js — heightfield sampling, normals, triangles and finite segment crossings |
| QSOLKCB/CorpoWars3d @ 2bdc0e12d7f0e3f691a2efbc2ab612e871b5d534, src/physics.js | modules/ballistics/index.js — closed-form bounded constant-gravity stepping |

Both modules are **adaptations with additional validation and independent tests**, not entire copies of donor games. No source assets, audio, models, campaigns, browser packages, external runtimes or optional Ski-Shooter LibreQuake artwork are included. The Apache-2.0 repository licence and attribution remain intact.

## Terrain contract

Heightfield constructor accepts cellsX, cellsZ (1–128), cellSize (positive bounded metres), originX, originZ and a dense row-major array of (cellsX+1)×(cellsZ+1) finite heights. It snapshots this array; callers cannot mutate its internal data. All horizontal queries must remain **inside the finite grid**, including both endpoints of a segment.

- sample(x,z) returns height, +Y normalized triangle-plane normal, integer cell and triangle index.
- triangleAt(ix,iz) returns two detached vertex triples corresponding to that interpolation. Split uses local u+v<=1 for (a,c,b) and (b,c,d) otherwise.
- castSegment(origin,displacement,{verticalOffset=0}) returns the first terrain-height crossing with time in [0,1], world reference-point, underlying surface height, normal and startedInside. It splits intervals at grid and diagonal boundaries to catch intervening crests/ridges missed by endpoints-only checking.

Vertical offset is a Y-axis clearance, **not** a swept sphere/capsule. This is a pure collision *query*, not a terrain-aware controller. There is no deformation, overhang, arbitrary triangular mesh, terrain rotation, sliding response or spatial streaming. At a shared triangle edge the normal need not be unique; a valid adjacent plane normal is returned.

## Ballistics contract

ballisticStep({height,velocity,dt,gravity=9.81,groundHeight=0}) returns {height,velocity}, with height in metres, velocity in m/s, dt in seconds. Gravity is positive and dt is bounded 0..0.1. Inputs must be finite; initial height below ground is rejected. Zero dt leaves the supplied state unchanged. Falling to ground clamps height to groundHeight and velocity to zero. Before landing, constant-gravity motion is mathematically partition-invariant up to floating roundoff. No implicit clock, game state or ambient randomness.

This remains **floating-point physics**, not the 16.16 fixed-point integer engine. A scalar groundHeight is a flat/static local boundary; a consumer must explicitly query the heightfield along its 3D path to handle ridge/terrain crossings.

## Usage

~~~js
import {Heightfield} from './modules/terrain/index.js';
import {ballisticStep} from './modules/ballistics/index.js';

const terrain = new Heightfield({cellsX:2,cellsZ:1,heights:[0,4,0,0,4,0]});
const crossing = terrain.castSegment([.25,2,.5],[1.5,0,0]);
const groundHeight = terrain.sample(.5,.5).height;
const jump = ballisticStep({height:groundHeight,velocity:4.3,gravity:11,dt:1/60});
~~~

## Verification

The focused Node tests check source-array copying, sampled-versus-renderable mesh parity, normals, edge and diagonal ridge crossings, bounded validation and **300 independently computed Möller–Trumbore ray/triangle oracle comparisons**, alongside ballistic split-step consistency, landing and invalid input gates.

Run:

~~~sh
node --test tests/terrain.test.js tests/ballistics.test.js
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
~~~

Full CI and packaged browser verification remain mandatory. Neither donor's performance numbers, a GPU speedup nor universal cross-browser bit-exactness are claimed.
