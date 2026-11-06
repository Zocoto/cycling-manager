# Morale on refused international callups

An explicit club manager refusal now requests a persistent -10 morale event for
the rider, including academy juniors and professional riders in junior events.
Distinct convocations accumulate; the existing morale engine clamps at zero.
The event's description appears in the existing morale history/tooltip.

Both the federation response RPC and the historical international championship
response RPC call the same private helper, inside their authorized refusal
branches. The conflict acknowledgement and bulk wrappers retain their behavior.
Automatic expiry, ineligibility processing, administrative cancellation and
acceptance do not call the helper. No historical refusals are backfilled.

The idempotency key is the event edition ID plus the rider identity supplied to
the existing ledger. The same event exposed by both pipelines cannot charge a
professional rider twice. Reopening/recreating a selection membership does not
create another penalty. Different event editions, such as road and time trial,
remain separate. Junior event IDs belong to development_race_editions.

The migration preserves the existing morale functions and sources, including
race_load, and their permissions. It extends the two source CHECK constraints
as supersets with NOT VALID to avoid a historical table scan under a schema
lock; new writes are checked immediately. No table trigger charges generic
status transitions.

The refusal consequence is stated next to the player choices. The response
actions invalidate the relevant health, rider and academy page caches.

Validation uses isolated PGlite with an audited fixture of the actual response
functions and existing morale ledgers; no credentials or network are loaded.
Run `scripts/test-international-callup-refusal-morale-sql.mjs` with a local
PGlite module path. The fixture contains SQL definitions, not player records.
UI/action tests, ESLint and i18n checks cover the player-facing changes.

Delivery uses `scripts/deliver-international-callup-refusal-morale.mjs` with
--preflight, --apply-reviewed and --verify. It applies only the reviewed migration
with bounded lock/statement waits and an atomic receipt, compares function bodies
and permissions, checks the helper's access/idempotency constraints and verifies
database and public application availability. No live gameplay fixture is run.
