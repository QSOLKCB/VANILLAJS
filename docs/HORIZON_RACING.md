# Make a scenic race with HORIZON

Open [Race Foundry](../demos/horizon-lab/index.html) from the Creator Hub or the existing Racing Lab’s Track Foundry. For a first launch without internet, extract the source ZIP and double-click `demos/horizon-lab/index.html`. Keep the extracted folder together. To use the HTTP build instead:

```sh
node scripts/build.js
python3 -m http.server 8000 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8000/demos/horizon-lab/index.html`.
No package installation, account or remote artwork is required. The main
`index.html` opens the playable race; `race.html` remains a compatible race URL.
The separate [Scenery Atelier](../demos/horizon-lab/scenery.html) is a static
visual-authoring workshop whose camera tour does not drive the car.

## Drive the original route

Cape Aster — Sunward Run is a complete short race through original elevated
coastal scenery: about 509 m, eight ordered checkpoints and a three-second
countdown in the supplied recipe. Select **Start race** and wait for the countdown.
Keyboard driving belongs to the focused canvas; form fields remain ordinary
authoring controls.

| Control | Action |
| --- | --- |
| W / Up | Drive forward; brake first if currently reversing |
| S / Down | Brake while travelling forward, then engage reverse and drive backwards |
| A / D or Left / Right | Steer |
| Space | Brake independently without requesting a direction change |
| Escape | Pause |

Hold S/down to slow to **0.5 m/s or less**, request the actual reverse gear, wait
for its shift delay, then drive backwards. W/up follows the same safe transition
back into first gear. The threshold uses total vehicle speed, including sideways
motion. This is a lab-owned control policy over the existing `vehicle3d` gearbox;
it never negates velocity or moves the rendered car independently. Reverse uses
the configured reverse ratio, and automatic forward shifts do not cancel it.
Holding both direction controls, or holding Space, applies the brake instead.

**Course assist: ON/OFF** (ON by default) applies bounded route steering and corner-speed braking through ordinary `vehicle3d` input. Switch it OFF for direct unassisted controls. No route, world pose or physical state is secretly modified. Excessive high-speed digital steering can otherwise saturate tyre grip and produce sudden slides.

The five touch buttons provide left, right, **Brake / reverse**, independent
**Brake** and **Forward** actions. The gear display shows **R** in reverse, while
engine audio and wheel rotation follow actual vehicle telemetry. Pause, focus
loss or a hidden page clears driving requests. Release held keys and press again
after resuming; an old held reverse key cannot restart driving by itself.

Follow the amber checkpoint gates in order and race the turquoise rival to the
finish. The rival steers a real vehicle through the same physics. Player and rival now have bounded same-level oriented-chassis contact with symmetric momentum response; cars no longer ghost through each other. Brake before corners. **Recover**
returns you just beyond the last accepted gate (or to the start before any gate)
and adds the displayed time penalty: four seconds in the supplied recipe.
Recovery does not award skipped gates. Passing a checkpoint backwards does not
award it. Recovery and **Restart** restore first gear with cleared driving input;
Restart begins a new attempt with your accepted tuning intact. Race time advances
only during simulation; a recovery
penalty can leave you waiting at the finish before the result is decided.
Switch between chase, bonnet and cockpit-style cameras without changing physics.
Enable sound with its button to hear original procedural engine/exhaust and tyre
feedback. Sound is optional and stops with the race.

## Change the route and vehicle

Choose **Selected road knot**, change its X/Z position, **Elevation (m)**,
**Bank (radians)**, **Road width (m)**, **Road surface** or **Structure**, then
select **Apply changes & reset**. Width is the full road width, not a half-width.
Environment and scenery seed can change terrain as well as appearance. **Visual
detail** changes rendering detail while retaining the road/contact geometry.
Surface friction changes actual handling. The recipe JSON exposes the full
validated route and limits.
Rejected edits keep the accepted project. Undo/redo restores admitted authoring
states; each accepted change begins a fresh test drive rather than pretending a
saved race remains comparable after its world changes.

