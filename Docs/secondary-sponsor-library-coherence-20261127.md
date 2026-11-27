# Secondary sponsor identities and seasonal jerseys

The former catalogue repeated ten brand templates for every country. Removing
the country suffix made those independent records display the same brand and
logo, and affinity-based offers could select the same template three times.
New offers now reference the existing principal sponsor library: one source
sponsor, country, name and existing logo. The reviewed snapshot contains 630
brands; production preflight found 600 matching active registry entries, no
country/name mismatches, and 30 brands not yet imported into the registry. The
fix never imports or invents missing principal sponsors.

Canonical entries have a unique source sponsor and case-insensitive brand name.
Their country is immutable, and source rebranding/status updates synchronize
the same identity. Retired templates remain readable for the four existing
signed agreements. Only unsigned future template offers are withdrawn; their
records remain available for audit. Generation V3 selects three distinct
canonical brands and excludes the team's principal sponsor. Existing budget,
nationality, permission and atomic replacement rules remain enforced.

The current season uses its selected principal jersey. Future placements use
the selected future principal contract, or an explicit pending jersey for that
exact season on a continuing contract. Without that choice the UI links to the
jersey selector instead of substituting the current jersey. The database enforces
the same rule when saving, including legacy five-argument compatibility.

Actual logos are reused in the editor and in active team/rider identity. Six
opaque logo backgrounds have small, precomputed colour metadata for a browser
SVG monochrome mask; no bitmap is changed and there is no runtime image job.
Legacy agreements retain their original logos. Current-season reads remain
separate from future plans, and frozen race snapshots are not rewritten.

Normal saved-offer reads retain the calendar-free path. Full catalogue reads
occur only when generating offers and now filter to canonical available brands
(600 production rows instead of 2,490 template rows). No per-rider lookup or
additional jersey query was introduced. Static logo files bypass Vercel image
transformation.

Validation includes the BE/TZ/MZ duplicate regression, real library assets,
principal-brand exclusion, current/future jersey isolation, monochrome pixel
checks, and two isolated PostgreSQL suites (56 and 32 assertions). Production
delivery installs only migrations 20261127180000 and 20261127181000, pinned by
SHA-256, with bounded waits and before/after signed-agreement fingerprints.
No production fixture, signing, reward claim or race replay is performed.
