# Iguchi: training progression audit, 2 November 2026

## Finding

Takeshi Iguchi (`4e44a1c8-c33d-49b1-9cf2-b5e809e20762`), Uji Midori,
managed by Pipo Inzaghi, is 18 in season 4 with potential_steps=8.
His Vallon started at 61. He has earned 12 whole points and is now at 73.
His last Vallon increase was 27 October at 08:00 Paris.

The existing seasonal training allowance for a starting rating in [60,70)
is +12, independently of potential (100 here). Once exhausted, the engine
clamps the decimal balance to 999 millipoints. This near-full balance
therefore does not indicate an eligible point that failed to apply.

The 22 recorded sessions reconstruct exactly to the current ratings,
daily rating changes, work totals and balances for all 13 stats. Vallon
has 14,409 work millipoints: 12,000 applied, 999 retained, 1,410 discarded
by the existing seasonal limit. The discarded work is not an unpaid
entitlement under the current rules. No rating repair is justified.

## Wider audit

Production reads ran sequentially, with 3–4s statement timeouts and 500ms
lock waits. No fixtures or temporary gameplay writes ran on production.

- Season 4: 2,316 riders and 30,108 stat balances checked, including free agents.
- Zero eligible, unconverted whole points below the applicable ceilings.
- Zero current ratings below their training ledger's initial+gain−loss.
- For 2,269 under-32 riders (29,497 stats), zero unexplained lost positive
  balances after accounting for recorded seasonal carryovers.
- The 62 balances equal to 999 comprise one seasonal limit (Iguchi's
  Vallon), 40 potential limits, two veteran maintenance limits, and 19
  mathematically exact balances with no discarded work.
- Historical seasons 1–3 were screened. Their 18 uncapped balances of 999
  exactly match recorded work less applied points. Four season-2 riders
  have uniform −2 offsets across all stats, consistent with withdrawal
  of the old homegrown bonus. These external-adjustment signatures are
  not evidence of unpaid training; past seasons were not rewritten.

This audit checks the reported balance/settlement failure pattern and
reconstructs Iguchi's recorded work. It does not infer unrecorded session
multipliers or recalculate sporting results. Evidence is local in
`C:/Dev/artifacts/iguchi-training-20261102/`, including query receipts,
live function definitions and `iguchi-reconstruction.json`. Private
session exports are not shipped in the application.

## Display correction and validation

The season report explains seasonal, potential and veteran limits beside
the affected stats. The latest-session report also labels capped stats
with recorded work and points to the season report when no integer note
changes. The real decimal balance and recorded work remain visible.

Age and potential come from rows already loaded by the service. No query,
scheduled task, settlement formula or ceiling changes. Detailed report
markup remains lazy. Seasonal limits use the recorded initial rating and
training gain counter, not current-minus-initial (which can include items).
Missing context infers no limit; new-season and veteran rules stay distinct.

53 targeted tests pass across limit classification, existing training
calculations, report rendering and services. Targeted ESLint and English
catalog coverage pass. Browser checks verify both views and 1280/390/320px
layouts without horizontal overflow or browser errors. Local synthetic
preview `/apercus/entrainement` returns 404 in production. The mobile
screenshot and browser proof accompany the local audit receipts.
