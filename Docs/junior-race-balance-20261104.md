# Junior races: weak virtual fillers and correctly scaled federation equipment

The junior World Championship audit reproduced Alioch4's reported official
times exactly from historical training snapshots. Federation equipment points
were added directly to internal youth notes (displayed as `34 + 8 * note`),
making equipment eight times too influential. Virtual filler scores ranged
around 4.15–7.6 before variation, exceeding the real youth note ceiling of 6.
All 48 virtual riders beat Hiroshi Saito in the CLM, whose first 38 places
were virtual. This behavior is not an appropriate challenge from filler bots.

## New behavior

Federation equipment's weighted stage bonus is divided by eight before
entering the native junior score. A displayed +1 therefore remains +1.
Profile weights, time-trial conditions, equipment contracts and professional
equipment effects retain their existing rules.

Virtual rider scores are now 0.10–0.35, with deterministic stage variation of
at most ±0.03: the final score stays between 0.07 and 0.38. A minimum-rated
real academy rider scores at least 0.64 before equipment, including the
existing worst daily variation. Virtual riders therefore finish behind
player academy riders on all seven profiles, while their small differences
still decide their order among themselves. Real riders' native ratings and
their own variation are unchanged.

The patch applies the same formula to whole-race simulation and daily tour
stages. It changes three function definitions only. No new cron, trigger,
table, network request or rendering query is introduced. Existing locks,
completion/cancellation guards, selections, point/prize rules and execution
permissions are retained. Lightweight national championships already contain
only real academy riders and need no virtual model change.

## Rollout and verification

There were no unfinished junior editions or partially published tours in
the active season when audited. The correction applies to upcoming
simulations. Completed World Championships are not replayed: their results,
titles, paid prizes and classifications need a separate deliberate replay
and reconciliation if requested.

154 isolated PostgreSQL checks pass against the actual captured production
engines, and the same 154 pass using their repository source definitions.
They reproduce the old issue, then check equipment conversion, minimum-rated
humans before bots on all profiles, World/Continental road and CLM events,
daily/final stage consistency, unchanged field sizes, quality between real
riders, bots-only fields, repeat settlement, cancelled/future races,
unchanged completed results, privileges and idempotent migration application.
All fixtures run locally with PGlite, without network or production data
mutations.

The 60 targeted Vitest checks for junior championships, eligibility, stage
publication, race profiles, rankings, international equipment and existing
reward rules also pass. Targeted ESLint and syntax checks pass.

`scripts/deliver-junior-race-balance.mjs` checks the audited function hashes
and rollout precondition, applies only the reviewed migration, records its
source hash and verifies the three markers, unchanged permissions, unchanged
professional/wrapper definitions, exact live equipment conversion and
fingerprints of both completed S4 World Championships. Read-only diagnostics
are sequential with five-second SQL timeouts. No race simulation RPC is run
in production.

Local evidence: `C:/Dev/artifacts/junior-engine-fix-20261104/`.

Production migration `20261104133000` was applied on 4 November 2026. All three
function markers are present with unchanged execution attributes. S4 Japan
road/CLM equipment bonuses are now 0.125/0.04 internal units; Brazil bonuses
are 0.47375/0.3525, exactly one eighth of the previous erroneous values.
Both completed S4 World Championship result fingerprints are unchanged.
