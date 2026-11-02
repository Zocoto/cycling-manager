# Seasonal race load and morale from S5

## Approved rule

The first 30 official race starts of each season carry no race-load morale
penalty. Each additional start costs one morale point after the result is
recorded. A classic or a stage counts once; two stages on a calendar day count
twice. DNS is excluded; DNF and outside-time-limit riders did start and count.
Gala imports and the simulator write no official stage result and do not count.
Other existing morale gains/losses continue to apply and morale stays within
0–100. Only the JDC counter resets each season, through the new rating row's
zero defaults. S4 receives no retroactive counter or morale adjustment.

## Implementation

Migration `20261102150000_add_season_race_load_morale.sql` adds two small fields
on the existing rider-season rating row: `season_race_days` and
`race_load_morale_debit` (the actual loss available for a correction refund).
Official stage-result participation changes maintain them from game year 5.

The new trigger ignores ordinary result upserts, rank changes, DNS-to-DNS
changes and roster remaps within the same rider/season. Transfers consequently
keep the existing count. A DNS correction/deletion adjusts the count and refunds
only morale actually deducted, avoiding a free gain for a loss clipped at zero.
Corrections to completed seasons update their count without changing old morale.
Missing purged rating rows cannot block an official result.

The existing per-rider advisory lock and persistent morale event engine are
reused. Each actual adjustment is visible in the existing morale history under
`race_load`, with its stage, season and before/after count. Its source is added
by a guarded patch that preserves the rest of the engine and its permissions.
The career JDC trigger, rollover and race simulation functions are unchanged.

The planning reads the count in its **existing rating query**, with no new RPC
or result-history scan. Remaining JDC are deduplicated by stage ID from stages
already loaded for team and federation registrations; cancelled/completed stages
are excluded. From S5 each rider displays actual and projected seasonal JDC:

- At 25 actual JDC: approaching-threshold warning.
- Above 30 projected JDC: projected-overload warning.
- Above 30 actual JDC: active-overload warning.

These are forecasts of existing registrations, including pending registrations;
only actual official starts trigger the morale penalty.

## Validation and delivery

- 59 isolated PostgreSQL assertions cover the threshold, two stages per day,
  retries, DNS/DNF/OTL, result deletion/reinsertion, correction refunds, morale
  clipping, transfers and roster remaps at 100 morale, S4 exclusion, S6 reset,
  archived ratings and function privileges.
- 36 application tests cover planning, scale/pagination, S5 presentation,
  projections, warnings and existing morale behavior.
- TypeScript, targeted ESLint, translation completeness and the i18n scanner pass.
- Production installation is atomic with its migration receipt, protected by
  the reviewed live function hashes, a 5-second statement limit and a 500-ms
  lock limit. No gameplay RPC, fixture or retroactive penalty is run.
- Delivery verifies the new columns/trigger/source, unchanged career/rollover
  functions, player write restrictions, zero pre-S5 race-load events/counters,
  SQL connectivity, authentication and public application health.

Evidence is saved under ignored `artifacts/s5-race-load-morale-20261102/`.

```powershell
node scripts/test-season-race-load-morale.mjs <local-pglite-module>
node scripts/deliver-season-race-load-morale.mjs --verify
```
