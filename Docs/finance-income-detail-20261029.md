# More precise finance income categories

The income chart previously put game-objective and newcomer rewards into
`other`, despite their stable ledger source references. Rivalry payments
could also appear as race prize money because the reward ledger uses the
generic `race_prize` category.

The analysis now recognizes these sources before applying the generic
ledger category:

| Source | Chart category |
| --- | --- |
| `objective:`, `newcomer-journey:` | Objectifs accomplis |
| `team-rivalry:` | Rivalités |
| `federation-solidarity:` | Aides de la fédération |
| `understaffed-roster-aid:` | Aides à l’équipe |
| `rookie-season-reward:`, `division-bonus:` | Primes de fin de saison |
| `development-event-reward:` | Courses juniors |

These references are recognized both directly and with the reward ledger's
`reward:` prefix. Sponsor objectives remain with sponsors; reimbursements
retain priority. Medical and night-auction trophy rewards are recognized
as non-race rewards. Unknown references are not guessed from descriptions.

Residual other income has a native disclosure listing ledger descriptions
and amounts, grouping repeated descriptions and separating amounts still
pending. Descriptions are rendered as escaped React text; internal source
references are not exposed. Missing descriptions have a neutral fallback.

The chart stays visible alongside the longer category list on desktop.
Mobile keeps its existing single-column layout. Each SVG tooltip is one
text string, avoiding React 19's title-array hydration mismatch found during
visual verification.

## Scope and verification

No payment, balance, accounting status or settlement rule changes. All
calculations use the transactions already loaded by the finance page. No
new SQL, remote calls or client-side JavaScript is added. Breakdown amounts
and residual details are accumulated in cents in the existing pass.

96 targeted tests cover source classification, boundary references, sponsor
and refund precedence, exact totals, pending/posted distinctions,
cancellations, description grouping/escaping, rendering, financial-director
projections and finance-page/service behavior. English catalog coverage and
ESLint are checked.

A bounded read-only audit of Zocoto's active-season ledger supplied 475
positive entries. Offline old/new classification preserves all totals and
identifies EUR 1,379,500 of objective rewards previously in other income.
The audit does not settle finances or write gameplay data. Evidence is saved
locally under `C:/Dev/artifacts/finance-income-detail-20261029/`.

`/apercus/finances-recettes` uses synthetic local data only and returns 404
in production. Browser checks cover desktop, 390px and 320px widths and the
native residual-income disclosure.
