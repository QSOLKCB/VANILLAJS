# Commander's field guide

VOIDWARD advances only when you end a turn. Select a campaign, a listed playable
empire, a seed and a difficulty in **New game**. The original campaigns keep their
original starting conditions. [Campaign briefings](CAMPAIGNS.md) explain the new
expeditions and their alternate routes.

## Your first ten turns

1. Inspect your home system. Select the survey ship, select a neighbouring star,
   then **Plot course**. End a turn to travel. You may route through surveyed
   systems and finish at one unexplored frontier system.
2. Use your colony ark to settle the second home-system planet or escort it to a
   better world. Settlement consumes the ark and the displayed mineral/energy
   cost. Hostile ships must be cleared first.
3. Open **Colonies** and manage production. Pay for a mine, laboratory, reactor,
   yard or ship when you queue it. Five orders fit per colony. Move orders up/down
   without losing work; cancelling refunds only the unfinished fraction.
4. Check **Research** before picking a field. Each card lists prerequisites and
   the hulls/components unlocked by its next level. Research is banked globally;
   only one field advances at a time. Changing focus does not discard science.
5. In **Ship designer**, copy a class or choose a template, install an engine and
   fit the remaining slots. Compare against an existing class before registering
   or updating it. Build the class at any friendly orbital yard.

Minerals pay for construction, settlement and refits. Energy pays upkeep and
agreements. At zero energy both ship firepower and invasion strength are halved.
Production completes the head of each colony's queue; excess work is not carried
into its next order. Facilities and technology improve local production.

## Fleets and refits

Group two or more available ships in one system into a named fleet. Groups travel
at their slowest member's speed and halt together on contact with hostile forces.
Use the group's **Set destination** control, or select a member on the map and
choose **Plot course** to route the whole group. Dissolving a group leaves its
ships intact; an ark consumed by settlement leaves its former group.

**Auto-explore** repeatedly chooses reachable unsurveyed frontier systems.
**Patrol between here and target** runs between the current system and a selected
surveyed destination. **Return to shipyard** selects a reachable friendly yard.
**Hold position** clears the route and standing order.
Automatic orders use your explored chart, never hidden routes. An exhausted
exploration order waits until another frontier becomes reachable.

Refits require a stationary, ungrouped ship at an uncontested friendly yard and a
registered class using the **same hull**. The quote shows minerals and work before
acceptance. Cost is `max(1, new design cost − old design cost) + ceil(new cost/10)`;
work is half the new hull's build work, rounded up. A refitting ship stays
stationary and vulnerable, and cannot fire. Work pauses if the yard is lost or
contested. Construction and refit orders snapshot their target designs: later
class edits and research do not silently change ships already built or ordered.

## Information and diplomacy

Your ships and colonies provide current system intelligence. Elsewhere you see
last-observed ownership and ship counts, with their observation turn. Exploring a
system does not grant permanent live surveillance. The AI uses the same chart and
last-seen restrictions. Archives require survey equipment and can be recovered
only once; rivals may reach them first.

First contact opens diplomacy. A neutral trade pact benefits both empires each
turn. War cancels that pact; peace costs the displayed energy. AI honours trade
agreements. Difficulty changes its opening war grace period; scenario AI settings
also adjust aggression, reserves and desired fleet composition.

Combat resolves on end-turn. Ship volleys use the same pre-combat state so firing
order does not give an empire the first shot. Planets fire defensive batteries.
After clearing defenders, a marine-equipped force can capture a planet when its
combined effective attack meets the planet's defence. Reports show losses,
committed forces, damage and captured worlds. Return survivors to a yard to repair.

## Campaign progress and larger empires

Objective campaigns show prerequisites and progress. Choose one offered story
route; other routes become unavailable for that expedition. Completed objectives
are **historical milestones**: spending an earned resource or losing a previously
held colony does not erase the record. Your empire must remain viable to win.
Scenario events and route choices are saved, so reloading does not duplicate rewards.
Simultaneous objective victories use empire score, then empire ID as a final tie.
Loss of all colonies and colony arks ends your expedition. New objective campaigns
also have a deadline; their briefings specify its consequence.

Use search, filters and sorting in the colony, fleet and report lists. Look for
idle yards, ships awaiting orders and the latest combat before ending a turn.
Notifications and turn summaries help identify new unlocks and completed work.

Tab moves through controls; Enter/Space activates a focused button. E ends a turn,
1–8 select command views and ? opens help. Typing in forms and open dialogs
suppresses turn shortcuts. Mouse and touch use the same select-then-confirm orders.
Settings include independent music/effects levels, mute and reduced motion.

## Saves and offline play

Accepted commands autosave. Export a save before replacing an expedition or
clearing site storage. Save files embed their text pack; installed source-hook
campaigns must match the installed pack exactly. Version-1 saves migrate to the
current state schema with empire 0, retained ships/queues/resources and last-seen
snapshots from their old chart. Export the migrated save as a new backup.

After one complete service-worker installation, reload and play offline. Serve
local files over HTTP rather than double-clicking index.html. No CDN, account or
runtime package installation is required. See [MOD_GUIDE.md](../MOD_GUIDE.md) for
pack updates, limits and troubleshooting.
