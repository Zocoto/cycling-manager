# Training without seasonal gain allowances

Professional training no longer stops at +18/+12/+8/+4/+2 points according
to the season-start stat. The change covers club training, free-agent
training and fractional carryover conversion. Potential ceilings, the
absolute maximum of 100, progression slowing at high ratings and veteran
maintenance/decline rules remain in effect. Juniors keep their own curve.

The migration patches only five verified annual-allowance fragments in
each of the three live functions. Unknown shapes abort. Function access,
bonuses, schedules, locks, contract guards and session idempotency remain.
There is no new recurring query or scheduled job. Client reports remove
the annual-limit classification while retaining potential/veteran notices.

## Audited recovery

Across all four seasons, only Takeshi Iguchi's season-4 Vallon has reached
the old annual allowance. Recorded work is 14,409 millipoints, with 12,000
already applied and 999 still retained. Recovery restores the discarded
1,410 millipoints. Together with the balance this converts into +2 VAL:
73 becomes 75 and the balance becomes 409. His other 12 stats are unchanged.

Recovery preserves earned recorded work. It does not rerun historical
training multipliers, future contracts, finances, simulations or results.
An immutable private receipt, exact source-data guards and one transaction
protect against duplicate credits or silently changed inputs. The original
work total stays 14,409 and the gain counter becomes 14. The current day's
report receives the +2 adjustment so training history remains consistent.
The career progress trigger uses a session receipt: when that receipt is
already consumed, a separate unique recovery receipt credits only +2 to
the relevant career metric, without replaying other gains or claiming rewards.

No past season requires a correction. The reviewed migration is applied
alone, with a three-second lock wait and twelve-second statement budget,
and recorded atomically in migration history. No fixtures run in production.

## Verification

`scripts/test-unlimited-training-sql.mjs` runs actual captured live training
functions in isolated PGlite. Its 50 checks cover all five former tiers in
both club/free-agent training, potential/100 limits, item preservation,
veteran maintenance and decline, eligibility, retry safety, recovery and
career accounting, source-drift rollback, privileges and season carryover.
Existing rollover, junior training and potential helper definitions are
unchanged. The five focused Vitest files contain 53 passing checks.
The synthetic browser preview verifies +2 VAL in the daily report and
75/+14 with a 0.409 balance in the season report, with no annual-limit
notice or horizontal overflow at 390px. Its screenshot is
`report-unlimited-mobile.png` in the evidence directory.

`scripts/deliver-unlimited-training.mjs --inspect|--apply|--verify` verifies
the linked production project, source hash, engine markers, receipt and
result. Set `SUPABASE_LINKED_WORKDIR` when using a separate linked checkout.
Evidence is in `C:/Dev/artifacts/iguchi-training-20261102/`.
