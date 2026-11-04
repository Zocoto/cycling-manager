# International events: no UCI points from S4

## Rule and confirmed inconsistency

Jeux quadriennaux (road and TT), world championships and continental
championships must not award UCI points in the current S4 or subsequent seasons.
The CM/CC calculator and public reward tables still contained their former UCI
scale (winner: 650 CM / 280 CC in S4). The existing S4 national registrations
have no club account and skipped the ordinary reward path, so those points were
not actually credited. The Games already had an explicit zero-UCI cash-only
settlement. Depending on a missing club context was not a durable rule.

## Correction

- S4+ CM/CC scale entries contain zero UCI points. The calculator also enforces
  zero independently of the selected placement; an omitted game year uses the
  current zero-UCI policy. Explicit S1–S3 historical scales stay available.
- Race dotations and the guide state **Aucun point UCI attribué.**
- The international footer no longer suggests that points are credited to riders.
- The existing official club and free-agent reward entry points clamp UCI to
  zero for S4+ world/continental/nations-cup competitions. This also protects
  against stale app clients sending the old positive amounts.
- Competition identity is resolved in the existing indexed roster context
  query. No new per-rider query, RPC, trigger, table or ranking rebuild is added.
- Cash, XP, reputation, victories, titles, Games cash settlements and ordinary
  races keep their previous behavior. The complete S3 continental reward void
  and explicit historical accounting are preserved.

Migration: `20261104120000_prevent_international_uci_points.sql`.
The guarded patch changes only the reviewed context lookup and UCI argument in
the two existing wrappers, preserving their signatures, ACLs and search paths.

## Verification

- 355 isolated PostgreSQL assertions execute the real reward/finance functions:
  stale UCI inputs are blocked in both club and free-agent paths, while ordinary
  races, cash/XP/reputation, victories, retries, S3's exception and historical
  seasons retain their previous results. S4, S5 and S8 are covered.
- 79 application tests cover all CM/CC places through rank 40 in S4/S5/S8,
  historical scales, ordinary economics, Games cash rewards and the displayed
  reward tables.
- TypeScript, targeted ESLint, translation coverage and diff checks pass.
- A bounded, indexed read-only audit covers the official reward prefixes of all
  14 completed professional international editions in the active S4. It finds
  zero UCI credited, including the 235 recorded Games club rewards. Therefore
  no account, points or ranking correction is needed or performed.
- Installation is atomic with its migration receipt, protects the reviewed live
  function hashes, limits lock waits to 500 ms and execution to 5 seconds, then
  verifies both guards, unchanged access controls and auth/site availability.

Production evidence is stored in ignored
`artifacts/international-uci-check-20261104/`.

```powershell
node scripts/test-international-no-uci.mjs <local-pglite-module>
node scripts/deliver-international-no-uci.mjs --verify
```
