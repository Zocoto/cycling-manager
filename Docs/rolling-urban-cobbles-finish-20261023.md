# Rolling urban cobbles: finish correction (23 October 2026)

Engine: `2026.10-rolling-urban-cobbles-finish-v51`.

## Cause

The Paris finale is flat (164 km, 294 m ascent) with five short cobbled
islands totalling 16 km. A terminal cobbled surface previously prohibited
both mass and reduced sprint finishes. The resulting generic finish score
did not use sprint and overweighted leader/giclette bonuses, while the five
islands produced classic-style splits. The visual selection could also omit
official podium finishers whose assigned roles were not sprinters.

## Deliberately narrow sporting policy

`urban-cobbles.ts` derives an internal `cobblesStyle: "urban"` once before
roles and tactics are resolved. This is a gameplay geometry convention, not
an assertion that road roughness can be inferred from geometry.

All criteria must hold:

- Road stage explicitly labelled flat or sprint, at least 100 km.
- Four to eight continuous cobbled islands, each at most 4 km, entirely flat
  and at most 0.5% absolute gradient, separated by at least 3 km of asphalt.
- First island in the final quarter; final island ends within 5 km of arrival.
- At most 12.5% cobbled distance, 500 m ascent, no positive gradient over 3%.
- Invalid or ambiguous inputs retain traditional behaviour. Incoming urban
  tags are re-derived, not trusted. Splitting a sector into smaller authored
  segments cannot turn a traditional sector into an urban circuit.

For qualifying islands only, terrain weights become 82% flat / 18% cobbles,
energy terrain load becomes 1.02 (asphalt 0.9, traditional cobbles 1.28), and
selection difficulty stays below classic-style rupture thresholds. Exhaustion,
incidents and explicit attacks remain possible. Urban terminal paving permits
the existing sprint policy; no rider profile or named rider is forced to win.

Traditional cobbles weights (36% flat / 64% cobbles), climbs, weather, crash
and puncture rules, base speeds, team duties and all time-trial policies are
unchanged. Surfaces remain cobbled for rendering, handling and incidents.
No migration or additional database request is required; copied future-season
routes qualify from their geometry without relying on an edition ID or name.

## Visual and historical safety

New road simulations freeze `roadFinishMode`; the visual selector does not
mistake selective/reduced finishes for mass sprints. Historical snapshots
without the field keep their prior fallback and all sporting results intact.
The sprint animation includes the official podium, including teammates and
a podium rider whose starting role was leadout. Visibility stays bounded.

Official locks remain immutable. No results, rewards, form ledger or historic
inputs are updated, and no live repair RPC is called.

## Regression evidence

- Thirty pre-change SHA-256 sporting fingerprints cover flat, sprint, hills,
  mountains, traditional cobbles, a non-urban cobbled finish, an uphill finish,
  individual time trial, prologue and team time trial, with three seeds each.
- Geometry boundary, immutability, segmentation and idempotence tests.
- Urban integration tests cover sprint competition, exhausted sprinters,
  automatic roles, explicit protection/attack instructions, incident risk,
  deterministic results and visual/official group consistency.
- Frozen real 180-rider input replayed offline: the baseline reproduces the
  official record; the corrected local experiment gives a 158-rider sprint
  group rather than 13. This is not an alternative official result.
- Broad course/visual suites, lint, type checking and production build are
  required before delivery. Performance measurements are diagnostics, not
  flaky wall-clock unit-test thresholds.
