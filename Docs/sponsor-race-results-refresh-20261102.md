# Sponsor race objectives: official classification refresh

## Confirmed incident

Montecristi Toquilla House requested a Top 5 at the S4 Mekong Delta Tour.
Óscar Pari officially finished second (`race_results.status = classified`).
The objective nevertheless retained `failed`, `current_value = 0` and
`achievementLevel = partial`, awarding 5 of its 20 satisfaction points from
secondary classifications.

The live evaluator's terminal-status branches ran **before** its race-result
branch. An earlier failure therefore bypassed the official-rank query on every
subsequent evaluation. The partial-success layer then read that stale zero and
credited secondary results instead. An already successful objective similarly
retained an outdated rank after an official classification change.

The persisted rows establish that the failure predated the official Mékong
classification (30 October). They do not identify the original request that
first wrote it; `updated_at` is also changed by routine evaluations. We do not
attribute that initial write to a specific job without an audit trail.

## Source correction

Migration `20261102120000_refresh_unsettled_sponsor_race_results.sql` moves the
existing race-result calculation before the terminal-status shortcuts, **only
when `objective_progress.settled_at is null`**. The original indexed query is
reused, with the original contract/team/objective-season predicates and edition
fallback. Partial credit consequently follows the newly evaluated official rank.

- Official completion remains necessary for a live objective to be achieved.
- Sealed objectives and financial settlements retain their existing behavior.
- Cancelled objectives and other objective types keep their original rules.
- No new request, table, index, job, trigger or client-facing query is added.
- The guarded function patch preserves permissions and unrelated engine changes.

## Curative audit and application

A bounded, read-only comparison of the active season's race objectives against
official team results found four discrepancies across three teams. Settled goals
were included in the audit; all four discrepancies were unsealed and had no
main-objective monetary terms.

| Team | Objective | Stored rank | Official rank | Correction |
| --- | --- | --- | --- | --- |
| Montecristi Toquilla House | Top 5 Mékong | Missing | 2 | Full success, 20 rather than 5 points |
| Montecristi Toquilla House | Win Routes de Basalte | 3 | 5 | Removes an incorrect 3-point near-target credit |
| Ardennes Outillage | Top 12 Kasseien van Limburg | Missing | 10 | Full success, 6 points |
| Bijagós Caju | Top 12 Tour des Hauts du Laos | 7 | 5 | Correct rank; objective remains achieved |

The canonical evaluator was called once per affected active contract, each in a
separate transaction with a 3-second statement limit and 500-ms lock limit.
No race results were modified and no manual finance/reputation entries were
created. Montecristi's total satisfaction changed from 65 to **77** (net +12).
Recorded cash, annual budgets and reputation were verified unchanged.

Migration installation is atomic with its migration-history receipt; the
delivery script checks the reviewed live function hash before installation.
Its catch-up is resumable, skips already repaired objectives and refuses to
reopen an objective that acquired a settlement since the audit.
Diagnostic output and before/after evidence are in ignored
`artifacts/montecristi-sponsor-20261102/`.

## Verification

- 37 isolated PostgreSQL assertions reproduce the exact incident before the fix,
  then check official rank changes in both directions, full/partial/missed
  success, publication order, annual edition fallback, foreign teams/seasons,
  disqualification, neutralized goals, sealed history, other objective types,
  unchanged cash and permission preservation.
- 45 existing isolated SQL checks cover stage results, secondary classifications,
  combativity, idempotence, replay, rollover, history and financial invariants.
- 29 existing application tests cover objective status, partial achievements,
  sponsor summary and partial-result rendering.
- Production source/receipt, corrected objectives, SQL connectivity, auth health
  and the public sign-in page were checked after application.
- The final active-season audit returned no remaining official-rank discrepancy.

Commands:

```powershell
node scripts/test-sponsor-race-result-refresh.mjs <local-pglite-module>
$env:SPONSOR_PARTIAL_SQL_TEST_MODULE='<local-pglite-module>'
node scripts/test-sponsor-partial-achievements-sql.mjs
node scripts/audit-sponsor-race-results-20261102.mjs mismatches after
node scripts/deliver-sponsor-race-result-refresh.mjs --verify
```
