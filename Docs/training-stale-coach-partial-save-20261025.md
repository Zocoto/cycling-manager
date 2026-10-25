# Training: obsolete coach reference and partial batch saves

## Confirmed production cause

Gouille (`gouilleTW`), Cidrerie de l’Aulne, S4 J17: Tedla Weldesimon
(`4fff1c95-c408-4377-93ad-02895bc1caf0`) retained coach contract
`22e85195-96c4-4937-ae76-83ec3a45ec85` (Abdalla Didi), now terminated.
The last plan was intensity 58, `stage_racer`, effective J4. The coach selector
contained only active coaches, so the browser displayed its first “Sans
entraîneur” option although the controlled state/hidden batch retained the
obsolete UUID. The former batch RPC rejected that UUID and rolled back all rows.

Diagnostics were bounded read-only queries. One diagnostic attempted to call
`get_training_effective_day_number` inside a read-only transaction; PostgreSQL
refused its internal season UPDATE, with no mutation. The diagnostic session was
confirmed ended; subsequent diagnostics used stored season/day fields only.

## Fix

- Normalize the editable plan against actual selectable active team coaches,
  on the server and for client/restored drafts. Never erase historical plans.
- New `save_current_rider_training_plans_v2(jsonb)` returns an outcome per rider.
  A retained obsolete coach is cleared only if it matches that rider's own stored
  reference; a newly supplied foreign/inactive coach is rejected.
- Valid programs save even when another rider fails. Errors remain on the rider
  card, failed settings remain editable, and retries contain only unsaved changes.
- Acknowledge the submitted values, not newer edits made during the request.
  Reconcile the server refresh without remounting the editor or losing failures.
- Existing integer-returning RPCs retain their atomic all-or-nothing contract
  for older clients and scripts; they share the same stale-reference correction.

## Safety and performance

One RPC per submission, maximum 35 programs. Context, active coaches and latest
assignments are loaded once. Quotas use the final distribution, allowing swaps
between full coaches. If a row fails during persistence, the tentative write pass
rolls back before quotas are recomputed: a failed release cannot leave an
over-capacity incoming assignment behind. Global failures/timeouts propagate;
they are never reported as saved rows.

Season/day synchronization runs before team-local locks to preserve rollover
lock ordering. The team mutex uses `FOR NO KEY UPDATE`, avoiding unnecessary
conflicts with foreign-key checks. Lock wait 2.5 seconds, statement budget 12
seconds. No polling, per-rider network requests or production test fixtures.

## Verification

- 208 Vitest checks, 37 files: training, actions, state reconciliation, history,
  coach validation and performance instrumentation.
- 111 isolated PostgreSQL/PGlite checks, including capacity swaps, dependent
  failures in both input orders, authorization, invalid input, historical
  preservation, legacy atomicity and transaction-wide failure propagation.
  Quota-only refusals are reconsidered when a failed incoming program frees a
  place. Even 35 permanent write failures terminate without residual writes.
- ESLint and TypeScript passed. Next production compilation passed; the new UI
  translations were added and all post-build checks subsequently passed
  (registration routes, image runtimes, scanner and catalog coverage).
- The older source-only eligibility test now follows the already-existing
  `loadTeamTrainingHistory` delegation and still asserts its eligibility filter.

## Production database delivery

Migrations `20261025100000_isolate_training_plan_save_failures.sql` and
`20261025103000_reconsider_training_capacity_after_row_failure.sql` applied and
recorded atomically with guarded preflight source hashes. The second is a
separate follow-up, not a rewrite of an applied migration. No gameplay data was
changed. Final function source hashes:

| Function | Body MD5 |
| --- | --- |
| Single compatibility saver | `fbcf31148c429dcc66495b6ddc0273b1` |
| Bulk compatibility saver | `487ddaf9087e7bdcbaec6d39af63f9d4` |
| Partial v2 saver | `0e20b9960b2fd9099268cf2ecae42906` |

Anonymous execution remains denied. Authenticated execution remains allowed.
Both Tedla historical rows were unchanged, verified by complete-row hashes:
J4 `1b971d31f2cebd93e00b68ec1ebc0ff1`, J2
`127777fb83d85f533eaec0c89e7f544a`. Both resolve to no editable coach.
Database connectivity and absence of lingering release sessions were verified.
Application delivery is through the normal main-branch production build.
The application commit `3de129528c1578d9231556b968164c0c7eba866f` completed a
production build and received the live domains. The follow-up changes only SQL,
isolated tests and this delivery note; it uses the same frontend contract.
