# Campaign briefings

The original **Open Frontier** and **Machine Dawn** packs remain byte-for-byte
unchanged. Their expansion, scientific, conquest and council victories retain
legacy rules. Machine Dawn keeps its installed turn-eight fabrication event;
importing it as a text pack intentionally does not execute that JavaScript hook.

| Campaign | Geography | Playable empires | Objective pacing / deadline |
| --- | --- | --- | --- |
| Grand Frontier: The Long Concord | 64 stars, 128 worlds, open grid | Meridian, Viridian, Basalt | Objective victory from turn 100; deadline 220 |
| Fallen Gates: The Quiet Meridian | 36 stars, 72 worlds, broken corridors | Lanterns, Glass, Hinterland | Objective victory from turn 70; deadline 180 |
| Siege of the Outer Rim | 40 stars, 80 worlds, two narrow interior corridors | Rimward Freeholds | Reconquest from turn 60; endurance turn 90; deadline 160 |

These are turn targets, not estimates of real-world session length. Early military
elimination can still end an expedition. Relaxed, standard and veteran change AI
war timing; scripted event schedules are unchanged. They do not guarantee a
strict ordering of outcomes for every strategy/seed. All campaigns use the same
legal command rules and content limits.

## Grand Frontier: The Long Concord

Three expeditions reach the same unclaimed network. Meridian sees a commonwealth,
Viridian a living accord, and Basalt a durable order. Broad starlanes permit many
expansion choices; exposed borders make a compact early economy valuable.

Survey twelve stars and develop six colonies. Then choose:

- **Concord:** sign at least one trade pact, research Industrial Systems VI and
  keep a viable empire to turn 100.
- **Dominion:** hold eighteen colony worlds, research Directed Energy VI and
  reach turn 100.

Rivals pursue the same objectives. If multiple empires finish on the same turn,
score resolves the council decision. Trade avoids an expensive early war; a
territorial route needs shipyards, survey escorts and transport capacity. The
higher research costs make laboratories and observatories useful well beyond
first settlement. Supply grants and a council dispatch mark later phases.

Opening route: survey with the scout, settle nearby rich worlds, queue yards and
replacement arks, then build laboratories. Research prerequisites mean advanced
weapons need Industrial Systems III. For Concord, make contact and sign trade
before war starts; for Dominion, expand along several fronts and refit escorts.
The deadline is a defeat for the selected empire if it has not already won.

## Fallen Gates: The Quiet Meridian

The old transit network is silent. Horizontal corridors connect through a few
crossings; archives reveal fragments of a civilisation that chose to dismantle
its own roads. Every empire can interpret the fragments differently.

Survey eight stars, then recover two archives with survey-equipped ships. Choose:

- **Restore:** reach Industrial Systems V and Field Harmonics V; survive to
  turn 70 to stabilise the old network.
- **Path:** chart thirty stars and reach Warp Dynamics VI; survive to turn 70
  to establish independent routes.

Archive ownership is permanent, so scouting is a race. Build another survey ship
if the first is lost. Map crossings and faster drives matter more here than in
Grand Frontier. The archive reward helps fund the chosen programme; it does not
replace the research prerequisites. Route choice, recovered archives, completed
stages and rewards persist through saves. The deadline at turn 180 is a defeat
for the selected empire if another route to victory has not finished.

## Siege of the Outer Rim

The Freeholds begin with three worlds. Each occupying power holds five. Their
command systems sit at the far end of two corridors. The Directorate declares
war at turn ten; the Mandate follows at eighteen. Relief shipments arrive every
fourteen turns. Raiding groups begin at turns 25 and 45 and recur more frequently
as the siege develops, within the normal fleet cap.

Maintain four colony worlds to establish your foothold. Choose:

- **Endure:** research Directed Energy IV, then survive to turn 90.
- **Reclaim:** capture a world in the Directorate command system (31), then a
  world in the Mandate command system (39), and reach turn 60.

Reclaim needs marine ships and enough concentrated attack to overcome late
planetary defences. Use fleet groups to keep escorts together. Endurance rewards
energy reserves, defence grids and repair yards along the approaches. The relief
convoys help replace losses, but do not supply energy upkeep. Missing the turn-160
deadline is defeat. Completed liberation milestones remain recorded if a rival
later counterattacks; losing every colony and ark still ends the expedition.

## Reproducing and editing the campaigns

The shipped `.txt` files are the runtime content. Edit them in either campaign
workshop, or load a shipped pack as a starting point in the Visual Workbench.
Run `node tests/voidward-campaigns.test.js` from the VANILLAJS repository root
for legal-command completion checks for both alternate routes in every new
campaign. The tests validate each turn and compare deterministic state.

The original generator and larger seed/difficulty sweep remain in the pinned
[4XGAMES source](https://github.com/QSOLKCB/4XGAMES/tree/030859385ac8929e066702ef8af0518663480653/scripts).
Do not run the upstream generator over this port without adapting its paths.
Current VANILLAJS execution evidence is recorded in the repository's
`docs/VOIDWARD_VALIDATION.md`; upstream results are not new port measurements.
