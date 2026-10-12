# S4 Olympic road programme — 12 October 2026

## Scope

One professional road discipline (no Olympic ITT), reusing `nc-hills` and its eight division/group heats. The immutable Nations Cup allocation is retained, with one rider per federation. Junior Nations Cup, continental/world championships and normal-season five-discipline Nations Cups are unchanged.

194 km: three long climbs (9 km at 6.5%, 10 km at 6%, 8 km at 7%), three shorter hills, three cobbled sectors totalling 19 km, and an 8 km flat finish. Authored descents keep the course's altitude continuous. No global simulation-engine changes or forced winner restrictions.

## Callup safety

- Shared SQL availability gate covers target resolution, deadlines, manual save, automatic callups and replacements; obsolete direct requests cannot recreate cancelled disciplines.
- Confirmed road selection/member, stage and registration IDs remain unchanged. Four other disciplines are cancelled/withdrawn, never deleted; obsolete invitations are archived. A private targeted before-image is saved in `quadrennial_programme_migration_audits`.
- Existing ownership checks across nationalities, explicit DS approval, deadline H−1, quota, locks, refused-rider exclusion and idempotent notifications remain intact.
- Automatic and replacement selections use a balanced MO/VAL/PAV/END/RES/SPR/ACC score only for Olympic road.
- Normal H−24 automatic jobs remain in control; migration creates no new callups, starts no races and triggers no rollover.
- Rollover ignores cancelled disciplines and accepts the single completed Olympic discipline, keeping normal Nations Cup completeness rules.
- Calendar/profile cache namespace refreshed so preserved stage IDs cannot display the old 55 km hills route.

## Verification and installation

`node scripts/test-local-olympic-selections.mjs C:/Dev/.tmp-chat-translation-sql-20261005/node_modules/@electric-sql/pglite/dist/index.js`

51 isolated SQL assertions: real save/publish/respond/sync/automatic/refill/target/schedule/seed functions; approval and replacement across nationalities, no duplicates, deadline refusal, blocked-tour acceptance rollback, retained identities, old events not resurrected, exact group mapping, and future-season initialization. Unrelated qualification/auth/race-camp hooks use documented local doubles; no production fixtures.

289 targeted application/engine tests passed before merge, including six complete simulations on the authored route. Guide/cache/Olympic follow-up suite: 10 tests passed after integrating main. Targeted ESLint passed. No full local Next build (cloud deployment validates the production build).

Reviewed migration `20261012130000_single_hybrid_olympic_road_event` installed and recorded through `apply-reviewed-olympic-road-programme.mjs`, run from the linked gala checkout. Read-only diagnostics sequential and bounded to 5s; migration lock wait 3s, statements 15s, refuses any live/result/simulation/claim.

Production receipt: 8 road heats, all mixed/194 km with 19 km cobbles; 0 obsolete active editions/calls, 0 changed retained road members, 0 missing stage IDs and 0 unexpected results. Ownership/deadline/startlist/ranking SQL hashes and function permissions preserved.

App deployment verification is recorded below once Vercel reaches READY and the canonical site is healthy.
