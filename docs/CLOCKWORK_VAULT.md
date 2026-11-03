# The Clockwork Vault — v1.0.0 showcase

**Credit: Brian Thorne’s ARCH OMI.** Open `demos/clockwork-vault/index.html`
through the repository’s static server. This original first-person chamber
composes the existing game modules and [Brass Engine](BRASS_ENGINE.md) into a
complete expedition with six seals, moving gates, a causeway, a lift and an exit.

The v1.0.0 number names this completed showcase milestone. It does not promote
experimental module contracts, demo-owned schemas or the OMI research entry to
stable APIs. There remain eleven core modules; the vault is the fifteenth game
recipe and explicitly declares its research dependency in `MODULES.json`.

## Play the expedition

Walk forward to the active brass console and inspect it when the proximity
prompt appears. The latched word must match its engraved target before the seal
can be engaged. A complete crank revolution is one OMI delta operation. Each
lever XORs the word with a labelled fixed mask. The order of operations matters.
First release the gates, then cross the raised causeway. The fifth seal powers
the lift. Board it at the lower landing, ride to height 2 m, and walk forward onto
the upper floor. Release the sixth seal and pass through the last door to finish.

| Control | Action |
| --- | --- |
| WASD / on-screen movement buttons | Walk and strafe |
| Mouse capture / drag / arrow keys | Look; stopping mouse input stops turning |
| Shift / Space / C | Sprint / jump / held crouch |
| E | Inspect a reachable console; leave an open console |
| Crank / T or Δ Full turn | One detent / motor through the remainder of one revolution |
| 1–3 / lever buttons | Apply the corresponding XOR mask, only with an idle cam |
| U / R | Undo / reset the current unsealed lock |
| Tab, Enter, Space | Navigate and activate console buttons |
| Escape / Pause / window blur / hidden tab | Freeze the expedition and cancel input |
| Engage seal | Release the current mechanism after a complete matching calculation |

The motor runs at eight detents per simulation second: fifteen integer ticks
per detent at 120 Hz. The first seven detents expose the capture, rotations and
XOR lanes; the eighth latches the result. The actual calculation uses the existing
`BrassMachine`, not a separate decorative substitute. Closing a console stops
its motor at the current fractional position; a subsequent turn resumes toward
the latch. Pausing preserves its motor flag and fraction until deliberate resume.

Undo cancels a pending revolution first. At an idle cam it reverses the last
completed command. Reset restores only the current lock’s seed. Engaging a seal
commits that progression: completed locks cannot be undone or reset through the
game controls. Restart begins a fresh expedition. A fall below the chamber
returns the player to the last visited console, preserving released seals.

Touch uses a drag to look plus held movement buttons. Cancelled gestures and
late pointer releases cannot activate discrete controls. Keyboard repeats after
input cancellation cannot restart movement or operate the console. The console
traps keyboard focus while open. Reduced-motion preferences snap the drawn cam
to detents; the integer calculation is unchanged. No sound is required or emitted.

## Six authored locks

Commands are `0 = delta`, `1 = lever A`, `2 = lever B`, `3 = lever C`.
Every completed delta or XOR costs one command. Cam detents, undo and reset are
not graph edges; shortest lengths measure the forward puzzle command sequence.
The command tape accepts at most 128 completed commands per lock. Undo/reset
remain available at the limit. The UI shows its most recent twelve entries.

| Seal | Seed | Target | XOR masks A / B / C | Shortest commands | Mechanism |
| --- | --- | --- | --- | ---: | --- |
| The Awakening | `1234` | `EB78` | `0001` | 2 | Rising entrance gate |
| The Twin Keys | `4A21` | `C20C` | `00F0`, `0F00` | 3 | Parting doors |
| The Still Point | `1477` | `A177` | `1000`, `0100` | 4 | Inner gate |
| The Lost Causeway | `00C3` | `59BE` | `3333`, `000F`, `8001` | 5 | Gate and rising bridge |
| The Ascent | `BEEF` | `7A7E` | `0FF0`, `00A5`, `8421` | 6 | Gate and cycling lift |
| The Keeper’s Seal | `5A3C` | `31AF` | `1111`, `0248`, `8001` | 7 | Final vault gate |

Delta alone remains inside a cycle of length 1/2/4/8. The masks allow movement
between those cycles; they do not make every level reach every possible word.
[`VAULT_EVIDENCE.json`](VAULT_EVIDENCE.json) records each reachable component,
all its examined edges, an independent shortest solution and a distance-table
hash. The hint search uses a bounded FIFO traversal with 512 expansions per
simulation tick and at most 65,536 visited words. It returns one next-step hint
from the current word; it never operates the mechanism for the player.

## World and composition

- `character` supplies upright walking, crouching, jumping, mouse-oriented views
  and translating-platform riding; `collision` supplies AABBs and line of sight.
- `interactions` checks grounded proximity, sequence, idle calculation and target
  equality before emitting a release. DOM button state is not the authority.
