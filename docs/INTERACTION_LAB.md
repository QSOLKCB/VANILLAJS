# Interaction Lab — recipe contracts and sources

Entry: `demos/interaction-lab/index.html`. Headless simulation:
`createLab`, `stepLab`, `focusTarget` in `demos/interaction-lab/recipes.js`.
These are demonstration contracts, not promoted module APIs.

## Shared composition

Both recipes run 120 Hz simulation ticks. Shots travel at 100 m/s, last 1.5 s,
and use an axis-aligned cube halfSize of 0.08 m. A held fire command has a
0.25 s simulation cooldown. A shot begins at the camera's current position and
orientation, avoiding a muzzle offset that could skip a close wall. The camera
then advances with the existing flight module. Projectiles query static target
and wall boxes. The resolver receives each hit, in event-time/id order.

Colliders remain solid when a drone is disabled. Subsequent hits report the
spent target and apply no further damage. Targets do not move during a tick;
moving-target continuous collision is outside this milestone. The lab has 64
projectile slots, at most 64 short-lived impact flashes and eight log entries.
All feedback, expiry and cooldown timing uses simulation seconds.

Pause/blur/visibility loss freezes ticks and clears keyboard, pointer and button
states. Resuming discards wall-clock debt. F and on-screen controls need a fresh
press; quick taps are retained until a simulation tick can consume them. Changing
recipes resets all simulation state. Focusing a target preserves scores but
repositions/stops the camera, cancels old shots and pauses. Render interpolation
does not change simulation or collision state.

## Target practice

Three stationary drones each have 100 hull points. All share a shield-field
condition. A pulse requires a live target and an open shield; it removes 25 hull
points. Conditions are checked at impact, so changing the field while a shot
travels changes its result. The first lethal hit marks a drone spent before
the next hit is resolved. Damage values and shield fiction are original game
rules. The camera uses inertial 6DOF flight, with explicit X braking.

## Reaction Bench

The camera stays at an observation station and can rotate; focus buttons line up
a specimen. Symbolic hydrogen probes encounter these small curated rules:

| Specimen / conditions | Outcome | Scientific basis / simplification |
| --- | --- | --- |
| O₂ chamber, feed on, ignition off | Blocked: needs ignition | An activation-energy requirement is represented as a boolean, not a numeric temperature |
| O₂ chamber, feed off | Blocked: needs oxygen | The selected water-forming reaction requires both reactants |
| O₂ chamber, feed and ignition on | Applied: water-forming event | `2H₂ + O₂ → 2H₂O`; energy release is explained, not computed |
| Neon chamber | Resisted | Ordinary-condition chemical unreactivity, limited to this model |
| Empty chamber | Blocked: no oxygen | Ignition cannot supply a missing reactant |

The feed toggle affects the oxygen chamber only. Every chamber is a separate
specimen; no shared gaseous atmosphere or cross-chamber mixing is simulated.
Stock is reusable and not depleted. Probes are visual tokens, not measured
molecules; the product counter counts successful events, not water quantity.
There is no thermodynamics, reaction kinetics, concentration, pressure, heat
transport or numerical activation-energy threshold. This is a playable logic
model and makes no measured claim about educational outcomes.

Primary educational sources checked for the modeled facts:

- [Purdue University, The Chemistry of Hydrogen](https://chemed.chem.purdue.edu/demos/demosheets/10.1.html):
  hydrogen and oxygen form water; ignition supplies activation energy.
- [Royal Society of Chemistry, Neon](https://periodic-table.rsc.org/element/10/neon):
  the element's lack of chemical reactivity.

Design inspiration:
[David Nate Breslauer's Reaction Rumble write-up](https://davidnate.com/work/reaction-rumble)
describes condition-dependent interactions and explanations for failed moves.
This repository independently implements the mechanics and procedural visuals;
it includes no source code, assets, moveset or dataset from that game. The Python
press article mentioned during planning was not verified and is not an evidence
source or justification for these modules.

## Reuse

Keep collider queries independent of effect rules. A consumer can replace the
recipe data with abilities, shields, environmental hazards or another small
validated scientific model. Return structured reasons even when no effect is
applied. Define units and approximation limits in the recipe, and test both
successful and rejected outcomes. Do not infer a general chemistry engine from
these few hand-authored cases.
