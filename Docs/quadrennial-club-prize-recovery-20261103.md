# Club prize recovery for the S4 Quadrennial Games

## Cause and scope

The payout used the owner recorded on the national callup. Several riders
were recorded without a club, including free agents who signed before the
Games. They raced and were classified, but their new clubs received no cash
or budget entry. This is a settlement defect, not a hidden finance line.

Read-only, sequential diagnostics with five-second SQL limits covered both
official S4 editions: 99 CLM and 177 road results. The 225 original club
payments and their posted ledger entries match. Historical contracts identify
ten additional payable results in five clubs, totaling EUR 46,000.

| Manager | Club | Missing cash |
| --- | --- | ---: |
| Lionelionel | Paidalevite | EUR 18,000 |
| PeterParker | Bijagós Caju | EUR 8,000 |
| Enzozopopo | Socquettes légères | EUR 8,000 |
| Corto Maltese | RC Malta | EUR 8,000 |
| Borji Okazaki | Borjiest | EUR 4,000 |

Lionelionel's results: Dario Đukić, CLM 36th, EUR 10,000; Cường Dũng Lữ,
road 78th, EUR 4,000; Ante Atanasov, road 142nd, EUR 4,000. Alceste Balzano
was acquired after the Games and correctly earned his CLM prize for his
previous club. A rider recruited on the day after the Games is also excluded.

## Durable correction

The existing settlement now resolves club ownership from durable contracts
covering the race's season/day, with signature time no later than departure.
Cancelled/planned contracts and later acquisitions do not qualify. A later
departure does not erase the historical beneficiary. National representation
continues to come from the official selection.

The same final-result validation, advisory lock, immutable paid receipt,
unique reward references, finance status, timeouts, privileges and federation
payment are retained. A helper performs indexed contract lookups only while
settling Games results. No extra consultation requests, daily cron or global
write trigger is added.

The migration also recovers missing club payments on completed official
Games that already have a settlement receipt. Each recovery uses the
original unique reward reference, credits the club balance and adds a posted
`race_prize` ledger row on the original race day, J24. It adjusts the receipt
count/total. Existing payments are neither recreated nor redistributed; an
unexpected existing beneficiary mismatch aborts the whole migration.
Federations and sporting results are not replayed.

## Verification

- `scripts/test-quadrennial-games-cash-sql.mjs`: 344 checks on isolated
  PostgreSQL, including the original scale, atomicity and 220-rider field.
- `scripts/test-quadrennial-club-ownership-sql.mjs`: 24 isolated checks using
  the real old/new migrations, reproducing the missing payment and checking
  recovery, retry idempotence, contracts before/after departure, historical
  transfers, exclusions, immutable paid outcomes and missing club accounts.
- 94 targeted UI/service tests pass for Games prizes and the existing finance view.
- `scripts/deliver-quadrennial-club-ownership.mjs` applies only this reviewed
  migration, records its source hash and verifies all recovered ledger rows,
  exact receipt totals, unchanged function rights/settings, and club balances
  against their full posted ledgers. Production fixtures are never run.

The audited target totals after recovery are 82 CLM club payments for
EUR 2,012,000 and 153 road club payments for EUR 2,302,000. The two original
federation prizes remain separate and unchanged.

Local production evidence: `C:/Dev/artifacts/jq-club-prizes-20261103/`.

## Production result

Migration `20261103103000` was applied on 3 November 2026. Ten posted prize
entries totaling EUR 46,000 were created with the original race day J24.
All five corrected balances reconcile exactly with opening cash plus posted
transactions. Paidalevite had EUR 210,985 at the verification snapshot,
including the EUR 18,000 recovery.

The final audit of all 276 classified riders finds no missing eligible club
prize, wrong recipient or ledger discrepancy. There are now 235 club prize
receipts totaling EUR 4,314,000. The original federation prizes and settlement
dates are preserved. The settlement execution ACL, security-definer setting
and timeout configuration are unchanged.