- `time` supplies fixed 120 Hz ticks, a 0.25-second frame clamp and a 32-step
  catch-up limit. Excess wall time is dropped. The expedition has an explicit
  four-hour simulation limit, after which it can be saved or restarted.
- `input` supplies fresh-press keyboard cancellation and mouse capture/drag.
  `render-webgl` draws original procedural stone, brass and etched geometry.
- `puzzles.js` owns puzzle definitions, `VaultLock`, its 128-command tape and
  `PuzzleSearch`. `world.js` owns chamber geometry, progression, checkpoint policy,
  fixed-tick composition and replay validation. `app.js` owns DOM, WebGL, focus,
  file handling and the bounded hint work. None is a new core API.

Coordinates remain metres, +Y up and −Z forward. The chamber spans X ±8 m and
Z +8 to −63 m. The upper landing is 2 m high. Gates move over 180 mechanism ticks;
the bridge rises over 240. The lift’s 960-tick route has 240 ticks at each landing
and 240 ticks for each two-metre translation. A blocked kinematic transaction
holds the entire mechanism clock, then lets the player move against the stopped
world. Simulation time can advance while the mechanism clock is held.

Door movement, collision and platform carrying use the same model state.
Etchings, small decorative elements and drawn cam angles do not feed back into
physics. Colliders are upright, axis-aligned boxes. There is no capsule, slope,
rotating rigid-body, reciprocal gear-contact or crushing solver. This is an
imagined chamber with discrete logic, not an ancient-device reconstruction.

## Local expedition replay

Save pauses and downloads `clockwork-vault-v1.json`. Restore accepts at most
64 KiB, parses JSON without evaluation, validates a fresh expedition before
replacement, and leaves it paused. A completed replay restores its victory
state. A stale asynchronous file read cannot overwrite newer user actions.
There is no network request, backend, account or persistent browser database.

The strict version-1 envelope has these fields, with no unknown keys:

| Field | Meaning |
| --- | --- |
| `schemaVersion`, `game`, `levelSet` | `1`, `clockwork-vault`, `vault-six-1`; unsupported revisions are rejected |
| `ticks`, `mechanismTick` | Bounded integer world ticks and the mechanism clock; mechanism time cannot exceed world time |
| `locks` | Six records containing completed numeric commands, redundant word, pending detents 0–7, subTick 0–14 and motor flag |
| `sealedAt` | Six mechanism-tick release times or null; only a chronological solved prefix is valid |
| `player` | Owned position, velocity, yaw, pitch, crouch/ground flags, support id and support velocity |
| `checkpoint`, `console`, `rescues` | Bounded checkpoint/rescue state and the reachable open console or null |
| `complete` | Must agree with all six released locks and the exit position |

Import reconstructs every word from the pinned seed and allowed command history.
It rejects incorrect words, impossible phases, operated future locks, unearned
seal releases, invalid support, positive-volume overlaps with the reconstructed
world, unreachable open consoles and inconsistent completion. It validates
finite bounded poses before replacing any live state. Rendering interpolation
and sub-tick wall-clock debt are intentionally not saved; simulation poses and
integer cam positions are. Logical OMI state is exact; physical continuation is
tested for identical state in one JavaScript runtime.

These files are portable save snapshots with a replayable puzzle command tape,
not a signed event audit or an anti-cheat protocol. Structural and consistency
validation does not authenticate who produced a save. Valid edits to player pose
or timing are not evidence of a historically played route.

## Verification and provenance

```sh
node --test tests/vault.test.js
node scripts/verify-vault.js --check
```

The independent development oracle uses arithmetic bit extraction and parity,
then its own complete FIFO graph traversal. Each distance table contains 65,536
signed little-endian 32-bit entries; −1 denotes an unreachable word. Its hashes,
component sizes and shortest lengths reproduce in CI, ignoring only the recorded
runtime label. The runtime hint solver uses separate code and the OMI kernel.

Nineteen new Node regressions cover every puzzle, bounded hints, staged latching,
undo, limits, 144 lock replay phase/fraction cases, invalid data, interaction
failure paths, the entire physical route, bridge/lift support, fall recovery,
blocked-motion interlocks, moving-lift saves, pause and 30/60/144 Hz schedules.
Packaged Chromium scenarios cover the full expedition with ordinary controls,
actual JSON download/restore, invalid and stale files, pointer and keyboard
cancellation, captured mouse, mobile touch controls and graphics failure.
Execution details, screenshots and artifact hashes are recorded in the PR after CI.

The original source pins and OMI interpretation remain in [ARCH_OMI.md](ARCH_OMI.md).
Brian Thorne’s mathematical reference is credited; four-nibble packing, valued
XOR edges, these authored puzzles and the chamber are VANILLAJS choices. No
external source files, artwork, audio or runtime libraries are imported.
Other browser engines, physical devices, real mechanical tolerances and broad
performance claims remain unverified. Existing game and research demos remain
available, and the underlying OMI kernel is unchanged.