Changing **Vehicle silhouette** immediately loads the original sport, touring
or utility class with matching dimensions, mass and suspension. Apply pending
form edits first if you want to keep them. Tune **Torque curve: rpm:Nm pairs**,
**Forward gear ratios**, spring/damper response and grip, then drive the result.
For example, a curve entry `4200:300` means 300 N·m at 4200 rpm. Spring values
are N/m and damper values are N·s/m. Paint and material appearance are independent
of forces. Both cars use the accepted vehicle recipe; **Rival target (m/s)**
sets the opponent's desired speed rather than teleporting it along the road.
The supplied race uses automatic gearing. The lower-level vehicle recipe also
permits a manual gearbox, but this race UI has no forward-ratio shift buttons;
disabling `vehicle.gearbox.automatic` retains first gear during forward driving.
The safe first/reverse direction requests still work. The separate Vehicle
Dynamics study retains its existing manual gear controls and brake mapping;
the race's directional control policy does not change that workshop.

The camera field of view and steering/bank angles are in radians. Engine, exhaust,
tyre and shift gains are linear mix levels from 0 to 0.4; **Exhaust tone** is a
frequency multiplier. These sound settings and camera settings change presentation
without changing the forces. The full vehicle and sound recipes remain available
in **Inspect or edit race JSON**. Use **Validate and apply JSON** to admit an edit;
plain imported text is never executed.

A road schema can reject a folded triangle or unsupported value. It cannot promise
that a steep, slippery or sharply curved route is fun or finishable. Test your
changes with real inputs. Use the specialist [Vehicle Dynamics](HORIZON_DRIVING.md)
and [Scenery Atelier](HORIZON_LAB.md) for focused investigation.

## Keep and share the result

Select **Export race recipe** to preserve editable, inert authoring data, then
use **Import race recipe** to continue work. **Export vehicle** downloads only the
reusable vehicle3d recipe; it does not contain a route, art, audio or game rules. This separate `qsol.vanillajs.horizon-race.v1` sidecar
preserves the legacy `qsol.vanillajs.track.v1` format; the two are not interchangeable.

Select **Export playable race** for the complete single-route game ZIP. It includes your
course, both vehicles and race rules, cameras/HUD/controls, procedural audio/art,
native local engine modules, source hashes, licences/notices and an offline worker.
It excludes the authoring interface, external assets, multiplayer and saved progress.
`README.txt` inside the package describes serving and provenance. `project.json`
is the editable copy to reimport; the runtime uses the validated data embedded
during export, so editing that JSON in the extracted folder does not update the game.
Apply changes in Race Foundry and export again.
Extract everything into a new directory and double-click its top-level `index.html`. Both cars, cameras and controls work directly from disk. The exported race includes its accepted project and all executable modules. A local HTTP server is also supported:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open its HTTP URL, let the integrity-checked worker install and then test a later
offline visit. HTTPS or loopback is required for service workers. A new browser
still needs the complete package served once. Keeping it under a nested URL prefix
is supported; keep its directory structure and notices together.

For a reproducible command-line export from the checkout:

```sh
node scripts/export-horizon-race.mjs MY_RACE.json --out MY_NEW_RACE_FOLDER
```

The output directory must not already exist. Runtime changes require regenerating
and reviewing `node scripts/horizon-race-runtime.mjs --write`; ordinary project
editing does not. Package hashes identify the actual included source, not a promise
that an unreleased candidate is an approved engine release.

## Limits and integration

The suspension/tyres/materials are documented approximations. Decorative trees,
checkpoint arches and tunnel/building walls are not collision surfaces. Cockpit
is a driving camera with the local body hidden, not a detailed interior model. No physical controller,
phone or GPU coverage is implied by Chromium emulation. Try low detail if needed;
graphics recovery leaves the race paused, and invalid data does not erase your work.

For your own game, reuse [vehicle3d](VEHICLE3D_API.md), [scenic3d](SCENIC3D_API.md),
[render-lit](RENDER_LIT_API.md) and [vehicle-audio](VEHICLE_AUDIO_API.md). Own your
content, input lifecycle and rules separately. A Games2 game must select an
immutable owner-approved release and record provenance in its own reviewed PR.
[Contracts and verification boundaries](HORIZON_003.md).
