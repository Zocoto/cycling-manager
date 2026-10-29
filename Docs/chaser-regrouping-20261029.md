# Failed bridge: physical regrouping instead of a random drop

## Cause

After an unsuccessful bridge, `resolveExistingChasers` randomly returned a
rider to the peloton (66%) or dropped them, adding 10–22 seconds. Neither the
drop decision nor this penalty checked whether the rider was still ahead of
the peloton or physically capable of following it.

The locked Baltic Cobbles scenario of 28 October confirms the problem:
Kulmane was still 11.974 seconds ahead of the peloton with 58.076 energy at
T18. A failed bridge roll then moved his clock behind the peloton and added
11.099 seconds. This was consistent with the implementation, but the rule
itself was wrong.

## Change

- The successful-bridge calculation is unchanged.
- A failed bridge preserves the rider's actual clock. A rider still ahead
  stays intercalated; without a peloton, no catch is invented.
- At contact, the rider rejoins the peloton using the existing three-second
  group-contact tolerance. No additional time penalty is imposed.
- An existing deficit beyond that tolerance remains a real deficit, without
  adding any extra seconds.
- Energy is never replenished. The ordinary terrain, energy, pursuit,
  incident and group-selection rules still apply afterwards.

The obsolete random return/drop rolls are removed. In simulations containing
failed bridges, later random draws and subsequent race events can therefore
change. This is a prospective engine correction, not a replay guarantee.

Official engine version: `2026.10-chaser-regrouping-v54`. Existing locked
scenarios and official results remain immutable through the existing
non-retroactive official-simulation path. No database migration or gameplay
data write is required. There are no new database calls, background jobs or
per-tick scans; the same chaser loop performs the correction.

## Verification

Direct tests cover remaining ahead, physical contact, actual deficits,
absence of a peloton, low energy, successful bridges, and same-segment
attacks. Existing race tests cover exhaustion, selective terrain, pursuit,
sprints, time trials, incidents, team work and official non-retroactivity.

Thirty historical scenarios were compared offline. Restoring **only** the
v53 `resolveExistingChasers` function in the current engine reproduces all
30 historical fingerprints exactly. With the correction, eight scenarios
change (three hilly, three mountain and two classic-cobbles); the remaining
22 scenarios are identical. The original fingerprints are retained in the
regression test, and the eight intentional changes have separate v54
references. The tests are not merely disabled or broadly regenerated.

The frozen Baltic input was also replayed locally. At T18 the corrected
Kulmane remains ahead in the chase group, rather than being assigned an
artificial deficit. Subsequent physical selection can still drop him; this
does not guarantee a particular final ranking. The production race is not
recomputed.

Local evidence (not shipped):
`C:/Dev/artifacts/kulmane-baltic-20261029/chaser-causality.json`,
`baselines-current.json`, `baselines-legacy.json`, and
`after-fix-replay.json`. The original v53 replay is preserved separately.
