# Minimum contract coverage on recruitment

New immediate acquisitions cover at least the active season and the following
season. The database normalizes the contract at INSERT, before salary scheduling
and roster capacity checks. This covers free agents, both auction types, direct
transfers, both sides of an exchange, instant academy promotions and season draft.

Longer contracts keep their agreed duration. Initial squad allocation, renewals,
future/planned arrivals and scheduled academy promotions during rollover keep
their existing rules. Activation or other UPDATE operations never add another
year. There is no backfill of previously signed contracts.

The new year reserves an actual future roster slot and carries the normal salary
installments, without changing the agreed transfer fee or seasonal wage. A full
future roster or conflicting commitment rejects the transaction atomically. The
draft and exchange preflight checks now include the incoming rider in next
season's roster. Offer screens and recruitment messages state the actual term.

A season row lock with NOWAIT protects acquisition against rollover; submissions
using an old-season context fail with a refresh message. Creating a missing next
season only creates its identity, without provisioning the complete race calendar.

## Validation

- `scripts/test-recruitment-contract-minimum-sql.mjs`: isolated PGlite integration
  using versioned contract, transfer, roster, finance and draft business code.
- `scripts/test-deferred-direct-transfers-sql.mjs`: existing future-transfer and
  lifecycle regressions, now also loading the minimum policy.
- Existing offer composer, offer terms and draft component tests; ESLint; i18n.
- PGlite tests prove transactional outcomes, not multi-session concurrency.

Use `TRADE_SQL_TEST_MODULE` to point to an available local PGlite module; these
tests have no production credentials or network access.

## Delivery

`scripts/deliver-recruitment-contract-minimum.mjs` supports `--preflight`,
`--apply-reviewed`, and `--verify`, followed by the linked Supabase workdir.
It checks the exact reviewed SQL hash, inspects production metadata read-only,
applies only this migration with bounded waits and records its receipt in the
same transaction. It verifies all patched function bodies and unrelated contract
functions, the INSERT-only trigger, existing draft/capacity guards, database
connectivity and the public application. No live gameplay fixture is run.
