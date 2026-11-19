# Retro and Scenic traffic difficulty

Select a difficulty before starting Retro Tour or Scenic Tour. Reset starts a fresh run and unlocks the selector. The default is Classic. The setting applies to the next tour and to the entire recorded run. During damage recovery the bumper remains solid, steering and nitro remain available and the HUD shows the recovery interval.

| Profile | Impact damage | Recovery ticks at 60 Hz | Recorded owner run |
|---|---:|---:|---|
| Arcade | 5 HP | 72 | 8 damaging contacts, 60 HP at tick 863 |
| Classic | 9 HP | 48 | 12 damaging contacts, destroyed at tick 863 |
| Challenge | 11 HP | 42 | 10 damaging contacts, destroyed at tick 713 |

The imported 863-input v1 owner recording has SHA-256 `ee27b537b2e7b9ea5625b106a71bf39124c70b4d328ab910c08db9b41bb225fe`. Classic reproduces 14.383333 simulated seconds and 648.733 m. The scoring counter counts damaging contacts. The unchanged swept-separation path also runs during cooldown. Clear-lane touring finished at tick 2,454 with 100 HP and zero contacts on all three settings.

Six candidate settings were evaluated against the recorded steering and boost inputs. Three-point damage left 76 HP after extended contact. Five points and a 72-tick window left room for a second mistake while preserving eight damage events. The most severe 12/36 combination ended at tick 642. The selected Challenge 11/42 leaves another 71 ticks to steer clear in this recording. These results describe this input tape. The owner still needs to judge the feel behind the wheel. The repository records all six comparison rows in `evidence/RACING-002D/profile-study.jsonl`.

Built-in Classic exports continue using the v1 shape. Optional profiles and authored Scenic tracks export v2 receipts with the selected difficulty, validated track and first retained input tick. Old v1 receipts replay as Classic; for an old authored Scenic run supply its original track as the second argument to `replayTourRun`. The pre-existing journal retains the most recent 36,000 inputs. A partial journal is identified and refused for whole-run reconstruction. The track format stays at v1.

Reproduce the owner tape, clearance, cooldown, nitro and fork checks with `node --test tests/racing-lab.test.js`. The packaged browser witness selects Arcade, holds throttle and nitro until a real impact, captures the recovery display, exports and replays the run, then selects Challenge and switches to a 3D mode. The body of the 3D solver and the released swept-contact function are unchanged.
