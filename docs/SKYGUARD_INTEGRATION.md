# SKYGUARD-001 — Naval Air Defence Lab

[Play Skyguard](../demos/skyguard-lab/index.html). Defend the fictional destroyer **DDG Resolute** through rotating naval weapon stations. This is a distinct air-defence game derived from [Spooky v0.1.0](https://github.com/QSOLKCB/Spooky/releases/tag/v0.1.0), not an embedded copy of Spooky.

## Four batteries, one ship

| Station | Fire control | Specialist refit |
| --- | --- | --- |
| TWIN / 35 autocannon | Hold to fire travelling tracers; lead aircraft and manage barrel heat | Cooler, tighter bursts |
| FUSE / 76 flak | Place a delayed airburst; a proximity fuse can trigger beside an aircraft | Larger blast footprint |
| SEASPEAR VLS | Hold aim near one contact until locked; fire a turning guided interceptor | Faster acquisition and turning |
| LANCER railgun | Hold to charge, release to fire a beam through up to three aligned targets | Additional penetrations |

Drones, fighters, bombers and low-flying sea-skimmers approach the ship. Their silhouettes, movement, hit points and breach damage differ. The first Cadet rotation contains **8 / 10 / 12 / 14 contacts**, with at most four active at once. Later raids grow; each completed rotation adds an active slot, up to eight in Cadet. Watch officer and Red alert offer greater pressure. The default is Cadet.

Clear a raid and choose one of three seeded refit cards. Damage, firing/reload handling, magazines and specialist systems persist separately for each battery. Damage control repairs the shared hull. Between raids the ship recovers eight integrity; zero integrity ends the watch. Each battery arrives resupplied.

The new Canvas scene includes a ship's bow and railings, forward turret, launch cells, bridge, escort vessels, sea horizon, aircraft, radar contacts, airburst smoke, wreckage splashes and a charged beam. The four batteries have distinct models and reports. **Bluewater Watch** revoices Spooky's deterministic score into four naval arrangements. The ship's manual exports complete 32-second WAVs, generated locally.

## Controls and lifecycle

Pointer / WASD / arrows aim. Left mouse / Space fires; the railgun requires a charged release. R reloads, P / Esc pauses. Touch uses independent aim and fire pointers. Standard gamepads use the left stick, RT / A, X and Start. Cancellation vents a rail charge without firing; only a normal charged release fires a beam. The launcher cannot spend ammunition before acquiring a valid lock. Missiles retain their acquired target; if it disappears, they continue their last course and expire instead of silently selecting another target.

Fit window, native fullscreen and Windowed page share VANILLAJS's display controller. Absolute pointer conversion accounts for the contained canvas and letterboxing. Lost focus, hidden tabs, history restoration, controller disconnect and display transitions cancel held input and require explicit resume. Menus and paused scenes stop repainting unless their presentation changes. Audio failure leaves combat and saved sound preferences intact.

## Source and dependency boundary

- Source release: `QSOLKCB/Spooky` **v0.1.0**, commit `0c13684a03e301e59ba5dd04c67167874ab04766`, tree `56597baf5affbbab9c09d44bb2fbdf2e471afe1d`.
- Adapted: Spooky's rotating station/refit architecture, seeded wave drafts, controller lifecycle, HUD structure, local preferences and deterministic score construction.
- Original to Skyguard: naval content, aircraft movement, weapon behaviours, warship renderer, radar and naval presentation. The ground map, AC-130 weapons, sniper scope and zombie models are not included.
- Runtime dependencies are shared native `math`, `collision`, `time`, `audio2d`, `soundtrack`, `api/audio` and `api/display` files. No engine copies, CDN, third-party runtime or downloaded assets are introduced. Game fiction and rules remain in the demo.
- `PROVENANCE.json` records original Git blobs/SHA-256 hashes and hashes of each adapted/original target. The Apache-2.0 licence and Spooky source notice remain byte-identical. The notice is retained as source attribution; its historical list of Spooky features does not describe every Skyguard feature.

The build packages a content-addressed snapshot of the lab's native module graph, using the same packaging function as Pursuit. This prevents an older root worker from combining the new app with an incompatible cached shared API. The root verified-cache service worker owns the lab's offline assets; Skyguard does not install a nested worker. Packaging remains allowlisted and below the repository's 16 MiB budget.

## Simulation boundary

Combat advances at 60 Hz through `FixedClock`, with bounded catch-up. Simulation uses seeded randomness and no DOM, wall clock or audio state. Aircraft and projectiles occupy a **logical 1152×720 arcade plane**, +X right and +Y down. Collision calls embed that plane as `[x, y, 0]`; these display units are deliberately not real-world metres. No shared module's SI or 3D frame convention is changed. Ship perspective and radar are presentation.

Autocannon and guided rounds use swept segments against moving aircraft boxes so fast projectiles cannot skip a target between ticks. Flak has a bounded flight/fuse delay and radial damage. Missile turning is rate-limited. The railgun traces a finite segment, orders hits deterministically and attenuates damage with penetration. Aircraft hitboxes conservatively cover their stylised airframes; they are not mesh-exact. Debris follows a bounded visual gravity model and splashes at the sea plane. This is fictional arcade behaviour, not a real naval weapon or flight simulator.

## Verification

The pure tests exercise complete eight-raid runs over three seeds, retained refits, wave growth and caps, malformed controls, moving projectile collision, flak clusters, missile lock/lost-target expiry, rail charging/penetration/cancellation, overheat/reload timing, loss/retry, fixed-step schedule agreement and deterministic four-arrangement WAVs.

The packaged browser suite plays all four batteries through actual DOM input handlers. A test-only clock advances accepted input ticks without changing hull, aircraft, ammunition or offers. It also checks pointer alignment, keyboard activation, toolbar Space, explicit resume, native/denied fullscreen, 320/390 px portrait and short landscape layouts, independent emulated touch pointers, controller cancellation, WAV export, offline reload, device-audio failure and startup under an incompatible older cached audio API. `?test=1` enables the bounded input-clock control; the normal game advances from real animation frames. `skyguard.snapshot()` returns a copy for inspection.

Receipts and captures are recorded in the repository evidence directory and uploaded by the normal hosted browser CI. These are software/browser checks, including emulated touch/controller events; physical mobile/gamepad ergonomics and cross-browser bit-exact floating-point claims are outside this validation.

```sh
node --test tests/*.test.js
node scripts/check.js
node scripts/build.js
node scripts/browser-check.js --suites=donor
```

The new browser suite is registered with the existing fail-closed reuse policy. New or changed source/harness bytes require real Chromium execution; the change does not manufacture reviewed-main reuse witnesses or trigger the owner's hardware runner.
